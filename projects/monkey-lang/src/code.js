// Monkey Language Bytecode Definitions
// Stack-based VM following Thorsten Ball's approach

// Opcodes
export const Opcodes = {
  OpConstant:       0x01, // Push constant from pool onto stack
  OpPop:            0x02, // Pop top of stack (expression statement cleanup)

  // Arithmetic
  OpAdd:            0x03,
  OpSub:            0x04,
  OpMul:            0x05,
  OpDiv:            0x06,

  // Boolean
  OpTrue:           0x07,
  OpFalse:          0x08,

  // Comparison
  OpEqual:          0x09,
  OpNotEqual:       0x0A,
  OpGreaterThan:    0x0B, // Less-than rewritten as reversed greater-than by compiler

  // Prefix
  OpMinus:          0x0C,
  OpBang:           0x0D,

  // Jump
  OpJumpNotTruthy:  0x0E, // Conditional jump (if-else)
  OpJump:           0x0F, // Unconditional jump

  // Null
  OpNull:           0x10,

  // Bindings
  OpSetGlobal:      0x11,
  OpGetGlobal:      0x12,
  OpSetLocal:       0x13,
  OpGetLocal:       0x14,

  // Data structures
  OpArray:          0x15,
  OpHash:           0x16,
  OpIndex:          0x17,

  // Strings
  OpConcat:         0x18, // String concatenation (reuses OpAdd but separate for clarity? No — use OpAdd)

  // Functions
  OpCall:           0x19,
  OpReturnValue:    0x1A,
  OpReturn:         0x1B, // Return without value (implicit null)
  OpClosure:        0x1C, // Create closure from compiled function
  OpGetFree:        0x1D, // Get free variable from closure
  OpCurrentClosure: 0x1E, // Push current closure (for recursion)

  // Builtins
  OpGetBuiltin:     0x1F,

  // Constant-operand arithmetic (fused OpConstant + op)
  // Right operand is loaded from constant pool, left from stack
  OpAddConst:       0x20,
  OpSubConst:       0x21,
  OpMulConst:       0x22,
  OpDivConst:       0x23,

  // Superinstructions: fused OpGetLocal + Op*Const
  // Left operand from local slot, right from constant pool
  OpGetLocalAddConst: 0x24,
  OpGetLocalSubConst: 0x25,
  OpGetLocalMulConst: 0x26,
  OpGetLocalDivConst: 0x27,

  // Integer-specialized opcodes (skip instanceof checks)
  // Compiler emits these when it can prove both operands are integers
  OpAddInt:         0x28,
  OpSubInt:         0x29,
  OpGreaterThanInt: 0x2A,
  OpEqualInt:       0x2B,
  OpNotEqualInt:    0x2C,
  OpLessThanInt:    0x2D, // Unlike generic path, this is a direct opcode (no rewrite to GT)

  // Additional integer-specialized opcodes (for adaptive quickening)
  OpMulInt:         0x2E,
  OpDivInt:         0x2F,
  OpMod:            0x30,
  OpModConst:       0x31,
  OpModInt:         0x32,
  OpAnd:            0x33,
  OpOr:             0x34,
  OpSetFree:        0x35, // Set free variable in closure
  OpSetIndex:       0x36, // Set element at index: arr[i] = val
  OpSlice:          0x37, // Slice: arr[start:end]
  OpTypeCheck:      0x38, // Type check: local(1) typeConstIdx(2) — validates param type
  OpTypeIs:         0x39, // Type check: pops value, pushes bool (typeConstIdx(2))
  OpResultValue:    0x3A, // Pop Result, push its inner .value
  OpTry:            0x3B, // Push exception handler: operand = catch handler address (2 bytes), finally address (2 bytes)
  OpThrow:          0x3C, // Throw: pop value from stack, unwind to nearest handler
  OpPopHandler:     0x3D, // Pop the current exception handler (try block completed normally)
  OpYield:          0x3E, // Yield: pop value from stack, add to generator's collection, push null
  OpMakeGenerator:  0x3F, // Make generator: operand = closure index, wraps closure in generator factory
};

// Opcode definitions: [name, ...operandWidths]
// Operand widths in bytes (2 = uint16, 1 = uint8)
const definitions = {
  [Opcodes.OpConstant]:       ['OpConstant', 2],
  [Opcodes.OpPop]:            ['OpPop'],
  [Opcodes.OpAdd]:            ['OpAdd'],
  [Opcodes.OpSub]:            ['OpSub'],
  [Opcodes.OpMul]:            ['OpMul'],
  [Opcodes.OpDiv]:            ['OpDiv'],
  [Opcodes.OpTrue]:           ['OpTrue'],
  [Opcodes.OpFalse]:          ['OpFalse'],
  [Opcodes.OpEqual]:          ['OpEqual'],
  [Opcodes.OpNotEqual]:       ['OpNotEqual'],
  [Opcodes.OpGreaterThan]:    ['OpGreaterThan'],
  [Opcodes.OpMinus]:          ['OpMinus'],
  [Opcodes.OpBang]:           ['OpBang'],
  [Opcodes.OpJumpNotTruthy]:  ['OpJumpNotTruthy', 2],
  [Opcodes.OpJump]:           ['OpJump', 2],
  [Opcodes.OpNull]:           ['OpNull'],
  [Opcodes.OpSetGlobal]:      ['OpSetGlobal', 2],
  [Opcodes.OpGetGlobal]:      ['OpGetGlobal', 2],
  [Opcodes.OpSetLocal]:       ['OpSetLocal', 1],
  [Opcodes.OpGetLocal]:       ['OpGetLocal', 1],
  [Opcodes.OpArray]:          ['OpArray', 2],
  [Opcodes.OpHash]:           ['OpHash', 2],
  [Opcodes.OpIndex]:          ['OpIndex'],
  [Opcodes.OpCall]:           ['OpCall', 1],
  [Opcodes.OpReturnValue]:    ['OpReturnValue'],
  [Opcodes.OpReturn]:         ['OpReturn'],
  [Opcodes.OpClosure]:        ['OpClosure', 2, 1], // constIndex (2), numFree (1)
  [Opcodes.OpGetFree]:        ['OpGetFree', 1],
  [Opcodes.OpCurrentClosure]: ['OpCurrentClosure'],
  [Opcodes.OpGetBuiltin]:     ['OpGetBuiltin', 1],
  [Opcodes.OpAddConst]:       ['OpAddConst', 2],
  [Opcodes.OpSubConst]:       ['OpSubConst', 2],
  [Opcodes.OpMulConst]:       ['OpMulConst', 2],
  [Opcodes.OpDivConst]:       ['OpDivConst', 2],
  [Opcodes.OpGetLocalAddConst]: ['OpGetLocalAddConst', 1, 2],
  [Opcodes.OpGetLocalSubConst]: ['OpGetLocalSubConst', 1, 2],
  [Opcodes.OpGetLocalMulConst]: ['OpGetLocalMulConst', 1, 2],
  [Opcodes.OpGetLocalDivConst]: ['OpGetLocalDivConst', 1, 2],
  [Opcodes.OpAddInt]:           ['OpAddInt'],
  [Opcodes.OpSubInt]:           ['OpSubInt'],
  [Opcodes.OpGreaterThanInt]:   ['OpGreaterThanInt'],
  [Opcodes.OpEqualInt]:         ['OpEqualInt'],
  [Opcodes.OpNotEqualInt]:      ['OpNotEqualInt'],
  [Opcodes.OpLessThanInt]:      ['OpLessThanInt'],
  [Opcodes.OpMulInt]:           ['OpMulInt'],
  [Opcodes.OpDivInt]:           ['OpDivInt'],
  [Opcodes.OpMod]:              ['OpMod'],
  [Opcodes.OpModConst]:         ['OpModConst', 2],
  [Opcodes.OpModInt]:           ['OpModInt'],
  [Opcodes.OpAnd]:              ['OpAnd'],
  [Opcodes.OpOr]:               ['OpOr'],
  [Opcodes.OpSetFree]:          ['OpSetFree', 1],
  [Opcodes.OpSetIndex]:         ['OpSetIndex'],
  [Opcodes.OpSlice]:            ['OpSlice'],
  [Opcodes.OpTypeCheck]:        ['OpTypeCheck', 1, 2], // localSlot (1), typeNameConstIdx (2)
  [Opcodes.OpTypeIs]:           ['OpTypeIs', 2],       // typeNameConstIdx (2) — pops value, pushes bool
  [Opcodes.OpResultValue]:      ['OpResultValue'],     // Pop Result, push its .value
  [Opcodes.OpTry]:              ['OpTry', 2, 2],       // catchAddr (2), finallyAddr (2)
  [Opcodes.OpThrow]:            ['OpThrow'],            // Pop value, throw
  [Opcodes.OpPopHandler]:       ['OpPopHandler'],       // Remove current handler
  [Opcodes.OpYield]:            ['OpYield'],             // Pop value, add to generator collection
  [Opcodes.OpMakeGenerator]:    ['OpMakeGenerator'],     // Pop closure, wrap in generator factory
};

/**
 * Look up the definition for an opcode.
 * @returns {{ name: string, operandWidths: number[] }} or undefined
 */
export function lookup(op) {
  const def = definitions[op];
  if (!def) return undefined;
  return { name: def[0], operandWidths: def.slice(1) };
}

/**
 * Encode a single instruction: opcode + operands.
 * @param {number} op - Opcode
 * @param {...number} operands - Operand values
 * @returns {Uint8Array}
 */
export function make(op, ...operands) {
  const def = definitions[op];
  if (!def) return new Uint8Array(0);

  const widths = def.slice(1);
  let len = 1; // opcode byte
  for (const w of widths) len += w;

  const instruction = new Uint8Array(len);
  instruction[0] = op;

  let offset = 1;
  for (let i = 0; i < widths.length; i++) {
    const w = widths[i];
    const val = operands[i] || 0;
    if (w === 2) {
      // Big-endian uint16
      instruction[offset] = (val >> 8) & 0xFF;
      instruction[offset + 1] = val & 0xFF;
    } else if (w === 1) {
      instruction[offset] = val & 0xFF;
    }
    offset += w;
  }

  return instruction;
}

/**
 * Read operands from an instruction stream at the given offset.
 * @param {number[]} operandWidths
 * @param {Uint8Array} instructions
 * @param {number} offset - start of operands (after opcode)
 * @returns {{ operands: number[], bytesRead: number }}
 */
export function readOperands(operandWidths, instructions, offset) {
  const operands = [];
  let bytesRead = 0;

  for (const w of operandWidths) {
    if (w === 2) {
      operands.push((instructions[offset + bytesRead] << 8) | instructions[offset + bytesRead + 1]);
    } else if (w === 1) {
      operands.push(instructions[offset + bytesRead]);
    }
    bytesRead += w;
  }

  return { operands, bytesRead };
}

/**
 * Disassemble bytecode into human-readable form.
 * @param {Uint8Array} instructions
 * @returns {string}
 */
export function disassemble(instructions) {
  const lines = [];
  let i = 0;

  while (i < instructions.length) {
    const op = instructions[i];
    const def = lookup(op);
    if (!def) {
      lines.push(`${String(i).padStart(4, '0')} UNKNOWN(${op})`);
      i++;
      continue;
    }

    const { operands, bytesRead } = readOperands(def.operandWidths, instructions, i + 1);
    const operandStr = operands.length > 0 ? ' ' + operands.join(' ') : '';
    lines.push(`${String(i).padStart(4, '0')} ${def.name}${operandStr}`);
    i += 1 + bytesRead;
  }

  return lines.join('\n');
}

/**
 * Concatenate multiple Uint8Arrays into one.
 */
export function concatInstructions(...arrays) {
  let len = 0;
  for (const a of arrays) len += a.length;
  const result = new Uint8Array(len);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}
