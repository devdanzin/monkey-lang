/**
 * Prolog Term types
 */

class Atom {
  constructor(name) { this.type = 'atom'; this.name = name; }
  toString() { return this.name; }
}

class Var {
  constructor(name) { this.type = 'var'; this.name = name; }
  toString() { return this.name; }
}

class Num {
  constructor(value) { this.type = 'num'; this.value = value; }
  toString() { return String(this.value); }
}

class Compound {
  constructor(functor, args) {
    this.type = 'compound';
    this.functor = functor;
    this.args = args;
  }
  toString() {
    if (this.functor === '.' && this.args.length === 2) return listToString(this);
    if (this.args.length === 2 && /^[+\-*\/><]|>=|=<|=:=|=\\=|is|mod$/.test(this.functor)) {
      return `${this.args[0]} ${this.functor} ${this.args[1]}`;
    }
    return `${this.functor}(${this.args.map(a => a.toString()).join(', ')})`;
  }
}

// Special cut term
class Cut {
  constructor() { this.type = 'cut'; }
  toString() { return '!'; }
}

// List helpers
const NIL = new Atom('[]');

function list(...elems) {
  let result = NIL;
  for (let i = elems.length - 1; i >= 0; i--) {
    result = new Compound('.', [elems[i], result]);
  }
  return result;
}

function listWithTail(elems, tail) {
  let result = tail;
  for (let i = elems.length - 1; i >= 0; i--) {
    result = new Compound('.', [elems[i], result]);
  }
  return result;
}

function listToString(term) {
  const elems = [];
  let cur = term;
  while (cur.type === 'compound' && cur.functor === '.' && cur.args.length === 2) {
    elems.push(cur.args[0].toString());
    cur = cur.args[1];
  }
  if (cur.type === 'atom' && cur.name === '[]') {
    return `[${elems.join(', ')}]`;
  }
  return `[${elems.join(', ')} | ${cur.toString()}]`;
}

// Convenience constructors
function atom(name) { return new Atom(name); }
function variable(name) { return new Var(name); }
function compound(f, ...args) { return new Compound(f, args); }
function num(n) { return new Num(n); }
function cut() { return new Cut(); }

module.exports = {
  Atom, Var, Num, Compound, Cut, NIL,
  atom, variable, compound, num, cut, list, listWithTail
};
