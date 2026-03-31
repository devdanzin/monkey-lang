import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseELF, isELF } from '../src/index.js';

// Minimal ELF64 LE binary (header only, enough to parse)
function makeELF64() {
  const buf = new Uint8Array(128).fill(0);
  // Magic
  buf[0] = 0x7f; buf[1] = 0x45; buf[2] = 0x4c; buf[3] = 0x46;
  buf[4] = 2; // 64-bit
  buf[5] = 1; // Little-endian
  buf[6] = 1; // Version
  buf[7] = 0; // OSABI
  // Type = EXEC (2)
  buf[16] = 2; buf[17] = 0;
  // Machine = x86-64 (62)
  buf[18] = 62; buf[19] = 0;
  // Entry point = 0x400000
  buf[24] = 0x00; buf[25] = 0x00; buf[26] = 0x40; buf[27] = 0x00;
  // phoff = 0, shoff = 0, phnum = 0, shnum = 0
  return buf;
}

function makeELF32() {
  const buf = new Uint8Array(64).fill(0);
  buf[0] = 0x7f; buf[1] = 0x45; buf[2] = 0x4c; buf[3] = 0x46;
  buf[4] = 1; // 32-bit
  buf[5] = 1; // LE
  buf[6] = 1;
  buf[16] = 3; buf[17] = 0; // DYN
  buf[18] = 40; buf[19] = 0; // ARM
  return buf;
}

describe('isELF', () => {
  it('detects ELF', () => assert.equal(isELF(makeELF64()), true));
  it('rejects non-ELF', () => assert.equal(isELF(new Uint8Array([0, 1, 2, 3])), false));
  it('rejects short data', () => assert.equal(isELF(new Uint8Array([0x7f])), false));
});

describe('parseELF', () => {
  it('parses 64-bit header', () => {
    const elf = parseELF(makeELF64());
    assert.equal(elf.header.class, 'ELF64');
    assert.equal(elf.header.encoding, 'little-endian');
    assert.equal(elf.header.type, 'EXEC');
    assert.equal(elf.header.machine, 'x86-64');
  });

  it('parses 32-bit header', () => {
    const elf = parseELF(makeELF32());
    assert.equal(elf.header.class, 'ELF32');
    assert.equal(elf.header.type, 'DYN');
    assert.equal(elf.header.machine, 'ARM');
  });

  it('rejects non-ELF', () => {
    assert.throws(() => parseELF(new Uint8Array(64)), /Not an ELF/);
  });

  it('rejects too-small input', () => {
    assert.throws(() => parseELF(new Uint8Array(10)), /Too small/);
  });

  it('returns sections array', () => {
    const elf = parseELF(makeELF64());
    assert.ok(Array.isArray(elf.sections));
  });

  it('returns segments array', () => {
    const elf = parseELF(makeELF64());
    assert.ok(Array.isArray(elf.segments));
  });
});
