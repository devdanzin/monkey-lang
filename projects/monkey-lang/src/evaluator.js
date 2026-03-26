// Monkey Language Tree-Walking Evaluator

import {
  MonkeyInteger, MonkeyString, MonkeyReturnValue, MonkeyError,
  MonkeyFunction, MonkeyArray, MonkeyHash, MonkeyBuiltin,
  MonkeyBreak, MonkeyContinue,
  Environment, TRUE, FALSE, NULL, OBJ, internString,
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
  ['split', new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return newError(`wrong number of arguments. got=${args.length}, want=2`);
    if (!(args[0] instanceof MonkeyString) || !(args[1] instanceof MonkeyString))
      return newError(`arguments to \`split\` must be STRING`);
    return new MonkeyArray(args[0].value.split(args[1].value).map(s => new MonkeyString(s)));
  })],
  ['join', new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return newError(`wrong number of arguments. got=${args.length}, want=2`);
    if (!(args[0] instanceof MonkeyArray) || !(args[1] instanceof MonkeyString))
      return newError(`arguments to \`join\` must be (ARRAY, STRING)`);
    return new MonkeyString(args[0].elements.map(e => e instanceof MonkeyString ? e.value : e.inspect()).join(args[1].value));
  })],
  ['trim', new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return newError(`wrong number of arguments. got=${args.length}, want=1`);
    if (!(args[0] instanceof MonkeyString)) return newError(`argument to \`trim\` must be STRING`);
    return new MonkeyString(args[0].value.trim());
  })],
  ['str_contains', new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return newError(`wrong number of arguments. got=${args.length}, want=2`);
    if (!(args[0] instanceof MonkeyString) || !(args[1] instanceof MonkeyString))
      return newError(`arguments to \`str_contains\` must be STRING`);
    return args[0].value.includes(args[1].value) ? TRUE : FALSE;
  })],
  ['substr', new MonkeyBuiltin((...args) => {
    if (args.length < 2 || args.length > 3) return newError(`wrong number of arguments. got=${args.length}, want=2 or 3`);
    if (!(args[0] instanceof MonkeyString) || !(args[1] instanceof MonkeyInteger))
      return newError(`arguments to \`substr\` must be (STRING, INT[, INT])`);
    const str = args[0].value;
    const start = args[1].value;
    const end = args.length === 3 && args[2] instanceof MonkeyInteger ? args[2].value : str.length;
    return new MonkeyString(str.slice(start, end));
  })],
  ['replace', new MonkeyBuiltin((...args) => {
    if (args.length !== 3) return newError(`wrong number of arguments. got=${args.length}, want=3`);
    if (!(args[0] instanceof MonkeyString) || !(args[1] instanceof MonkeyString) || !(args[2] instanceof MonkeyString))
      return newError(`arguments to \`replace\` must be STRING`);
    return new MonkeyString(args[0].value.split(args[1].value).join(args[2].value));
  })],
  ['int', new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return newError(`wrong number of arguments. got=${args.length}, want=1`);
    if (args[0] instanceof MonkeyInteger) return args[0];
    if (args[0] instanceof MonkeyString) {
      const n = parseInt(args[0].value);
      if (isNaN(n)) return NULL;
      return new MonkeyInteger(n);
    }
    return newError(`cannot convert ${args[0].type()} to INT`);
  })],
  ['str', new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return newError(`wrong number of arguments. got=${args.length}, want=1`);
    if (args[0] instanceof MonkeyString) return args[0];
    return new MonkeyString(args[0].inspect());
  })],
  ['type', new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return newError(`wrong number of arguments. got=${args.length}, want=1`);
    return new MonkeyString(args[0].type());
  })],
  ['ord', new MonkeyBuiltin((...args) => {
    if (args.length !== 1 || args[0].type() !== OBJ.STRING) return newError('ord requires one string argument');
    return new MonkeyInteger(args[0].value.charCodeAt(0));
  })],
  ['char', new MonkeyBuiltin((...args) => {
    if (args.length !== 1 || args[0].type() !== OBJ.INTEGER) return newError('char requires one integer argument');
    return new MonkeyString(String.fromCharCode(args[0].value));
  })],
  ['abs', new MonkeyBuiltin((...args) => {
    if (args.length !== 1 || args[0].type() !== OBJ.INTEGER) return newError('abs requires one integer argument');
    return new MonkeyInteger(Math.abs(args[0].value));
  })],
  ['upper', new MonkeyBuiltin((...args) => {
    if (args.length !== 1 || args[0].type() !== OBJ.STRING) return newError('upper requires one string argument');
    return new MonkeyString(args[0].value.toUpperCase());
  })],
  ['lower', new MonkeyBuiltin((...args) => {
    if (args.length !== 1 || args[0].type() !== OBJ.STRING) return newError('lower requires one string argument');
    return new MonkeyString(args[0].value.toLowerCase());
  })],
  ['indexOf', new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return newError(`wrong number of arguments. got=${args.length}, want=2`);
    if (args[0].type() === OBJ.STRING && args[1].type() === OBJ.STRING) {
      return new MonkeyInteger(args[0].value.indexOf(args[1].value));
    }
    return newError('indexOf requires two string arguments');
  })],
  ['startsWith', new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return newError(`wrong number of arguments. got=${args.length}, want=2`);
    return nativeBoolToBooleanObject(args[0].value.startsWith(args[1].value));
  })],
  ['endsWith', new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return newError(`wrong number of arguments. got=${args.length}, want=2`);
    return nativeBoolToBooleanObject(args[0].value.endsWith(args[1].value));
  })],
  ['keys', new MonkeyBuiltin((...args) => {
    if (args.length !== 1 || args[0].type() !== OBJ.HASH) return newError('keys requires one hash argument');
    const arr = [];
    for (const [, {key}] of args[0].pairs) arr.push(key);
    return new MonkeyArray(arr);
  })],
  ['values', new MonkeyBuiltin((...args) => {
    if (args.length !== 1 || args[0].type() !== OBJ.HASH) return newError('values requires one hash argument');
    const arr = [];
    for (const [, {value}] of args[0].pairs) arr.push(value);
    return new MonkeyArray(arr);
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
    env.set(node.name.value, val, node.isConst);
    return undefined;
  }
  if (node instanceof AST.DestructuringLet) {
    const val = monkeyEval(node.value, env);
    if (isError(val)) return val;
    if (val instanceof MonkeyArray) {
      for (let i = 0; i < node.names.length; i++) {
        if (node.names[i]) {
          env.set(node.names[i].value, i < val.elements.length ? val.elements[i] : NULL);
        }
      }
    }
    return undefined;
  }
  if (node instanceof AST.ReturnStatement) {
    const val = monkeyEval(node.returnValue, env);
    if (isError(val)) return val;
    return new MonkeyReturnValue(val);
  }

  // Expressions
  if (node instanceof AST.IntegerLiteral) return new MonkeyInteger(node.value);
  if (node instanceof AST.StringLiteral) return internString(node.value);
  if (node instanceof AST.BooleanLiteral) return nativeBoolToBooleanObject(node.value);

  if (node instanceof AST.PrefixExpression) {
    const right = monkeyEval(node.right, env);
    if (isError(right)) return right;
    return evalPrefixExpression(node.operator, right);
  }

  if (node instanceof AST.InfixExpression) {
    // Short-circuit evaluation for && and ||
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
      if (left !== NULL && left !== undefined) return left;
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
  if (node instanceof AST.DoWhileExpression) {
    do {
      const result = monkeyEval(node.body, env);
      if (isError(result)) return result;
      if (result instanceof MonkeyReturnValue) return result;
      if (result instanceof MonkeyBreak) break;
      if (result instanceof MonkeyContinue) continue;
      const cond = monkeyEval(node.condition, env);
      if (isError(cond)) return cond;
      if (!isTruthy(cond)) break;
    } while (true);
    return NULL;
  }
  if (node instanceof AST.ForExpression) return evalForExpression(node, env);
  if (node instanceof AST.ForInExpression) return evalForInExpression(node, env);
  if (node instanceof AST.BreakStatement) return new MonkeyBreak();
  if (node instanceof AST.ContinueStatement) return new MonkeyContinue();
  if (node instanceof AST.NullLiteral) return NULL;
  if (node instanceof AST.TernaryExpression) {
    const condition = monkeyEval(node.condition, env);
    if (isError(condition)) return condition;
    return isTruthy(condition) ? monkeyEval(node.consequence, env) : monkeyEval(node.alternative, env);
  }
  if (node instanceof AST.MatchExpression) {
    const subject = monkeyEval(node.subject, env);
    if (isError(subject)) return subject;
    for (const arm of node.arms) {
      if (arm.pattern === null) {
        return monkeyEval(arm.value, env); // wildcard
      }
      const pattern = monkeyEval(arm.pattern, env);
      if (isError(pattern)) return pattern;
      if (subject.inspect() === pattern.inspect()) {
        return monkeyEval(arm.value, env);
      }
    }
    return NULL;
  }
  if (node instanceof AST.TemplateLiteral) return evalTemplateLiteral(node, env);

  if (node instanceof AST.AssignExpression) {
    if (env.isConst(node.name.value)) return new MonkeyError(`cannot assign to const variable: ${node.name.value}`);
    const val = monkeyEval(node.value, env);
    if (isError(val)) return val;
    env.set(node.name.value, val);
    return val;
  }

  if (node instanceof AST.Identifier) return evalIdentifier(node, env);

  if (node instanceof AST.FunctionLiteral) {
    const fn = new MonkeyFunction(node.parameters, node.body, env);
    fn.defaults = node.defaults || [];
    return fn;
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

  if (node instanceof AST.IndexAssignExpression) {
    const obj = monkeyEval(node.left, env);
    if (isError(obj)) return obj;
    const index = monkeyEval(node.index, env);
    if (isError(index)) return index;
    const val = monkeyEval(node.value, env);
    if (isError(val)) return val;
    if (obj instanceof MonkeyArray && index instanceof MonkeyInteger) {
      let i = index.value;
      if (i < 0) i += obj.elements.length;
      if (i >= 0 && i < obj.elements.length) {
        obj.elements[i] = val;
      }
    } else if (obj instanceof MonkeyHash) {
      if (index.fastHashKey) {
        obj.pairs.set(index.fastHashKey(), { key: index, value: val });
      }
    }
    return val;
  }
  if (node instanceof AST.SliceExpression) {
    const obj = monkeyEval(node.left, env);
    if (isError(obj)) return obj;
    const start = node.start ? monkeyEval(node.start, env) : null;
    if (start && isError(start)) return start;
    const end = node.end ? monkeyEval(node.end, env) : null;
    if (end && isError(end)) return end;
    if (obj instanceof MonkeyArray) {
      const len = obj.elements.length;
      let s = start ? start.value : 0;
      let e = end ? end.value : len;
      if (s < 0) s += len;
      if (e < 0) e += len;
      return new MonkeyArray(obj.elements.slice(s, e));
    }
    if (obj instanceof MonkeyString) {
      const len = obj.value.length;
      let s = start ? start.value : 0;
      let e = end ? end.value : len;
      if (s < 0) s += len;
      if (e < 0) e += len;
      return new MonkeyString(obj.value.slice(s, e));
    }
    return NULL;
  }
  if (node instanceof AST.IndexExpression) {
    const left = monkeyEval(node.left, env);
    if (isError(left)) return left;
    const index = monkeyEval(node.index, env);
    if (isError(index)) return index;
    return evalIndexExpression(left, index);
  }

  if (node instanceof AST.OptionalChainExpression) {
    const left = monkeyEval(node.left, env);
    if (isError(left)) return left;
    if (left === NULL || left === undefined) return NULL;
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
      if (result instanceof MonkeyBreak || result instanceof MonkeyContinue) return result;
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
  // String * Integer or Integer * String
  if (op === '*') {
    if (left.type() === OBJ.STRING && right.type() === OBJ.INTEGER) {
      const n = right.value;
      return new MonkeyString(n > 0 ? left.value.repeat(n) : '');
    }
    if (left.type() === OBJ.INTEGER && right.type() === OBJ.STRING) {
      const n = left.value;
      return new MonkeyString(n > 0 ? right.value.repeat(n) : '');
    }
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

function evalIfExpression(node, env) {
  const condition = monkeyEval(node.condition, env);
  if (isError(condition)) return condition;
  if (isTruthy(condition)) return monkeyEval(node.consequence, env);
  if (node.alternative) return monkeyEval(node.alternative, env);
  return NULL;
}

function evalWhileExpression(node, env) {
  while (true) {
    const condition = monkeyEval(node.condition, env);
    if (isError(condition)) return condition;
    if (!isTruthy(condition)) break;
    const result = monkeyEval(node.body, env);
    if (isError(result)) return result;
    if (result instanceof MonkeyReturnValue) return result;
    if (result instanceof MonkeyBreak) break;
    if (result instanceof MonkeyContinue) continue;
  }
  return NULL;
}

function evalForExpression(node, env) {
  const initResult = monkeyEval(node.init, env);
  if (isError(initResult)) return initResult;

  while (true) {
    const condition = monkeyEval(node.condition, env);
    if (isError(condition)) return condition;
    if (!isTruthy(condition)) break;
    const bodyResult = monkeyEval(node.body, env);
    if (isError(bodyResult)) return bodyResult;
    if (bodyResult instanceof MonkeyReturnValue) return bodyResult;
    if (bodyResult instanceof MonkeyBreak) break;
    if (bodyResult instanceof MonkeyContinue) { /* fall through to update */ }
    const updateResult = monkeyEval(node.update, env);
    if (isError(updateResult)) return updateResult;
  }
  return NULL;
}

function evalForInExpression(node, env) {
  const iterable = monkeyEval(node.iterable, env);
  if (isError(iterable)) return iterable;

  let elements;
  if (iterable instanceof MonkeyArray) {
    elements = iterable.elements;
  } else if (iterable instanceof MonkeyString) {
    elements = iterable.value.split('').map(c => new MonkeyString(c));
  } else {
    return new MonkeyError(`for-in: expected ARRAY or STRING, got ${iterable.type()}`);
  }

  for (const elem of elements) {
    env.set(node.variable, elem);
    const bodyResult = monkeyEval(node.body, env);
    if (isError(bodyResult)) return bodyResult;
    if (bodyResult instanceof MonkeyReturnValue) return bodyResult;
    if (bodyResult instanceof MonkeyBreak) break;
    if (bodyResult instanceof MonkeyContinue) continue;
  }
  return NULL;
}

function evalTemplateLiteral(node, env) {
  let result = '';
  for (const part of node.parts) {
    const val = monkeyEval(part, env);
    if (isError(val)) return val;
    result += val.inspect();
  }
  return new MonkeyString(result);
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
      if (i < args.length) {
        extendedEnv.set(fn.parameters[i].value, args[i]);
      } else if (fn.defaults && fn.defaults[i]) {
        // Evaluate default in the function's environment
        const defaultVal = monkeyEval(fn.defaults[i], extendedEnv);
        extendedEnv.set(fn.parameters[i].value, defaultVal);
      } else {
        extendedEnv.set(fn.parameters[i].value, NULL);
      }
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
    if (idx < 0) idx += left.elements.length; // negative indexing
    const max = left.elements.length - 1;
    if (idx < 0 || idx > max) return NULL;
    return left.elements[idx];
  }
  if (left.type() === OBJ.HASH) {
    if (typeof index.fastHashKey !== 'function') {
      return newError(`unusable as hash key: ${index.type()}`);
    }
    const pair = left.pairs.get(index.fastHashKey());
    if (!pair) return NULL;
    return pair.value;
  }
  if (left.type() === OBJ.STRING && index instanceof MonkeyInteger) {
    let idx = index.value;
    if (idx < 0) idx += left.value.length; // negative indexing
    if (idx < 0 || idx >= left.value.length) return NULL;
    return new MonkeyString(left.value[idx]);
  }
  return newError(`index operator not supported: ${left.type()}`);
}

function evalHashLiteral(node, env) {
  const pairs = new Map();
  for (const [keyNode, valueNode] of node.pairs) {
    const key = monkeyEval(keyNode, env);
    if (isError(key)) return key;
    if (typeof key.fastHashKey !== 'function') {
      return newError(`unusable as hash key: ${key.type()}`);
    }
    const value = monkeyEval(valueNode, env);
    if (isError(value)) return value;
    pairs.set(key.fastHashKey(), { key, value });
  }
  return new MonkeyHash(pairs);
}
