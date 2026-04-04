// wasi.js — WASI preview 1 host implementation
// Provides the wasi_snapshot_preview1 import module for WASM programs.

const ERRNO_SUCCESS = 0;
const ERRNO_BADF = 8;
const ERRNO_INVAL = 28;
const ERRNO_NOSYS = 52;

const CLOCKID_REALTIME = 0;
const CLOCKID_MONOTONIC = 1;

class WasiExit extends Error {
  constructor(code) {
    super(`WASI exit: ${code}`);
    this.name = 'WasiExit';
    this.code = code;
  }
}

export class WasiHost {
  constructor(options = {}) {
    this.args = options.args || [];
    this.env = options.env || {};
    this.stdin = options.stdin || '';
    this.stdout = options.stdout || [];
    this.stderr = options.stderr || [];
    this.stdinPos = 0;
    this.exitCode = null;
    this._memory = null; // set during instantiation
  }

  get memory() {
    return this._memory;
  }

  set memory(mem) {
    this._memory = mem;
  }

  _view() {
    return new DataView(this._memory);
  }

  _bytes() {
    return new Uint8Array(this._memory);
  }

  // Read an iovec array from memory
  _readIovecs(iovs, iovsLen) {
    const view = this._view();
    const vecs = [];
    for (let i = 0; i < iovsLen; i++) {
      const ptr = view.getUint32(iovs + i * 8, true);
      const len = view.getUint32(iovs + i * 8 + 4, true);
      vecs.push({ ptr, len });
    }
    return vecs;
  }

  // Build the import object for wasi_snapshot_preview1
  getImports() {
    const self = this;
    return {
      wasi_snapshot_preview1: {
        // fd_write(fd, iovs, iovs_len, nwritten) -> errno
        fd_write(fd, iovs, iovsLen, nwrittenPtr) {
          if (fd !== 1 && fd !== 2) return ERRNO_BADF;
          const target = fd === 1 ? self.stdout : self.stderr;
          const vecs = self._readIovecs(iovs, iovsLen);
          const bytes = self._bytes();
          let totalWritten = 0;

          for (const { ptr, len } of vecs) {
            const data = bytes.slice(ptr, ptr + len);
            const text = new TextDecoder().decode(data);
            target.push(text);
            totalWritten += len;
          }

          self._view().setUint32(nwrittenPtr, totalWritten, true);
          return ERRNO_SUCCESS;
        },

        // fd_read(fd, iovs, iovs_len, nread) -> errno
        fd_read(fd, iovs, iovsLen, nreadPtr) {
          if (fd !== 0) return ERRNO_BADF;
          const vecs = self._readIovecs(iovs, iovsLen);
          const bytes = self._bytes();
          const stdinBytes = new TextEncoder().encode(self.stdin);
          let totalRead = 0;

          for (const { ptr, len } of vecs) {
            const remaining = stdinBytes.length - self.stdinPos;
            const toRead = Math.min(len, remaining);
            if (toRead > 0) {
              bytes.set(stdinBytes.slice(self.stdinPos, self.stdinPos + toRead), ptr);
              self.stdinPos += toRead;
              totalRead += toRead;
            }
          }

          self._view().setUint32(nreadPtr, totalRead, true);
          return ERRNO_SUCCESS;
        },

        // fd_close(fd) -> errno
        fd_close(fd) {
          return ERRNO_SUCCESS;
        },

        // fd_seek(fd, offset, whence, newoffset) -> errno
        fd_seek(fd, offsetLo, offsetHi, whence, newoffsetPtr) {
          return ERRNO_NOSYS;
        },

        // fd_prestat_get(fd, prestat) -> errno
        fd_prestat_get(fd, prestatPtr) {
          return ERRNO_BADF;
        },

        // fd_prestat_dir_name(fd, path, path_len) -> errno
        fd_prestat_dir_name(fd, pathPtr, pathLen) {
          return ERRNO_BADF;
        },

        // fd_fdstat_get(fd, fdstat) -> errno
        fd_fdstat_get(fd, fdstatPtr) {
          if (fd > 2) return ERRNO_BADF;
          const view = self._view();
          // Write minimal fdstat: filetype=character_device(2), flags=0
          view.setUint8(fdstatPtr, 2); // filetype
          view.setUint16(fdstatPtr + 2, 0, true); // flags
          // rights_base and rights_inheriting (64-bit each, set to all rights)
          view.setBigUint64(fdstatPtr + 8, 0xFFFFFFFFFFFFFFFFn, true);
          view.setBigUint64(fdstatPtr + 16, 0xFFFFFFFFFFFFFFFFn, true);
          return ERRNO_SUCCESS;
        },

        // args_sizes_get(argc, argv_buf_size) -> errno
        args_sizes_get(argcPtr, argvBufSizePtr) {
          const view = self._view();
          view.setUint32(argcPtr, self.args.length, true);
          let bufSize = 0;
          for (const arg of self.args) {
            bufSize += new TextEncoder().encode(arg).length + 1; // +1 for null terminator
          }
          view.setUint32(argvBufSizePtr, bufSize, true);
          return ERRNO_SUCCESS;
        },

        // args_get(argv, argv_buf) -> errno
        args_get(argvPtr, argvBufPtr) {
          const view = self._view();
          const bytes = self._bytes();
          let bufOffset = argvBufPtr;

          for (let i = 0; i < self.args.length; i++) {
            view.setUint32(argvPtr + i * 4, bufOffset, true);
            const encoded = new TextEncoder().encode(self.args[i]);
            bytes.set(encoded, bufOffset);
            bytes[bufOffset + encoded.length] = 0; // null terminator
            bufOffset += encoded.length + 1;
          }

          return ERRNO_SUCCESS;
        },

        // environ_sizes_get(environc, environ_buf_size) -> errno
        environ_sizes_get(environcPtr, environBufSizePtr) {
          const view = self._view();
          const entries = Object.entries(self.env);
          view.setUint32(environcPtr, entries.length, true);
          let bufSize = 0;
          for (const [key, val] of entries) {
            bufSize += new TextEncoder().encode(`${key}=${val}`).length + 1;
          }
          view.setUint32(environBufSizePtr, bufSize, true);
          return ERRNO_SUCCESS;
        },

        // environ_get(environ, environ_buf) -> errno
        environ_get(environPtr, environBufPtr) {
          const view = self._view();
          const bytes = self._bytes();
          const entries = Object.entries(self.env);
          let bufOffset = environBufPtr;

          for (let i = 0; i < entries.length; i++) {
            view.setUint32(environPtr + i * 4, bufOffset, true);
            const str = `${entries[i][0]}=${entries[i][1]}`;
            const encoded = new TextEncoder().encode(str);
            bytes.set(encoded, bufOffset);
            bytes[bufOffset + encoded.length] = 0;
            bufOffset += encoded.length + 1;
          }

          return ERRNO_SUCCESS;
        },

        // proc_exit(rval)
        proc_exit(rval) {
          self.exitCode = rval;
          throw new WasiExit(rval);
        },

        // clock_time_get(id, precision, time) -> errno
        clock_time_get(id, precisionLo, precisionHi, timePtr) {
          const view = self._view();
          let ns;
          if (id === CLOCKID_REALTIME) {
            ns = BigInt(Math.floor(Date.now() * 1e6));
          } else if (id === CLOCKID_MONOTONIC) {
            ns = BigInt(Math.floor(performance.now() * 1e6));
          } else {
            return ERRNO_INVAL;
          }
          view.setBigUint64(timePtr, ns, true);
          return ERRNO_SUCCESS;
        },

        // random_get(buf, buf_len) -> errno
        random_get(bufPtr, bufLen) {
          const bytes = self._bytes();
          for (let i = 0; i < bufLen; i++) {
            bytes[bufPtr + i] = Math.floor(Math.random() * 256);
          }
          return ERRNO_SUCCESS;
        },

        // poll_oneoff — stub
        poll_oneoff(in_, out, nsubscriptions, neventsPtr) {
          return ERRNO_NOSYS;
        },

        // sched_yield — stub
        sched_yield() {
          return ERRNO_SUCCESS;
        },
      }
    };
  }

  getStdout() {
    return this.stdout.join('');
  }

  getStderr() {
    return this.stderr.join('');
  }
}

export { WasiExit, ERRNO_SUCCESS, ERRNO_BADF, ERRNO_NOSYS };
