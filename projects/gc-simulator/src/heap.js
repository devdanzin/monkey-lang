// Cheney Semi-Space Garbage Collector
//
// Memory layout:
//   Each object is a contiguous region in the heap buffer:
//   [tag:1][size:1][field0][field1]...[fieldN-1]
//
//   tag values:
//     0 = FORWARDING_PTR (field0 = new address)
//     1 = INT (field0 = integer value)
//     2 = PAIR (field0 = car, field1 = cdr)  — cons cell
//     3 = ARRAY (field0 = length, field1..N = elements)
//     4 = STRING (field0 = string index into string table)
//     5 = NIL (no fields)
//     6 = SYMBOL (field0 = symbol index into string table)
//
// All values in the heap are word-sized (JavaScript numbers).
// Pointers are indices into the heap array.
// Non-pointer values use a tagged representation:
//   - Heap pointers: positive integers (index into heap)
//   - Immediate integers: stored directly as JS numbers in fields
//   - NIL: represented by the sentinel value -1

const TAG = {
  FORWARDING: 0,
  INT: 1,
  PAIR: 2,
  ARRAY: 3,
  STRING: 4,
  NIL: 5,
  SYMBOL: 6,
};

const HEADER_SIZE = 2; // tag + size
const NIL = -1;

// How many fields each tag type has (excluding header)
function fieldCount(tag, sizeWord) {
  switch (tag) {
    case TAG.INT: return 1;       // value
    case TAG.PAIR: return 2;      // car, cdr
    case TAG.ARRAY: return sizeWord; // length stored separately; fields = actual element count
    case TAG.STRING: return 1;    // string table index
    case TAG.NIL: return 0;
    case TAG.SYMBOL: return 1;    // string table index
    default: return sizeWord;     // fallback: size word tells us
  }
}

// Which fields are pointers (could reference other heap objects)?
function isPointerField(tag, fieldIndex) {
  switch (tag) {
    case TAG.INT: return false;
    case TAG.PAIR: return true;     // both car and cdr can be pointers
    case TAG.ARRAY: return true;    // all elements can be pointers
    case TAG.STRING: return false;  // string table index, not a heap pointer
    case TAG.NIL: return false;
    case TAG.SYMBOL: return false;
    default: return false;
  }
}

export class Heap {
  constructor(semiSpaceSize = 1024) {
    this.semiSpaceSize = semiSpaceSize;
    // Two semi-spaces
    this.space0 = new Array(semiSpaceSize).fill(0);
    this.space1 = new Array(semiSpaceSize).fill(0);
    this.fromSpace = this.space0;
    this.toSpace = this.space1;
    this.allocPtr = 0; // bump pointer in from-space
    
    // Root set: array of { get, set } accessors
    // Each root is a function pair that reads/writes a heap pointer
    this.roots = [];
    
    // String table (for STRING and SYMBOL objects)
    this.strings = [];
    
    // Stats
    this.totalAllocated = 0;
    this.totalCollections = 0;
    this.totalCopied = 0;
  }

  // === Allocation ===
  
  _allocRaw(tag, fields) {
    const size = fields.length;
    const totalSize = HEADER_SIZE + size;
    
    if (this.allocPtr + totalSize > this.semiSpaceSize) {
      // Out of space — trigger GC
      this.collect();
      if (this.allocPtr + totalSize > this.semiSpaceSize) {
        throw new Error(`Heap overflow: need ${totalSize} words, only ${this.semiSpaceSize - this.allocPtr} available`);
      }
    }
    
    const addr = this.allocPtr;
    this.fromSpace[addr] = tag;
    this.fromSpace[addr + 1] = size;
    for (let i = 0; i < size; i++) {
      this.fromSpace[addr + HEADER_SIZE + i] = fields[i];
    }
    this.allocPtr += totalSize;
    this.totalAllocated++;
    return addr;
  }

  allocInt(value) {
    return this._allocRaw(TAG.INT, [value]);
  }

  allocPair(car, cdr) {
    return this._allocRaw(TAG.PAIR, [car, cdr]);
  }

  allocNil() {
    return this._allocRaw(TAG.NIL, []);
  }

  allocArray(elements) {
    return this._allocRaw(TAG.ARRAY, elements);
  }

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

  // === Reading ===
  
  getTag(addr) {
    return this.fromSpace[addr];
  }

  getSize(addr) {
    return this.fromSpace[addr + 1];
  }

  getField(addr, fieldIndex) {
    return this.fromSpace[addr + HEADER_SIZE + fieldIndex];
  }

  setField(addr, fieldIndex, value) {
    this.fromSpace[addr + HEADER_SIZE + fieldIndex] = value;
  }

  // Convenience accessors
  intValue(addr) {
    if (this.getTag(addr) !== TAG.INT) throw new Error('Not an INT');
    return this.getField(addr, 0);
  }

  car(addr) {
    if (this.getTag(addr) !== TAG.PAIR) throw new Error('Not a PAIR');
    return this.getField(addr, 0);
  }

  cdr(addr) {
    if (this.getTag(addr) !== TAG.PAIR) throw new Error('Not a PAIR');
    return this.getField(addr, 1);
  }

  setCar(addr, value) {
    if (this.getTag(addr) !== TAG.PAIR) throw new Error('Not a PAIR');
    this.setField(addr, 0, value);
  }

  setCdr(addr, value) {
    if (this.getTag(addr) !== TAG.PAIR) throw new Error('Not a PAIR');
    this.setField(addr, 1, value);
  }

  arrayLength(addr) {
    if (this.getTag(addr) !== TAG.ARRAY) throw new Error('Not an ARRAY');
    return this.getSize(addr);
  }

  arrayGet(addr, index) {
    if (this.getTag(addr) !== TAG.ARRAY) throw new Error('Not an ARRAY');
    return this.getField(addr, index);
  }

  arraySet(addr, index, value) {
    if (this.getTag(addr) !== TAG.ARRAY) throw new Error('Not an ARRAY');
    this.setField(addr, index, value);
  }

  stringValue(addr) {
    const tag = this.getTag(addr);
    if (tag !== TAG.STRING && tag !== TAG.SYMBOL) throw new Error('Not a STRING/SYMBOL');
    return this.strings[this.getField(addr, 0)];
  }

  isNil(addr) {
    return addr === NIL || this.getTag(addr) === TAG.NIL;
  }

  // === Root Management ===

  addRoot(getter, setter) {
    const root = { get: getter, set: setter };
    this.roots.push(root);
    return root;
  }

  removeRoot(root) {
    const idx = this.roots.indexOf(root);
    if (idx >= 0) this.roots.splice(idx, 1);
  }

  // Convenience: push a value as a root, returns a handle object { value, release() }
  pushRoot(value) {
    const handle = { value };
    const root = this.addRoot(() => handle.value, (v) => { handle.value = v; });
    handle.release = () => this.removeRoot(root);
    return handle;
  }

  // === Cheney Copying Collection ===

  collect() {
    this.totalCollections++;
    
    // Scan and alloc pointers for to-space
    let scanPtr = 0;
    let allocPtr = 0;
    const toSpace = this.toSpace;
    
    // Copy a single object, returning its new address
    const copy = (addr) => {
      if (addr === NIL) return NIL;
      if (addr < 0 || addr >= this.semiSpaceSize) return addr; // not a valid heap ptr
      
      const tag = this.fromSpace[addr];
      
      // Already forwarded?
      if (tag === TAG.FORWARDING) {
        return this.fromSpace[addr + 1]; // forwarding address stored in field 0 (at offset 1... wait)
        // Actually: header is [tag][size], so forwarding addr is at addr+1? 
        // No — when we set forwarding, we store the new addr at addr+1 (the size slot).
        // Let me use a consistent layout: FORWARDING tag, new_addr at addr+1
      }
      
      const size = this.fromSpace[addr + 1];
      const totalSize = HEADER_SIZE + size;
      
      // Copy to to-space
      const newAddr = allocPtr;
      for (let i = 0; i < totalSize; i++) {
        toSpace[newAddr + i] = this.fromSpace[addr + i];
      }
      allocPtr += totalSize;
      
      // Leave forwarding pointer in from-space
      this.fromSpace[addr] = TAG.FORWARDING;
      this.fromSpace[addr + 1] = newAddr;
      
      this.totalCopied++;
      return newAddr;
    };
    
    // Phase 1: Copy all root objects
    for (const root of this.roots) {
      const addr = root.get();
      if (addr !== NIL && addr >= 0) {
        root.set(copy(addr));
      }
    }
    
    // Phase 2: Cheney scan — BFS through copied objects
    while (scanPtr < allocPtr) {
      const tag = toSpace[scanPtr];
      const size = toSpace[scanPtr + 1];
      
      // Scan fields for pointers and copy referenced objects
      for (let i = 0; i < size; i++) {
        if (isPointerField(tag, i)) {
          const fieldVal = toSpace[scanPtr + HEADER_SIZE + i];
          if (fieldVal !== NIL && fieldVal >= 0) {
            toSpace[scanPtr + HEADER_SIZE + i] = copy(fieldVal);
          }
        }
      }
      
      scanPtr += HEADER_SIZE + size;
    }
    
    // Phase 3: Flip spaces
    const temp = this.fromSpace;
    this.fromSpace = this.toSpace;
    this.toSpace = temp;
    this.allocPtr = allocPtr;
    
    // Clear to-space (now the old from-space)
    this.toSpace.fill(0);
  }

  // === Utilities ===

  get usedWords() { return this.allocPtr; }
  get freeWords() { return this.semiSpaceSize - this.allocPtr; }
  get utilization() { return this.allocPtr / this.semiSpaceSize; }

  // Build a linked list from an array of heap addresses
  buildList(elements) {
    let list = NIL;
    for (let i = elements.length - 1; i >= 0; i--) {
      list = this.allocPair(elements[i], list);
    }
    return list;
  }

  // Convert a heap list to a JS array
  listToArray(addr) {
    const result = [];
    while (addr !== NIL && this.getTag(addr) === TAG.PAIR) {
      result.push(this.car(addr));
      addr = this.cdr(addr);
    }
    return result;
  }

  // Pretty-print a heap value
  inspect(addr, depth = 0) {
    if (depth > 10) return '...';
    if (addr === NIL) return 'nil';
    const tag = this.getTag(addr);
    switch (tag) {
      case TAG.INT: return `${this.intValue(addr)}`;
      case TAG.PAIR: return `(${this.inspect(this.car(addr), depth + 1)} . ${this.inspect(this.cdr(addr), depth + 1)})`;
      case TAG.ARRAY: {
        const elems = [];
        for (let i = 0; i < this.arrayLength(addr); i++) {
          elems.push(this.inspect(this.arrayGet(addr, i), depth + 1));
        }
        return `[${elems.join(', ')}]`;
      }
      case TAG.STRING: return `"${this.stringValue(addr)}"`;
      case TAG.SYMBOL: return `:${this.stringValue(addr)}`;
      case TAG.NIL: return 'nil';
      default: return `<unknown@${addr}>`;
    }
  }
}

export { TAG, NIL, HEADER_SIZE };
