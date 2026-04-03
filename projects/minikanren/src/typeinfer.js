/**
 * Type Inference via miniKanren
 * 
 * A relational type checker for a simple typed lambda calculus.
 * Uses tagged representations for all values:
 *   ['num', n]           — number literal
 *   ['bool', b]          — boolean literal
 *   ['var', x]           — variable reference
 *   ['lam', x, body]     — lambda abstraction
 *   ['app', fn, arg]     — application
 *   ['if', c, t, e]      — conditional
 * 
 * Types:
 *   'int' | 'bool' | ['arrow', t1, t2]
 */

const {
  eq, fresh, conde, conj, run, runAll, toList, fromList,
  conso, firsto, resto, emptyo, zzz, succeed, fail, neq
} = require('../src/index.js');

// ─── Environment (linked list of [name, type] pairs) ─

function lookupo(x, env, t) {
  return fresh((head, rest) => conj(
    conso(head, rest, env),
    conde(
      [eq(head, [x, t])],
      [fresh((other, otherT) => conj(
        eq(head, [other, otherT]),
        neq(other, x),
        zzz(() => lookupo(x, rest, t))
      ))]
    )
  ));
}

// ─── typeo(env, expr, type) ─────────────────────────

function typeo(env, expr, type) {
  return conde(
    // Number literal: ['num', _] has type 'int'
    [fresh(n => conj(eq(expr, ['num', n]), eq(type, 'int')))],
    
    // Boolean literal: ['bool', _] has type 'bool'
    [fresh(b => conj(eq(expr, ['bool', b]), eq(type, 'bool')))],
    
    // Variable: ['var', x] — look up in env
    [fresh(x => conj(eq(expr, ['var', x]), lookupo(x, env, type)))],
    
    // Lambda: ['lam', x, body] has type ['arrow', tArg, tBody]
    [fresh((x, body, tArg, tBody, newEnv) => conj(
      eq(expr, ['lam', x, body]),
      eq(type, ['arrow', tArg, tBody]),
      conso([x, tArg], env, newEnv),
      zzz(() => typeo(newEnv, body, tBody))
    ))],
    
    // Application: ['app', fn, arg]
    [fresh((fn, arg, tArg) => conj(
      eq(expr, ['app', fn, arg]),
      zzz(() => typeo(env, fn, ['arrow', tArg, type])),
      zzz(() => typeo(env, arg, tArg))
    ))],
    
    // If-then-else: ['if', cond, then, else]
    [fresh((cond, then, els) => conj(
      eq(expr, ['if', cond, then, els]),
      zzz(() => typeo(env, cond, 'bool')),
      zzz(() => typeo(env, then, type)),
      zzz(() => typeo(env, els, type))
    ))]
  );
}

// Convenience: type check with empty env
function typeCheck(expr) {
  return run(1, t => typeo(null, expr, t));
}

module.exports = { typeo, lookupo, typeCheck };
