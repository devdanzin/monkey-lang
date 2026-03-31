/**
 * Tiny PEG Parser Generator
 * 
 * Parsing Expression Grammars:
 * - Literal: "text"
 * - Regex: /pattern/
 * - Sequence: a b c
 * - Ordered choice: a / b
 * - Zero or more: a*
 * - One or more: a+
 * - Optional: a?
 * - Lookahead: &a, !a
 * - Rule references
 * - Actions/transforms
 */

class PEG {
  constructor() {
    this.rules = new Map();
    this.startRule = null;
  }

  rule(name, expr) {
    if (!this.startRule) this.startRule = name;
    this.rules.set(name, expr);
    return this;
  }

  parse(input, startRule = null) {
    const rule = startRule || this.startRule;
    const result = this._match(this.rules.get(rule), input, 0);
    if (!result) throw new Error(`Parse failed at position 0`);
    return result.value;
  }

  _match(expr, input, pos) {
    switch (expr.type) {
      case 'literal': {
        if (input.startsWith(expr.value, pos)) {
          return { value: expr.value, pos: pos + expr.value.length };
        }
        return null;
      }

      case 'regex': {
        const m = expr.pattern.exec(input.slice(pos));
        if (m && m.index === 0) {
          return { value: m[0], pos: pos + m[0].length };
        }
        return null;
      }

      case 'seq': {
        const values = [];
        let p = pos;
        for (const child of expr.exprs) {
          const r = this._match(child, input, p);
          if (!r) return null;
          values.push(r.value);
          p = r.pos;
        }
        const value = expr.action ? expr.action(...values) : (values.length === 1 ? values[0] : values);
        return { value, pos: p };
      }

      case 'choice': {
        for (const child of expr.exprs) {
          const r = this._match(child, input, pos);
          if (r) return r;
        }
        return null;
      }

      case 'many': {
        const values = [];
        let p = pos;
        while (true) {
          const r = this._match(expr.expr, input, p);
          if (!r || r.pos === p) break;
          values.push(r.value);
          p = r.pos;
        }
        if (expr.min && values.length < expr.min) return null;
        return { value: values, pos: p };
      }

      case 'optional': {
        const r = this._match(expr.expr, input, pos);
        return r || { value: null, pos };
      }

      case 'lookahead': {
        const r = this._match(expr.expr, input, pos);
        if (expr.positive) return r ? { value: '', pos } : null;
        return r ? null : { value: '', pos };
      }

      case 'ref': {
        const rule = this.rules.get(expr.name);
        if (!rule) throw new Error(`Unknown rule: ${expr.name}`);
        return this._match(rule, input, pos);
      }

      case 'action': {
        const r = this._match(expr.expr, input, pos);
        if (!r) return null;
        return { value: expr.fn(r.value), pos: r.pos };
      }

      default:
        throw new Error(`Unknown expr type: ${expr.type}`);
    }
  }
}

// ─── Expression Builders ────────────────────────────

const lit = (value) => ({ type: 'literal', value });
const regex = (pattern) => ({ type: 'regex', pattern: pattern instanceof RegExp ? pattern : new RegExp(pattern) });
const seq = (...exprs) => ({ type: 'seq', exprs: exprs.filter(e => e), action: null });
const seqAction = (action, ...exprs) => ({ type: 'seq', exprs, action });
const choice = (...exprs) => ({ type: 'choice', exprs });
const many = (expr) => ({ type: 'many', expr, min: 0 });
const many1 = (expr) => ({ type: 'many', expr, min: 1 });
const optional = (expr) => ({ type: 'optional', expr });
const lookahead = (expr) => ({ type: 'lookahead', expr, positive: true });
const notFollowedBy = (expr) => ({ type: 'lookahead', expr, positive: false });
const ref = (name) => ({ type: 'ref', name });
const action = (expr, fn) => ({ type: 'action', expr, fn });

// ─── Convenience: Skip whitespace ───────────────────

const ws = regex(/\s*/);
const token = (expr) => seqAction(v => v, expr, ws);
const keyword = (str) => token(lit(str));

module.exports = {
  PEG,
  lit, regex, seq, seqAction, choice, many, many1,
  optional, lookahead, notFollowedBy, ref, action,
  ws, token, keyword,
};
