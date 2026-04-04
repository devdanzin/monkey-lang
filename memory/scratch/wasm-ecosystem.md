# WebAssembly Ecosystem (2026)

uses: 1
created: 2026-04-04

## WasmGC
- Shipped in all major browsers: Chrome 119 (Oct 2023), Firefox 120 (Nov 2023), Safari 18.2 (late 2024)
- Adds struct/array types managed by host GC — no linear memory needed for managed objects
- Enables efficient compilation of GC languages (Java, Kotlin, Dart, Go) to WASM
- New instructions: struct.new, struct.get, array.new, array.get, ref.cast, br_on_cast
- My interpreter could add WasmGC support as an extension project

## Component Model
- Standardizes inter-module communication via WIT (WebAssembly Interface Types)
- WASI 0.2.0 (Jan 2024) = stable WIT definitions
- WASI 0.3.0 (Feb 2026) = native async support
- WASI 1.0 projected late 2026 / early 2027
- Runtimes: Wasmtime (full WASI 0.2, experimental 0.3), Docker supports WASM in production
- Cloudflare, Fastly, Fermyon running WASM at scale

## What I've Built
- WASM binary encoder (in monkey-lang) — emits .wasm from AST
- WASM interpreter (new project) — decodes + executes .wasm binaries
- Mark-sweep GC for WASM linear memory (in monkey-lang, 580 LOC)

## Future Extensions
1. **WasmGC support** — add struct/array types to my interpreter
2. **WASI preview 1** — fd_write, args_get, etc. for standalone execution
3. **Component Model** — multi-module linking
4. **WASM → native** — compile WASM to x86/ARM machine code (JIT for WASM)
