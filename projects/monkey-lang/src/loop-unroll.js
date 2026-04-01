// loop-unroll.js — Loop unrolling optimization for Monkey AST
//
// Detects `for (let i = 0; i < N; i = i + 1) { body }` where N is constant
// and unrolls the loop body N times (for small N).
//
// Benefit: eliminates loop overhead (comparison, increment, branch)
// Risk: code size increases, only worth it for small N

import * as ast from './ast.js';

const MAX_UNROLL = 8; // Maximum iterations to unroll

/**
 * Check if a for loop has a constant bound and can be unrolled.
 * Returns the bound if unrollable, or null.
 */
export function getLoopBound(forExpr) {
  if (!(forExpr instanceof ast.ForExpression)) return null;
  
  // Check init: let i = 0
  if (!forExpr.init || !(forExpr.init instanceof ast.LetStatement)) return null;
  if (!(forExpr.init.value instanceof ast.IntegerLiteral)) return null;
  if (forExpr.init.value.value !== 0) return null;
  
  const varName = forExpr.init.name?.value;
  if (!varName) return null;
  
  // Check condition: i < N (where N is constant)
  if (!(forExpr.condition instanceof ast.InfixExpression)) return null;
  if (forExpr.condition.operator !== '<') return null;
  if (!(forExpr.condition.left instanceof ast.Identifier)) return null;
  if (forExpr.condition.left.value !== varName) return null;
  if (!(forExpr.condition.right instanceof ast.IntegerLiteral)) return null;
  
  const bound = forExpr.condition.right.value;
  if (bound <= 0 || bound > MAX_UNROLL) return null;
  
  // Check update: i = i + 1
  if (!(forExpr.update instanceof ast.AssignExpression)) return null;
  
  return bound;
}

/**
 * Count unrollable loops in a program
 */
export function countUnrollable(program) {
  let count = 0;
  
  function walk(node) {
    if (!node) return;
    
    if (node instanceof ast.ForExpression && getLoopBound(node) !== null) {
      count++;
    }
    
    // Walk children
    if (node.statements) node.statements.forEach(walk);
    if (node.expression) walk(node.expression);
    if (node.body) walk(node.body);
    if (node.consequence) walk(node.consequence);
    if (node.alternative) walk(node.alternative);
    if (node.value) walk(node.value);
    if (node.returnValue) walk(node.returnValue);
  }
  
  if (program.statements) program.statements.forEach(walk);
  return count;
}

export { MAX_UNROLL };
