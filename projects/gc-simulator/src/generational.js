// Generational Garbage Collector
//
// Two generations:
//   1. Nursery (young generation) — small, semi-space Cheney collection
//   2. Tenured (old generation) — large, mark-compact collection
//
// Objects are born in the nursery. After surviving `promotionAge` collections,
// they get promoted to tenured space.
//
// Write barrier: when a tenured object stores a pointer to a nursery object,
// we record it in the "remembered set" so nursery collection knows about it.

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

// Marker to distinguish nursery vs tenured addresses
// Tenured addresses are offset by TENURED_OFFSET
const TENURED_OFFSET = 1_000_000;

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

function isTenuredAddr(addr) { return addr >= TENURED_OFFSET; }
function toTenuredAddr(localAddr) { return localAddr + TENURED_OFFSET; }
function fromTenuredAddr(addr) { return addr - TENURED_OFFSET; }

export class GenerationalHeap {
  constructor(nurserySize = 256, tenuredSize = 1024, promotionAge = 2) {
    this.nurserySize = nurserySize;
    this.tenuredSize = tenuredSize;
    this.promotionAge = promotionAge;
    
    // Nursery: two semi-spaces
    this.nurseryFrom = new Array(nurserySize).fill(0);
    this.nurseryTo = new Array(nurserySize).fill(0);
    this.nurseryAllocPtr = 0;
    
    // Tenured: single space with mark-compact
    this.tenured = new Array(tenuredSize).fill(0);
    this.tenuredAllocPtr = 0;
    this.tenuredMarkBits = new Uint8Array(tenuredSize);
    this.tenuredForward = new Int32Array(tenuredSize).fill(-1);
    
    // Age tracking: addr → number of nursery collections survived
    this.ages = new Map();
    
    // Remembered set: tenured addresses that point to nursery objects
    this.rememberedSet = new Set();
    
    // Root set
    this.roots = [];
    
    // String table
    this.strings = [];
    
    // Stats
    this.stats = {
      nurseryCollections: 0,
      tenuredCollections: 0,
      promotions: 0,
      totalAllocated: 0,
      writeBarriers: 0,
    };
  }

  // === Space helpers ===
  
  _getSpace(addr) {
    if (isTenuredAddr(addr)) return this.tenured;
    return this.nurseryFrom;
  }
  
  _getLocalAddr(addr) {
    return isTenuredAddr(addr) ? fromTenuredAddr(addr) : addr;
  }
  
  // === Allocation (always in nursery) ===
  
  _allocRaw(tag, fields) {
    const size = fields.length;
    const totalSize = HEADER_SIZE + size;
    
    if (this.nurseryAllocPtr + totalSize > this.nurserySize) {
      this._collectNursery();
      if (this.nurseryAllocPtr + totalSize > this.nurserySize) {
        // Full collection
        this._collectTenured();
        this._collectNursery();
        if (this.nurseryAllocPtr + totalSize > this.nurserySize) {
          throw new Error('Heap overflow: nursery full after full GC');
        }
      }
    }
    
    const addr = this.nurseryAllocPtr;
    this.nurseryFrom[addr] = tag;
    this.nurseryFrom[addr + 1] = size;
    for (let i = 0; i < size; i++) {
      this.nurseryFrom[addr + HEADER_SIZE + i] = fields[i];
    }
    this.nurseryAllocPtr += totalSize;
    this.ages.set(addr, 0);
    this.stats.totalAllocated++;
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
  
  getTag(addr) { return this._getSpace(addr)[this._getLocalAddr(addr)]; }
  getSize(addr) { return this._getSpace(addr)[this._getLocalAddr(addr) + 1]; }
  getField(addr, i) { return this._getSpace(addr)[this._getLocalAddr(addr) + HEADER_SIZE + i]; }
  
  setField(addr, i, val) {
    this._getSpace(addr)[this._getLocalAddr(addr) + HEADER_SIZE + i] = val;
    // Write barrier: if tenured object stores pointer to nursery object
    this._writeBarrier(addr, val);
  }
  
  _writeBarrier(srcAddr, val) {
    if (isTenuredAddr(srcAddr) && !isTenuredAddr(val) && val >= 0) {
      this.rememberedSet.add(fromTenuredAddr(srcAddr));
      this.stats.writeBarriers++;
    }
  }
  
  getCar(addr) { return this.getField(addr, 0); }
  getCdr(addr) { return this.getField(addr, 1); }
  setCar(addr, val) { this.setField(addr, 0, val); }
  setCdr(addr, val) { this.setField(addr, 1, val); }
  getInt(addr) { return this.getField(addr, 0); }
  getString(addr) { return this.strings[this.getField(addr, 0)]; }
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

  // === Nursery Collection (Cheney semi-space) ===
  
  _collectNursery() {
    this.stats.nurseryCollections++;
    
    const from = this.nurseryFrom;
    const to = this.nurseryTo;
    let scanPtr = 0;
    let freePtr = 0;
    
    const forwarding = new Map(); // old nursery addr → new addr
    const promotedObjects = []; // tenured local addrs that need field updating
    const pendingAges = new Map(); // new nursery addr → new age (set after collection)
    
    const copyOrPromote = (oldAddr) => {
      if (oldAddr < 0 || isTenuredAddr(oldAddr)) return oldAddr;
      if (oldAddr >= this.nurseryAllocPtr) return oldAddr;
      if (forwarding.has(oldAddr)) return forwarding.get(oldAddr);
      
      const tag = from[oldAddr];
      const size = from[oldAddr + 1];
      const fields = fieldCount(tag, size);
      const totalSize = HEADER_SIZE + fields;
      const age = (this.ages.get(oldAddr) || 0) + 1;
      
      if (age >= this.promotionAge) {
        const tenuredLocal = this._tenuredAlloc(tag, size, from, oldAddr, fields, totalSize);
        const newAddr = toTenuredAddr(tenuredLocal);
        forwarding.set(oldAddr, newAddr);
        promotedObjects.push(tenuredLocal);
        this.stats.promotions++;
        return newAddr;
      }
      
      const newAddr = freePtr;
      for (let i = 0; i < totalSize; i++) {
        to[freePtr + i] = from[oldAddr + i];
      }
      freePtr += totalSize;
      forwarding.set(oldAddr, newAddr);
      pendingAges.set(newAddr, age);
      return newAddr;
    };
    
    // Copy/promote from roots
    for (const root of this.roots) {
      const addr = root.get();
      if (!isTenuredAddr(addr) && addr >= 0 && addr < this.nurseryAllocPtr) {
        root.set(copyOrPromote(addr));
      }
    }
    
    // Copy from remembered set
    for (const tenuredLocal of this.rememberedSet) {
      const tag = this.tenured[tenuredLocal];
      const size = this.tenured[tenuredLocal + 1];
      const fields = fieldCount(tag, size);
      for (let i = 0; i < fields; i++) {
        if (isPointerField(tag, i)) {
          const fieldVal = this.tenured[tenuredLocal + HEADER_SIZE + i];
          if (!isTenuredAddr(fieldVal) && fieldVal >= 0 && fieldVal < this.nurseryAllocPtr) {
            this.tenured[tenuredLocal + HEADER_SIZE + i] = copyOrPromote(fieldVal);
          }
        }
      }
    }
    
    // Scan to-space (Cheney BFS)
    while (scanPtr < freePtr) {
      const tag = to[scanPtr];
      const size = to[scanPtr + 1];
      const fields = fieldCount(tag, size);
      for (let i = 0; i < fields; i++) {
        if (isPointerField(tag, i)) {
          const fieldVal = to[scanPtr + HEADER_SIZE + i];
          if (!isTenuredAddr(fieldVal) && fieldVal >= 0 && fieldVal < this.nurseryAllocPtr) {
            to[scanPtr + HEADER_SIZE + i] = copyOrPromote(fieldVal);
          }
        }
      }
      scanPtr += HEADER_SIZE + fields;
    }
    
    // Scan promoted objects in tenured — update nursery pointers
    for (const tenuredLocal of promotedObjects) {
      const tag = this.tenured[tenuredLocal];
      const size = this.tenured[tenuredLocal + 1];
      const fields = fieldCount(tag, size);
      for (let i = 0; i < fields; i++) {
        if (isPointerField(tag, i)) {
          const fieldVal = this.tenured[tenuredLocal + HEADER_SIZE + i];
          if (!isTenuredAddr(fieldVal) && fieldVal >= 0) {
            if (forwarding.has(fieldVal)) {
              this.tenured[tenuredLocal + HEADER_SIZE + i] = forwarding.get(fieldVal);
            } else if (fieldVal < this.nurseryAllocPtr) {
              // Need to copy/promote this child too
              this.tenured[tenuredLocal + HEADER_SIZE + i] = copyOrPromote(fieldVal);
            }
          }
        }
      }
    }
    
    // One more scan of to-space after promoted objects may have added more
    while (scanPtr < freePtr) {
      const tag = to[scanPtr];
      const size = to[scanPtr + 1];
      const fields = fieldCount(tag, size);
      for (let i = 0; i < fields; i++) {
        if (isPointerField(tag, i)) {
          const fieldVal = to[scanPtr + HEADER_SIZE + i];
          if (!isTenuredAddr(fieldVal) && fieldVal >= 0 && fieldVal < this.nurseryAllocPtr) {
            to[scanPtr + HEADER_SIZE + i] = copyOrPromote(fieldVal);
          }
        }
      }
      scanPtr += HEADER_SIZE + fields;
    }
    
    // Swap spaces
    this.nurseryFrom = to;
    this.nurseryTo = from;
    this.nurseryAllocPtr = freePtr;
    
    // Replace ages with new ages from this collection
    this.ages = pendingAges;
    
    this.rememberedSet.clear();
  }
  
  _tenuredAlloc(tag, size, srcSpace, srcAddr, fields, totalSize) {
    if (this.tenuredAllocPtr + totalSize > this.tenuredSize) {
      this._collectTenured();
      if (this.tenuredAllocPtr + totalSize > this.tenuredSize) {
        throw new Error('Tenured space overflow');
      }
    }
    
    const addr = this.tenuredAllocPtr;
    for (let i = 0; i < totalSize; i++) {
      this.tenured[addr + i] = srcSpace[srcAddr + i];
    }
    this.tenuredAllocPtr += totalSize;
    return addr;
  }

  // === Tenured Collection (Mark-Compact) ===
  
  _collectTenured() {
    this.stats.tenuredCollections++;
    
    // Mark phase
    this.tenuredMarkBits.fill(0);
    
    const worklist = [];
    
    // Roots
    for (const root of this.roots) {
      const addr = root.get();
      if (isTenuredAddr(addr)) {
        worklist.push(fromTenuredAddr(addr));
      }
    }
    
    // Nursery → tenured references
    let nAddr = 0;
    while (nAddr < this.nurseryAllocPtr) {
      const tag = this.nurseryFrom[nAddr];
      const size = this.nurseryFrom[nAddr + 1];
      const fields = fieldCount(tag, size);
      
      for (let i = 0; i < fields; i++) {
        if (isPointerField(tag, i)) {
          const fieldVal = this.nurseryFrom[nAddr + HEADER_SIZE + i];
          if (isTenuredAddr(fieldVal)) {
            worklist.push(fromTenuredAddr(fieldVal));
          }
        }
      }
      nAddr += HEADER_SIZE + fields;
    }
    
    // DFS mark
    while (worklist.length > 0) {
      const localAddr = worklist.pop();
      if (this.tenuredMarkBits[localAddr]) continue;
      this.tenuredMarkBits[localAddr] = 1;
      
      const tag = this.tenured[localAddr];
      const size = this.tenured[localAddr + 1];
      const fields = fieldCount(tag, size);
      
      for (let i = 0; i < fields; i++) {
        if (isPointerField(tag, i)) {
          const fieldVal = this.tenured[localAddr + HEADER_SIZE + i];
          if (isTenuredAddr(fieldVal)) {
            const tLocal = fromTenuredAddr(fieldVal);
            if (!this.tenuredMarkBits[tLocal]) worklist.push(tLocal);
          }
        }
      }
    }
    
    // Compute forwarding
    this.tenuredForward.fill(-1);
    let newAddr = 0;
    let addr = 0;
    while (addr < this.tenuredAllocPtr) {
      const tag = this.tenured[addr];
      const size = this.tenured[addr + 1];
      const totalSize = HEADER_SIZE + fieldCount(tag, size);
      
      if (this.tenuredMarkBits[addr]) {
        this.tenuredForward[addr] = newAddr;
        newAddr += totalSize;
      }
      addr += totalSize;
    }
    
    // Update pointers in tenured
    addr = 0;
    while (addr < this.tenuredAllocPtr) {
      const tag = this.tenured[addr];
      const size = this.tenured[addr + 1];
      const fields = fieldCount(tag, size);
      const totalSize = HEADER_SIZE + fields;
      
      if (this.tenuredMarkBits[addr]) {
        for (let i = 0; i < fields; i++) {
          if (isPointerField(tag, i)) {
            const fieldVal = this.tenured[addr + HEADER_SIZE + i];
            if (isTenuredAddr(fieldVal)) {
              const tLocal = fromTenuredAddr(fieldVal);
              if (this.tenuredForward[tLocal] >= 0) {
                this.tenured[addr + HEADER_SIZE + i] = toTenuredAddr(this.tenuredForward[tLocal]);
              }
            }
          }
        }
      }
      addr += totalSize;
    }
    
    // Update roots
    for (const root of this.roots) {
      const rAddr = root.get();
      if (isTenuredAddr(rAddr)) {
        const tLocal = fromTenuredAddr(rAddr);
        if (this.tenuredForward[tLocal] >= 0) {
          root.set(toTenuredAddr(this.tenuredForward[tLocal]));
        }
      }
    }
    
    // Update nursery → tenured pointers
    nAddr = 0;
    while (nAddr < this.nurseryAllocPtr) {
      const tag = this.nurseryFrom[nAddr];
      const size = this.nurseryFrom[nAddr + 1];
      const fields = fieldCount(tag, size);
      
      for (let i = 0; i < fields; i++) {
        if (isPointerField(tag, i)) {
          const fieldVal = this.nurseryFrom[nAddr + HEADER_SIZE + i];
          if (isTenuredAddr(fieldVal)) {
            const tLocal = fromTenuredAddr(fieldVal);
            if (this.tenuredForward[tLocal] >= 0) {
              this.nurseryFrom[nAddr + HEADER_SIZE + i] = toTenuredAddr(this.tenuredForward[tLocal]);
            }
          }
        }
      }
      nAddr += HEADER_SIZE + fields;
    }
    
    // Compact
    addr = 0;
    while (addr < this.tenuredAllocPtr) {
      const tag = this.tenured[addr];
      const size = this.tenured[addr + 1];
      const fields = fieldCount(tag, size);
      const totalSize = HEADER_SIZE + fields;
      
      if (this.tenuredMarkBits[addr]) {
        const na = this.tenuredForward[addr];
        if (na !== addr) {
          for (let i = 0; i < totalSize; i++) {
            this.tenured[na + i] = this.tenured[addr + i];
          }
        }
      }
      addr += totalSize;
    }
    
    this.tenuredAllocPtr = newAddr;
  }

  // === Stats ===
  
  get nurseryUsed() { return this.nurseryAllocPtr; }
  get tenuredUsed() { return this.tenuredAllocPtr; }
}

export { TAG, HEADER_SIZE, NIL, TENURED_OFFSET, isTenuredAddr };
