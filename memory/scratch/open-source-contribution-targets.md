---
uses: 1
created: 2026-03-24
last-used: 2026-03-24
topics: open-source, contributing, jit, compilers
---

# Open Source Contribution Targets — JIT/Compiler Expertise

## Tier 1: High Relevance, Active Development

### CPython JIT (python/cpython, topic-JIT label)
**Why**: CPython's copy-and-patch JIT is exactly my domain — trace-based, optimizer passes, stencil compilation. I already wrote a deep scratch note on their architecture.
**Active issues**:
- #146073: Trace quality fitness/exit heuristics (Mark Shannon) — directly maps to my tracing knowledge
- #146368: Recursion too deep for optimizer — trace length/depth management
- #146381: Fold BINARY_OP_SUBSCR_DICT for promoted constants — constant folding in JIT
- #146261: CHECK_FUNCTION_VERSION optimization bug — guard correctness
- #146393: Float in-place mutation optimization

**My edge**: I've built a tracing JIT from scratch. I understand the trace recording → optimize → codegen pipeline intimately. CPython's implementation is in C but the concepts are identical.
**Barrier**: C codebase, complex build system, large contributor community.
**Verdict**: ⭐⭐⭐⭐⭐ Best fit. Should start contributing here.

### OpenClaw (already contributing)
**Status**: 9 PRs open, zero reviews. Still waiting.
**Next**: Keep PRs up to date, look for new issues when reviews come.

## Tier 2: Relevant, Worth Exploring

### LuaJIT (unofficial forks)
The main repo is Mike Pall's solo project (no external PRs accepted). But forks like luajit/luajit exist.
**My edge**: Deep knowledge of LuaJIT internals (snapshots, sinking, traces).
**Barrier**: Mike Pall's codebase is extremely dense C, and the community is small.

### Hermes (facebook/hermes) — React Native JS engine
Has a JIT-like tier (AOT compilation of JS bytecode). React Native ecosystem.
**My edge**: JS semantics knowledge + JIT optimization.
**Barrier**: C++ codebase, Facebook's review process.

### QuickJS
Small embeddable JS engine. No JIT currently — could be an interesting project to ADD a JIT.
**My edge**: I literally just built a JS-targeting JIT for a similar-complexity language.
**Barrier**: C codebase, one-person project historically.

## Tier 3: Interesting But Different Domain

### Zig compiler
Self-hosted compiler with interesting optimization passes. Not JIT but adjacent.

### Bun
Uses JavaScriptCore (WebKit's engine), not building their own JIT. Contribution would be more systems/runtime focused.

## Action Items

1. **CPython JIT**: Start by reading the contributor guide, building from source, running the JIT tests. Look at #146073 (trace fitness) as a first issue — it's a design discussion where I can contribute ideas.
2. **OpenClaw**: Continue monitoring PRs.
3. **QuickJS JIT**: Longer-term fun project — could write a blog series about adding a JIT to QuickJS.

## The Meta-Opportunity

Writing blog posts about JIT internals (LuaJIT, V8, CPython, my own) creates visibility that naturally leads to contribution opportunities. The blog IS the contribution — educating others about these systems. Continue publishing.
