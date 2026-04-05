'use strict';

// ============================================================
// Forth Interpreter — Stack-based, dictionary-threaded
// ============================================================

class ForthError extends Error {
  constructor(msg) { super(msg); this.name = 'ForthError'; }
}

class Forth {
  constructor(opts = {}) {
    // Data stack and return stack
    this.stack = [];
    this.rstack = [];
    
    // Memory (linear, byte-addressable with cell alignment)
    this.memory = new Int32Array(opts.memorySize || 65536);
    this.here = 0; // next free memory cell
    
    // Dictionary: linked list of word entries
    // Each entry: { name, immediate, hidden, code }
    this.dictionary = [];
    this.latestDef = null; // word being compiled
    
    // State: 0 = interpret, 1 = compile
    this.state = 0;
    
    // Compile buffer (for colon definitions)
    this.compileBuffer = [];
    
    // Output buffer
    this.output = '';
    
    // Input source
    this.inputBuffer = '';
    this.inputPos = 0;
    
    // BASE for number formatting
    this.base = 10;
    
    this._initPrimitives();
  }

  // === Stack Operations ===
  push(v) { this.stack.push(v); }
  pop() {
    if (this.stack.length === 0) throw new ForthError('Stack underflow');
    return this.stack.pop();
  }
  peek() {
    if (this.stack.length === 0) throw new ForthError('Stack underflow');
    return this.stack[this.stack.length - 1];
  }
  rpush(v) { this.rstack.push(v); }
  rpop() {
    if (this.rstack.length === 0) throw new ForthError('Return stack underflow');
    return this.rstack.pop();
  }

  // === Memory ===
  store(addr, val) { this.memory[addr] = val; }
  fetch(addr) { return this.memory[addr]; }
  allot(n) { const addr = this.here; this.here += n; return addr; }
  comma(val) { this.memory[this.here++] = val; }

  // === Dictionary ===
  addWord(name, code, immediate = false) {
    this.dictionary.push({ name: name.toUpperCase(), immediate, hidden: false, code });
  }

  findWord(name) {
    const upper = name.toUpperCase();
    for (let i = this.dictionary.length - 1; i >= 0; i--) {
      const w = this.dictionary[i];
      if (!w.hidden && w.name === upper) return w;
    }
    return null;
  }

  // === Output ===
  emit(ch) { this.output += typeof ch === 'number' ? String.fromCharCode(ch) : ch; }
  type(s) { this.output += s; }

  // === Tokenizer ===
  nextToken() {
    // Skip whitespace
    while (this.inputPos < this.inputBuffer.length && 
           /\s/.test(this.inputBuffer[this.inputPos])) {
      this.inputPos++;
    }
    if (this.inputPos >= this.inputBuffer.length) return null;
    
    let start = this.inputPos;
    while (this.inputPos < this.inputBuffer.length && 
           !/\s/.test(this.inputBuffer[this.inputPos])) {
      this.inputPos++;
    }
    return this.inputBuffer.substring(start, this.inputPos);
  }

  // Parse to delimiter (for S", .", etc.)
  parseToDelimiter(delim) {
    // Skip one leading space if present
    if (this.inputPos < this.inputBuffer.length && this.inputBuffer[this.inputPos] === ' ') {
      this.inputPos++;
    }
    const start = this.inputPos;
    while (this.inputPos < this.inputBuffer.length && this.inputBuffer[this.inputPos] !== delim) {
      this.inputPos++;
    }
    const result = this.inputBuffer.substring(start, this.inputPos);
    if (this.inputPos < this.inputBuffer.length) this.inputPos++; // skip delimiter
    return result;
  }

  // === Number Parsing ===
  parseNumber(token) {
    // Try current base
    const n = parseInt(token, this.base);
    if (!isNaN(n) && n.toString(this.base).toUpperCase() === token.toUpperCase()) return n;
    // Try decimal as fallback for negative numbers
    const d = parseInt(token, 10);
    if (!isNaN(d) && d.toString(10) === token) return d;
    // Try float
    const f = parseFloat(token);
    if (!isNaN(f) && f.toString() === token) return f;
    return null;
  }

  // === Interpreter ===
  evaluate(input) {
    this.inputBuffer = input;
    this.inputPos = 0;
    
    let token;
    while ((token = this.nextToken()) !== null) {
      this._processToken(token);
    }
    return this.output;
  }

  _processToken(token) {
    const word = this.findWord(token);
    
    if (this.state === 0) {
      // Interpret mode
      if (word) {
        word.code(this);
      } else {
        const num = this.parseNumber(token);
        if (num !== null) {
          this.push(num);
        } else {
          throw new ForthError(`Undefined word: ${token}`);
        }
      }
    } else {
      // Compile mode
      if (word && word.immediate) {
        word.code(this);
      } else if (word) {
        this.compileBuffer.push({ type: 'call', word });
      } else {
        const num = this.parseNumber(token);
        if (num !== null) {
          this.compileBuffer.push({ type: 'literal', value: num });
        } else {
          throw new ForthError(`Undefined word: ${token}`);
        }
      }
    }
  }

  // Execute compiled code array
  _exec(code) {
    let ip = 0;
    while (ip < code.length) {
      const instr = code[ip];
      if (instr.type === 'call') {
        instr.word.code(this);
      } else if (instr.type === 'literal') {
        this.push(instr.value);
      } else if (instr.type === 'branch') {
        ip = instr.target;
        continue;
      } else if (instr.type === 'branch0') {
        const cond = this.pop();
        if (cond === 0) { ip = instr.target; continue; }
      } else if (instr.type === 'do') {
        const start = this.pop();
        const limit = this.pop();
        this.rpush(start);
        this.rpush(limit);
      } else if (instr.type === 'loop') {
        const limit = this.rpop();
        let index = this.rpop();
        index += (instr.increment !== undefined) ? instr.increment : 1;
        if ((instr.increment !== undefined && instr.increment < 0) ? index > limit : index < limit) {
          this.rpush(index);
          this.rpush(limit);
          ip = instr.target;
          continue;
        }
      } else if (instr.type === 'plusloop') {
        const limit = this.rpop();
        let index = this.rpop();
        const inc = this.pop();
        const oldDiff = index - limit;
        index += inc;
        const newDiff = index - limit;
        // Loop terminates when the difference crosses zero
        if ((oldDiff < 0 && newDiff >= 0) || (oldDiff >= 0 && newDiff < 0)) {
          // done
        } else {
          this.rpush(index);
          this.rpush(limit);
          ip = instr.target;
          continue;
        }
      } else if (instr.type === 'i') {
        // Loop index: second from top of return stack
        this.push(this.rstack[this.rstack.length - 2]);
      } else if (instr.type === 'j') {
        // Outer loop index
        this.push(this.rstack[this.rstack.length - 4]);
      } else if (instr.type === 'leave') {
        this.rpop(); // limit
        this.rpop(); // index
        ip = instr.target;
        continue;
      } else if (instr.type === 'recurse') {
        this._exec(code);
      } else if (instr.type === 'does>') {
        // Take remaining code after this instruction
        const doesCode = code.slice(ip + 1);
        // Patch the most recently created word
        const lastWord = this.dictionary[this.dictionary.length - 1];
        const origCode = lastWord.code;
        lastWord.code = (f) => {
          origCode(f); // push data address
          f._exec(doesCode);
        };
        return; // stop executing the defining word
      }
      ip++;
    }
  }

  // === Initialize all primitive words ===
  _initPrimitives() {
    const f = this;

    // Arithmetic
    f.addWord('+', (f) => { const b = f.pop(), a = f.pop(); f.push(a + b); });
    f.addWord('-', (f) => { const b = f.pop(), a = f.pop(); f.push(a - b); });
    f.addWord('*', (f) => { const b = f.pop(), a = f.pop(); f.push(a * b); });
    f.addWord('/', (f) => { const b = f.pop(), a = f.pop(); if (b === 0) throw new ForthError('Division by zero'); f.push(Math.trunc(a / b)); });
    f.addWord('MOD', (f) => { const b = f.pop(), a = f.pop(); f.push(a % b); });
    f.addWord('/MOD', (f) => { const b = f.pop(), a = f.pop(); f.push(a % b); f.push(Math.trunc(a / b)); });
    f.addWord('NEGATE', (f) => { f.push(-f.pop()); });
    f.addWord('ABS', (f) => { f.push(Math.abs(f.pop())); });
    f.addWord('MIN', (f) => { const b = f.pop(), a = f.pop(); f.push(Math.min(a, b)); });
    f.addWord('MAX', (f) => { const b = f.pop(), a = f.pop(); f.push(Math.max(a, b)); });
    f.addWord('1+', (f) => { f.push(f.pop() + 1); });
    f.addWord('1-', (f) => { f.push(f.pop() - 1); });
    f.addWord('2+', (f) => { f.push(f.pop() + 2); });
    f.addWord('2-', (f) => { f.push(f.pop() - 2); });
    f.addWord('2*', (f) => { f.push(f.pop() * 2); });
    f.addWord('2/', (f) => { f.push(Math.trunc(f.pop() / 2)); });

    // Bitwise
    f.addWord('AND', (f) => { const b = f.pop(), a = f.pop(); f.push(a & b); });
    f.addWord('OR', (f) => { const b = f.pop(), a = f.pop(); f.push(a | b); });
    f.addWord('XOR', (f) => { const b = f.pop(), a = f.pop(); f.push(a ^ b); });
    f.addWord('INVERT', (f) => { f.push(~f.pop()); });
    f.addWord('LSHIFT', (f) => { const n = f.pop(), v = f.pop(); f.push(v << n); });
    f.addWord('RSHIFT', (f) => { const n = f.pop(), v = f.pop(); f.push(v >>> n); });

    // Comparison
    f.addWord('=', (f) => { const b = f.pop(), a = f.pop(); f.push(a === b ? -1 : 0); });
    f.addWord('<>', (f) => { const b = f.pop(), a = f.pop(); f.push(a !== b ? -1 : 0); });
    f.addWord('<', (f) => { const b = f.pop(), a = f.pop(); f.push(a < b ? -1 : 0); });
    f.addWord('>', (f) => { const b = f.pop(), a = f.pop(); f.push(a > b ? -1 : 0); });
    f.addWord('<=', (f) => { const b = f.pop(), a = f.pop(); f.push(a <= b ? -1 : 0); });
    f.addWord('>=', (f) => { const b = f.pop(), a = f.pop(); f.push(a >= b ? -1 : 0); });
    f.addWord('0=', (f) => { f.push(f.pop() === 0 ? -1 : 0); });
    f.addWord('0<', (f) => { f.push(f.pop() < 0 ? -1 : 0); });
    f.addWord('0>', (f) => { f.push(f.pop() > 0 ? -1 : 0); });
    f.addWord('0<>', (f) => { f.push(f.pop() !== 0 ? -1 : 0); });

    // Boolean
    f.addWord('TRUE', (f) => { f.push(-1); });
    f.addWord('FALSE', (f) => { f.push(0); });
    f.addWord('NOT', (f) => { f.push(f.pop() === 0 ? -1 : 0); });

    // Stack manipulation
    f.addWord('DUP', (f) => { f.push(f.peek()); });
    f.addWord('DROP', (f) => { f.pop(); });
    f.addWord('SWAP', (f) => { const b = f.pop(), a = f.pop(); f.push(b); f.push(a); });
    f.addWord('OVER', (f) => { const b = f.pop(), a = f.pop(); f.push(a); f.push(b); f.push(a); });
    f.addWord('ROT', (f) => { const c = f.pop(), b = f.pop(), a = f.pop(); f.push(b); f.push(c); f.push(a); });
    f.addWord('-ROT', (f) => { const c = f.pop(), b = f.pop(), a = f.pop(); f.push(c); f.push(a); f.push(b); });
    f.addWord('NIP', (f) => { const b = f.pop(); f.pop(); f.push(b); });
    f.addWord('TUCK', (f) => { const b = f.pop(), a = f.pop(); f.push(b); f.push(a); f.push(b); });
    f.addWord('2DUP', (f) => { const b = f.pop(), a = f.pop(); f.push(a); f.push(b); f.push(a); f.push(b); });
    f.addWord('2DROP', (f) => { f.pop(); f.pop(); });
    f.addWord('2SWAP', (f) => { const d = f.pop(), c = f.pop(), b = f.pop(), a = f.pop(); f.push(c); f.push(d); f.push(a); f.push(b); });
    f.addWord('2OVER', (f) => { const d = f.pop(), c = f.pop(), b = f.pop(), a = f.pop(); f.push(a); f.push(b); f.push(c); f.push(d); f.push(a); f.push(b); });
    f.addWord('?DUP', (f) => { const v = f.peek(); if (v !== 0) f.push(v); });
    f.addWord('DEPTH', (f) => { f.push(f.stack.length); });
    f.addWord('PICK', (f) => { const n = f.pop(); f.push(f.stack[f.stack.length - 1 - n]); });
    f.addWord('ROLL', (f) => {
      const n = f.pop();
      if (n > 0) {
        const val = f.stack.splice(f.stack.length - 1 - n, 1)[0];
        f.push(val);
      }
    });

    // Return stack
    f.addWord('>R', (f) => { f.rpush(f.pop()); });
    f.addWord('R>', (f) => { f.push(f.rpop()); });
    f.addWord('R@', (f) => { f.push(f.rstack[f.rstack.length - 1]); });

    // Memory
    f.addWord('!', (f) => { const addr = f.pop(), val = f.pop(); f.store(addr, val); });
    f.addWord('@', (f) => { const addr = f.pop(); f.push(f.fetch(addr)); });
    f.addWord('+!', (f) => { const addr = f.pop(), val = f.pop(); f.store(addr, f.fetch(addr) + val); });
    f.addWord('HERE', (f) => { f.push(f.here); });
    f.addWord('ALLOT', (f) => { f.here += f.pop(); });
    f.addWord(',', (f) => { f.comma(f.pop()); });
    f.addWord('CELLS', (f) => { f.push(f.pop()); }); // cells = 1 unit in our impl
    f.addWord('CELL+', (f) => { f.push(f.pop() + 1); });

    // I/O
    f.addWord('.', (f) => { f.type(f.pop().toString() + ' '); });
    f.addWord('.S', (f) => { f.type('<' + f.stack.length + '> ' + f.stack.join(' ') + ' '); });
    f.addWord('EMIT', (f) => { f.emit(f.pop()); });
    f.addWord('CR', (f) => { f.type('\n'); });
    f.addWord('SPACE', (f) => { f.type(' '); });
    f.addWord('SPACES', (f) => { const n = f.pop(); f.type(' '.repeat(Math.max(0, n))); });
    f.addWord('BL', (f) => { f.push(32); });
    f.addWord('.R', (f) => { 
      const width = f.pop(), n = f.pop();
      const s = n.toString();
      f.type(s.length < width ? ' '.repeat(width - s.length) + s : s);
    });

    // String literals  ." ..."
    f.addWord('."', (f) => {
      if (f.state === 0) {
        const s = f.parseToDelimiter('"');
        f.type(s);
      } else {
        const s = f.parseToDelimiter('"');
        f.compileBuffer.push({ type: 'call', word: { code: (f) => f.type(s) } });
      }
    }, true);

    f.addWord('S"', (f) => {
      if (f.state === 0) {
        const s = f.parseToDelimiter('"');
        f.push(s);
        f.push(s.length);
      } else {
        const s = f.parseToDelimiter('"');
        f.compileBuffer.push({ type: 'call', word: { code: (f) => { f.push(s); f.push(s.length); } } });
      }
    }, true);

    f.addWord('TYPE', (f) => { const len = f.pop(); const s = f.pop(); f.type(typeof s === 'string' ? s.substring(0, len) : s.toString()); });

    // Comments
    f.addWord('(', (f) => { f.parseToDelimiter(')'); }, true);
    f.addWord('\\', (f) => { f.inputPos = f.inputBuffer.length; }, true);

    // Defining words
    f.addWord(':', (f) => {
      const name = f.nextToken();
      if (!name) throw new ForthError('Expected word name');
      f.latestDef = name;
      f.compileBuffer = [];
      f.state = 1;
      f._colonStartPos = f.inputPos;
    });

    f.addWord(';', (f) => {
      const code = [...f.compileBuffer];
      const name = f.latestDef;
      const startPos = f._colonStartPos || 0;
      // Capture source between : name ... ;
      const source = f.inputBuffer.substring(startPos, f.inputPos).replace(/\s*;\s*$/, '').trim();
      f.addWord(name, (f) => { f._exec(code); });
      f.dictionary[f.dictionary.length - 1]._source = source;
      f.state = 0;
      f.latestDef = null;
    }, true);

    // Control flow (compile-time only, IMMEDIATE)
    f.addWord('IF', (f) => {
      f.compileBuffer.push({ type: 'branch0', target: -1 });
      f.rpush(f.compileBuffer.length - 1); // save position for patching
    }, true);

    f.addWord('ELSE', (f) => {
      f.compileBuffer.push({ type: 'branch', target: -1 });
      const ifPos = f.rpop();
      f.compileBuffer[ifPos].target = f.compileBuffer.length;
      f.rpush(f.compileBuffer.length - 1);
    }, true);

    f.addWord('THEN', (f) => {
      const pos = f.rpop();
      f.compileBuffer[pos].target = f.compileBuffer.length;
    }, true);

    // DO...LOOP
    f.addWord('DO', (f) => {
      f.compileBuffer.push({ type: 'do' });
      f.rpush(f.compileBuffer.length); // loop start
    }, true);

    f.addWord('LOOP', (f) => {
      const loopStart = f.rpop();
      f.compileBuffer.push({ type: 'loop', target: loopStart });
    }, true);

    f.addWord('+LOOP', (f) => {
      const loopStart = f.rpop();
      f.compileBuffer.push({ type: 'plusloop', target: loopStart });
    }, true);

    f.addWord('I', (f) => {
      if (f.state === 1) {
        f.compileBuffer.push({ type: 'i' });
      } else {
        f.push(f.rstack[f.rstack.length - 2]);
      }
    }, true);

    f.addWord('J', (f) => {
      if (f.state === 1) {
        f.compileBuffer.push({ type: 'j' });
      } else {
        f.push(f.rstack[f.rstack.length - 4]);
      }
    }, true);

    f.addWord('LEAVE', (f) => {
      // Find the matching LOOP and patch later
      f.compileBuffer.push({ type: 'leave', target: -1 });
      // We need to patch this when LOOP is reached — store leave positions
      // Simple approach: use a second return stack marker
    }, true);

    // BEGIN...UNTIL / BEGIN...WHILE...REPEAT
    f.addWord('BEGIN', (f) => {
      f.rpush(f.compileBuffer.length);
    }, true);

    f.addWord('UNTIL', (f) => {
      const beginPos = f.rpop();
      f.compileBuffer.push({ type: 'branch0', target: beginPos });
    }, true);

    f.addWord('WHILE', (f) => {
      f.compileBuffer.push({ type: 'branch0', target: -1 });
      f.rpush(f.compileBuffer.length - 1);
    }, true);

    f.addWord('REPEAT', (f) => {
      const whilePos = f.rpop();
      const beginPos = f.rpop();
      f.compileBuffer.push({ type: 'branch', target: beginPos });
      f.compileBuffer[whilePos].target = f.compileBuffer.length;
    }, true);

    // RECURSE
    f.addWord('RECURSE', (f) => {
      f.compileBuffer.push({ type: 'recurse' });
    }, true);

    // VARIABLE and CONSTANT
    f.addWord('VARIABLE', (f) => {
      const name = f.nextToken();
      if (!name) throw new ForthError('Expected variable name');
      const addr = f.allot(1);
      f.addWord(name, (f) => { f.push(addr); });
    });

    f.addWord('CONSTANT', (f) => {
      const name = f.nextToken();
      if (!name) throw new ForthError('Expected constant name');
      const val = f.pop();
      f.addWord(name, (f) => { f.push(val); });
    });

    // VALUE and TO
    f.addWord('VALUE', (f) => {
      const name = f.nextToken();
      if (!name) throw new ForthError('Expected value name');
      const val = f.pop();
      const addr = f.allot(1);
      f.store(addr, val);
      f.addWord(name, (f) => { f.push(f.fetch(addr)); });
      // Store addr metadata for TO
      f.dictionary[f.dictionary.length - 1]._valueAddr = addr;
    });

    f.addWord('TO', (f) => {
      const name = f.nextToken();
      if (!name) throw new ForthError('Expected value name');
      const word = f.findWord(name);
      if (!word || word._valueAddr === undefined) throw new ForthError(`${name} is not a VALUE`);
      if (f.state === 0) {
        f.store(word._valueAddr, f.pop());
      } else {
        const addr = word._valueAddr;
        f.compileBuffer.push({ type: 'call', word: { code: (f) => { f.store(addr, f.pop()); } } });
      }
    }, true);

    // CREATE / DOES>
    f.addWord('CREATE', (f) => {
      const name = f.nextToken();
      if (!name) throw new ForthError('Expected word name');
      const addr = f.here;
      f.addWord(name, (f) => { f.push(addr); });
    });

    f.addWord('DOES>', (f) => {
      // Mark this position in the compile buffer
      // When the defining word runs, everything after DOES> becomes the runtime behavior
      // of the most recently CREATEd word
      f.compileBuffer.push({ type: 'does>' });
    }, true);

    // IMMEDIATE
    f.addWord('IMMEDIATE', (f) => {
      f.dictionary[f.dictionary.length - 1].immediate = true;
    });

    // Tick and EXECUTE
    f.addWord("'", (f) => {
      const name = f.nextToken();
      if (!name) throw new ForthError('Expected word name');
      const word = f.findWord(name);
      if (!word) throw new ForthError(`Undefined word: ${name}`);
      f.push(word);
    });

    f.addWord('EXECUTE', (f) => {
      const word = f.pop();
      if (typeof word === 'object' && word.code) {
        word.code(f);
      } else {
        throw new ForthError('Not an execution token');
      }
    });

    // ['] in compile mode
    f.addWord("[']", (f) => {
      const name = f.nextToken();
      if (!name) throw new ForthError('Expected word name');
      const word = f.findWord(name);
      if (!word) throw new ForthError(`Undefined word: ${name}`);
      f.compileBuffer.push({ type: 'literal', value: word });
    }, true);

    // POSTPONE
    f.addWord('POSTPONE', (f) => {
      const name = f.nextToken();
      if (!name) throw new ForthError('Expected word name');
      const word = f.findWord(name);
      if (!word) throw new ForthError(`Undefined word: ${name}`);
      if (word.immediate) {
        // Compile execution of the immediate word
        f.compileBuffer.push({ type: 'call', word });
      } else {
        // Compile code that will compile the word
        f.compileBuffer.push({ type: 'call', word: { code: (f) => { f.compileBuffer.push({ type: 'call', word }); } } });
      }
    }, true);

    // BASE
    f.addWord('DECIMAL', (f) => { f.base = 10; });
    f.addWord('HEX', (f) => { f.base = 16; });
    f.addWord('BASE', (f) => { 
      // BASE is a pseudo-variable
      const addr = f.allot(1);
      f.store(addr, f.base);
      f.push(addr);
    });

    // SEE (decompiler)
    f.addWord('SEE', (f) => {
      const name = f.nextToken();
      if (!name) throw new ForthError('Expected word name');
      const word = f.findWord(name);
      if (!word) throw new ForthError(`Undefined word: ${name}`);
      f.type(`: ${word.name} `);
      if (word._source) {
        f.type(word._source);
      } else {
        f.type('<primitive>');
      }
      f.type(' ;');
    });

    // WORDS
    f.addWord('WORDS', (f) => {
      const words = f.dictionary.filter(w => !w.hidden).map(w => w.name);
      f.type(words.join(' '));
    });

    // CASE/OF/ENDOF/ENDCASE
    f.addWord('CASE', (f) => {
      f.rpush(0); // count of ENDOFs to patch
    }, true);

    f.addWord('OF', (f) => {
      f.compileBuffer.push({ type: 'call', word: f.findWord('OVER') });
      f.compileBuffer.push({ type: 'call', word: f.findWord('=') });
      f.compileBuffer.push({ type: 'branch0', target: -1 });
      f.rpush(f.compileBuffer.length - 1);
      f.compileBuffer.push({ type: 'call', word: f.findWord('DROP') });
    }, true);

    f.addWord('ENDOF', (f) => {
      f.compileBuffer.push({ type: 'branch', target: -1 });
      const endofIdx = f.compileBuffer.length - 1;
      const ofIdx = f.rpop();
      f.compileBuffer[ofIdx].target = f.compileBuffer.length;
      // Save ENDOF position and increment count
      const count = f.rpop();
      // Push ENDOF positions + new count
      // Store positions in a simpler way - use a marker array
      for (let i = 0; i < count; i++) {
        const pos = f.rpop();
        f.rpush(pos);
      }
      f.rpush(endofIdx);
      f.rpush(count + 1);
    }, true);

    f.addWord('ENDCASE', (f) => {
      f.compileBuffer.push({ type: 'call', word: f.findWord('DROP') });
      const count = f.rpop();
      for (let i = 0; i < count; i++) {
        const pos = f.rpop();
        f.compileBuffer[pos].target = f.compileBuffer.length;
      }
    }, true);

    // DEFER / IS
    f.addWord('DEFER', (f) => {
      const name = f.nextToken();
      if (!name) throw new ForthError('Expected word name');
      const deferRef = { fn: null };
      f.addWord(name, (f) => {
        if (!deferRef.fn) throw new ForthError(`${name} is uninitialized (DEFER)`);
        deferRef.fn.code(f);
      });
      f.dictionary[f.dictionary.length - 1]._deferRef = deferRef;
    });

    f.addWord('IS', (f) => {
      const name = f.nextToken();
      if (!name) throw new ForthError('Expected word name');
      const word = f.findWord(name);
      if (!word || !word._deferRef) throw new ForthError(`${name} is not a DEFERred word`);
      word._deferRef.fn = f.pop();
    });

    // [CHAR]
    f.addWord('[CHAR]', (f) => {
      const tok = f.nextToken();
      if (!tok) throw new ForthError('Expected character');
      f.compileBuffer.push({ type: 'literal', value: tok.charCodeAt(0) });
    }, true);

    f.addWord('CHAR', (f) => {
      const tok = f.nextToken();
      if (!tok) throw new ForthError('Expected character');
      f.push(tok.charCodeAt(0));
    });

    // Misc
    f.addWord('BYE', () => { /* no-op in embedded mode */ });
    f.addWord('PAGE', (f) => { f.output = ''; });
  }

  // Run a string, return output, reset output buffer
  run(input) {
    this.output = '';
    this.evaluate(input);
    return this.output;
  }

  // Get the data stack contents
  getStack() {
    return [...this.stack];
  }
}

module.exports = { Forth, ForthError };
