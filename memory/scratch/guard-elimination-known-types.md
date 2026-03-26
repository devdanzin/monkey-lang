---
uses: 1
created: 2026-03-26
last-used: 2026-03-26
topics: jit, guard-elimination, type-propagation, optimization
---

# Known Node Information in Monkey JIT

## Finding
Our redundantGuardElimination pass already implements "Known Node Information" from Maglev.

## How It Works
1. First pass: mark refs with known types from producing instructions:
   - CONST_INT, UNBOX_INT, BOX_INT, ADD_INT, SUB_INT, etc. → 'int'
   - CONST_BOOL, GT, LT, EQ, NEQ → 'bool'
   - CONCAT, UNBOX_STRING, BOX_STRING → 'string'
2. Second pass: eliminate guards on refs with already-known types
3. Store-to-load forwarding (earlier pass) replaces LOADs with original refs, enabling guard elimination

## Result
Typical numeric loops end up with **0 guards** after optimization. Type annotations help during *recording* (fewer guards emitted initially) but don't change the final optimized output.

## Type Annotation Benefits
Despite not changing guard counts in optimized code:
- **Runtime safety**: wrong types throw clear `Type error: expected X, got Y`
- **Recording efficiency**: fewer guards → less IR → faster compilation
- **Documentation**: function signatures are self-documenting
- **Future**: when we add more complex type-dependent optimizations, annotations provide trusted type info
