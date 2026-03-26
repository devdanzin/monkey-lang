# Module Systems in Small Languages
uses: 1
created: 2026-03-26
topics: modules, language-design, lua, wren, lox

## Lua
- `require("module")` — runtime function, not syntax
- Modules return tables: `local M = {}; ... return M`
- `package.loaded` cache prevents re-execution
- Elegant: modules = values (tables)

## Wren
- `import "module" for ClassName` — static, selective
- Can import specific names
- Each module has own top-level scope
- More structured than Lua

## Lox
- No module system (deliberate omission)
- Book focuses on language core

## Patterns
1. **Namespace** (Lua, our current): `import "math"` → hash/table
2. **Selective** (Wren, Python): `import "math" for sqrt, PI`
3. **Aliased** (Python): `import "math" as m`

## Future Monkey Extensions
- `import "math" for sqrt, PI` — selective binding
- `import "math" as m` — aliasing
- User-defined modules (needs file I/O for non-browser)
- Module caching (don't re-evaluate)
