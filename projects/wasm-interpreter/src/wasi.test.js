// wasi.test.js — Tests for WASI preview 1 host implementation

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { WasiHost, WasiExit } from './wasi.js';
import { decode } from './decoder.js';
import { WasmInstance } from './runtime.js';
import { buildModule, encodeI32, encodeU32, Op } from './encoder.js';

// Helper: instantiate with WASI
function wasiRun(desc, wasiOpts = {}) {
  const wasi = new WasiHost(wasiOpts);
  const wasm = buildModule(desc);
  const module = decode(wasm);
  const imports = wasi.getImports();
  const instance = new WasmInstance(module, imports);
  // Give WASI access to the memory
  wasi.memory = instance.memory;
  return { instance, wasi };
}

describe('WASI Host', () => {

  describe('fd_write (stdout)', () => {
    it('writes to stdout via fd_write', () => {
      // Build a module that calls fd_write to print "Hi"
      // fd_write(fd=1, iovs, iovs_len=1, nwritten) -> errno
      // Memory layout: [iovec at 0: ptr=8, len=2] [data at 8: "Hi"]
      const { instance, wasi } = wasiRun({
        types: [
          { params: ['i32', 'i32', 'i32', 'i32'], results: ['i32'] }, // fd_write sig
          { params: [], results: [] }, // main
        ],
        imports: [{ module: 'wasi_snapshot_preview1', name: 'fd_write', typeIdx: 0 }],
        memories: [{ min: 1 }],
        data: [
          // iovec: ptr=16, len=2 at offset 0
          { memIdx: 0, offset: [Op.i32_const, ...encodeI32(0)], bytes: [16, 0, 0, 0, 2, 0, 0, 0] },
          // data "Hi" at offset 16
          { memIdx: 0, offset: [Op.i32_const, ...encodeI32(16)], bytes: [72, 105] },
        ],
        functions: [{
          typeIdx: 1,
          body: [
            Op.i32_const, ...encodeI32(1),  // fd = stdout
            Op.i32_const, ...encodeI32(0),  // iovs pointer
            Op.i32_const, ...encodeI32(1),  // iovs_len
            Op.i32_const, ...encodeI32(8),  // nwritten pointer
            Op.call, ...encodeU32(0),       // call fd_write
            Op.drop,                         // drop errno
          ]
        }],
        exports: [
          { name: '_start', kind: 'func', index: 1 },
          { name: 'memory', kind: 'memory', index: 0 },
        ]
      });

      instance.exports._start();
      assert.equal(wasi.getStdout(), 'Hi');
    });

    it('writes multiple iovecs', () => {
      const { instance, wasi } = wasiRun({
        types: [
          { params: ['i32', 'i32', 'i32', 'i32'], results: ['i32'] },
          { params: [], results: [] },
        ],
        imports: [{ module: 'wasi_snapshot_preview1', name: 'fd_write', typeIdx: 0 }],
        memories: [{ min: 1 }],
        data: [
          // iovec 0: ptr=32, len=5 ("Hello")
          { memIdx: 0, offset: [Op.i32_const, ...encodeI32(0)], bytes: [32, 0, 0, 0, 5, 0, 0, 0] },
          // iovec 1: ptr=37, len=1 (" ")
          { memIdx: 0, offset: [Op.i32_const, ...encodeI32(8)], bytes: [37, 0, 0, 0, 1, 0, 0, 0] },
          // iovec 2: ptr=38, len=5 ("World")
          { memIdx: 0, offset: [Op.i32_const, ...encodeI32(16)], bytes: [38, 0, 0, 0, 5, 0, 0, 0] },
          // "Hello World"
          { memIdx: 0, offset: [Op.i32_const, ...encodeI32(32)], bytes: [72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100] },
        ],
        functions: [{
          typeIdx: 1,
          body: [
            Op.i32_const, ...encodeI32(1),  // fd
            Op.i32_const, ...encodeI32(0),  // iovs
            Op.i32_const, ...encodeI32(3),  // 3 iovecs
            Op.i32_const, ...encodeI32(24), // nwritten
            Op.call, ...encodeU32(0),
            Op.drop,
          ]
        }],
        exports: [
          { name: '_start', kind: 'func', index: 1 },
          { name: 'memory', kind: 'memory', index: 0 },
        ]
      });

      instance.exports._start();
      assert.equal(wasi.getStdout(), 'Hello World');
    });

    it('writes to stderr via fd=2', () => {
      const { instance, wasi } = wasiRun({
        types: [
          { params: ['i32', 'i32', 'i32', 'i32'], results: ['i32'] },
          { params: [], results: [] },
        ],
        imports: [{ module: 'wasi_snapshot_preview1', name: 'fd_write', typeIdx: 0 }],
        memories: [{ min: 1 }],
        data: [
          { memIdx: 0, offset: [Op.i32_const, ...encodeI32(0)], bytes: [16, 0, 0, 0, 3, 0, 0, 0] },
          { memIdx: 0, offset: [Op.i32_const, ...encodeI32(16)], bytes: [69, 114, 114] }, // "Err"
        ],
        functions: [{
          typeIdx: 1,
          body: [
            Op.i32_const, ...encodeI32(2),  // fd = stderr
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

      instance.exports._start();
      assert.equal(wasi.getStderr(), 'Err');
    });
  });

  describe('fd_read (stdin)', () => {
    it('reads from stdin', () => {
      const { instance, wasi } = wasiRun({
        types: [
          { params: ['i32', 'i32', 'i32', 'i32'], results: ['i32'] }, // fd_read
          { params: [], results: ['i32'] }, // main -> returns bytes read
        ],
        imports: [{ module: 'wasi_snapshot_preview1', name: 'fd_read', typeIdx: 0 }],
        memories: [{ min: 1 }],
        data: [
          // iovec: ptr=16, len=10 at offset 0
          { memIdx: 0, offset: [Op.i32_const, ...encodeI32(0)], bytes: [16, 0, 0, 0, 10, 0, 0, 0] },
        ],
        functions: [{
          typeIdx: 1,
          body: [
            Op.i32_const, ...encodeI32(0),  // fd = stdin
            Op.i32_const, ...encodeI32(0),  // iovs
            Op.i32_const, ...encodeI32(1),  // iovs_len
            Op.i32_const, ...encodeI32(8),  // nread
            Op.call, ...encodeU32(0),
            Op.drop,
            Op.i32_const, ...encodeI32(8),
            Op.i32_load, ...encodeU32(2), ...encodeU32(0), // load nread
          ]
        }],
        exports: [
          { name: 'main', kind: 'func', index: 1 },
          { name: 'memory', kind: 'memory', index: 0 },
        ]
      }, { stdin: 'Hello' });

      const nread = instance.exports.main();
      assert.equal(nread, 5);
      // Check memory contains "Hello"
      const bytes = new Uint8Array(instance.memory);
      const text = new TextDecoder().decode(bytes.slice(16, 21));
      assert.equal(text, 'Hello');
    });
  });

  describe('args', () => {
    it('args_sizes_get returns correct counts', () => {
      const { instance, wasi } = wasiRun({
        types: [
          { params: ['i32', 'i32'], results: ['i32'] }, // args_sizes_get
          { params: [], results: ['i32'] }, // main
        ],
        imports: [{ module: 'wasi_snapshot_preview1', name: 'args_sizes_get', typeIdx: 0 }],
        memories: [{ min: 1 }],
        functions: [{
          typeIdx: 1,
          body: [
            Op.i32_const, ...encodeI32(0),  // argc ptr
            Op.i32_const, ...encodeI32(4),  // argv_buf_size ptr
            Op.call, ...encodeU32(0),
            Op.drop,
            Op.i32_const, ...encodeI32(0),
            Op.i32_load, ...encodeU32(2), ...encodeU32(0), // load argc
          ]
        }],
        exports: [
          { name: 'main', kind: 'func', index: 1 },
          { name: 'memory', kind: 'memory', index: 0 },
        ]
      }, { args: ['prog', 'hello', 'world'] });

      assert.equal(instance.exports.main(), 3);
    });

    it('args_get populates memory', () => {
      const { instance, wasi } = wasiRun({
        types: [
          { params: ['i32', 'i32'], results: ['i32'] }, // args_sizes_get
          { params: ['i32', 'i32'], results: ['i32'] }, // args_get (same sig)
          { params: [], results: ['i32'] }, // main
        ],
        imports: [
          { module: 'wasi_snapshot_preview1', name: 'args_sizes_get', typeIdx: 0 },
          { module: 'wasi_snapshot_preview1', name: 'args_get', typeIdx: 1 },
        ],
        memories: [{ min: 1 }],
        functions: [{
          typeIdx: 2,
          body: [
            // args_sizes_get -> [0] = argc, [4] = buf_size
            Op.i32_const, ...encodeI32(0),
            Op.i32_const, ...encodeI32(4),
            Op.call, ...encodeU32(0),
            Op.drop,
            // args_get(argv=100, argv_buf=200)
            Op.i32_const, ...encodeI32(100),
            Op.i32_const, ...encodeI32(200),
            Op.call, ...encodeU32(1),
            Op.drop,
            // Read first arg pointer
            Op.i32_const, ...encodeI32(100),
            Op.i32_load, ...encodeU32(2), ...encodeU32(0),
          ]
        }],
        exports: [
          { name: 'main', kind: 'func', index: 2 },
          { name: 'memory', kind: 'memory', index: 0 },
        ]
      }, { args: ['test'] });

      const firstArgPtr = instance.exports.main();
      assert.equal(firstArgPtr, 200); // argv_buf starts at 200
      // Verify "test\0" at offset 200
      const bytes = new Uint8Array(instance.memory);
      const text = new TextDecoder().decode(bytes.slice(200, 204));
      assert.equal(text, 'test');
      assert.equal(bytes[204], 0); // null terminator
    });
  });

  describe('environ', () => {
    it('environ_sizes_get returns counts', () => {
      const { instance, wasi } = wasiRun({
        types: [
          { params: ['i32', 'i32'], results: ['i32'] },
          { params: [], results: ['i32'] },
        ],
        imports: [{ module: 'wasi_snapshot_preview1', name: 'environ_sizes_get', typeIdx: 0 }],
        memories: [{ min: 1 }],
        functions: [{
          typeIdx: 1,
          body: [
            Op.i32_const, ...encodeI32(0),
            Op.i32_const, ...encodeI32(4),
            Op.call, ...encodeU32(0),
            Op.drop,
            Op.i32_const, ...encodeI32(0),
            Op.i32_load, ...encodeU32(2), ...encodeU32(0),
          ]
        }],
        exports: [
          { name: 'main', kind: 'func', index: 1 },
          { name: 'memory', kind: 'memory', index: 0 },
        ]
      }, { env: { HOME: '/home/user', PATH: '/usr/bin' } });

      assert.equal(instance.exports.main(), 2); // 2 env vars
    });
  });

  describe('proc_exit', () => {
    it('throws WasiExit with exit code', () => {
      const { instance, wasi } = wasiRun({
        types: [
          { params: ['i32'], results: [] }, // proc_exit
          { params: [], results: [] },      // main
        ],
        imports: [{ module: 'wasi_snapshot_preview1', name: 'proc_exit', typeIdx: 0 }],
        memories: [{ min: 1 }],
        functions: [{
          typeIdx: 1,
          body: [
            Op.i32_const, ...encodeI32(42),
            Op.call, ...encodeU32(0),
          ]
        }],
        exports: [
          { name: '_start', kind: 'func', index: 1 },
          { name: 'memory', kind: 'memory', index: 0 },
        ]
      });

      try {
        instance.exports._start();
        assert.fail('Should have thrown WasiExit');
      } catch (e) {
        if (e instanceof WasiExit) {
          assert.equal(e.code, 42);
          assert.equal(wasi.exitCode, 42);
        } else {
          throw e;
        }
      }
    });
  });

  describe('clock_time_get', () => {
    it('returns monotonic time', () => {
      const { instance, wasi } = wasiRun({
        types: [
          { params: ['i32', 'i32', 'i32', 'i32'], results: ['i32'] }, // clock_time_get (with i32 precision parts)
          { params: [], results: ['i32'] },
        ],
        imports: [{ module: 'wasi_snapshot_preview1', name: 'clock_time_get', typeIdx: 0 }],
        memories: [{ min: 1 }],
        functions: [{
          typeIdx: 1,
          body: [
            Op.i32_const, ...encodeI32(1),  // CLOCKID_MONOTONIC
            Op.i32_const, ...encodeI32(0),  // precision low
            Op.i32_const, ...encodeI32(0),  // precision high
            Op.i32_const, ...encodeI32(0),  // time ptr
            Op.call, ...encodeU32(0),
            // errno should be 0
          ]
        }],
        exports: [
          { name: 'main', kind: 'func', index: 1 },
          { name: 'memory', kind: 'memory', index: 0 },
        ]
      });

      const errno = instance.exports.main();
      assert.equal(errno, 0);
    });
  });

  describe('Complete WASI program', () => {
    it('hello world: args + fd_write', () => {
      // A program that writes "Hello, <arg1>!\n" to stdout
      const { instance, wasi } = wasiRun({
        types: [
          { params: ['i32', 'i32', 'i32', 'i32'], results: ['i32'] }, // fd_write
          { params: ['i32', 'i32'], results: ['i32'] },               // args_sizes_get
          { params: ['i32', 'i32'], results: ['i32'] },               // args_get
          { params: [], results: [] },                                  // _start
        ],
        imports: [
          { module: 'wasi_snapshot_preview1', name: 'fd_write', typeIdx: 0 },
          { module: 'wasi_snapshot_preview1', name: 'args_sizes_get', typeIdx: 1 },
          { module: 'wasi_snapshot_preview1', name: 'args_get', typeIdx: 2 },
        ],
        memories: [{ min: 1 }],
        data: [
          // "Hello, " at 1024
          { memIdx: 0, offset: [Op.i32_const, ...encodeI32(1024)], bytes: [72, 101, 108, 108, 111, 44, 32] },
        ],
        functions: [{
          typeIdx: 3,
          locals: [
            { count: 1, type: 'i32' }, // local 0: arg ptr
          ],
          body: [
            // Get args
            Op.i32_const, ...encodeI32(100), // argc
            Op.i32_const, ...encodeI32(104), // buf_size
            Op.call, ...encodeU32(1), // args_sizes_get
            Op.drop,
            Op.i32_const, ...encodeI32(200), // argv
            Op.i32_const, ...encodeI32(300), // argv_buf
            Op.call, ...encodeU32(2), // args_get
            Op.drop,

            // Write "Hello, " (7 bytes at 1024)
            // iovec at 500: ptr=1024, len=7
            Op.i32_const, ...encodeI32(500),
            Op.i32_const, ...encodeI32(1024),
            Op.i32_store, ...encodeU32(2), ...encodeU32(0),
            Op.i32_const, ...encodeI32(504),
            Op.i32_const, ...encodeI32(7),
            Op.i32_store, ...encodeU32(2), ...encodeU32(0),

            Op.i32_const, ...encodeI32(1),   // stdout
            Op.i32_const, ...encodeI32(500), // iovs
            Op.i32_const, ...encodeI32(1),   // iovs_len
            Op.i32_const, ...encodeI32(508), // nwritten
            Op.call, ...encodeU32(0),
            Op.drop,

            // Now write arg[1] (the name)
            // Get arg[1] pointer from argv[1] (at 204)
            Op.i32_const, ...encodeI32(204),
            Op.i32_load, ...encodeU32(2), ...encodeU32(0),
            Op.local_set, ...encodeU32(0),

            // Calculate length of arg[1] by scanning for null byte
            // For simplicity, just write 5 bytes (assume "World")
            Op.i32_const, ...encodeI32(500),
            Op.local_get, ...encodeU32(0),
            Op.i32_store, ...encodeU32(2), ...encodeU32(0),
            Op.i32_const, ...encodeI32(504),
            Op.i32_const, ...encodeI32(5),  // "World" = 5 bytes
            Op.i32_store, ...encodeU32(2), ...encodeU32(0),

            Op.i32_const, ...encodeI32(1),
            Op.i32_const, ...encodeI32(500),
            Op.i32_const, ...encodeI32(1),
            Op.i32_const, ...encodeI32(508),
            Op.call, ...encodeU32(0),
            Op.drop,
          ]
        }],
        exports: [
          { name: '_start', kind: 'func', index: 3 },
          { name: 'memory', kind: 'memory', index: 0 },
        ]
      }, { args: ['hello', 'World'] });

      instance.exports._start();
      assert.equal(wasi.getStdout(), 'Hello, World');
    });
  });
});
