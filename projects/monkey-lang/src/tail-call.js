// tail-call.js — Tail Call Optimization for Monkey AST
//
// Detects tail-recursive functions and converts them to loops.
// This prevents stack overflow for recursive algorithms like factorial, fibonacci.
//
// Algorithm:
// 1. Find function literals bound to a name (let f = fn(...) { ... })
// 2. Check if the function body has a tail call to itself
// 3. Transform: replace tail-recursive call with parameter reassignment + loop

import * as ast from './ast.js';

/**
 * Check if an expression is in tail position and is a self-call
 */
function isTailCall(expr, fnName) {
  if (!expr) return false;

  // Direct call to self
  if (expr instanceof ast.CallExpression) {
    if (expr.function instanceof ast.Identifier && expr.function.value === fnName) {
      return true;
    }
    return false;
  }

  // If expression: check both branches
  if (expr instanceof ast.IfExpression) {
    const consTail = isTailCallInBlock(expr.consequence, fnName);
    const altTail = expr.alternative ? isTailCallInBlock(expr.alternative, fnName) : false;
    return consTail || altTail;
  }

  return false;
}

function isTailCallInBlock(block, fnName) {
  if (!block || !block.statements || block.statements.length === 0) return false;
  const lastStmt = block.statements[block.statements.length - 1];
  
  if (lastStmt instanceof ast.ReturnStatement) {
    return isTailCall(lastStmt.returnValue, fnName);
  }
  if (lastStmt instanceof ast.ExpressionStatement) {
    return isTailCall(lastStmt.expression, fnName);
  }
  return false;
}

/**
 * Check if a function is tail-recursive
 */
export function isTailRecursive(fnNode, fnName) {
  if (!fnNode.body || !fnNode.body.statements) return false;
  return isTailCallInBlock(fnNode.body, fnName);
}

/**
 * Transform tail-recursive function to use a loop.
 * Creates: fn(params) { while(true) { ... params = newArgs; continue ... } }
 */
export function optimizeTailCall(program) {
  if (!program || !program.statements) return program;

  for (const stmt of program.statements) {
    if (stmt instanceof ast.LetStatement && stmt.value instanceof ast.FunctionLiteral) {
      const fnName = stmt.name.value;
      const fn = stmt.value;

      if (isTailRecursive(fn, fnName)) {
        transformTailRecursive(fn, fnName);
        fn._tailCallOptimized = true;
      }
    }
  }

  return program;
}

/**
 * Perform the actual transformation on a tail-recursive function
 */
function transformTailRecursive(fn, fnName) {
  // The idea:
  // Original: fn(x, y) { if (cond) { base } else { f(newX, newY) } }
  // Becomes:  fn(x, y) { while(true) { if (cond) { return base } else { x=newX; y=newY; continue } } }
  
  // We can't easily restructure the AST into a while loop without having while/continue nodes.
  // Instead, we'll mark tail calls with a special flag that the compiler can recognize
  // and emit as a loop + branch instead of a function call.
  
  markTailCalls(fn.body, fnName, fn.parameters);
}

function markTailCalls(block, fnName, params) {
  if (!block || !block.statements) return;
  
  for (const stmt of block.statements) {
    if (stmt instanceof ast.ReturnStatement) {
      markTailCallExpr(stmt.returnValue, fnName, params);
    } else if (stmt instanceof ast.ExpressionStatement) {
      markTailCallExpr(stmt.expression, fnName, params);
    }
  }
}

function markTailCallExpr(expr, fnName, params) {
  if (!expr) return;

  if (expr instanceof ast.CallExpression) {
    if (expr.function instanceof ast.Identifier && expr.function.value === fnName) {
      // Mark this call as a tail call
      expr._isTailCall = true;
      expr._tailCallParams = params;
    }
  }

  if (expr instanceof ast.IfExpression) {
    if (expr.consequence) markTailCalls(expr.consequence, fnName, params);
    if (expr.alternative) markTailCalls(expr.alternative, fnName, params);
  }
}

/**
 * Count tail-recursive functions found (for testing)
 */
export function countTailRecursive(program) {
  let count = 0;
  if (!program || !program.statements) return 0;
  
  for (const stmt of program.statements) {
    if (stmt instanceof ast.LetStatement && stmt.value instanceof ast.FunctionLiteral) {
      if (isTailRecursive(stmt.value, stmt.name.value)) {
        count++;
      }
    }
  }
  return count;
}
