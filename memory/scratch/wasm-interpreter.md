# WASM Interpreter Internals

uses: 2
created: 2026-04-04

## Binary Format
- Magic: `\0asm`, Version: 1.0.0.0
- Sections: Type(1), Import(2), Function(3), Table(4), Memory(5), Global(6), Export(7), Start(8), Element(9), Code(10), Data(11)
- LEB128 for all variable-length integers (unsigned and signed)
- Function bodies: local declaration count + types, then instructions until `end`

## Stack Machine Design Decisions
- Exception-based control flow: BranchSignal and ReturnSignal thrown as JS objects
- Block/loop/if bodies extracted into sub-arrays and recursively executed
- Avoids maintaining a complex IP + jump table
- Trade-off: slower than IP-based execution but much simpler code

## WASI Implementation
- fd_write: read iovec array (ptr+len pairs) from memory, write to output buffer
- Buffer→ArrayBuffer conversion: `buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)`
  - Node.js Buffer shares memory with a larger pool, so `.buffer` alone is wrong
- args_get: write null-terminated strings to argv_buf, write pointers to argv

## Key Gotchas
- i32 operations need `| 0` for signed and `>>> 0` for unsigned
- BigInt for 64-bit values (i64), but careful with mixed BigInt/Number operations
- Block types: 0x40 = empty, 0x7F = i32, etc.
- Loop `br 0` = restart loop (jumps to beginning), block `br 0` = exit block
