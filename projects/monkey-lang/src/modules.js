// Monkey Module System
// Built-in modules that can be imported with: import "moduleName"
// Each module is a hash of functions/constants.

import { MonkeyInteger, MonkeyString, MonkeyBuiltin, MonkeyHash, MonkeyNull, MonkeyBoolean, MonkeyArray } from './object.js';

function mkInt(v) { return new MonkeyInteger(v); }
function mkStr(v) { return new MonkeyString(v); }
function mkBool(v) { return v ? MonkeyBoolean.TRUE || new MonkeyBoolean(true) : MonkeyBoolean.FALSE || new MonkeyBoolean(false); }

// Helper: build a MonkeyHash from a JS object of { name: MonkeyObject }
function buildModule(entries) {
  const hash = new MonkeyHash(new Map());
  for (const [name, value] of Object.entries(entries)) {
    const key = new MonkeyString(name);
    hash.pairs.set(key.fastHashKey ? key.fastHashKey() : key.hashKey(), { key, value });
  }
  return hash;
}

// --- math module ---
const mathModule = () => buildModule({
  PI: mkInt(3),  // We only have integers... let's use a float approximation via string
  E: mkInt(2),
  abs: new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyNull();
    return mkInt(Math.abs(args[0].value));
  }),
  pow: new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return new MonkeyNull();
    return mkInt(Math.pow(args[0].value, args[1].value));
  }),
  sqrt: new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyNull();
    return mkInt(Math.floor(Math.sqrt(args[0].value)));
  }),
  min: new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return new MonkeyNull();
    return mkInt(Math.min(args[0].value, args[1].value));
  }),
  max: new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return new MonkeyNull();
    return mkInt(Math.max(args[0].value, args[1].value));
  }),
  floor: new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyNull();
    return mkInt(Math.floor(args[0].value));
  }),
  ceil: new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyNull();
    return mkInt(Math.ceil(args[0].value));
  }),
});

// --- string module ---
const stringModule = () => buildModule({
  upper: new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyNull();
    return mkStr(args[0].value.toUpperCase());
  }),
  lower: new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyNull();
    return mkStr(args[0].value.toLowerCase());
  }),
  trim: new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyNull();
    return mkStr(args[0].value.trim());
  }),
  split: new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return new MonkeyNull();
    return new MonkeyArray(args[0].value.split(args[1].value).map(s => mkStr(s)));
  }),
  join: new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return new MonkeyNull();
    return mkStr(args[0].elements.map(e => e.value).join(args[1].value));
  }),
  repeat: new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return new MonkeyNull();
    return mkStr(args[0].value.repeat(args[1].value));
  }),
  contains: new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return new MonkeyNull();
    return new MonkeyBoolean(args[0].value.includes(args[1].value));
  }),
  replace: new MonkeyBuiltin((...args) => {
    if (args.length !== 3) return new MonkeyNull();
    return mkStr(args[0].value.split(args[1].value).join(args[2].value));
  }),
  charAt: new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return new MonkeyNull();
    const ch = args[0].value[args[1].value];
    return ch !== undefined ? mkStr(ch) : new MonkeyNull();
  }),
});

// --- functional module ---
const functionalModule = () => buildModule({
  compose: new MonkeyBuiltin((...args) => {
    // compose(f, g) returns fn(x) { f(g(x)) }
    // Can't easily return a MonkeyFunction from builtins, so return a builtin
    if (args.length !== 2) return new MonkeyNull();
    const f = args[0], g = args[1];
    return new MonkeyBuiltin((...innerArgs) => {
      // This is tricky without an evaluator reference... skip for now
      return new MonkeyNull();
    });
  }),
  identity: new MonkeyBuiltin((...args) => args[0] || new MonkeyNull()),
  constant: new MonkeyBuiltin((...args) => {
    const val = args[0] || new MonkeyNull();
    return new MonkeyBuiltin(() => val);
  }),
});

// --- Module registry ---

// Add to math module: sign, clamp
const mathModuleEnhanced = () => {
  const base = mathModule();
  const extras = {
    sign: new MonkeyBuiltin((...args) => {
      if (args.length !== 1) return new MonkeyNull();
      const v = args[0].value;
      return mkInt(v > 0 ? 1 : v < 0 ? -1 : 0);
    }),
    clamp: new MonkeyBuiltin((...args) => {
      if (args.length !== 3) return new MonkeyNull();
      const [val, lo, hi] = args.map(a => a.value);
      return mkInt(Math.max(lo, Math.min(hi, val)));
    }),
  };
  for (const [name, value] of Object.entries(extras)) {
    const key = new MonkeyString(name);
    base.pairs.set(key.fastHashKey ? key.fastHashKey() : key.hashKey(), { key, value });
  }
  return base;
};

// Add to string module: padLeft, padRight, reverse
const stringModuleEnhanced = () => {
  const base = stringModule();
  const extras = {
    padLeft: new MonkeyBuiltin((...args) => {
      if (args.length !== 3) return new MonkeyNull();
      return mkStr(args[0].value.padStart(args[1].value, args[2].value));
    }),
    padRight: new MonkeyBuiltin((...args) => {
      if (args.length !== 3) return new MonkeyNull();
      return mkStr(args[0].value.padEnd(args[1].value, args[2].value));
    }),
    reverse: new MonkeyBuiltin((...args) => {
      if (args.length !== 1) return new MonkeyNull();
      return mkStr([...args[0].value].reverse().join(''));
    }),
    length: new MonkeyBuiltin((...args) => {
      if (args.length !== 1) return new MonkeyNull();
      return mkInt(args[0].value.length);
    }),
  };
  for (const [name, value] of Object.entries(extras)) {
    const key = new MonkeyString(name);
    base.pairs.set(key.fastHashKey ? key.fastHashKey() : key.hashKey(), { key, value });
  }
  return base;
};

// --- algorithms module ---
const algorithmsModule = () => buildModule({
  gcd: new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return new MonkeyNull();
    let [a, b] = args.map(x => Math.abs(x.value));
    while (b) { [a, b] = [b, a % b]; }
    return mkInt(a);
  }),
  lcm: new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return new MonkeyNull();
    let [a, b] = args.map(x => Math.abs(x.value));
    let [a0, b0] = [a, b];
    while (b) { [a, b] = [b, a % b]; }
    return mkInt((a0 / a) * b0);
  }),
  isPrime: new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyNull();
    const n = args[0].value;
    if (n < 2) return new MonkeyBoolean(false);
    if (n < 4) return new MonkeyBoolean(true);
    if (n % 2 === 0 || n % 3 === 0) return new MonkeyBoolean(false);
    for (let i = 5; i * i <= n; i += 6) {
      if (n % i === 0 || n % (i + 2) === 0) return new MonkeyBoolean(false);
    }
    return new MonkeyBoolean(true);
  }),
  factorial: new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyNull();
    let n = args[0].value;
    let result = 1;
    for (let i = 2; i <= n; i++) result *= i;
    return mkInt(result);
  }),
  fibonacci: new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyNull();
    const n = args[0].value;
    if (n <= 0) return mkInt(0);
    if (n === 1) return mkInt(1);
    let [a, b] = [0, 1];
    for (let i = 2; i <= n; i++) [a, b] = [b, a + b];
    return mkInt(b);
  }),
});

const MODULE_REGISTRY = {
  math: mathModuleEnhanced,
  string: stringModuleEnhanced,
  functional: functionalModule,
  algorithms: algorithmsModule,
};

export function getModule(name) {
  const factory = MODULE_REGISTRY[name];
  if (!factory) return null;
  return factory();
}

export function getModuleNames() {
  return Object.keys(MODULE_REGISTRY);
}
