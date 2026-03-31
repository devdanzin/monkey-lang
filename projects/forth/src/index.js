/**
 * Tiny Forth Interpreter
 * 
 * Stack-based concatenative language:
 * - Data stack operations: dup, drop, swap, over, rot, nip, tuck
 * - Arithmetic: + - * / mod
 * - Comparison: = < > <> <= >=
 * - Logic: and or not
 * - Control: if...then, if...else...then, do...loop, begin...until, begin...while...repeat
 * - Definitions: : name ... ;
 * - Variables: variable name, ! (store), @ (fetch)
 * - Constants: constant name
 * - Output: . .s cr emit
 * - String: ." ..."
 */

class Forth {
  constructor() {
    this.stack = [];
    this.returnStack = [];
    this.dict = new Map();
    this.variables = new Map();
    this.output = [];
    this._nextVarAddr = 1000;
    this._setupBuiltins();
  }

  _setupBuiltins() {
    // Stack
    this._builtin('dup', () => { this.stack.push(this._peek()); });
    this._builtin('drop', () => { this._pop(); });
    this._builtin('swap', () => { const b = this._pop(), a = this._pop(); this.stack.push(b, a); });
    this._builtin('over', () => { this.stack.push(this.stack[this.stack.length - 2]); });
    this._builtin('rot', () => { const c = this._pop(), b = this._pop(), a = this._pop(); this.stack.push(b, c, a); });
    this._builtin('nip', () => { const b = this._pop(); this._pop(); this.stack.push(b); });
    this._builtin('tuck', () => { const b = this._pop(), a = this._pop(); this.stack.push(b, a, b); });
    this._builtin('2dup', () => { const b = this._peek(), a = this.stack[this.stack.length - 2]; this.stack.push(a, b); });
    this._builtin('depth', () => { this.stack.push(this.stack.length); });

    // Arithmetic
    this._builtin('+', () => { const b = this._pop(), a = this._pop(); this.stack.push(a + b); });
    this._builtin('-', () => { const b = this._pop(), a = this._pop(); this.stack.push(a - b); });
    this._builtin('*', () => { const b = this._pop(), a = this._pop(); this.stack.push(a * b); });
    this._builtin('/', () => { const b = this._pop(), a = this._pop(); this.stack.push(Math.trunc(a / b)); });
    this._builtin('mod', () => { const b = this._pop(), a = this._pop(); this.stack.push(a % b); });
    this._builtin('negate', () => { this.stack.push(-this._pop()); });
    this._builtin('abs', () => { this.stack.push(Math.abs(this._pop())); });
    this._builtin('min', () => { const b = this._pop(), a = this._pop(); this.stack.push(Math.min(a, b)); });
    this._builtin('max', () => { const b = this._pop(), a = this._pop(); this.stack.push(Math.max(a, b)); });

    // Comparison
    this._builtin('=', () => { const b = this._pop(), a = this._pop(); this.stack.push(a === b ? -1 : 0); });
    this._builtin('<>', () => { const b = this._pop(), a = this._pop(); this.stack.push(a !== b ? -1 : 0); });
    this._builtin('<', () => { const b = this._pop(), a = this._pop(); this.stack.push(a < b ? -1 : 0); });
    this._builtin('>', () => { const b = this._pop(), a = this._pop(); this.stack.push(a > b ? -1 : 0); });
    this._builtin('<=', () => { const b = this._pop(), a = this._pop(); this.stack.push(a <= b ? -1 : 0); });
    this._builtin('>=', () => { const b = this._pop(), a = this._pop(); this.stack.push(a >= b ? -1 : 0); });
    this._builtin('0=', () => { this.stack.push(this._pop() === 0 ? -1 : 0); });

    // Logic
    this._builtin('and', () => { const b = this._pop(), a = this._pop(); this.stack.push(a & b); });
    this._builtin('or', () => { const b = this._pop(), a = this._pop(); this.stack.push(a | b); });
    this._builtin('not', () => { this.stack.push(this._pop() === 0 ? -1 : 0); });

    // Output
    this._builtin('.', () => { this.output.push(String(this._pop())); });
    this._builtin('cr', () => { this.output.push('\n'); });
    this._builtin('emit', () => { this.output.push(String.fromCharCode(this._pop())); });
    this._builtin('.s', () => { this.output.push(`<${this.stack.length}> ${this.stack.join(' ')}`); });

    // Return stack
    this._builtin('>r', () => { this.returnStack.push(this._pop()); });
    this._builtin('r>', () => { this.stack.push(this.returnStack.pop()); });
    this._builtin('r@', () => { this.stack.push(this.returnStack[this.returnStack.length - 1]); });
  }

  _builtin(name, fn) {
    this.dict.set(name, { type: 'builtin', fn });
  }

  _pop() {
    if (this.stack.length === 0) throw new Error('Stack underflow');
    return this.stack.pop();
  }

  _peek() {
    if (this.stack.length === 0) throw new Error('Stack underflow');
    return this.stack[this.stack.length - 1];
  }

  eval(src) {
    const tokens = this._tokenize(src);
    this._execute(tokens);
    return this.output.join('');
  }

  _tokenize(src) {
    const tokens = [];
    let i = 0;
    while (i < src.length) {
      // Skip whitespace
      while (i < src.length && /\s/.test(src[i])) i++;
      if (i >= src.length) break;

      // Parenthesized comment
      if (src[i] === '(' && src[i + 1] === ' ') {
        while (i < src.length && src[i] !== ')') i++;
        i++; continue;
      }
      // Line comment
      if (src[i] === '\\') {
        while (i < src.length && src[i] !== '\n') i++;
        continue;
      }
      // String literal
      if (src.startsWith('." ', i)) {
        i += 3;
        let s = '';
        while (i < src.length && src[i] !== '"') s += src[i++];
        i++;
        tokens.push({ type: 'string', value: s });
        continue;
      }
      // Word
      let word = '';
      while (i < src.length && !/\s/.test(src[i])) word += src[i++];
      tokens.push({ type: 'word', value: word.toLowerCase() });
    }
    return tokens;
  }

  _execute(tokens) {
    let i = 0;

    while (i < tokens.length) {
      const token = tokens[i];
      
      if (token.type === 'string') {
        this.output.push(token.value);
        i++; continue;
      }

      const word = token.value;

      // Definition
      if (word === ':') {
        i++;
        const name = tokens[i++].value;
        const body = [];
        while (i < tokens.length && tokens[i].value !== ';') {
          body.push(tokens[i++]);
        }
        i++; // skip ;
        this.dict.set(name, { type: 'defined', body });
        continue;
      }

      // Variable
      if (word === 'variable') {
        i++;
        const name = tokens[i++].value;
        const addr = this._nextVarAddr++;
        this.variables.set(addr, 0);
        this.dict.set(name, { type: 'builtin', fn: () => this.stack.push(addr) });
        continue;
      }

      // Constant
      if (word === 'constant') {
        i++;
        const name = tokens[i++].value;
        const val = this._pop();
        this.dict.set(name, { type: 'builtin', fn: () => this.stack.push(val) });
        continue;
      }

      // Store/Fetch
      if (word === '!') { const addr = this._pop(), val = this._pop(); this.variables.set(addr, val); i++; continue; }
      if (word === '@') { const addr = this._pop(); this.stack.push(this.variables.get(addr) || 0); i++; continue; }
      if (word === '+!') { const addr = this._pop(), val = this._pop(); this.variables.set(addr, (this.variables.get(addr) || 0) + val); i++; continue; }

      // If/else/then
      if (word === 'if') {
        i++;
        const trueBranch = [], falseBranch = [];
        let depth = 1;
        let inElse = false;
        while (i < tokens.length && depth > 0) {
          if (tokens[i].value === 'if') depth++;
          if (tokens[i].value === 'then') { depth--; if (depth === 0) { i++; break; } }
          if (tokens[i].value === 'else' && depth === 1) { inElse = true; i++; continue; }
          (inElse ? falseBranch : trueBranch).push(tokens[i]);
          i++;
        }
        const cond = this._pop();
        this._execute(cond !== 0 ? trueBranch : falseBranch);
        continue;
      }

      // Do loop
      if (word === 'do') {
        i++;
        const body = [];
        let depth = 1;
        while (i < tokens.length && depth > 0) {
          if (tokens[i].value === 'do') depth++;
          if (tokens[i].value === 'loop' || tokens[i].value === '+loop') { depth--; if (depth === 0) break; }
          body.push(tokens[i]);
          i++;
        }
        const isPlus = tokens[i].value === '+loop';
        i++;
        
        const start = this._pop(), limit = this._pop();
        for (let j = start; j < limit; ) {
          this.returnStack.push(j);
          // Replace 'i' references
          const expanded = body.map(t => t.value === 'i' ? { type: 'word', value: String(j) } : t);
          this._execute(expanded);
          this.returnStack.pop();
          if (isPlus) j += this._pop(); else j++;
        }
        continue;
      }

      // Begin...until / begin...while...repeat
      if (word === 'begin') {
        i++;
        const body = [];
        let depth = 1;
        while (i < tokens.length && depth > 0) {
          if (tokens[i].value === 'begin') depth++;
          if (tokens[i].value === 'until' || tokens[i].value === 'repeat') { depth--; if (depth === 0) break; }
          body.push(tokens[i]);
          i++;
        }
        const endWord = tokens[i].value;
        i++;

        if (endWord === 'until') {
          do { this._execute(body); } while (this._pop() === 0);
        } else {
          // begin...while...repeat
          const whileIdx = body.findIndex(t => t.value === 'while');
          const cond = body.slice(0, whileIdx);
          const loopBody = body.slice(whileIdx + 1);
          while (true) {
            this._execute(cond);
            if (this._pop() === 0) break;
            this._execute(loopBody);
          }
        }
        continue;
      }

      // Number
      if (/^-?\d+$/.test(word)) {
        this.stack.push(parseInt(word, 10));
        i++; continue;
      }

      // Dictionary lookup
      const entry = this.dict.get(word);
      if (entry) {
        if (entry.type === 'builtin') entry.fn();
        else this._execute(entry.body);
        i++; continue;
      }

      throw new Error(`Unknown word: ${word}`);
    }
  }

  getStack() { return [...this.stack]; }
  getOutput() { return this.output.join(''); }
  reset() { this.stack = []; this.returnStack = []; this.output = []; }
}

module.exports = { Forth };
