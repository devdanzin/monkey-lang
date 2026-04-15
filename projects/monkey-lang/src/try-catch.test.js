// Try/Catch/Throw tests — both evaluator and VM

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { monkeyEval } from './evaluator.js';
import { Environment, NULL, MonkeyInteger, MonkeyString, MonkeyError } from './object.js';
import { Compiler } from './compiler.js';
import { VM } from './vm.js';

function evalProgram(input) {
  const lexer = new Lexer(input);
  const parser = new Parser(lexer);
  const program = parser.parseProgram();
  if (parser.errors.length > 0) {
    throw new Error(`Parser errors: ${parser.errors.join(', ')}`);
  }
  const env = new Environment();
  return monkeyEval(program, env);
}

function vmRun(input) {
  const lexer = new Lexer(input);
  const parser = new Parser(lexer);
  const program = parser.parseProgram();
  if (parser.errors.length > 0) {
    throw new Error(`Parser errors: ${parser.errors.join(', ')}`);
  }
  const compiler = new Compiler();
  const err = compiler.compile(program);
  if (err) throw new Error(`Compiler error: ${err}`);
  const vm = new VM(compiler.bytecode());
  vm.run();
  return vm.lastPoppedStackElem();
}

function testBoth(name, input, expected) {
  it(`eval: ${name}`, () => {
    const result = evalProgram(input);
    checkResult(result, expected);
  });
  it(`vm: ${name}`, () => {
    const result = vmRun(input);
    checkResult(result, expected);
  });
}

function checkResult(result, expected) {
  if (expected === null) {
    assert.ok(result === NULL || result === null || result === undefined,
      `expected null, got ${result?.inspect ? result.inspect() : result}`);
  } else if (typeof expected === 'number') {
    assert.ok(result instanceof MonkeyInteger, `expected integer, got ${result?.type?.()}`);
    assert.equal(result.value, expected);
  } else if (typeof expected === 'string') {
    assert.ok(result instanceof MonkeyString, `expected string, got ${result?.type?.()}: ${result?.inspect?.()}`);
    assert.equal(result.value, expected);
  }
}

describe('try/catch/throw', () => {
  // Basic try/catch
  testBoth('basic try/catch with throw',
    `let result = "";
     try {
       throw "error!";
       result = "not reached";
     } catch (e) {
       result = e;
     }
     result`,
    'error!'
  );

  testBoth('try block runs normally when no throw',
    `let x = 0;
     try {
       x = 42;
     } catch (e) {
       x = -1;
     }
     x`,
    42
  );

  testBoth('throw integer value',
    `let result = 0;
     try {
       throw 99;
     } catch (e) {
       result = e;
     }
     result`,
    99
  );

  testBoth('throw string value',
    `let result = "";
     try {
       throw "oops";
     } catch (e) {
       result = e;
     }
     result`,
    'oops'
  );

  testBoth('nested try/catch — inner catches',
    `let result = "";
     try {
       try {
         throw "inner";
       } catch (e) {
         result = e;
       }
     } catch (e) {
       result = "outer";
     }
     result`,
    'inner'
  );

  testBoth('nested try/catch — inner rethrows to outer',
    `let result = "";
     try {
       try {
         throw "inner";
       } catch (e) {
         throw "rethrown";
       }
     } catch (e) {
       result = e;
     }
     result`,
    'rethrown'
  );

  testBoth('try/catch without parameter',
    `let result = 0;
     try {
       throw "err";
     } catch {
       result = 1;
     }
     result`,
    1
  );

  testBoth('code after throw is not executed',
    `let result = "before";
     try {
       throw "err";
       result = "after";
     } catch (e) {
       result = result;
     }
     result`,
    'before'
  );

  testBoth('throw in function caught by caller',
    `let throwFn = fn() { throw "from fn"; };
     let result = "";
     try {
       throwFn();
     } catch (e) {
       result = e;
     }
     result`,
    'from fn'
  );

  testBoth('try/finally — finally always runs',
    `let result = 0;
     let finallyRan = 0;
     try {
       result = 42;
     } finally {
       finallyRan = 1;
     }
     finallyRan`,
    1
  );

  testBoth('try/catch/finally — catch and finally both run on throw',
    `let caught = "";
     let finallyRan = 0;
     try {
       throw "err";
     } catch (e) {
       caught = e;
     } finally {
       finallyRan = 1;
     }
     finallyRan`,
    1
  );

  testBoth('try/finally — finally runs even without throw',
    `let x = 0;
     try {
       x = 1;
     } finally {
       x = x + 10;
     }
     x`,
    11
  );

  // Edge cases
  testBoth('throw in while loop breaks out to catch',
    `let result = 0;
     try {
       let i = 0;
       while (i < 10) {
         if (i == 5) { throw "stopped"; }
         i = i + 1;
       }
     } catch (e) {
       result = 5;
     }
     result`,
    5
  );

  testBoth('return inside try in function',
    `let f = fn() {
       try {
         return 42;
       } catch (e) {
         return -1;
       }
     };
     f()`,
    42
  );

  testBoth('nested finally — inner finally + outer catch + outer finally',
    `let log = 0;
     try {
       try {
         throw "inner";
       } finally {
         log = log + 1;
       }
     } catch (e) {
       log = log + 10;
     } finally {
       log = log + 100;
     }
     log`,
    111
  );

  testBoth('triple nested rethrow chain',
    `let result = "";
     try {
       try {
         try {
           throw "a";
         } catch (e) {
           throw "b";
         }
       } catch (e) {
         throw "c";
       }
     } catch (e) {
       result = e;
     }
     result`,
    'c'
  );

  testBoth('throw propagates through finally-only block',
    `let finallyRan = 0;
     try {
       try {
         throw "err";
       } finally {
         finallyRan = 1;
       }
     } catch (e) {
       finallyRan = finallyRan + 10;
     }
     finallyRan`,
    11
  );

  testBoth('catch and finally both run on throw',
    `let caught = 0;
     let fin = 0;
     try {
       throw "x";
     } catch(e) {
       caught = 1;
     } finally {
       fin = 1;
     }
     caught + fin`,
    2
  );
});

describe('try/catch parser', () => {
  it('parses try/catch', () => {
    const lexer = new Lexer('try { 1 } catch (e) { 2 }');
    const parser = new Parser(lexer);
    const program = parser.parseProgram();
    assert.equal(parser.errors.length, 0, `Parser errors: ${parser.errors}`);
    assert.equal(program.statements.length, 1);
  });

  it('parses try/finally', () => {
    const lexer = new Lexer('try { 1 } finally { 2 }');
    const parser = new Parser(lexer);
    const program = parser.parseProgram();
    assert.equal(parser.errors.length, 0, `Parser errors: ${parser.errors}`);
  });

  it('parses try/catch/finally', () => {
    const lexer = new Lexer('try { 1 } catch (e) { 2 } finally { 3 }');
    const parser = new Parser(lexer);
    const program = parser.parseProgram();
    assert.equal(parser.errors.length, 0, `Parser errors: ${parser.errors}`);
  });

  it('rejects try without catch or finally', () => {
    const lexer = new Lexer('try { 1 }');
    const parser = new Parser(lexer);
    parser.parseProgram();
    assert.ok(parser.errors.length > 0, 'Should have parser errors');
  });

  it('parses throw statement', () => {
    const lexer = new Lexer('throw "error"');
    const parser = new Parser(lexer);
    const program = parser.parseProgram();
    assert.equal(parser.errors.length, 0, `Parser errors: ${parser.errors}`);
    assert.equal(program.statements.length, 1);
  });
});
