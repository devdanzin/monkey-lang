// Mark-Compact Garbage Collector
//
// Uses the same object layout as Cheney semi-space:
//   [tag:1][size:1][field0][field1]...[fieldN-1]
//
// But instead of two semi-spaces, uses a single contiguous heap.
// GC happens in three phases:
//   1. Mark: DFS from roots, mark all reachable objects
//   2. Compute forwarding: scan heap linearly, assign new addresses to live objects
//   3. Update + compact: update all pointers, then slide objects to new positions

const TAG = {
  FORWARDING: 0,
  INT: 1,
  PAIR: 2,
  ARRAY: 3,
  STRING: 4,
  NIL: 5,
  SYMBOL: 6,
};

const HEADER_SIZE = 2;
const NIL = -1;

function fieldCount(tag, sizeWord) {
  switch (tag) {
    case TAG.INT: return 1;
    case TAG.PAIR: return 2;
    case TAG.ARRAY: return sizeWord;
    case TAG.STRING: return 1;
    case TAG.NIL: return 0;
    case TAG.SYMBOL: return 1;
    default: return sizeWord;
  }
}

function isPointerField(tag, fieldIndex) {
  switch (tag) {
    case TAG.INT: return false;
    case TAG.PAIR: return true;
    case TAG.ARRAY: return true;
    case TAG.STRING: return false;
    case TAG.NIL: return false;
    case TAG.SYMBOL: return false;
    default: return false;
  }
}

export class MarkCompactHeap {
  constructor(heapSize = 2048) {
    this.heapSize = heapSize;
    this.heap = new Array(heapSize).fill(0);
    this.allocPtr = 0;
    
    // Mark bitmap: one bit per word (could optimize with actual bitset)
    this.markBits = new Uint8Array(heapSize); // 1 = marked, 0 = unmarked
    
    // Forwarding addresses computed during compact
    this.forward = new Int32Array(heapSize).fill(-1);
    
    this.roots = [];
    this.strings = [];
    
    this.totalAllocated = 0;
    this.totalCollections = 0;
    this.totalCompacted = 0;
  }

  // === Allocation ===
  
  _allocRaw(tag, fields) {
    const size = fields.length;
    const totalSize = HEADER_SIZE + size;
    
    if (this.allocPtr + totalSize > this.heapSize) {
      this.collect();
      if (this.allocPtr + totalSize > this.heapSize) {
        throw new Error(`Heap overflow: need ${totalSize} words, only ${this.heapSize - this.allocPtr} available`);
      }
    }
    
    const addr = this.allocPtr;
    this.heap[addr] = tag;
    this.heap[addr + 1] = size;
    for (let i = 0; i < size; i++) {
      this.heap[addr + HEADER_SIZE + i] = fields[i];
    }
    this.allocPtr += totalSize;
    this.totalAllocated++;
    return addr;
  }

  allocInt(value) { return this._allocRaw(TAG.INT, [value]); }
  allocPair(car, cdr) { return this._allocRaw(TAG.PAIR, [car, cdr]); }
  allocNil() { return this._allocRaw(TAG.NIL, []); }
  allocArray(elements) { return this._allocRaw(TAG.ARRAY, elements); }
  allocString(str) {
    const idx = this.strings.length;
    this.strings.push(str);
    return this._allocRaw(TAG.STRING, [idx]);
  }
  allocSymbol(name) {
    const idx = this.strings.length;
    this.strings.push(name);
    return this._allocRaw(TAG.SYMBOL, [idx]);
  }

  // === Read/Write ===
  
  getTag(addr) { return this.heap[addr]; }
  getSize(addr) { return this.heap[addr + 1]; }
  getField(addr, i) { return this.heap[addr + HEADER_SIZE + i]; }
  setField(addr, i, val) { this.heap[addr + HEADER_SIZE + i] = val; }
  
  getCar(addr) { return this.getField(addr, 0); }
  getCdr(addr) { return this.getField(addr, 1); }
  setCar(addr, val) { this.setField(addr, 0, val); }
  setCdr(addr, val) { this.setField(addr, 1, val); }
  getInt(addr) { return this.getField(addr, 0); }
  getString(addr) { return this.strings[this.getField(addr, 0)]; }
  getSymbol(addr) { return this.strings[this.getField(addr, 0)]; }
  getArrayLength(addr) { return this.getSize(addr); }
  getArrayElement(addr, i) { return this.getField(addr, i); }
  setArrayElement(addr, i, val) { this.setField(addr, i, val); }

  // === Root management ===
  
  addRoot(get, set) {
    const root = { get, set };
    this.roots.push(root);
    return root;
  }
  
  removeRoot(root) {
    const idx = this.roots.indexOf(root);
    if (idx >= 0) this.roots.splice(idx, 1);
  }

  // === Mark-Compact Collection ===
  
  collect() {
    this.totalCollections++;
    
    // Phase 1: Mark
    this.markBits.fill(0);
    this._mark();
    
    // Phase 2: Compute forwarding addresses
    this._computeForwarding();
    
    // Phase 3: Update pointers and compact
    this._updateAndCompact();
  }
  
  // Phase 1: Mark all reachable objects via DFS
  _mark() {
    const worklist = [];
    
    // Add all roots to worklist
    for (const root of this.roots) {
      const addr = root.get();
      if (addr >= 0 && addr < this.allocPtr) {
        worklist.push(addr);
      }
    }
    
    while (worklist.length > 0) {
      const addr = worklist.pop();
      
      // Already marked?
      if (this.markBits[addr]) continue;
      
      // Mark this object (mark the header word position)
      this.markBits[addr] = 1;
      
      // Traverse pointer fields
      const tag = this.heap[addr];
      const size = this.heap[addr + 1];
      const fields = fieldCount(tag, size);
      
      for (let i = 0; i < fields; i++) {
        if (isPointerField(tag, i)) {
          const fieldVal = this.heap[addr + HEADER_SIZE + i];
          if (fieldVal >= 0 && fieldVal < this.allocPtr && !this.markBits[fieldVal]) {
            worklist.push(fieldVal);
          }
        }
      }
    }
  }
  
  // Phase 2: Compute new addresses for live objects
  _computeForwarding() {
    this.forward.fill(-1);
    let newAddr = 0;
    let addr = 0;
    
    while (addr < this.allocPtr) {
      const tag = this.heap[addr];
      const size = this.heap[addr + 1];
      const totalSize = HEADER_SIZE + fieldCount(tag, size);
      
      if (this.markBits[addr]) {
        // Live object — assign new address
        this.forward[addr] = newAddr;
        newAddr += totalSize;
      }
      
      addr += totalSize;
    }
    
    this._newAllocPtr = newAddr;
  }
  
  // Phase 3: Update all pointers and slide objects
  _updateAndCompact() {
    // First pass: update all pointer fields in live objects
    let addr = 0;
    while (addr < this.allocPtr) {
      const tag = this.heap[addr];
      const size = this.heap[addr + 1];
      const fields = fieldCount(tag, size);
      const totalSize = HEADER_SIZE + fields;
      
      if (this.markBits[addr]) {
        // Update pointer fields
        for (let i = 0; i < fields; i++) {
          if (isPointerField(tag, i)) {
            const fieldVal = this.heap[addr + HEADER_SIZE + i];
            if (fieldVal >= 0 && this.forward[fieldVal] >= 0) {
              this.heap[addr + HEADER_SIZE + i] = this.forward[fieldVal];
            }
          }
        }
      }
      
      addr += totalSize;
    }
    
    // Update roots
    for (const root of this.roots) {
      const oldAddr = root.get();
      if (oldAddr >= 0 && this.forward[oldAddr] >= 0) {
        root.set(this.forward[oldAddr]);
      }
    }
    
    // Second pass: slide objects to new positions
    addr = 0;
    while (addr < this.allocPtr) {
      const tag = this.heap[addr];
      const size = this.heap[addr + 1];
      const fields = fieldCount(tag, size);
      const totalSize = HEADER_SIZE + fields;
      
      if (this.markBits[addr]) {
        const newAddr = this.forward[addr];
        if (newAddr !== addr) {
          // Copy object to new position
          for (let i = 0; i < totalSize; i++) {
            this.heap[newAddr + i] = this.heap[addr + i];
          }
        }
        this.totalCompacted++;
      }
      
      addr += totalSize;
    }
    
    // Update alloc pointer
    this.allocPtr = this._newAllocPtr;
    
    // Clear the rest of the heap
    for (let i = this.allocPtr; i < this.heapSize; i++) {
      this.heap[i] = 0;
    }
  }
  
  // === Stats ===
  
  get usedWords() { return this.allocPtr; }
  get freeWords() { return this.heapSize - this.allocPtr; }
  get utilizationPercent() { return (this.allocPtr / this.heapSize * 100).toFixed(1); }
}

export { TAG, HEADER_SIZE, NIL, fieldCount, isPointerField };
