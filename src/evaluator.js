// Monkey Language Tree-Walking Evaluator

import {
  MonkeyInteger, MonkeyFloat, MonkeyString, MonkeyReturnValue, MonkeyError,
  MonkeyFunction, MonkeyArray, MonkeyHash, MonkeyBuiltin,
  Environment, TRUE, FALSE, NULL, OBJ, BREAK_SIGNAL, CONTINUE_SIGNAL,
} from './object.js';

import * as AST from './ast.js';
import { STDLIB } from './stdlib.js';
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';

// --- Builtins ---

const builtins = new Map([
  ['len', new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return newError(`wrong number of arguments. got=${args.length}, want=1`);
    const arg = args[0];
    if (arg instanceof MonkeyString) return new MonkeyInteger(arg.value.length);
    if (arg instanceof MonkeyArray) return new MonkeyInteger(arg.elements.length);
    return newError(`argument to \`len\` not supported, got ${arg.type()}`);
  })],
  ['first', new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return newError(`wrong number of arguments. got=${args.length}, want=1`);
    if (args[0].type() !== OBJ.ARRAY) return newError(`argument to \`first\` must be ARRAY, got ${args[0].type()}`);
    return args[0].elements.length > 0 ? args[0].elements[0] : NULL;
  })],
  ['last', new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return newError(`wrong number of arguments. got=${args.length}, want=1`);
    if (args[0].type() !== OBJ.ARRAY) return newError(`argument to \`last\` must be ARRAY, got ${args[0].type()}`);
    const els = args[0].elements;
    return els.length > 0 ? els[els.length - 1] : NULL;
  })],
  ['rest', new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return newError(`wrong number of arguments. got=${args.length}, want=1`);
    if (args[0].type() !== OBJ.ARRAY) return newError(`argument to \`rest\` must be ARRAY, got ${args[0].type()}`);
    const els = args[0].elements;
    return els.length > 0 ? new MonkeyArray(els.slice(1)) : NULL;
  })],
  ['push', new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return newError(`wrong number of arguments. got=${args.length}, want=2`);
    if (args[0].type() !== OBJ.ARRAY) return newError(`argument to \`push\` must be ARRAY, got ${args[0].type()}`);
    return new MonkeyArray([...args[0].elements, args[1]]);
  })],
  ['puts', new MonkeyBuiltin((...args) => {
    for (const arg of args) console.log(arg.inspect());
    return NULL;
  })],
  ['type', new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return newError(`wrong number of arguments. got=${args.length}, want=1`);
    return new MonkeyString(args[0].type());
  })],
  ['str', new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return newError(`wrong number of arguments. got=${args.length}, want=1`);
    return new MonkeyString(args[0].inspect());
  })],
  ['int', new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return newError(`wrong number of arguments. got=${args.length}, want=1`);
    const arg = args[0];
    if (arg instanceof MonkeyInteger) return arg;
    if (arg instanceof MonkeyFloat) return new MonkeyInteger(Math.trunc(arg.value));
    if (arg instanceof MonkeyString) {
      const n = parseInt(arg.value, 10);
      return isNaN(n) ? NULL : new MonkeyInteger(n);
    }
    return NULL;
  })],
  ['float', new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return newError(`wrong number of arguments. got=${args.length}, want=1`);
    const arg = args[0];
    if (arg instanceof MonkeyFloat) return arg;
    if (arg instanceof MonkeyInteger) return new MonkeyFloat(arg.value);
    if (arg instanceof MonkeyString) {
      const n = parseFloat(arg.value);
      return isNaN(n) ? NULL : new MonkeyFloat(n);
    }
    return NULL;
  })],
  ['format', new MonkeyBuiltin((...args) => {
    if (args.length < 1) return newError(`format requires at least 1 argument`);
    if (!(args[0] instanceof MonkeyString)) return newError(`first argument to format must be a string`);
    let template = args[0].value;
    let argIdx = 1;
    let result = '';
    for (let i = 0; i < template.length; i++) {
      if (template[i] === '%' && i + 1 < template.length) {
        const spec = template[i + 1];
        if (spec === '%') { result += '%'; i++; continue; }
        if (argIdx >= args.length) { result += '%' + spec; i++; continue; }
        const arg = args[argIdx++];
        switch (spec) {
          case 's': result += arg.inspect(); break;
          case 'd': result += arg instanceof MonkeyInteger ? String(arg.value) : arg.inspect(); break;
          default: result += '%' + spec;
        }
        i++;
      } else {
        result += template[i];
      }
    }
    return new MonkeyString(result);
  })],
  ['range', new MonkeyBuiltin((...args) => {
    if (args.length < 1 || args.length > 3) return newError(`wrong number of arguments to range. got=${args.length}`);
    let start, end, step;
    if (args.length === 1) {
      start = 0; end = args[0].value; step = 1;
    } else if (args.length === 2) {
      start = args[0].value; end = args[1].value; step = 1;
    } else {
      start = args[0].value; end = args[1].value; step = args[2].value;
    }
    if (step === 0) return newError('range step cannot be zero');
    const elements = [];
    if (step > 0) {
      for (let i = start; i < end; i += step) elements.push(new MonkeyInteger(i));
    } else {
      for (let i = start; i > end; i += step) elements.push(new MonkeyInteger(i));
    }
    return new MonkeyArray(elements);
  })],
  // String methods
  ['split', new MonkeyBuiltin((...args) => {
    if (args.length < 1 || args.length > 2) return newError(`wrong number of arguments to split. got=${args.length}`);
    if (!(args[0] instanceof MonkeyString)) return newError(`argument to split must be STRING, got ${args[0].type()}`);
    const sep = args.length === 2 && args[1] instanceof MonkeyString ? args[1].value : '';
    const parts = sep === '' ? [...args[0].value] : args[0].value.split(sep);
    return new MonkeyArray(parts.map(s => new MonkeyString(s)));
  })],
  ['join', new MonkeyBuiltin((...args) => {
    if (args.length < 1 || args.length > 2) return newError(`wrong number of arguments to join. got=${args.length}`);
    if (!(args[0] instanceof MonkeyArray)) return newError(`first argument to join must be ARRAY, got ${args[0].type()}`);
    const sep = args.length === 2 && args[1] instanceof MonkeyString ? args[1].value : '';
    const strs = args[0].elements.map(e => e.inspect ? e.inspect() : String(e));
    return new MonkeyString(strs.join(sep));
  })],
  ['trim', new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return newError(`wrong number of arguments to trim. got=${args.length}, want=1`);
    if (!(args[0] instanceof MonkeyString)) return newError(`argument to trim must be STRING, got ${args[0].type()}`);
    return new MonkeyString(args[0].value.trim());
  })],
  ['upper', new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return newError(`wrong number of arguments to upper. got=${args.length}, want=1`);
    if (!(args[0] instanceof MonkeyString)) return newError(`argument to upper must be STRING, got ${args[0].type()}`);
    return new MonkeyString(args[0].value.toUpperCase());
  })],
  ['lower', new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return newError(`wrong number of arguments to lower. got=${args.length}, want=1`);
    if (!(args[0] instanceof MonkeyString)) return newError(`argument to lower must be STRING, got ${args[0].type()}`);
    return new MonkeyString(args[0].value.toLowerCase());
  })],
  ['contains', new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return newError(`wrong number of arguments to contains. got=${args.length}, want=2`);
    if (args[0] instanceof MonkeyString && args[1] instanceof MonkeyString) {
      return args[0].value.includes(args[1].value) ? TRUE : FALSE;
    }
    if (args[0] instanceof MonkeyArray) {
      for (const el of args[0].elements) {
        if (el.value !== undefined && args[1].value !== undefined && el.value === args[1].value) return TRUE;
        if (el === args[1]) return TRUE;
      }
      return FALSE;
    }
    return newError(`contains: unsupported types ${args[0].type()}, ${args[1].type()}`);
  })],
  ['indexOf', new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return newError(`wrong number of arguments to indexOf. got=${args.length}, want=2`);
    if (args[0] instanceof MonkeyString && args[1] instanceof MonkeyString) {
      return new MonkeyInteger(args[0].value.indexOf(args[1].value));
    }
    if (args[0] instanceof MonkeyArray) {
      for (let i = 0; i < args[0].elements.length; i++) {
        if (args[0].elements[i].value !== undefined && args[1].value !== undefined && args[0].elements[i].value === args[1].value) return new MonkeyInteger(i);
      }
      return new MonkeyInteger(-1);
    }
    return newError(`indexOf: unsupported types ${args[0].type()}, ${args[1].type()}`);
  })],
  ['replace', new MonkeyBuiltin((...args) => {
    if (args.length !== 3) return newError(`wrong number of arguments to replace. got=${args.length}, want=3`);
    if (!(args[0] instanceof MonkeyString) || !(args[1] instanceof MonkeyString) || !(args[2] instanceof MonkeyString))
      return newError('replace: all arguments must be STRING');
    return new MonkeyString(args[0].value.split(args[1].value).join(args[2].value));
  })],
  ['reverse', new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return newError(`wrong number of arguments to reverse. got=${args.length}, want=1`);
    if (args[0] instanceof MonkeyArray) return new MonkeyArray([...args[0].elements].reverse());
    if (args[0] instanceof MonkeyString) return new MonkeyString([...args[0].value].reverse().join(''));
    return newError(`reverse: unsupported type ${args[0].type()}`);
  })],
  ['abs', new MonkeyBuiltin((...args) => {
    if (args.length !== 1 || !(args[0] instanceof MonkeyInteger)) return newError('abs: expected 1 integer');
    return new MonkeyInteger(Math.abs(args[0].value));
  })],
  ['min', new MonkeyBuiltin((...args) => {
    if (args.length < 2) return newError('min: expected at least 2 arguments');
    let result = args[0].value;
    for (let i = 1; i < args.length; i++) result = Math.min(result, args[i].value);
    return new MonkeyInteger(result);
  })],
  ['max', new MonkeyBuiltin((...args) => {
    if (args.length < 2) return newError('max: expected at least 2 arguments');
    let result = args[0].value;
    for (let i = 1; i < args.length; i++) result = Math.max(result, args[i].value);
    return new MonkeyInteger(result);
  })],
  // Hash iteration
  ['keys', new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return newError(`wrong number of arguments to keys. got=${args.length}, want=1`);
    if (!(args[0] instanceof MonkeyHash)) return newError(`argument to keys must be HASH, got ${args[0].type()}`);
    const ks = [];
    for (const [, { key }] of args[0].pairs) ks.push(key);
    return new MonkeyArray(ks);
  })],
  ['values', new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return newError(`wrong number of arguments to values. got=${args.length}, want=1`);
    if (!(args[0] instanceof MonkeyHash)) return newError(`argument to values must be HASH, got ${args[0].type()}`);
    const vs = [];
    for (const [, { value }] of args[0].pairs) vs.push(value);
    return new MonkeyArray(vs);
  })],
  // map(array, fn) — apply fn to each element
  ['map', new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return newError(`wrong number of arguments to map. got=${args.length}, want=2`);
    const [arr, fn] = args;
    if (!(arr instanceof MonkeyArray)) return newError(`first argument to map must be ARRAY, got ${arr.type()}`);
    if (!(fn instanceof MonkeyFunction) && !(fn instanceof MonkeyBuiltin))
      return newError(`second argument to map must be FUNCTION, got ${fn.type()}`);
    const results = [];
    for (const el of arr.elements) {
      const result = applyFunction(fn, [el]);
      if (isError(result)) return result;
      results.push(result);
    }
    return new MonkeyArray(results);
  })],
  // filter(array, fn) — keep elements where fn returns truthy
  ['filter', new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return newError(`wrong number of arguments to filter. got=${args.length}, want=2`);
    const [arr, fn] = args;
    if (!(arr instanceof MonkeyArray)) return newError(`first argument to filter must be ARRAY, got ${arr.type()}`);
    if (!(fn instanceof MonkeyFunction) && !(fn instanceof MonkeyBuiltin))
      return newError(`second argument to filter must be FUNCTION, got ${fn.type()}`);
    const results = [];
    for (const el of arr.elements) {
      const result = applyFunction(fn, [el]);
      if (isError(result)) return result;
      if (isTruthy(result)) results.push(el);
    }
    return new MonkeyArray(results);
  })],
  // reduce(array, initial, fn) — fold array with fn(acc, el)
  ['reduce', new MonkeyBuiltin((...args) => {
    if (args.length !== 3) return newError(`wrong number of arguments to reduce. got=${args.length}, want=3`);
    const [arr, initial, fn] = args;
    if (!(arr instanceof MonkeyArray)) return newError(`first argument to reduce must be ARRAY, got ${arr.type()}`);
    if (!(fn instanceof MonkeyFunction) && !(fn instanceof MonkeyBuiltin))
      return newError(`third argument to reduce must be FUNCTION, got ${fn.type()}`);
    let acc = initial;
    for (const el of arr.elements) {
      acc = applyFunction(fn, [acc, el]);
      if (isError(acc)) return acc;
    }
    return acc;
  })],
  // sort(array) or sort(array, comparator)
  ['sort', new MonkeyBuiltin((...args) => {
    if (args.length < 1 || args.length > 2) return newError(`wrong number of arguments to sort. got=${args.length}`);
    const arr = args[0];
    if (!(arr instanceof MonkeyArray)) return newError(`first argument to sort must be ARRAY, got ${arr.type()}`);
    const sorted = [...arr.elements];
    if (args.length === 2) {
      // Custom comparator: fn(a, b) returns integer (<0, 0, >0)
      const fn = args[1];
      if (!(fn instanceof MonkeyFunction) && !(fn instanceof MonkeyBuiltin))
        return newError(`second argument to sort must be FUNCTION, got ${fn.type()}`);
      sorted.sort((a, b) => {
        const result = applyFunction(fn, [a, b]);
        if (isError(result)) return 0;
        return result.value || 0;
      });
    } else {
      // Default sort: by value
      sorted.sort((a, b) => {
        if (a.value < b.value) return -1;
        if (a.value > b.value) return 1;
        return 0;
      });
    }
    return new MonkeyArray(sorted);
  })],
  // find(arr, fn) — first element matching predicate (evaluator only)
  ['find', new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return newError(`wrong number of arguments to find. got=${args.length}, want=2`);
    if (!(args[0] instanceof MonkeyArray)) return newError(`first argument to find must be ARRAY`);
    const fn = args[1];
    for (const el of args[0].elements) {
      const result = applyFunction(fn, [el]);
      if (isError(result)) return result;
      if (isTruthy(result)) return el;
    }
    return NULL;
  })],
  // every(arr, fn) — true if all elements match predicate
  ['every', new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return newError(`wrong number of arguments to every. got=${args.length}, want=2`);
    if (!(args[0] instanceof MonkeyArray)) return newError(`first argument to every must be ARRAY`);
    const fn = args[1];
    for (const el of args[0].elements) {
      const result = applyFunction(fn, [el]);
      if (isError(result)) return result;
      if (!isTruthy(result)) return FALSE;
    }
    return TRUE;
  })],
  // some(arr, fn) — true if any element matches predicate
  ['some', new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return newError(`wrong number of arguments to some. got=${args.length}, want=2`);
    if (!(args[0] instanceof MonkeyArray)) return newError(`first argument to some must be ARRAY`);
    const fn = args[1];
    for (const el of args[0].elements) {
      const result = applyFunction(fn, [el]);
      if (isError(result)) return result;
      if (isTruthy(result)) return TRUE;
    }
    return FALSE;
  })],
  ['flat', new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return newError(`wrong number of arguments to flat. got=${args.length}, want=1`);
    if (!(args[0] instanceof MonkeyArray)) return newError(`argument to flat must be ARRAY`);
    const result = [];
    for (const el of args[0].elements) {
      if (el instanceof MonkeyArray) {
        result.push(...el.elements);
      } else {
        result.push(el);
      }
    }
    return new MonkeyArray(result);
  })],
  // import(module_name) — loads a standard library module
  ['import', new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return newError(`wrong number of arguments to import. got=${args.length}, want=1`);
    if (!(args[0] instanceof MonkeyString)) return newError(`argument to import must be STRING, got ${args[0].type()}`);
    const name = args[0].value;
    const source = STDLIB[name];
    if (!source) return newError(`module not found: ${name}`);
    const l = new Lexer(source);
    const p = new Parser(l);
    const program = p.parseProgram();
    const env = new Environment();
    for (const [k, v] of builtins) env.set(k, v);
    return monkeyEval(program, env);
  })],
]);

// --- Helpers ---

function newError(msg) { return new MonkeyError(msg); }
function isError(obj) { return obj && obj.type() === OBJ.ERROR; }
function nativeBoolToBooleanObject(val) { return val ? TRUE : FALSE; }
function isTruthy(obj) {
  if (obj === NULL || obj === FALSE) return false;
  if (obj === TRUE) return true;
  return true;
}

// --- Eval ---

export function monkeyEval(node, env) {
  // Program
  if (node instanceof AST.Program) return evalProgram(node.statements, env);

  // Statements
  if (node instanceof AST.ExpressionStatement) return monkeyEval(node.expression, env);
  if (node instanceof AST.BlockStatement) return evalBlockStatement(node.statements, env);
  if (node instanceof AST.LetStatement) {
    const val = monkeyEval(node.value, env);
    if (isError(val)) return val;
    if (node.isConst) {
      env.setConst(node.name.value, val);
    } else {
      env.set(node.name.value, val);
    }
    return undefined;
  }
  if (node instanceof AST.DestructureLetStatement) {
    const val = monkeyEval(node.value, env);
    if (isError(val)) return val;
    if (!(val instanceof MonkeyArray)) return newError('destructuring requires an array value');
    for (let i = 0; i < node.names.length; i++) {
      const v = i < val.elements.length ? val.elements[i] : NULL;
      if (node.isConst) env.setConst(node.names[i].value, v);
      else env.set(node.names[i].value, v);
    }
    return undefined;
  }
  if (node instanceof AST.DestructureHashLetStatement) {
    const val = monkeyEval(node.value, env);
    if (isError(val)) return val;
    if (!(val instanceof MonkeyHash)) return newError('hash destructuring requires a hash value');
    for (const name of node.names) {
      const key = new MonkeyString(name.value).hashKey();
      const pair = val.pairs.get(key);
      const v = pair ? pair.value : NULL;
      if (node.isConst) env.setConst(name.value, v);
      else env.set(name.value, v);
    }
    return undefined;
  }
  if (node instanceof AST.SetStatement) {
    const val = monkeyEval(node.value, env);
    if (isError(val)) return val;
    if (env.isConst(node.name.value)) {
      return newError(`Cannot reassign const binding '${node.name.value}'`);
    }
    env.update(node.name.value, val);
    return undefined;
  }
  if (node instanceof AST.ReturnStatement) {
    const val = monkeyEval(node.returnValue, env);
    if (isError(val)) return val;
    return new MonkeyReturnValue(val);
  }

  // Expressions
  if (node instanceof AST.IntegerLiteral) return new MonkeyInteger(node.value);
  if (node instanceof AST.FloatLiteral) return new MonkeyFloat(node.value);
  if (node instanceof AST.StringLiteral) return new MonkeyString(node.value);
  if (node instanceof AST.FStringExpression) {
    let result = '';
    for (const seg of node.segments) {
      if (seg.type === 'text') {
        result += seg.value;
      } else {
        const val = monkeyEval(seg.expr, env);
        if (isError(val)) return val;
        result += val.inspect();
      }
    }
    return new MonkeyString(result);
  }
  if (node instanceof AST.BooleanLiteral) return nativeBoolToBooleanObject(node.value);

  if (node instanceof AST.PrefixExpression) {
    const right = monkeyEval(node.right, env);
    if (isError(right)) return right;
    return evalPrefixExpression(node.operator, right);
  }

  if (node instanceof AST.InfixExpression) {
    // Short-circuit logical operators
    if (node.operator === '&&') {
      const left = monkeyEval(node.left, env);
      if (isError(left)) return left;
      if (!isTruthy(left)) return left;
      return monkeyEval(node.right, env);
    }
    if (node.operator === '||') {
      const left = monkeyEval(node.left, env);
      if (isError(left)) return left;
      if (isTruthy(left)) return left;
      return monkeyEval(node.right, env);
    }
    if (node.operator === '??') {
      const left = monkeyEval(node.left, env);
      if (isError(left)) return left;
      if (left !== NULL) return left;
      return monkeyEval(node.right, env);
    }
    const left = monkeyEval(node.left, env);
    if (isError(left)) return left;
    const right = monkeyEval(node.right, env);
    if (isError(right)) return right;
    return evalInfixExpression(node.operator, left, right);
  }

  if (node instanceof AST.IfExpression) return evalIfExpression(node, env);
  if (node instanceof AST.WhileExpression) return evalWhileExpression(node, env);
  if (node instanceof AST.DoWhileExpression) return evalDoWhileExpression(node, env);
  if (node instanceof AST.BreakStatement) return BREAK_SIGNAL;
  if (node instanceof AST.ContinueStatement) return CONTINUE_SIGNAL;
  if (node instanceof AST.ThrowExpression) {
    const val = monkeyEval(node.value, env);
    if (isError(val)) return val;
    return new MonkeyError(val instanceof MonkeyString ? val.value : val.inspect());
  }
  if (node instanceof AST.FStringExpression) {
    let result = '';
    for (const seg of node.segments) {
      if (seg.type === 'text') {
        result += seg.value;
      } else {
        const val = monkeyEval(seg.expr, env);
        if (isError(val)) return val;
        result += val.inspect();
      }
    }
    return new MonkeyString(result);
  }
  if (node instanceof AST.TryCatchExpression) {
    const result = monkeyEval(node.tryBody, env);
    if (isError(result)) {
      // Caught! Bind error to the catch variable
      const catchEnv = new Environment(env);
      catchEnv.set(node.errorIdent, new MonkeyString(result.message));
      return monkeyEval(node.catchBody, catchEnv);
    }
    return result;
  }
  if (node instanceof AST.TernaryExpression) {
    const cond = monkeyEval(node.condition, env);
    if (isError(cond)) return cond;
    if (isTruthy(cond)) return monkeyEval(node.consequence, env);
    return monkeyEval(node.alternative, env);
  }
  if (node instanceof AST.SwitchExpression) {
    const switchVal = monkeyEval(node.value, env);
    if (isError(switchVal)) return switchVal;
    for (const c of node.cases) {
      const caseVal = monkeyEval(c.value, env);
      if (isError(caseVal)) return caseVal;
      // Value comparison
      let match = false;
      if (switchVal.value !== undefined && caseVal.value !== undefined) {
        match = switchVal.value === caseVal.value;
      } else {
        match = switchVal === caseVal;
      }
      if (match) return monkeyEval(c.body, env);
    }
    if (node.defaultCase) return monkeyEval(node.defaultCase, env);
    return NULL;
  }
  if (node instanceof AST.SliceExpression) {
    const left = monkeyEval(node.left, env);
    if (isError(left)) return left;
    const start = node.start ? monkeyEval(node.start, env) : new MonkeyInteger(0);
    if (isError(start)) return start;
    
    if (left instanceof MonkeyArray) {
      const len = left.elements.length;
      let s = start.value;
      let e = node.end ? monkeyEval(node.end, env).value : len;
      if (s < 0) s = len + s;
      if (e < 0) e = len + e;
      s = Math.max(0, Math.min(s, len));
      e = Math.max(0, Math.min(e, len));
      return new MonkeyArray(left.elements.slice(s, e));
    }
    if (left instanceof MonkeyString) {
      const len = left.value.length;
      let s = start.value;
      let e = node.end ? monkeyEval(node.end, env).value : len;
      if (s < 0) s = len + s;
      if (e < 0) e = len + e;
      s = Math.max(0, Math.min(s, len));
      e = Math.max(0, Math.min(e, len));
      return new MonkeyString(left.value.slice(s, e));
    }
    return newError(`slice operator not supported: ${left.type()}`);
  }
  if (node instanceof AST.ForExpression) return evalForExpression(node, env);
  if (node instanceof AST.ForInExpression) {
    const iterable = monkeyEval(node.iterable, env);
    if (isError(iterable)) return iterable;
    let items;
    if (iterable instanceof MonkeyArray) {
      items = iterable.elements;
    } else if (iterable instanceof MonkeyHash) {
      items = [];
      for (const [, { key }] of iterable.pairs) items.push(key);
    } else {
      return newError(`for-in: expected ARRAY or HASH, got ${iterable.type()}`);
    }
    let result = NULL;
    for (const item of items) {
      const loopEnv = new Environment(env);
      loopEnv.set(node.variable, item);
      result = monkeyEval(node.body, loopEnv);
      if (result === BREAK_SIGNAL) break;
      if (result === CONTINUE_SIGNAL) continue;
      if (isError(result)) return result;
      if (result instanceof MonkeyReturnValue) return result;
    }
    return result === BREAK_SIGNAL || result === CONTINUE_SIGNAL ? NULL : result;
  }

  if (node instanceof AST.Identifier) return evalIdentifier(node, env);

  if (node instanceof AST.FunctionLiteral) {
    return new MonkeyFunction(node.parameters, node.body, env);
  }

  if (node instanceof AST.CallExpression) {
    const fn = monkeyEval(node.function, env);
    if (isError(fn)) return fn;
    const args = evalExpressions(node.arguments, env);
    if (args.length === 1 && isError(args[0])) return args[0];
    return applyFunction(fn, args);
  }

  if (node instanceof AST.ArrayLiteral) {
    const elements = [];
    for (const elem of node.elements) {
      if (elem instanceof AST.SpreadExpression) {
        const val = monkeyEval(elem.value, env);
        if (isError(val)) return val;
        if (!(val instanceof MonkeyArray)) return newError('spread requires array');
        elements.push(...val.elements);
      } else {
        const val = monkeyEval(elem, env);
        if (isError(val)) return val;
        elements.push(val);
      }
    }
    return new MonkeyArray(elements);
  }
  if (node instanceof AST.ArrayComprehension) {
    const iterable = monkeyEval(node.iterable, env);
    if (isError(iterable)) return iterable;
    if (!(iterable instanceof MonkeyArray)) return newError('comprehension requires array iterable');
    const result = [];
    for (const elem of iterable.elements) {
      const innerEnv = new Environment(env);
      innerEnv.set(node.variable.value, elem);
      if (node.condition) {
        const cond = monkeyEval(node.condition, innerEnv);
        if (isError(cond)) return cond;
        if (!isTruthy(cond)) continue;
      }
      const val = monkeyEval(node.body, innerEnv);
      if (isError(val)) return val;
      result.push(val);
    }
    return new MonkeyArray(result);
  }

  if (node instanceof AST.IndexExpression) {
    const left = monkeyEval(node.left, env);
    if (isError(left)) return left;
    const index = monkeyEval(node.index, env);
    if (isError(index)) return index;
    return evalIndexExpression(left, index);
  }

  if (node instanceof AST.HashLiteral) {
    return evalHashLiteral(node, env);
  }

  return NULL;
}

function evalProgram(stmts, env) {
  let result;
  for (const stmt of stmts) {
    result = monkeyEval(stmt, env);
    if (result instanceof MonkeyReturnValue) return result.value;
    if (result instanceof MonkeyError) return result;
  }
  return result;
}

function evalBlockStatement(stmts, env) {
  let result;
  for (const stmt of stmts) {
    result = monkeyEval(stmt, env);
    if (result === BREAK_SIGNAL || result === CONTINUE_SIGNAL) return result;
    if (result) {
      const rt = result.type();
      if (rt === OBJ.RETURN || rt === OBJ.ERROR) return result;
    }
  }
  return result;
}

function evalPrefixExpression(op, right) {
  switch (op) {
    case '!': return evalBangOperator(right);
    case '-': return evalMinusPrefix(right);
    default: return newError(`unknown operator: ${op}${right.type()}`);
  }
}

function evalBangOperator(right) {
  if (right === TRUE) return FALSE;
  if (right === FALSE) return TRUE;
  if (right === NULL) return TRUE;
  return FALSE;
}

function evalMinusPrefix(right) {
  if (right.type() === OBJ.INTEGER) return new MonkeyInteger(-right.value);
  if (right.type() === OBJ.FLOAT) return new MonkeyFloat(-right.value);
  return newError(`unknown operator: -${right.type()}`);
}

function evalInfixExpression(op, left, right) {
  // Range operator
  if (op === '..') {
    if (left.type() === OBJ.INTEGER && right.type() === OBJ.INTEGER) {
      const elements = [];
      const start = left.value, end = right.value;
      if (start <= end) {
        for (let i = start; i <= end; i++) elements.push(new MonkeyInteger(i));
      } else {
        for (let i = start; i >= end; i--) elements.push(new MonkeyInteger(i));
      }
      return new MonkeyArray(elements);
    }
    return newError(`range operator requires integers, got ${left.type()} and ${right.type()}`);
  }
  if (left.type() === OBJ.INTEGER && right.type() === OBJ.INTEGER) {
    return evalIntegerInfix(op, left, right);
  }
  // Float arithmetic (including mixed int/float)
  if ((left.type() === OBJ.FLOAT || left.type() === OBJ.INTEGER) &&
      (right.type() === OBJ.FLOAT || right.type() === OBJ.INTEGER)) {
    return evalFloatInfix(op, left, right);
  }
  if (left.type() === OBJ.STRING && right.type() === OBJ.STRING) {
    if (op === '+') return new MonkeyString(left.value + right.value);
    if (op === '==') return nativeBoolToBooleanObject(left.value === right.value);
    if (op === '!=') return nativeBoolToBooleanObject(left.value !== right.value);
    if (op === '<') return nativeBoolToBooleanObject(left.value < right.value);
    if (op === '>') return nativeBoolToBooleanObject(left.value > right.value);
    if (op === '<=') return nativeBoolToBooleanObject(left.value <= right.value);
    if (op === '>=') return nativeBoolToBooleanObject(left.value >= right.value);
    return newError(`unknown operator: ${left.type()} ${op} ${right.type()}`);
  }
  // String * Integer = repeat
  if (left.type() === OBJ.STRING && right.type() === OBJ.INTEGER && op === '*') {
    return new MonkeyString(left.value.repeat(Math.max(0, right.value)));
  }
  if (left.type() === OBJ.INTEGER && right.type() === OBJ.STRING && op === '*') {
    return new MonkeyString(right.value.repeat(Math.max(0, left.value)));
  }
  // Array + Array = concat
  if (left.type() === OBJ.ARRAY && right.type() === OBJ.ARRAY && op === '+') {
    return new MonkeyArray([...left.elements, ...right.elements]);
  }
  if (op === '==') return nativeBoolToBooleanObject(left === right);
  if (op === '!=') return nativeBoolToBooleanObject(left !== right);
  if (left.type() !== right.type()) {
    return newError(`type mismatch: ${left.type()} ${op} ${right.type()}`);
  }
  return newError(`unknown operator: ${left.type()} ${op} ${right.type()}`);
}

function evalIntegerInfix(op, left, right) {
  const l = left.value, r = right.value;
  switch (op) {
    case '+': return new MonkeyInteger(l + r);
    case '-': return new MonkeyInteger(l - r);
    case '*': return new MonkeyInteger(l * r);
    case '/': return new MonkeyInteger(Math.trunc(l / r));
    case '%': return new MonkeyInteger(l % r);
    case '<': return nativeBoolToBooleanObject(l < r);
    case '>': return nativeBoolToBooleanObject(l > r);
    case '<=': return nativeBoolToBooleanObject(l <= r);
    case '>=': return nativeBoolToBooleanObject(l >= r);
    case '==': return nativeBoolToBooleanObject(l === r);
    case '!=': return nativeBoolToBooleanObject(l !== r);
    default: return newError(`unknown operator: ${left.type()} ${op} ${right.type()}`);
  }
}

function evalFloatInfix(op, left, right) {
  const l = left.value, r = right.value;
  switch (op) {
    case '+': return new MonkeyFloat(l + r);
    case '-': return new MonkeyFloat(l - r);
    case '*': return new MonkeyFloat(l * r);
    case '/': return new MonkeyFloat(l / r);
    case '%': return new MonkeyFloat(l % r);
    case '<': return nativeBoolToBooleanObject(l < r);
    case '>': return nativeBoolToBooleanObject(l > r);
    case '<=': return nativeBoolToBooleanObject(l <= r);
    case '>=': return nativeBoolToBooleanObject(l >= r);
    case '==': return nativeBoolToBooleanObject(l === r);
    case '!=': return nativeBoolToBooleanObject(l !== r);
    default: return newError(`unknown operator: ${left.type()} ${op} ${right.type()}`);
  }
}

function evalForExpression(node, env) {
  // Execute init
  const initResult = monkeyEval(node.init, env);
  if (isError(initResult)) return initResult;
  
  let result = NULL;
  while (true) {
    const condition = monkeyEval(node.condition, env);
    if (isError(condition)) return condition;
    if (!isTruthy(condition)) break;
    
    result = monkeyEval(node.body, env);
    if (result === BREAK_SIGNAL) break;
    if (result === CONTINUE_SIGNAL) {
      // Execute update even on continue
      const updateResult = monkeyEval(node.update, env);
      if (isError(updateResult)) return updateResult;
      continue;
    }
    if (isError(result)) return result;
    if (result instanceof MonkeyReturnValue) return result;
    
    // Execute update
    const updateResult = monkeyEval(node.update, env);
    if (isError(updateResult)) return updateResult;
  }
  return result === BREAK_SIGNAL || result === CONTINUE_SIGNAL ? NULL : result;
}

function evalWhileExpression(node, env) {
  let result = NULL;
  while (true) {
    const condition = monkeyEval(node.condition, env);
    if (isError(condition)) return condition;
    if (!isTruthy(condition)) break;
    result = monkeyEval(node.body, env);
    if (result === BREAK_SIGNAL) break;
    if (result === CONTINUE_SIGNAL) continue;
    if (isError(result)) return result;
    if (result instanceof MonkeyReturnValue) return result;
  }
  return result === BREAK_SIGNAL || result === CONTINUE_SIGNAL ? NULL : result;
}

function evalDoWhileExpression(node, env) {
  let result = NULL;
  while (true) {
    result = monkeyEval(node.body, env);
    if (result === BREAK_SIGNAL) break;
    if (result === CONTINUE_SIGNAL) { /* fall through to condition check */ }
    else {
      if (isError(result)) return result;
      if (result instanceof MonkeyReturnValue) return result;
    }
    const condition = monkeyEval(node.condition, env);
    if (isError(condition)) return condition;
    if (!isTruthy(condition)) break;
  }
  return result === BREAK_SIGNAL || result === CONTINUE_SIGNAL ? NULL : result;
}

function evalIfExpression(node, env) {
  const condition = monkeyEval(node.condition, env);
  if (isError(condition)) return condition;
  if (isTruthy(condition)) return monkeyEval(node.consequence, env);
  if (node.alternative) return monkeyEval(node.alternative, env);
  return NULL;
}

function evalIdentifier(node, env) {
  const val = env.get(node.value);
  if (val !== undefined) return val;
  const builtin = builtins.get(node.value);
  if (builtin) return builtin;
  return newError(`identifier not found: ${node.value}`);
}

function evalExpressions(exps, env) {
  const result = [];
  for (const exp of exps) {
    if (exp instanceof AST.SpreadExpression) {
      const val = monkeyEval(exp.value, env);
      if (isError(val)) return [val];
      if (!(val instanceof MonkeyArray)) return [newError('spread requires array')];
      result.push(...val.elements);
    } else {
      const val = monkeyEval(exp, env);
      if (isError(val)) return [val];
      result.push(val);
    }
  }
  return result;
}

function applyFunction(fn, args) {
  if (fn instanceof MonkeyFunction) {
    const extendedEnv = new Environment(fn.env);
    for (let i = 0; i < fn.parameters.length; i++) {
      extendedEnv.set(fn.parameters[i].value, args[i]);
    }
    const result = monkeyEval(fn.body, extendedEnv);
    if (result instanceof MonkeyReturnValue) return result.value;
    return result;
  }
  if (fn instanceof MonkeyBuiltin) return fn.fn(...args);
  return newError(`not a function: ${fn.type()}`);
}

function evalIndexExpression(left, index) {
  if (left.type() === OBJ.ARRAY && index.type() === OBJ.INTEGER) {
    let idx = index.value;
    if (idx < 0) idx = left.elements.length + idx; // negative indexing
    const max = left.elements.length - 1;
    if (idx < 0 || idx > max) return NULL;
    return left.elements[idx];
  }
  if (left.type() === OBJ.STRING && index.type() === OBJ.INTEGER) {
    let idx = index.value;
    if (idx < 0) idx = left.value.length + idx; // negative indexing
    if (idx < 0 || idx >= left.value.length) return NULL;
    return new MonkeyString(left.value[idx]);
  }
  if (left.type() === OBJ.HASH) {
    if (typeof index.hashKey !== 'function') {
      return newError(`unusable as hash key: ${index.type()}`);
    }
    const pair = left.pairs.get(index.hashKey());
    if (!pair) return NULL;
    return pair.value;
  }
  return newError(`index operator not supported: ${left.type()}`);
}

function evalHashLiteral(node, env) {
  const pairs = new Map();
  for (const [keyNode, valueNode] of node.pairs) {
    const key = monkeyEval(keyNode, env);
    if (isError(key)) return key;
    if (typeof key.hashKey !== 'function') {
      return newError(`unusable as hash key: ${key.type()}`);
    }
    const value = monkeyEval(valueNode, env);
    if (isError(value)) return value;
    pairs.set(key.hashKey(), { key, value });
  }
  return new MonkeyHash(pairs);
}
