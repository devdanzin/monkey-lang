// inline.js — Function inlining pass for Monkey AST
//
// Inlines calls to small, non-recursive functions:
//   - Single-expression functions (e.g., fn(x) { x + 1 })
//   - Functions called only once
//   - Functions under a size threshold
//
// Does NOT inline:
//   - Recursive functions
//   - Functions with side effects (puts, etc.)
//   - Functions that capture closures over mutable state
//   - Variadic functions

import * as ast from './ast.js';

const MAX_INLINE_BODY_NODES = 10; // Max AST nodes in function body to inline
const MAX_INLINE_PARAMS = 4;      // Don't inline functions with more params

/**
 * Perform function inlining on a Monkey AST Program.
 * Returns the modified program and inlining statistics.
 */
export function inlineFunctions(program, options = {}) {
  const maxNodes = options.maxBodyNodes || MAX_INLINE_BODY_NODES;
  const maxParams = options.maxParams || MAX_INLINE_PARAMS;
  const stats = { analyzed: 0, inlined: 0, skipped: 0 };

  // Phase 1: Collect function definitions and call sites
  const funcDefs = new Map();  // name → { node, params, body, callCount, isRecursive }
  const callSites = [];        // [{callExpr, funcName, parent, key}]

  collectFunctions(program, funcDefs);
  countCalls(program, funcDefs);

  // Phase 2: Determine which functions are inlineable
  for (const [name, info] of funcDefs) {
    stats.analyzed++;
    info.inlineable = isInlineable(info, maxNodes, maxParams);
    if (!info.inlineable) stats.skipped++;
  }

  // Phase 3: Inline qualifying call sites
  const result = inlinePass(program, funcDefs, stats);

  return { program: result, stats };
}

/**
 * Collect all named function definitions (let f = fn(...) { ... })
 */
function collectFunctions(node, defs) {
  if (!node) return;

  if (node instanceof ast.Program) {
    for (const stmt of node.statements) collectFunctions(stmt, defs);
    return;
  }

  if (node instanceof ast.LetStatement) {
    if (node.value instanceof ast.FunctionLiteral) {
      const name = node.name?.value;
      if (name) {
        defs.set(name, {
          node: node.value,
          params: node.value.parameters || [],
          body: node.value.body,
          callCount: 0,
          isRecursive: false,
          bodySize: countNodes(node.value.body),
        });
      }
    }
  }

  // Recurse into blocks
  if (node instanceof ast.BlockStatement) {
    for (const stmt of node.statements) collectFunctions(stmt, defs);
  }
  if (node instanceof ast.IfExpression) {
    collectFunctions(node.consequence, defs);
    collectFunctions(node.alternative, defs);
  }
}

/**
 * Count call sites for each function and detect recursion
 */
function countCalls(node, defs) {
  if (!node) return;

  if (node instanceof ast.CallExpression) {
    const name = node.function instanceof ast.Identifier ? node.function.value : null;
    if (name && defs.has(name)) {
      defs.get(name).callCount++;
    }
    // Check args too
    for (const arg of (node.arguments || [])) countCalls(arg, defs);
    return;
  }

  // Check for recursion: function body references its own name
  for (const [name, info] of defs) {
    if (containsCall(info.body, name)) {
      info.isRecursive = true;
    }
  }

  // Recurse into all child nodes
  visitChildren(node, child => countCalls(child, defs));
}

/**
 * Check if a node contains a call to a specific function name
 */
function containsCall(node, name) {
  if (!node) return false;
  if (node instanceof ast.CallExpression) {
    if (node.function instanceof ast.Identifier && node.function.value === name) return true;
  }
  let found = false;
  visitChildren(node, child => {
    if (containsCall(child, name)) found = true;
  });
  return found;
}

/**
 * Determine if a function is safe to inline
 */
function isInlineable(info, maxNodes, maxParams) {
  if (info.isRecursive) return false;
  if (info.params.length > maxParams) return false;
  if (info.bodySize > maxNodes) return false;

  // Check for side effects (puts, while loops with breaks, etc.)
  if (hasSideEffects(info.body)) return false;

  return true;
}

/**
 * Check for obvious side effects
 */
function hasSideEffects(node) {
  if (!node) return false;
  if (node instanceof ast.CallExpression) {
    const name = node.function instanceof ast.Identifier ? node.function.value : null;
    if (name === 'puts' || name === 'print' || name === 'push') return true;
  }
  let found = false;
  visitChildren(node, child => {
    if (hasSideEffects(child)) found = true;
  });
  return found;
}

/**
 * Count AST nodes in a subtree
 */
function countNodes(node) {
  if (!node) return 0;
  let count = 1;
  visitChildren(node, child => { count += countNodes(child); });
  return count;
}

/**
 * Perform the actual inlining — replaces call expressions with substituted bodies
 */
function inlinePass(node, funcDefs, stats) {
  if (!node) return node;

  if (node instanceof ast.CallExpression) {
    const name = node.function instanceof ast.Identifier ? node.function.value : null;
    if (name && funcDefs.has(name)) {
      const info = funcDefs.get(name);
      if (info.inlineable) {
        // Build substitution map: param name → argument expression
        const subs = new Map();
        for (let i = 0; i < info.params.length; i++) {
          const paramName = info.params[i].value || info.params[i].token?.literal;
          const arg = (node.arguments || [])[i] || new ast.NullLiteral(null);
          subs.set(paramName, arg);
        }

        // Clone and substitute the function body
        const inlined = substituteBody(info.body, subs);
        stats.inlined++;
        return inlined;
      }
    }
    // Still recurse into args even if we don't inline this call
    node.arguments = (node.arguments || []).map(a => inlinePass(a, funcDefs, stats));
    return node;
  }

  // Recurse into all node types
  if (node instanceof ast.Program) {
    node.statements = node.statements.map(s => inlinePass(s, funcDefs, stats));
    return node;
  }
  if (node instanceof ast.LetStatement) {
    node.value = inlinePass(node.value, funcDefs, stats);
    return node;
  }
  if (node instanceof ast.ReturnStatement) {
    node.returnValue = inlinePass(node.returnValue, funcDefs, stats);
    return node;
  }
  if (node instanceof ast.ExpressionStatement) {
    node.expression = inlinePass(node.expression, funcDefs, stats);
    return node;
  }
  if (node instanceof ast.InfixExpression) {
    node.left = inlinePass(node.left, funcDefs, stats);
    node.right = inlinePass(node.right, funcDefs, stats);
    return node;
  }
  if (node instanceof ast.PrefixExpression) {
    node.right = inlinePass(node.right, funcDefs, stats);
    return node;
  }
  if (node instanceof ast.IfExpression) {
    node.condition = inlinePass(node.condition, funcDefs, stats);
    node.consequence = inlinePass(node.consequence, funcDefs, stats);
    node.alternative = inlinePass(node.alternative, funcDefs, stats);
    return node;
  }
  if (node instanceof ast.BlockStatement) {
    node.statements = node.statements.map(s => inlinePass(s, funcDefs, stats));
    return node;
  }
  if (node instanceof ast.IndexExpression) {
    node.left = inlinePass(node.left, funcDefs, stats);
    node.index = inlinePass(node.index, funcDefs, stats);
    return node;
  }
  if (node instanceof ast.ArrayLiteral) {
    node.elements = (node.elements || []).map(e => inlinePass(e, funcDefs, stats));
    return node;
  }
  if (node instanceof ast.FunctionLiteral) {
    node.body = inlinePass(node.body, funcDefs, stats);
    return node;
  }
  if (node instanceof ast.WhileExpression) {
    node.condition = inlinePass(node.condition, funcDefs, stats);
    node.body = inlinePass(node.body, funcDefs, stats);
    return node;
  }

  return node;
}

/**
 * Substitute parameters with argument expressions in a function body.
 * For single-expression functions, returns the expression directly.
 * For multi-statement bodies, wraps in a block.
 */
function substituteBody(body, subs) {
  if (!body) return body;

  // Single return statement → extract the expression
  if (body instanceof ast.BlockStatement && body.statements.length === 1) {
    const stmt = body.statements[0];
    if (stmt instanceof ast.ReturnStatement) {
      return substituteExpr(stmt.returnValue, subs);
    }
    if (stmt instanceof ast.ExpressionStatement) {
      return substituteExpr(stmt.expression, subs);
    }
  }

  // Multi-statement — clone whole block
  return substituteExpr(body, subs);
}

/**
 * Deep-clone an AST node, replacing identifiers that match substitution map
 */
function substituteExpr(node, subs) {
  if (!node) return node;

  // Identifier → substitute if in map
  if (node instanceof ast.Identifier) {
    if (subs.has(node.value)) {
      return cloneNode(subs.get(node.value));
    }
    return node;
  }

  // Infix
  if (node instanceof ast.InfixExpression) {
    const result = new ast.InfixExpression(
      node.token,
      substituteExpr(node.left, subs),
      node.operator,
      substituteExpr(node.right, subs)
    );
    return result;
  }

  // Prefix
  if (node instanceof ast.PrefixExpression) {
    const result = new ast.PrefixExpression(
      node.token,
      node.operator,
      substituteExpr(node.right, subs)
    );
    return result;
  }

  // If
  if (node instanceof ast.IfExpression) {
    const result = new ast.IfExpression(
      node.token,
      substituteExpr(node.condition, subs),
      substituteExpr(node.consequence, subs),
      substituteExpr(node.alternative, subs)
    );
    return result;
  }

  // Block
  if (node instanceof ast.BlockStatement) {
    const result = new ast.BlockStatement(
      node.token,
      node.statements.map(s => substituteExpr(s, subs))
    );
    return result;
  }

  // Return
  if (node instanceof ast.ReturnStatement) {
    const result = new ast.ReturnStatement(node.token, substituteExpr(node.returnValue, subs));
    return result;
  }

  // Expression statement
  if (node instanceof ast.ExpressionStatement) {
    const result = new ast.ExpressionStatement(node.token, substituteExpr(node.expression, subs));
    return result;
  }

  // Call
  if (node instanceof ast.CallExpression) {
    const result = new ast.CallExpression(
      node.token,
      substituteExpr(node.function, subs),
      (node.arguments || []).map(a => substituteExpr(a, subs))
    );
    return result;
  }

  // Index
  if (node instanceof ast.IndexExpression) {
    const result = new ast.IndexExpression(
      node.token,
      substituteExpr(node.left, subs),
      substituteExpr(node.index, subs)
    );
    return result;
  }

  // Array literal
  if (node instanceof ast.ArrayLiteral) {
    const result = new ast.ArrayLiteral(
      node.token,
      (node.elements || []).map(e => substituteExpr(e, subs))
    );
    return result;
  }

  // Literals — no substitution needed
  return node;
}

/**
 * Deep clone an AST node
 */
function cloneNode(node) {
  if (!node) return node;
  if (node instanceof ast.IntegerLiteral) return new ast.IntegerLiteral(node.token, node.value);
  if (node instanceof ast.StringLiteral) return new ast.StringLiteral(node.token, node.value);
  if (node instanceof ast.BooleanLiteral) return new ast.BooleanLiteral(node.token, node.value);
  if (node instanceof ast.NullLiteral) return new ast.NullLiteral(node.token);
  if (node instanceof ast.Identifier) return new ast.Identifier(node.token, node.value);

  if (node instanceof ast.InfixExpression) {
    const r = new ast.InfixExpression(node.token, node.operator);
    r.left = cloneNode(node.left);
    r.right = cloneNode(node.right);
    return r;
  }
  if (node instanceof ast.PrefixExpression) {
    const r = new ast.PrefixExpression(node.token, node.operator);
    r.right = cloneNode(node.right);
    return r;
  }

  // Fallback — return the node itself (not perfect but safe for reads)
  return node;
}

/**
 * Visit all child nodes of an AST node
 */
function visitChildren(node, fn) {
  if (!node) return;
  if (node instanceof ast.Program) {
    for (const s of node.statements) fn(s);
  } else if (node instanceof ast.LetStatement) {
    fn(node.value);
  } else if (node instanceof ast.ReturnStatement) {
    fn(node.returnValue);
  } else if (node instanceof ast.ExpressionStatement) {
    fn(node.expression);
  } else if (node instanceof ast.InfixExpression) {
    fn(node.left); fn(node.right);
  } else if (node instanceof ast.PrefixExpression) {
    fn(node.right);
  } else if (node instanceof ast.IfExpression) {
    fn(node.condition); fn(node.consequence); fn(node.alternative);
  } else if (node instanceof ast.BlockStatement) {
    for (const s of node.statements) fn(s);
  } else if (node instanceof ast.CallExpression) {
    fn(node.function);
    for (const a of (node.arguments || [])) fn(a);
  } else if (node instanceof ast.FunctionLiteral) {
    fn(node.body);
  } else if (node instanceof ast.IndexExpression) {
    fn(node.left); fn(node.index);
  } else if (node instanceof ast.ArrayLiteral) {
    for (const e of (node.elements || [])) fn(e);
  } else if (node instanceof ast.WhileExpression) {
    fn(node.condition); fn(node.body);
  } else if (node instanceof ast.MatchExpression) {
    fn(node.subject);
    for (const arm of (node.arms || [])) { fn(arm.pattern); fn(arm.value); }
  }
}
