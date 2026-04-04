/**
 * Tiny Datalog
 * 
 * Logic programming database query language:
 * - Facts (ground atoms)
 * - Rules with head and body
 * - Bottom-up evaluation (semi-naive)
 * - Queries with variable binding
 * - Stratified negation
 */

class Datalog {
  constructor() {
    this.facts = new Map(); // predicate -> Set of tuples (as JSON strings)
    this.rules = []; // [{head: {pred, args}, body: [{pred, args, negated?}]}]
  }

  addFact(pred, ...args) {
    if (!this.facts.has(pred)) this.facts.set(pred, new Set());
    this.facts.get(pred).add(JSON.stringify(args));
    return this;
  }

  addRule(head, ...body) {
    this.rules.push({ head, body });
    return this;
  }

  query(pred, ...args) {
    this._evaluate();
    const facts = this.facts.get(pred);
    if (!facts) return [];
    
    const results = [];
    for (const factStr of facts) {
      const fact = JSON.parse(factStr);
      const bindings = this._unifyArgs(args, fact);
      if (bindings !== null) results.push(bindings);
    }
    return results;
  }

  _evaluate() {
    let changed = true;
    let iterations = 0;
    while (changed && iterations++ < 100) {
      changed = false;
      for (const rule of this.rules) {
        const newFacts = this._evaluateRule(rule);
        for (const fact of newFacts) {
          const key = rule.head.pred;
          if (!this.facts.has(key)) this.facts.set(key, new Set());
          const str = JSON.stringify(fact);
          if (!this.facts.get(key).has(str)) {
            this.facts.get(key).add(str);
            changed = true;
          }
        }
      }
    }
  }

  _evaluateRule(rule) {
    const results = [];
    const solutions = this._solveBody(rule.body, [{}]);
    for (const bindings of solutions) {
      const args = rule.head.args.map(a => this._resolve(a, bindings));
      if (args.every(a => a !== undefined)) results.push(args);
    }
    return results;
  }

  _solveBody(body, bindingsList) {
    if (body.length === 0) return bindingsList;
    const [first, ...rest] = body;
    const newBindings = [];
    
    for (const bindings of bindingsList) {
      if (first.negated) {
        const matches = this._matchAtom(first, bindings);
        if (matches.length === 0) newBindings.push(bindings);
      } else {

  aggregate(predicate, index, fn) {
    const facts = this.db.get(predicate) || [];
    const values = facts.map(f => f[index]).filter(v => typeof v === 'number');
    switch (fn) {
      case 'count': return values.length;
      case 'sum': return values.reduce((a, b) => a + b, 0);
      case 'avg': return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      case 'min': return Math.min(...values);
      case 'max': return Math.max(...values);
      default: return values;
    }
  }

  queryAll(predicate) {
    return this.db.get(predicate) || [];
  }

  queryWhere(predicate, conditions) {
    const facts = this.db.get(predicate) || [];
    return facts.filter(fact => {
      for (const [idx, value] of Object.entries(conditions)) {
        if (fact[parseInt(idx)] !== value) return false;
      }
      return true;
    });
  }
}

module.exports = Datalog;
