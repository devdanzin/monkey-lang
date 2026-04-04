// ===== S-Expression Parser for SMT-LIB =====

export function parseSexp(input) {
  let pos = 0;
  
  function skipWhitespace() {
    while (pos < input.length && /\s/.test(input[pos])) pos++;
    // Skip comments
    if (pos < input.length && input[pos] === ';') {
      while (pos < input.length && input[pos] !== '\n') pos++;
      skipWhitespace();
    }
  }
  
  function parseAtom() {
    let str = '';
    while (pos < input.length && !/[\s()]/.test(input[pos])) {
      str += input[pos++];
    }
    // Try number
    if (/^-?\d+$/.test(str)) return parseInt(str, 10);
    return str;
  }
  
  function parseExpr() {
    skipWhitespace();
    if (pos >= input.length) return null;
    
    if (input[pos] === '(') {
      pos++; // skip (
      const list = [];
      while (true) {
        skipWhitespace();
        if (pos >= input.length || input[pos] === ')') break;
        list.push(parseExpr());
      }
      if (pos < input.length) pos++; // skip )
      return list;
    }
    
    if (input[pos] === '"') {
      // String literal
      pos++;
      let str = '';
      while (pos < input.length && input[pos] !== '"') {
        if (input[pos] === '\\') { pos++; str += input[pos++]; }
        else str += input[pos++];
      }
      if (pos < input.length) pos++; // skip "
      return { type: 'string', value: str };
    }
    
    return parseAtom();
  }
  
  const results = [];
  while (true) {
    skipWhitespace();
    if (pos >= input.length) break;
    results.push(parseExpr());
  }
  return results;
}

// ===== SMT-LIB to Internal Representation =====

import { Term, TheoryLiteral, term, eq, neq, EUFSolver } from './euf.js';

// Parse SMT-LIB commands and build EUF problem
export function parseSmtLib(input) {
  const sexps = parseSexp(input);
  const declarations = new Map(); // name → sort
  const assertions = [];
  let status = null;
  
  for (const sexp of sexps) {
    if (!Array.isArray(sexp)) continue;
    
    const cmd = sexp[0];
    
    if (cmd === 'set-logic') {
      // Ignore for now — we only support QF_UF
    } else if (cmd === 'declare-fun') {
      // (declare-fun name (arg_sorts) return_sort)
      const name = sexp[1];
      const argSorts = sexp[2];
      const retSort = sexp[3];
      declarations.set(name, { argSorts, retSort });
    } else if (cmd === 'declare-const') {
      // (declare-const name sort)
      declarations.set(sexp[1], { argSorts: [], retSort: sexp[2] });
    } else if (cmd === 'assert') {
      assertions.push(sexp[1]);
    } else if (cmd === 'check-sat') {
      // Will be handled by solver
    } else if (cmd === 'set-info') {
      if (sexp[1] === ':status') status = sexp[2];
    }
  }
  
  return { declarations, assertions, status };
}

// Convert parsed assertion S-expression to TheoryLiteral
export function sexpToLiteral(sexp, termCache = new Map()) {
  // Build a Term from S-expression
  function buildTerm(s) {
    if (typeof s === 'string') {
      if (termCache.has(s)) return termCache.get(s);
      const t = term(s);
      termCache.set(s, t);
      return t;
    }
    if (Array.isArray(s)) {
      const name = s[0];
      const args = s.slice(1).map(buildTerm);
      const key = `${name}(${args.map(a => a.toString()).join(',')})`;
      if (termCache.has(key)) return termCache.get(key);
      const t = term(name, ...args);
      termCache.set(key, t);
      return t;
    }
    // Number — treat as constant
    const t = term(String(s));
    return t;
  }
  
  if (!Array.isArray(sexp)) {
    // Bare atom — treat as boolean variable
    return { type: 'bool', name: sexp };
  }
  
  const op = sexp[0];
  
  if (op === '=') {
    const lhs = buildTerm(sexp[1]);
    const rhs = buildTerm(sexp[2]);
    return eq(lhs, rhs);
  }
  
  if (op === 'not') {
    const inner = sexpToLiteral(sexp[1], termCache);
    if (inner instanceof TheoryLiteral) {
      return inner.negate();
    }
    return { type: 'not', child: inner };
  }
  
  if (op === 'distinct') {
    // (distinct a b) = (not (= a b))
    const lhs = buildTerm(sexp[1]);
    const rhs = buildTerm(sexp[2]);
    return neq(lhs, rhs);
  }
  
  if (op === 'and') {
    return { type: 'and', children: sexp.slice(1).map(s => sexpToLiteral(s, termCache)) };
  }
  
  if (op === 'or') {
    return { type: 'or', children: sexp.slice(1).map(s => sexpToLiteral(s, termCache)) };
  }
  
  if (op === '=>') {
    const antecedent = sexpToLiteral(sexp[1], termCache);
    const consequent = sexpToLiteral(sexp[2], termCache);
    return { type: 'implies', left: antecedent, right: consequent };
  }
  
  // Function application
  const t = buildTerm(sexp);
  return { type: 'term', term: t };
}

// ===== DPLL(T) Solver =====
// Integrates CDCL Boolean engine with EUF theory solver

export class DPLLTSolver {
  constructor() {
    this.euf = new EUFSolver();
    this.theoryLiterals = new Map();  // boolVar → TheoryLiteral
    this.boolVarCounter = 0;
    this.boolVarMap = new Map();      // literal_key → boolVar
    
    // Assertions (in CNF-like form)
    this.clauses = [];                // list of disjuncts (each is array of signed boolVars)
    this.assignment = new Map();      // boolVar → true/false
    this.trail = [];                  // ordered assignments
    this.trailLim = [];              // decision level markers
    this.reason = new Map();         // boolVar → clause index or null
    this.level = new Map();          // boolVar → decision level
    
    // Stats
    this.stats = { decisions: 0, propagations: 0, theoryConflicts: 0, backtracks: 0 };
  }
  
  _currentLevel() { return this.trailLim.length; }
  
  // Allocate a Boolean variable for a theory literal
  _boolVarFor(literal) {
    const key = literal.toString();
    if (this.boolVarMap.has(key)) return this.boolVarMap.get(key);
    
    const v = ++this.boolVarCounter;
    this.boolVarMap.set(key, v);
    this.theoryLiterals.set(v, literal);
    return v;
  }
  
  // Tseitin transformation: convert formula to CNF
  _toCnf(formula) {
    if (formula instanceof TheoryLiteral) {
      const v = this._boolVarFor(formula);
      // Register terms
      this.euf.register(formula.lhs);
      this.euf.register(formula.rhs);
      return [[v]]; // unit clause
    }
    
    if (formula.type === 'and') {
      const clauses = [];
      for (const child of formula.children) {
        clauses.push(...this._toCnf(child));
      }
      return clauses;
    }
    
    if (formula.type === 'or') {
      // Collect all literals from each child
      // Simple case: each child is a literal
      const lits = [];
      for (const child of formula.children) {
        if (child instanceof TheoryLiteral) {
          lits.push(this._boolVarFor(child));
        } else if (child.type === 'not' && child.child instanceof TheoryLiteral) {
          lits.push(-this._boolVarFor(child.child));
        } else {
          // Complex sub-formula: use Tseitin variable
          const subClauses = this._toCnf(child);
          const tv = ++this.boolVarCounter;
          // tv → child (if tv is true, child must be true)
          for (const sc of subClauses) {
            this.clauses.push([-tv, ...sc]);
          }
          lits.push(tv);
        }
      }
      return [lits];
    }
    
    if (formula.type === 'not') {
      if (formula.child instanceof TheoryLiteral) {
        const v = this._boolVarFor(formula.child);
        return [[-v]];
      }
      // Complex negation — handle with Tseitin
      const innerClauses = this._toCnf(formula.child);
      // Negate: negate each clause
      // For single-literal clauses, just negate the literal
      if (innerClauses.length === 1 && innerClauses[0].length === 1) {
        return [[-innerClauses[0][0]]];
      }
      // General case: use Tseitin
      const tv = ++this.boolVarCounter;
      for (const sc of innerClauses) {
        this.clauses.push([-tv, ...sc]);
      }
      return [[-tv]];
    }
    
    if (formula.type === 'implies') {
      // a => b ≡ ¬a ∨ b
      return this._toCnf({
        type: 'or',
        children: [{ type: 'not', child: formula.left }, formula.right]
      });
    }
    
    return [];
  }
  
  // Add assertion (formula in internal representation)
  assert(formula) {
    const clauses = this._toCnf(formula);
    for (const c of clauses) {
      this.clauses.push(c);
    }
  }

  // Assign a boolean variable
  _assign(v, value, lvl, reasonClause) {
    this.assignment.set(v, value);
    this.level.set(v, lvl);
    this.reason.set(v, reasonClause);
    this.trail.push(v);
    
    // Notify theory solver
    const theoryLit = this.theoryLiterals.get(v);
    if (theoryLit) {
      const lit = value ? theoryLit : theoryLit.negate();
      const conflict = this.euf.setTrue(lit);
      if (conflict) return conflict;
    }
    return null;
  }
  
  _litValue(lit) {
    const v = Math.abs(lit);
    if (!this.assignment.has(v)) return 0;
    const val = this.assignment.get(v);
    return (lit > 0) === val ? 1 : -1;
  }
  
  // Boolean unit propagation
  _propagate() {
    let changed = true;
    while (changed) {
      changed = false;
      for (let ci = 0; ci < this.clauses.length; ci++) {
        const cl = this.clauses[ci];
        let unsetCount = 0;
        let lastUnsetLit = 0;
        let satisfied = false;
        
        for (const lit of cl) {
          const val = this._litValue(lit);
          if (val === 1) { satisfied = true; break; }
          if (val === 0) { unsetCount++; lastUnsetLit = lit; }
        }
        
        if (satisfied) continue;
        if (unsetCount === 0) return { type: 'boolean', clause: ci };
        if (unsetCount === 1) {
          const v = Math.abs(lastUnsetLit);
          const theoryConflict = this._assign(v, lastUnsetLit > 0, this._currentLevel(), ci);
          if (theoryConflict) return { type: 'theory', conflict: theoryConflict };
          this.stats.propagations++;
          changed = true;
        }
      }
    }
    return null;
  }
  
  // Pick next unassigned variable (simple heuristic)
  _pickVariable() {
    for (let v = 1; v <= this.boolVarCounter; v++) {
      if (!this.assignment.has(v)) return v;
    }
    return null;
  }
  
  // Backtrack to level
  _backtrackTo(level) {
    const limit = level < this.trailLim.length ? this.trailLim[level] : this.trail.length;
    while (this.trail.length > limit) {
      const v = this.trail.pop();
      this.assignment.delete(v);
      this.level.delete(v);
      this.reason.delete(v);
    }
    this.trailLim.length = level;
    this.euf.popTo(level);
  }
  
  // Main DPLL(T) solve loop
  solve() {
    // Initial propagation
    let conflict = this._propagate();
    if (conflict) return { sat: false, stats: this.stats };
    
    while (true) {
      const v = this._pickVariable();
      if (v === null) {
        // All assigned — check theory consistency
        const consistency = this.euf.checkConsistency();
        if (consistency.consistent) {
          return { sat: true, model: new Map(this.assignment), stats: this.stats };
        }
        // Theory conflict — need to backtrack
        conflict = { type: 'theory', conflict: consistency.conflict };
      }
      
      if (!conflict && v !== null) {
        // Decision
        this.trailLim.push(this.trail.length);
        this.euf.pushLevel();
        this.stats.decisions++;
        
        const theoryConflict = this._assign(v, true, this._currentLevel(), null);
        if (theoryConflict) {
          conflict = { type: 'theory', conflict: theoryConflict };
        } else {
          conflict = this._propagate();
        }
      }
      
      // Handle conflict
      while (conflict) {
        if (this._currentLevel() === 0) {
          return { sat: false, stats: this.stats };
        }
        
        this.stats.backtracks++;
        if (conflict.type === 'theory') this.stats.theoryConflicts++;
        
        // Simple backtracking: go back one level and try other value
        const lastDecision = this.trail[this.trailLim[this.trailLim.length - 1]];
        const lastValue = this.assignment.get(lastDecision);
        
        this._backtrackTo(this._currentLevel() - 1);
        
        // Try the other value
        this.trailLim.push(this.trail.length);
        this.euf.pushLevel();
        
        const theoryConflict = this._assign(lastDecision, !lastValue, this._currentLevel(), null);
        if (theoryConflict) {
          conflict = { type: 'theory', conflict: theoryConflict };
          // Need to backtrack further
          this._backtrackTo(this._currentLevel() - 1);
          continue;
        }
        
        conflict = this._propagate();
        if (!conflict) break; // resolved
      }
    }
  }
}

// ===== High-level API =====

export function solveSmt(smtLib) {
  const { declarations, assertions, status } = parseSmtLib(smtLib);
  const solver = new DPLLTSolver();
  const termCache = new Map();
  
  for (const assertion of assertions) {
    const formula = sexpToLiteral(assertion, termCache);
    solver.assert(formula);
  }
  
  return solver.solve();
}
