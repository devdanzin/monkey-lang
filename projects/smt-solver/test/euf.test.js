import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { UnionFind, EUFSolver, Term, TheoryLiteral, term, eq, neq } from '../src/euf.js';

// ===== Union-Find =====
describe('UnionFind — basic', () => {
  it('find returns self for new elements', () => {
    const uf = new UnionFind();
    assert.equal(uf.find('a'), 'a');
    assert.equal(uf.find('b'), 'b');
  });

  it('union merges sets', () => {
    const uf = new UnionFind();
    assert.equal(uf.union('a', 'b'), true);
    assert.equal(uf.connected('a', 'b'), true);
  });

  it('union returns false for already-connected', () => {
    const uf = new UnionFind();
    uf.union('a', 'b');
    assert.equal(uf.union('a', 'b'), false);
  });

  it('transitive connections', () => {
    const uf = new UnionFind();
    uf.union('a', 'b');
    uf.union('b', 'c');
    assert.equal(uf.connected('a', 'c'), true);
  });

  it('separate sets remain separate', () => {
    const uf = new UnionFind();
    uf.union('a', 'b');
    uf.union('c', 'd');
    assert.equal(uf.connected('a', 'c'), false);
    assert.equal(uf.connected('b', 'd'), false);
  });
});

describe('UnionFind — backtracking', () => {
  it('backtrack undoes union', () => {
    const uf = new UnionFind();
    uf.union('a', 'b');
    uf.checkpoint();
    uf.union('b', 'c');
    assert.equal(uf.connected('a', 'c'), true);
    uf.backtrack();
    assert.equal(uf.connected('a', 'c'), false);
    assert.equal(uf.connected('a', 'b'), true);
  });

  it('multiple checkpoint levels', () => {
    const uf = new UnionFind();
    uf.checkpoint(); // level 0
    uf.union('a', 'b');
    uf.checkpoint(); // level 1
    uf.union('c', 'd');
    uf.checkpoint(); // level 2
    uf.union('a', 'c');
    
    assert.equal(uf.connected('a', 'd'), true);
    
    uf.backtrack(); // undo level 2
    assert.equal(uf.connected('a', 'd'), false);
    assert.equal(uf.connected('a', 'b'), true);
    assert.equal(uf.connected('c', 'd'), true);
    
    uf.backtrack(); // undo level 1
    assert.equal(uf.connected('c', 'd'), false);
    assert.equal(uf.connected('a', 'b'), true);
    
    uf.backtrack(); // undo level 0
    assert.equal(uf.connected('a', 'b'), false);
  });

  it('backtrackTo jumps to specific level', () => {
    const uf = new UnionFind();
    uf.checkpoint(); // 0
    uf.union('a', 'b');
    uf.checkpoint(); // 1
    uf.union('c', 'd');
    uf.checkpoint(); // 2
    uf.union('e', 'f');
    
    uf.backtrackTo(1);
    assert.equal(uf.connected('a', 'b'), true);
    assert.equal(uf.connected('c', 'd'), false);
    assert.equal(uf.connected('e', 'f'), false);
  });

  it('multiple unions in one level', () => {
    const uf = new UnionFind();
    uf.checkpoint();
    uf.union('a', 'b');
    uf.union('c', 'd');
    uf.union('b', 'c');
    
    assert.equal(uf.connected('a', 'd'), true);
    
    uf.backtrack();
    assert.equal(uf.connected('a', 'b'), false);
    assert.equal(uf.connected('c', 'd'), false);
  });
});

// ===== EUF Solver =====
describe('EUF — basic equality', () => {
  it('constants are equal after assertion', () => {
    const solver = new EUFSolver();
    const a = term('a');
    const b = term('b');
    solver.register(a);
    solver.register(b);
    
    solver.setTrue(eq(a, b));
    assert.equal(solver.areEqual(a, b), true);
  });

  it('transitivity: a=b, b=c implies a=c', () => {
    const solver = new EUFSolver();
    const a = term('a'), b = term('b'), c = term('c');
    solver.register(a); solver.register(b); solver.register(c);
    
    solver.setTrue(eq(a, b));
    solver.setTrue(eq(b, c));
    assert.equal(solver.areEqual(a, c), true);
  });

  it('detects equality conflict with disequality', () => {
    const solver = new EUFSolver();
    const a = term('a'), b = term('b');
    solver.register(a); solver.register(b);
    
    solver.setTrue(neq(a, b));
    const conflict = solver.setTrue(eq(a, b));
    assert.ok(conflict, 'Should detect conflict');
    assert.ok(conflict.length > 0);
  });

  it('detects conflict: a=b, b=c, a≠c', () => {
    const solver = new EUFSolver();
    const a = term('a'), b = term('b'), c = term('c');
    solver.register(a); solver.register(b); solver.register(c);
    
    assert.equal(solver.setTrue(eq(a, b)), null);
    assert.equal(solver.setTrue(eq(b, c)), null);
    const conflict = solver.setTrue(neq(a, c));
    assert.ok(conflict, 'Should detect conflict: a=b, b=c, a≠c');
  });

  it('no conflict when disequality is satisfiable', () => {
    const solver = new EUFSolver();
    const a = term('a'), b = term('b'), c = term('c');
    solver.register(a); solver.register(b); solver.register(c);
    
    assert.equal(solver.setTrue(eq(a, b)), null);
    assert.equal(solver.setTrue(neq(a, c)), null); // a≠c is fine
  });
});

describe('EUF — congruence closure', () => {
  it('f(a) = f(b) when a = b', () => {
    const solver = new EUFSolver();
    const a = term('a'), b = term('b');
    const fa = term('f', a), fb = term('f', b);
    solver.register(fa); solver.register(fb);
    
    solver.setTrue(eq(a, b));
    assert.equal(solver.areEqual(fa, fb), true);
  });

  it('detects congruence conflict: a=b, f(a)≠f(b)', () => {
    const solver = new EUFSolver();
    const a = term('a'), b = term('b');
    const fa = term('f', a), fb = term('f', b);
    solver.register(fa); solver.register(fb);
    
    solver.setTrue(neq(fa, fb));
    const conflict = solver.setTrue(eq(a, b));
    assert.ok(conflict, 'a=b should conflict with f(a)≠f(b)');
  });

  it('multi-arg congruence: g(a,c) = g(b,c) when a = b', () => {
    const solver = new EUFSolver();
    const a = term('a'), b = term('b'), c = term('c');
    const gac = term('g', a, c), gbc = term('g', b, c);
    solver.register(gac); solver.register(gbc);
    
    solver.setTrue(eq(a, b));
    assert.equal(solver.areEqual(gac, gbc), true);
  });

  it('nested congruence: f(f(a)) = f(f(b)) when a = b', () => {
    const solver = new EUFSolver();
    const a = term('a'), b = term('b');
    const fa = term('f', a), fb = term('f', b);
    const ffa = term('f', fa), ffb = term('f', fb);
    solver.register(ffa); solver.register(ffb);
    
    solver.setTrue(eq(a, b));
    assert.equal(solver.areEqual(fa, fb), true);
    assert.equal(solver.areEqual(ffa, ffb), true);
  });

  it('chain: a=b implies f(a)=f(b), which implies g(f(a))=g(f(b))', () => {
    const solver = new EUFSolver();
    const a = term('a'), b = term('b');
    const fa = term('f', a), fb = term('f', b);
    const gfa = term('g', fa), gfb = term('g', fb);
    solver.register(gfa); solver.register(gfb);
    
    solver.setTrue(eq(a, b));
    assert.equal(solver.areEqual(gfa, gfb), true);
  });

  it('no spurious congruence for different functions', () => {
    const solver = new EUFSolver();
    const a = term('a');
    const fa = term('f', a), ga = term('g', a);
    solver.register(fa); solver.register(ga);
    
    assert.equal(solver.areEqual(fa, ga), false);
  });
});

describe('EUF — backtracking', () => {
  it('undoes equality assertion', () => {
    const solver = new EUFSolver();
    const a = term('a'), b = term('b');
    solver.register(a); solver.register(b);
    
    solver.pushLevel();
    solver.setTrue(eq(a, b));
    assert.equal(solver.areEqual(a, b), true);
    
    solver.popTo(0);
    assert.equal(solver.areEqual(a, b), false);
  });

  it('undoes disequality assertion', () => {
    const solver = new EUFSolver();
    const a = term('a'), b = term('b');
    solver.register(a); solver.register(b);
    
    solver.pushLevel();
    solver.setTrue(neq(a, b));
    assert.equal(solver.areDifferent(a, b), true);
    
    solver.popTo(0);
    assert.equal(solver.areDifferent(a, b), false);
  });

  it('multi-level backtracking', () => {
    const solver = new EUFSolver();
    const a = term('a'), b = term('b'), c = term('c'), d = term('d');
    solver.register(a); solver.register(b); solver.register(c); solver.register(d);
    
    solver.pushLevel(); // level 1
    solver.setTrue(eq(a, b));
    
    solver.pushLevel(); // level 2
    solver.setTrue(eq(c, d));
    
    solver.pushLevel(); // level 3
    solver.setTrue(eq(b, c));
    assert.equal(solver.areEqual(a, d), true); // transitive
    
    solver.popTo(2);
    assert.equal(solver.areEqual(a, d), false);
    assert.equal(solver.areEqual(a, b), true);
    assert.equal(solver.areEqual(c, d), true);
    
    solver.popTo(1);
    assert.equal(solver.areEqual(c, d), false);
    assert.equal(solver.areEqual(a, b), true);
  });

  it('backtrack preserves earlier equalities', () => {
    const solver = new EUFSolver();
    const a = term('a'), b = term('b'), c = term('c');
    solver.register(a); solver.register(b); solver.register(c);
    
    solver.pushLevel();
    solver.setTrue(eq(a, b));
    
    solver.pushLevel();
    solver.setTrue(eq(b, c));
    assert.equal(solver.areEqual(a, c), true);
    
    solver.popTo(1);
    assert.equal(solver.areEqual(a, b), true);
    assert.equal(solver.areEqual(a, c), false);
  });
});

describe('EUF — consistency check', () => {
  it('consistent when no conflicts', () => {
    const solver = new EUFSolver();
    const a = term('a'), b = term('b'), c = term('c');
    solver.register(a); solver.register(b); solver.register(c);
    
    solver.setTrue(eq(a, b));
    solver.setTrue(neq(a, c));
    
    const r = solver.checkConsistency();
    assert.equal(r.consistent, true);
  });

  it('inconsistent after conflict', () => {
    const solver = new EUFSolver();
    const a = term('a'), b = term('b');
    solver.register(a); solver.register(b);
    
    solver.setTrue(eq(a, b));
    solver.setTrue(neq(a, b));
    
    const r = solver.checkConsistency();
    assert.equal(r.consistent, false);
    assert.ok(r.conflict.length > 0);
  });
});

describe('EUF — edge cases', () => {
  it('self-equality is trivial', () => {
    const solver = new EUFSolver();
    const a = term('a');
    solver.register(a);
    assert.equal(solver.areEqual(a, a), true);
  });

  it('many equalities chain', () => {
    const solver = new EUFSolver();
    const terms = [];
    for (let i = 0; i < 10; i++) {
      terms.push(term(`x${i}`));
      solver.register(terms[i]);
    }
    for (let i = 0; i < 9; i++) {
      solver.setTrue(eq(terms[i], terms[i + 1]));
    }
    assert.equal(solver.areEqual(terms[0], terms[9]), true);
  });

  it('diamond equality: a=b, a=c, b=d, c=d', () => {
    const solver = new EUFSolver();
    const a = term('a'), b = term('b'), c = term('c'), d = term('d');
    solver.register(a); solver.register(b); solver.register(c); solver.register(d);
    
    solver.setTrue(eq(a, b));
    solver.setTrue(eq(a, c));
    solver.setTrue(eq(b, d));
    assert.equal(solver.areEqual(c, d), true);
  });

  it('many functions with shared args', () => {
    const solver = new EUFSolver();
    const a = term('a'), b = term('b');
    const fa = term('f', a), fb = term('f', b);
    const ga = term('g', a), gb = term('g', b);
    const ha = term('h', a), hb = term('h', b);
    solver.register(fa); solver.register(fb);
    solver.register(ga); solver.register(gb);
    solver.register(ha); solver.register(hb);
    
    solver.setTrue(eq(a, b));
    assert.equal(solver.areEqual(fa, fb), true);
    assert.equal(solver.areEqual(ga, gb), true);
    assert.equal(solver.areEqual(ha, hb), true);
  });

  it('disequality does not imply function disequality', () => {
    // a ≠ b does NOT mean f(a) ≠ f(b) — f could be a constant function
    const solver = new EUFSolver();
    const a = term('a'), b = term('b');
    const fa = term('f', a), fb = term('f', b);
    solver.register(fa); solver.register(fb);
    
    solver.setTrue(neq(a, b));
    // f(a) and f(b) could still be equal (f is uninterpreted)
    assert.equal(solver.areEqual(fa, fb), false); // not proven equal
    assert.equal(solver.areDifferent(fa, fb), false); // not proven different either
  });
});
