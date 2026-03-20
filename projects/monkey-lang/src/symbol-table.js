// Monkey Language Compiler — Symbol Table

export const SCOPE = {
  GLOBAL: 'GLOBAL',
  LOCAL: 'LOCAL',
  BUILTIN: 'BUILTIN',
  FREE: 'FREE',
  FUNCTION: 'FUNCTION',
};

export class Symbol {
  constructor(name, scope, index) {
    this.name = name;
    this.scope = scope;
    this.index = index;
  }
}

export class SymbolTable {
  constructor(outer = null) {
    this.outer = outer;
    this.store = new Map();
    this.numDefinitions = 0;
    this.freeSymbols = [];
  }

  define(name) {
    const scope = this.outer === null ? SCOPE.GLOBAL : SCOPE.LOCAL;
    const sym = new Symbol(name, scope, this.numDefinitions);
    this.store.set(name, sym);
    this.numDefinitions++;
    return sym;
  }

  defineBuiltin(index, name) {
    const sym = new Symbol(name, SCOPE.BUILTIN, index);
    this.store.set(name, sym);
    return sym;
  }

  defineFunctionName(name) {
    const sym = new Symbol(name, SCOPE.FUNCTION, 0);
    this.store.set(name, sym);
    return sym;
  }

  defineFree(original) {
    this.freeSymbols.push(original);
    const sym = new Symbol(original.name, SCOPE.FREE, this.freeSymbols.length - 1);
    this.store.set(original.name, sym);
    return sym;
  }

  resolve(name) {
    let sym = this.store.get(name);
    if (sym) return sym;

    if (this.outer) {
      sym = this.outer.resolve(name);
      if (!sym) return undefined;

      // Globals and builtins are accessible from anywhere
      if (sym.scope === SCOPE.GLOBAL || sym.scope === SCOPE.BUILTIN) return sym;

      // Otherwise it's a free variable — capture it
      return this.defineFree(sym);
    }

    return undefined;
  }
}
