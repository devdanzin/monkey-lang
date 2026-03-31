// constant-fold.js — Constant folding optimization pass for Monkey AST
//
// Evaluates constant expressions at compile time:
//   2 + 3  →  5
//   "hello" + " world"  →  "hello world"
//   !true  →  false
//   -(5)   →  -5
//
// Runs as an AST transformation pass before compilation.

import * as ast from './ast.js';

export function constantFold(node) {
  if (!node) return node;

  // Fold arrays recursively
  if (node instanceof ast.Program) {
    node.statements = node.statements.map(s => constantFold(s));
    return node;
  }

  if (node instanceof ast.ExpressionStatement) {
    node.expression = constantFold(node.expression);
    return node;
  }

  if (node instanceof ast.LetStatement) {
    node.value = constantFold(node.value);
    return node;
  }

  if (node instanceof ast.ReturnStatement) {
    node.returnValue = constantFold(node.returnValue);
    return node;
  }

  if (node instanceof ast.BlockStatement) {
    node.statements = node.statements.map(s => constantFold(s));
    return node;
  }

  if (node instanceof ast.IfExpression) {
    node.condition = constantFold(node.condition);
    if (node.consequence) node.consequence = constantFold(node.consequence);
    if (node.alternative) node.alternative = constantFold(node.alternative);

    // If condition is a constant, eliminate dead branch
    if (node.condition instanceof ast.BooleanLiteral) {
      if (node.condition.value) {
        return node.consequence || node;
      } else {
        return node.alternative || new ast.IntegerLiteral(null, 0);
      }
    }
    return node;
  }

  if (node instanceof ast.ArrayLiteral) {
    if (node.elements) node.elements = node.elements.map(e => constantFold(e));
    return node;
  }

  if (node instanceof ast.HashLiteral) {
    if (node.pairs) {
      const newPairs = new Map();
      for (const [k, v] of node.pairs) {
        newPairs.set(constantFold(k), constantFold(v));
      }
      node.pairs = newPairs;
    }
    return node;
  }

  if (node instanceof ast.CallExpression) {
    if (node.arguments) node.arguments = node.arguments.map(a => constantFold(a));
    return node;
  }

  if (node instanceof ast.IndexExpression) {
    node.left = constantFold(node.left);
    node.index = constantFold(node.index);
    return node;
  }

  if (node instanceof ast.FunctionLiteral) {
    if (node.body) node.body = constantFold(node.body);
    return node;
  }

  // Fold prefix expressions
  if (node instanceof ast.PrefixExpression) {
    node.right = constantFold(node.right);
    
    if (node.operator === '-' && node.right instanceof ast.IntegerLiteral) {
      return new ast.IntegerLiteral(node.token, -node.right.value);
    }
    if (node.operator === '!' && node.right instanceof ast.BooleanLiteral) {
      return new ast.BooleanLiteral(node.token, !node.right.value);
    }
    if (node.operator === '!' && node.right instanceof ast.IntegerLiteral) {
      return new ast.BooleanLiteral(node.token, node.right.value === 0);
    }
    return node;
  }

  // Fold infix expressions
  if (node instanceof ast.InfixExpression) {
    node.left = constantFold(node.left);
    node.right = constantFold(node.right);

    const left = node.left;
    const right = node.right;

    // Integer arithmetic
    if (left instanceof ast.IntegerLiteral && right instanceof ast.IntegerLiteral) {
      const a = left.value, b = right.value;
      switch (node.operator) {
        case '+': return new ast.IntegerLiteral(node.token, a + b);
        case '-': return new ast.IntegerLiteral(node.token, a - b);
        case '*': return new ast.IntegerLiteral(node.token, a * b);
        case '/': return b !== 0 ? new ast.IntegerLiteral(node.token, Math.trunc(a / b)) : node;
        case '%': return b !== 0 ? new ast.IntegerLiteral(node.token, a % b) : node;
        case '<': return new ast.BooleanLiteral(node.token, a < b);
        case '>': return new ast.BooleanLiteral(node.token, a > b);
        case '<=': return new ast.BooleanLiteral(node.token, a <= b);
        case '>=': return new ast.BooleanLiteral(node.token, a >= b);
        case '==': return new ast.BooleanLiteral(node.token, a === b);
        case '!=': return new ast.BooleanLiteral(node.token, a !== b);
      }
    }

    // String concatenation
    if (left instanceof ast.StringLiteral && right instanceof ast.StringLiteral) {
      if (node.operator === '+') {
        return new ast.StringLiteral(node.token, left.value + right.value);
      }
      if (node.operator === '==') {
        return new ast.BooleanLiteral(node.token, left.value === right.value);
      }
      if (node.operator === '!=') {
        return new ast.BooleanLiteral(node.token, left.value !== right.value);
      }
    }

    // Boolean operations
    if (left instanceof ast.BooleanLiteral && right instanceof ast.BooleanLiteral) {
      if (node.operator === '==') return new ast.BooleanLiteral(node.token, left.value === right.value);
      if (node.operator === '!=') return new ast.BooleanLiteral(node.token, left.value !== right.value);
      if (node.operator === '&&') return new ast.BooleanLiteral(node.token, left.value && right.value);
      if (node.operator === '||') return new ast.BooleanLiteral(node.token, left.value || right.value);
    }

    // Identity optimizations
    if (right instanceof ast.IntegerLiteral) {
      if (right.value === 0 && node.operator === '+') return left;   // x + 0 → x
      if (right.value === 0 && node.operator === '-') return left;   // x - 0 → x
      if (right.value === 1 && node.operator === '*') return left;   // x * 1 → x
      if (right.value === 0 && node.operator === '*') return new ast.IntegerLiteral(node.token, 0); // x * 0 → 0
    }
    if (left instanceof ast.IntegerLiteral) {
      if (left.value === 0 && node.operator === '+') return right;   // 0 + x → x
      if (left.value === 1 && node.operator === '*') return right;   // 1 * x → x
      if (left.value === 0 && node.operator === '*') return new ast.IntegerLiteral(node.token, 0); // 0 * x → 0
    }

    return node;
  }

  return node;
}

// Count how many folds were applied (for testing/metrics)
export function countFolds(original, folded) {
  let count = 0;
  function walk(a, b) {
    if (!a || !b) return;
    if (a.constructor !== b.constructor) count++;
    // Walk children based on type
    if (a instanceof ast.Program) {
      for (let i = 0; i < (a.statements?.length || 0); i++) {
        walk(a.statements[i], b.statements?.[i]);
      }
    }
  }
  walk(original, folded);
  return count;
}
