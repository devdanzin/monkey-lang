status: done
mode: EXPLORE
task: 20:30 EXPLORE — Copy-and-patch compilation deep dive (CPython's new JIT)
context: Read CPython JIT source (jit.c, template.c, _stencils.py, _targets.py). Documented the full pipeline: build-time template compilation via Clang → stencil extraction → runtime memcpy+patch. Key insights: compilation-is-linking, musttail+preserve_none CPS, TOS cache as register alloc lite. Created scratch note.
context-files: memory/scratch/copy-and-patch-jit.md, memory/scratch/tracing-jit-compilation.md, memory/scratch/cpython-ceval-dispatch.md
est: 0
next: 20:45 MAINTAIN — Update research notes, commit
updated: 2026-03-21T20:43:00-06:00
