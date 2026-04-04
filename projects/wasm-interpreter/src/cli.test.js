// cli.test.js — Tests for the CLI runner and real WASM binaries

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, unlinkSync, mkdtempSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildModule, encodeI32, encodeU32, Op } from './encoder.js';

const cliPath = new URL('./cli.js', import.meta.url).pathname;

function writeWasm(desc) {
  const dir = mkdtempSync(join(tmpdir(), 'wasm-test-'));
  const path = join(dir, 'test.wasm');
  writeFileSync(path, buildModule(desc));
  return path;
}

describe('CLI Runner', () => {
  it('runs --decode on a simple module', () => {
    const path = writeWasm({
      types: [{ params: [], results: ['i32'] }],
      functions: [{ typeIdx: 0, body: [Op.i32_const, ...encodeI32(42)] }],
      exports: [{ name: 'main', kind: 'func', index: 0 }]
    });

    const output = execSync(`node ${cliPath} ${path} --decode`, { encoding: 'utf8' });
    assert.ok(output.includes('Functions: 1'));
    assert.ok(output.includes('Exports:   1'));
    assert.ok(output.includes('func main'));
  });

  it('runs a module with main export', () => {
    const path = writeWasm({
      types: [{ params: [], results: ['i32'] }],
      functions: [{ typeIdx: 0, body: [Op.i32_const, ...encodeI32(42)] }],
      exports: [{ name: 'main', kind: 'func', index: 0 }]
    });

    const output = execSync(`node ${cliPath} ${path}`, { encoding: 'utf8' });
    assert.equal(output.trim(), '42');
  });

  it('runs with --stats', () => {
    const path = writeWasm({
      types: [{ params: [], results: ['i32'] }],
      functions: [{ typeIdx: 0, body: [Op.i32_const, ...encodeI32(99)] }],
      exports: [{ name: 'main', kind: 'func', index: 0 }]
    });

    const output = execSync(`node ${cliPath} ${path} --stats`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    assert.ok(output.includes('99'));
  });

  it('runs a WASI _start program', () => {
    // A WASI program that writes "OK" to stdout
    const path = writeWasm({
      types: [
        { params: ['i32', 'i32', 'i32', 'i32'], results: ['i32'] },
        { params: [], results: [] },
      ],
      imports: [{ module: 'wasi_snapshot_preview1', name: 'fd_write', typeIdx: 0 }],
      memories: [{ min: 1 }],
      data: [
        { memIdx: 0, offset: [Op.i32_const, ...encodeI32(0)], bytes: [16, 0, 0, 0, 2, 0, 0, 0] },
        { memIdx: 0, offset: [Op.i32_const, ...encodeI32(16)], bytes: [79, 75] }, // "OK"
      ],
      functions: [{
        typeIdx: 1,
        body: [
          Op.i32_const, ...encodeI32(1),
          Op.i32_const, ...encodeI32(0),
          Op.i32_const, ...encodeI32(1),
          Op.i32_const, ...encodeI32(8),
          Op.call, ...encodeU32(0),
          Op.drop,
        ]
      }],
      exports: [
        { name: '_start', kind: 'func', index: 1 },
        { name: 'memory', kind: 'memory', index: 0 },
      ]
    });

    const output = execSync(`node ${cliPath} ${path}`, { encoding: 'utf8' });
    assert.equal(output, 'OK');
  });

  it('fibonacci via CLI', () => {
    // Module that computes fib(10) = 55
    const path = writeWasm({
      types: [{ params: [], results: ['i32'] }],
      functions: [{
        typeIdx: 0,
        locals: [
          { count: 1, type: 'i32' }, // n
          { count: 1, type: 'i32' }, // a
          { count: 1, type: 'i32' }, // b
          { count: 1, type: 'i32' }, // temp
          { count: 1, type: 'i32' }, // i
        ],
        body: [
          Op.i32_const, ...encodeI32(10),
          Op.local_set, ...encodeU32(0),
          Op.i32_const, ...encodeI32(0),
          Op.local_set, ...encodeU32(1),
          Op.i32_const, ...encodeI32(1),
          Op.local_set, ...encodeU32(2),
          Op.i32_const, ...encodeI32(2),
          Op.local_set, ...encodeU32(4),
          Op.block, 0x40,
            Op.loop, 0x40,
              Op.local_get, ...encodeU32(4),
              Op.local_get, ...encodeU32(0),
              Op.i32_gt_s,
              Op.br_if, ...encodeU32(1),
              Op.local_get, ...encodeU32(1),
              Op.local_get, ...encodeU32(2),
              Op.i32_add,
              Op.local_set, ...encodeU32(3),
              Op.local_get, ...encodeU32(2),
              Op.local_set, ...encodeU32(1),
              Op.local_get, ...encodeU32(3),
              Op.local_set, ...encodeU32(2),
              Op.local_get, ...encodeU32(4),
              Op.i32_const, ...encodeI32(1),
              Op.i32_add,
              Op.local_set, ...encodeU32(4),
              Op.br, ...encodeU32(0),
            Op.end,
          Op.end,
          Op.local_get, ...encodeU32(2),
        ]
      }],
      exports: [{ name: 'main', kind: 'func', index: 0 }]
    });

    const output = execSync(`node ${cliPath} ${path}`, { encoding: 'utf8' });
    assert.equal(output.trim(), '55');
  });
});
