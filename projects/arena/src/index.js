/**
 * Tiny Arena Allocator
 * 
 * Fast bump-pointer allocation in fixed-size memory arenas:
 * - Arena: fixed-size buffer, bump-pointer alloc, free-all-at-once
 * - Pool: fixed-size object pool with free list
 * - StackAllocator: LIFO allocation with markers
 */

class Arena {
  constructor(size) {
    this.buffer = new ArrayBuffer(size);
    this.view = new DataView(this.buffer);
    this.bytes = new Uint8Array(this.buffer);
    this.size = size;
    this.offset = 0;
    this.allocCount = 0;
  }

  alloc(bytes, align = 1) {
    // Align offset
    const aligned = (this.offset + align - 1) & ~(align - 1);
    if (aligned + bytes > this.size) return null;
    const ptr = aligned;
    this.offset = aligned + bytes;
    this.allocCount++;
    return ptr;
  }

  allocTyped(type) {
    const sizes = { i8: 1, u8: 1, i16: 2, u16: 2, i32: 4, u32: 4, f32: 4, f64: 8 };
    const size = sizes[type];
    if (!size) throw new Error(`Unknown type: ${type}`);
    return this.alloc(size, size);
  }

  write(ptr, value, type = 'u8') {
    switch (type) {
      case 'i8': this.view.setInt8(ptr, value); break;
      case 'u8': this.view.setUint8(ptr, value); break;
      case 'i16': this.view.setInt16(ptr, value, true); break;
      case 'u16': this.view.setUint16(ptr, value, true); break;
      case 'i32': this.view.setInt32(ptr, value, true); break;
      case 'u32': this.view.setUint32(ptr, value, true); break;
      case 'f32': this.view.setFloat32(ptr, value, true); break;
      case 'f64': this.view.setFloat64(ptr, value, true); break;
    }
  }

  read(ptr, type = 'u8') {
    switch (type) {
      case 'i8': return this.view.getInt8(ptr);
      case 'u8': return this.view.getUint8(ptr);
      case 'i16': return this.view.getInt16(ptr, true);
      case 'u16': return this.view.getUint16(ptr, true);
      case 'i32': return this.view.getInt32(ptr, true);
      case 'u32': return this.view.getUint32(ptr, true);
      case 'f32': return this.view.getFloat32(ptr, true);
      case 'f64': return this.view.getFloat64(ptr, true);
    }
  }

  writeBytes(ptr, data) {
    this.bytes.set(data, ptr);
  }

  readBytes(ptr, length) {
    return this.bytes.slice(ptr, ptr + length);
  }

  reset() {
    this.offset = 0;
    this.allocCount = 0;
  }

  used() { return this.offset; }
  free() { return this.size - this.offset; }
}

class Pool {
  constructor(objectSize, count) {
    this.objectSize = objectSize;
    this.count = count;
    this.arena = new Arena(objectSize * count);
    this.freeList = [];
    
    // Initialize free list with all slots
    for (let i = count - 1; i >= 0; i--) {
      this.freeList.push(i * objectSize);
    }
    this.allocated = 0;
  }

  alloc() {
    if (this.freeList.length === 0) return null;
    this.allocated++;
    return this.freeList.pop();
  }

  free(ptr) {
    this.freeList.push(ptr);
    this.allocated--;
  }

  write(ptr, data) { this.arena.writeBytes(ptr, data); }
  read(ptr) { return this.arena.readBytes(ptr, this.objectSize); }

  get available() { return this.freeList.length; }
  get used() { return this.allocated; }
}

class StackAllocator {
  constructor(size) {
    this.arena = new Arena(size);
    this.markers = [];
  }

  alloc(bytes, align = 1) {
    return this.arena.alloc(bytes, align);
  }

  pushMarker() {
    this.markers.push(this.arena.offset);
  }

  popMarker() {
    if (this.markers.length === 0) throw new Error('No markers');
    this.arena.offset = this.markers.pop();
  }

  write(ptr, value, type) { this.arena.write(ptr, value, type); }
  read(ptr, type) { return this.arena.read(ptr, type); }
  used() { return this.arena.used(); }
  free() { return this.arena.free(); }
}

module.exports = { Arena, Pool, StackAllocator };
