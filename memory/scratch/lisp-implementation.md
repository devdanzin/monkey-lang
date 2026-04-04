# Lisp Implementation Lessons
uses: 1
created: 2026-04-04

## call/cc (Escape Continuations)

- **Simplest approach**: Use JS `throw` to escape. Create a `ContinuationJump` exception class with a unique `tag` (Symbol). When the continuation is called, throw; the `call/cc` handler catches it.
- **Limitation**: This only gives *escape* continuations, not full delimited continuations. The continuation can only be called once, and only to escape upward. For full first-class continuations you need CPS transform.
- **Pattern**: `call/cc` + `set!` can store a continuation for later use, but it won't work with escape-only. True Scheme `call/cc` needs the evaluator to be in CPS.

## Macros (defmacro)

- **Key**: Macros receive *unevaluated* AST nodes. The transformer produces new AST that is then evaluated.
- **Quasiquote**: Reader macros (` ` , ,@) are essential for practical macros. Without them, you're stuck constructing ASTs with `(list 'if ...)` which is painful.
- **Rest params**: `(defmacro when (cond . body) ...)` — need to handle dotted pair notation in parameter lists. The `.` is parsed as a symbol; detect it and treat everything after as a list.
- **Hygiene**: `defmacro` is NOT hygienic. Variable capture is a real risk. For hygienic macros, you need `syntax-rules` with pattern matching and automatic renaming. Significantly more complex.

## Tail Call Optimization (Trampoline)

- **Approach**: Split `evaluate` into `evaluate` (trampoline loop) and `evaluateInner` (single step). When a tail position would normally recurse into `evaluate`, instead return a `TailCall(expr, env)` thunk.
- **Tail positions**: Last expression in `begin`, `if` branches, `let` body, `cond` branches, last body expression of lambda call.
- **Result**: 200K deep recursion works without stack overflow. Mutual recursion (even?/odd? with 10K calls) works.
- **Tricky parts**: Need to be careful that ALL code paths through function calls use the trampoline. The lambda call path at the bottom of `evaluateInner` is critical — must return `TailCall` not `evaluate`.
- **Performance**: The trampoline adds a small constant overhead per call (object allocation for TailCall). In practice this is negligible.
