// Monkey Language Tree-Walking Evaluator

import {
  MonkeyInteger, MonkeyString, MonkeyReturnValue, MonkeyError,
  MonkeyFunction, MonkeyArray, MonkeyHash, MonkeyBuiltin,
  Environment, TRUE, FALSE, NULL, OBJ,
} from './object.js';

import * as AST from './ast.js';

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
    if (arg instanceof MonkeyString) {
      const n = parseInt(arg.value, 10);
      return isNaN(n) ? NULL : new MonkeyInteger(n);
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
    env.set(node.name.value, val);
    return undefined;
  }
  if (node instanceof AST.SetStatement) {
    const val = monkeyEval(node.value, env);
    if (isError(val)) return val;
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
  if (node instanceof AST.StringLiteral) return new MonkeyString(node.value);
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
    const left = monkeyEval(node.left, env);
    if (isError(left)) return left;
    const right = monkeyEval(node.right, env);
    if (isError(right)) return right;
    return evalInfixExpression(node.operator, left, right);
  }

  if (node instanceof AST.IfExpression) return evalIfExpression(node, env);
  if (node instanceof AST.WhileExpression) return evalWhileExpression(node, env);
  if (node instanceof AST.DoWhileExpression) return evalDoWhileExpression(node, env);
  if (node instanceof AST.ForExpression) return evalForExpression(node, env);

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
    const elements = evalExpressions(node.elements, env);
    if (elements.length === 1 && isError(elements[0])) return elements[0];
    return new MonkeyArray(elements);
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
  if (right.type() !== OBJ.INTEGER) return newError(`unknown operator: -${right.type()}`);
  return new MonkeyInteger(-right.value);
}

function evalInfixExpression(op, left, right) {
  if (left.type() === OBJ.INTEGER && right.type() === OBJ.INTEGER) {
    return evalIntegerInfix(op, left, right);
  }
  if (left.type() === OBJ.STRING && right.type() === OBJ.STRING) {
    if (op === '+') return new MonkeyString(left.value + right.value);
    return newError(`unknown operator: ${left.type()} ${op} ${right.type()}`);
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
    if (isError(result)) return result;
    if (result instanceof MonkeyReturnValue) return result;
    
    // Execute update
    const updateResult = monkeyEval(node.update, env);
    if (isError(updateResult)) return updateResult;
  }
  return result;
}

function evalWhileExpression(node, env) {
  let result = NULL;
  while (true) {
    const condition = monkeyEval(node.condition, env);
    if (isError(condition)) return condition;
    if (!isTruthy(condition)) break;
    result = monkeyEval(node.body, env);
    if (isError(result)) return result;
    if (result instanceof MonkeyReturnValue) return result;
  }
  return result;
}

function evalDoWhileExpression(node, env) {
  let result = NULL;
  do {
    result = monkeyEval(node.body, env);
    if (isError(result)) return result;
    if (result instanceof MonkeyReturnValue) return result;
    const condition = monkeyEval(node.condition, env);
    if (isError(condition)) return condition;
    if (!isTruthy(condition)) break;
  } while (true);
  return result;
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
    const val = monkeyEval(exp, env);
    if (isError(val)) return [val];
    result.push(val);
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
    const idx = index.value;
    const max = left.elements.length - 1;
    if (idx < 0 || idx > max) return NULL;
    return left.elements[idx];
  }
  if (left.type() === OBJ.STRING && index.type() === OBJ.INTEGER) {
    const idx = index.value;
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
