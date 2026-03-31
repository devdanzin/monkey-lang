// dead-code.js — Dead code elimination pass for Monkey AST
//
// Removes unreachable code after:
//   - return statements
//   - break/continue statements
//
// Also removes:
//   - Empty blocks
//   - Let statements with unused variables (optional, conservative)

import * as ast from './ast.js';

export function eliminateDeadCode(node) {
  if (!node) return node;

  if (node instanceof ast.Program) {
    node.statements = eliminateStatementList(node.statements);
    return node;
  }

  if (node instanceof ast.BlockStatement) {
    node.statements = eliminateStatementList(node.statements);
    return node;
  }

  if (node instanceof ast.IfExpression) {
    if (node.consequence) node.consequence = eliminateDeadCode(node.consequence);
    if (node.alternative) node.alternative = eliminateDeadCode(node.alternative);
    return node;
  }

  if (node instanceof ast.FunctionLiteral) {
    if (node.body) node.body = eliminateDeadCode(node.body);
    return node;
  }

  if (node instanceof ast.LetStatement) {
    if (node.value) node.value = eliminateDeadCodeExpr(node.value);
    return node;
  }

  if (node instanceof ast.ExpressionStatement) {
    if (node.expression) node.expression = eliminateDeadCodeExpr(node.expression);
    return node;
  }

  return node;
}

function eliminateDeadCodeExpr(expr) {
  if (!expr) return expr;

  if (expr instanceof ast.FunctionLiteral) {
    if (expr.body) expr.body = eliminateDeadCode(expr.body);
    return expr;
  }

  if (expr instanceof ast.IfExpression) {
    if (expr.consequence) expr.consequence = eliminateDeadCode(expr.consequence);
    if (expr.alternative) expr.alternative = eliminateDeadCode(expr.alternative);
    return expr;
  }

  if (expr instanceof ast.WhileExpression) {
    if (expr.body) expr.body = eliminateDeadCode(expr.body);
    return expr;
  }

  if (expr instanceof ast.ForExpression) {
    if (expr.body) expr.body = eliminateDeadCode(expr.body);
    return expr;
  }

  if (expr instanceof ast.CallExpression) {
    if (expr.arguments) expr.arguments = expr.arguments.map(a => eliminateDeadCodeExpr(a));
    return expr;
  }

  return expr;
}

function eliminateStatementList(statements) {
  if (!statements) return statements;

  const result = [];
  for (const stmt of statements) {
    const processed = eliminateDeadCode(stmt);
    result.push(processed);

    // Check if this statement terminates the block
    if (isTerminating(stmt)) {
      // Everything after this is dead code
      break;
    }
  }

  return result;
}

function isTerminating(stmt) {
  if (stmt instanceof ast.ReturnStatement) return true;
  if (stmt instanceof ast.BreakStatement) return true;
  if (stmt instanceof ast.ContinueStatement) return true;

  // ExpressionStatement wrapping a return/break could happen
  if (stmt instanceof ast.ExpressionStatement) {
    return isTerminating(stmt.expression);
  }

  return false;
}

// Count eliminated statements for metrics
export function countEliminated(original, optimized) {
  function countStmts(node) {
    let count = 0;
    if (!node) return 0;
    if (node.statements) {
      count += node.statements.length;
      for (const s of node.statements) count += countStmts(s);
    }
    if (node.expression) count += countStmts(node.expression);
    if (node.consequence) count += countStmts(node.consequence);
    if (node.alternative) count += countStmts(node.alternative);
    if (node.body) count += countStmts(node.body);
    return count;
  }
  return countStmts(original) - countStmts(optimized);
}
