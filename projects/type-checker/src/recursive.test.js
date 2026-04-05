// recursive.test.js — Tests for recursive types and advanced type features

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  TVar, TCon, Scheme, Subst, Expr,
  TInt, TBool, TString, TUnit,
  tFun, tList, tPair, tTuple, tRecord,
  ftv, ftvScheme,
  unify, generalize, instantiate,
  infer, typeOf, typeCheck,
  resetFresh,
} = require('./index.js');

describe('Recursive Types', () => {
  beforeEach(() => resetFresh());

  describe('LetRec — recursive functions', () => {
    it('infers factorial type: Int -> Int', () => {
      const fact = Expr.LetRec('fact',
        Expr.Lam('n',
          Expr.If(
            Expr.BinOp('==', Expr.Var('n'), Expr.Int(0)),
            Expr.Int(1),
            Expr.BinOp('*', Expr.Var('n'),
              Expr.App(Expr.Var('fact'), Expr.BinOp('-', Expr.Var('n'), Expr.Int(1))))
          )
        ),
        Expr.Var('fact')
      );
      assert.equal(typeOf(fact).toString(), '(Int -> Int)');
    });

    it('infers fibonacci type: Int -> Int', () => {
      const fib = Expr.LetRec('fib',
        Expr.Lam('n',
          Expr.If(
            Expr.BinOp('<=', Expr.Var('n'), Expr.Int(1)),
            Expr.Var('n'),
            Expr.BinOp('+',
              Expr.App(Expr.Var('fib'), Expr.BinOp('-', Expr.Var('n'), Expr.Int(1))),
              Expr.App(Expr.Var('fib'), Expr.BinOp('-', Expr.Var('n'), Expr.Int(2))))
          )
        ),
        Expr.Var('fib')
      );
      assert.equal(typeOf(fib).toString(), '(Int -> Int)');
    });

    it('infers recursive sum: Int -> Int', () => {
      const sum = Expr.LetRec('sum',
        Expr.Lam('n',
          Expr.If(
            Expr.BinOp('==', Expr.Var('n'), Expr.Int(0)),
            Expr.Int(0),
            Expr.BinOp('+', Expr.Var('n'),
              Expr.App(Expr.Var('sum'), Expr.BinOp('-', Expr.Var('n'), Expr.Int(1))))
          )
        ),
        Expr.Var('sum')
      );
      assert.equal(typeOf(sum).toString(), '(Int -> Int)');
    });

    it('recursive with Bool return', () => {
      // isEven n = if n == 0 then true else isOdd (n-1)
      // Simplified: isPositive n = if n <= 0 then false else true
      const isPos = Expr.LetRec('isPos',
        Expr.Lam('n',
          Expr.If(
            Expr.BinOp('<=', Expr.Var('n'), Expr.Int(0)),
            Expr.Bool(false),
            Expr.Bool(true)
          )
        ),
        Expr.Var('isPos')
      );
      assert.equal(typeOf(isPos).toString(), '(Int -> Bool)');
    });

    it('using recursive function in expression', () => {
      const t = typeOf(
        Expr.LetRec('fact',
          Expr.Lam('n',
            Expr.If(
              Expr.BinOp('==', Expr.Var('n'), Expr.Int(0)),
              Expr.Int(1),
              Expr.BinOp('*', Expr.Var('n'),
                Expr.App(Expr.Var('fact'), Expr.BinOp('-', Expr.Var('n'), Expr.Int(1))))
            )
          ),
          Expr.App(Expr.Var('fact'), Expr.Int(5))
        )
      );
      assert.equal(t.toString(), 'Int');
    });
  });

  describe('List type inference', () => {
    it('empty list is polymorphic', () => {
      const t = typeOf(Expr.List([]));
      assert.ok(t.toString().startsWith('List'));
    });

    it('Int list', () => {
      const t = typeOf(Expr.List([Expr.Int(1), Expr.Int(2)]));
      assert.equal(t.toString(), 'List<Int>');
    });

    it('Bool list', () => {
      const t = typeOf(Expr.List([Expr.Bool(true), Expr.Bool(false)]));
      assert.equal(t.toString(), 'List<Bool>');
    });

    it('nested list', () => {
      const t = typeOf(Expr.List([
        Expr.List([Expr.Int(1)]),
        Expr.List([Expr.Int(2)])
      ]));
      assert.equal(t.toString(), 'List<List<Int>>');
    });

    it('list of pairs', () => {
      const t = typeOf(Expr.List([
        Expr.Pair(Expr.Int(1), Expr.Bool(true)),
        Expr.Pair(Expr.Int(2), Expr.Bool(false))
      ]));
      assert.equal(t.toString(), 'List<Pair<Int, Bool>>');
    });
  });

  describe('Complex type interactions', () => {
    it('function returning pair', () => {
      const t = typeOf(Expr.Lam('x', Expr.Pair(Expr.Var('x'), Expr.Var('x'))));
      // Should be t0 -> Pair<t0, t0>
      assert.ok(t.toString().includes('Pair'));
    });

    it('function returning list', () => {
      const t = typeOf(Expr.Lam('x', Expr.List([Expr.Var('x')])));
      // Should be t0 -> List<t0>
      assert.ok(t.toString().includes('List'));
    });

    it('let with pair destructuring-like pattern', () => {
      const t = typeOf(
        Expr.Let('p', Expr.Pair(Expr.Int(1), Expr.Bool(true)),
          Expr.Var('p')
        )
      );
      assert.equal(t.toString(), 'Pair<Int, Bool>');
    });

    it('polymorphic function applied to different list types', () => {
      // let id = fn x => x in (id [1,2], id [true, false])
      const t = typeOf(
        Expr.Let('id', Expr.Lam('x', Expr.Var('x')),
          Expr.Pair(
            Expr.App(Expr.Var('id'), Expr.List([Expr.Int(1)])),
            Expr.App(Expr.Var('id'), Expr.List([Expr.Bool(true)]))
          )
        )
      );
      assert.ok(t.toString().includes('List<Int>'));
      assert.ok(t.toString().includes('List<Bool>'));
    });

    it('K combinator type', () => {
      // K = fn x => fn y => x
      const t = typeOf(Expr.Lam('x', Expr.Lam('y', Expr.Var('x'))));
      // Should be a -> b -> a
      assert.ok(t.kind === 'TCon' && t.name === '->');
      const returnType = t.args[1];
      assert.ok(returnType.kind === 'TCon' && returnType.name === '->');
    });

    it('Church numeral zero type', () => {
      // zero = fn f => fn x => x
      const t = typeOf(Expr.Lam('f', Expr.Lam('x', Expr.Var('x'))));
      assert.ok(t.toString().includes('->'));
    });

    it('Church successor type', () => {
      // succ = fn n => fn f => fn x => f (n f x)
      const succ = Expr.Lam('n', Expr.Lam('f', Expr.Lam('x',
        Expr.App(Expr.Var('f'),
          Expr.App(Expr.App(Expr.Var('n'), Expr.Var('f')), Expr.Var('x')))
      )));
      const t = typeOf(succ);
      assert.ok(t.toString().includes('->'));
    });
  });

  describe('Record type interactions', () => {
    it('record in list', () => {
      const t = typeOf(Expr.List([
        Expr.Record([{ name: 'x', value: Expr.Int(1) }]),
        Expr.Record([{ name: 'x', value: Expr.Int(2) }])
      ]));
      assert.ok(t.toString().includes('List'));
    });

    it('function returning record', () => {
      const t = typeOf(Expr.Lam('x',
        Expr.Record([
          { name: 'value', value: Expr.Var('x') },
          { name: 'valid', value: Expr.Bool(true) }
        ])
      ));
      assert.ok(t.toString().includes('->'));
      assert.ok(t.toString().includes('Bool'));
    });
  });

  describe('Type checker from source', () => {
    it('recursive function from source', () => {
      const t = typeCheck('letrec f = fn n => if n == 0 then 1 else n * f (n - 1) in f');
      assert.equal(t, '(Int -> Int)');
    });

    it('simple expression from source', () => {
      assert.equal(typeCheck('let x = 5 in let y = 10 in x + y'), 'Int');
    });

    it('lambda from source', () => {
      const t = typeCheck('fn x => fn y => x + y');
      assert.equal(t, '(Int -> (Int -> Int))');
    });

    it('boolean expression from source', () => {
      assert.equal(typeCheck('(1 < 2) && (3 > 0)'), 'Bool');
    });

    it('nested if from source', () => {
      assert.equal(typeCheck('if true then if false then 1 else 2 else 3'), 'Int');
    });
  });
});
