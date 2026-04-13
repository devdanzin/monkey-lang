// stdlib.js — Monkey standard library modules
// Each module is a Monkey source string that gets evaluated on import

export const STDLIB = {
  'math': `
    let math = {
      "abs": fn(x) { if (x < 0) { 0 - x } else { x } },
      "max": fn(a, b) { if (a > b) { a } else { b } },
      "min": fn(a, b) { if (a < b) { a } else { b } },
      "clamp": fn(x, lo, hi) { if (x < lo) { lo } else { if (x > hi) { hi } else { x } } },
      "pow": fn(base, exp) {
        let result = 1;
        for (let i = 0; i < exp; set i = i + 1) { set result = result * base; }
        result
      },
      "factorial": fn(n) {
        if (n <= 1) { 1 } else { n * factorial(n - 1) }
      }
    };
    math
  `,
  
  'strings': `
    let strings = {
      "repeat": fn(s, n) {
        let result = "";
        for (let i = 0; i < n; set i = i + 1) { set result = result + s; }
        result
      },
      "startsWith": fn(s, prefix) {
        if (len(s) < len(prefix)) { return false; }
        for (let i = 0; i < len(prefix); set i = i + 1) {
          if (s[i] != prefix[i]) { return false; }
        }
        true
      },
      "endsWith": fn(s, suffix) {
        if (len(s) < len(suffix)) { return false; }
        let offset = len(s) - len(suffix);
        for (let i = 0; i < len(suffix); set i = i + 1) {
          if (s[offset + i] != suffix[i]) { return false; }
        }
        true
      },
      "contains": fn(s, sub) {
        for (let i = 0; i <= len(s) - len(sub); set i = i + 1) {
          let found = true;
          for (let j = 0; j < len(sub); set j = j + 1) {
            if (s[i + j] != sub[j]) { set found = false; break; }
          }
          if (found) { return true; }
        }
        false
      },
      "reverse": fn(s) {
        let result = "";
        for (let i = len(s) - 1; i >= 0; set i = i - 1) { set result = result + s[i]; }
        result
      }
    };
    strings
  `,
  
  'collections': `
    let collections = {
      "flatten": fn(arr) {
        let result = [];
        for (let i = 0; i < len(arr); set i = i + 1) {
          let item = arr[i];
          if (type(item) == "ARRAY") {
            let sub = flatten(item);
            for (let j = 0; j < len(sub); set j = j + 1) {
              set result = push(result, sub[j]);
            }
          } else {
            set result = push(result, item);
          }
        }
        result
      },
      "zip": fn(a, b) {
        let result = [];
        let n = len(a);
        if (len(b) < n) { set n = len(b); }
        for (let i = 0; i < n; set i = i + 1) {
          set result = push(result, [a[i], b[i]]);
        }
        result
      },
      "enumerate": fn(arr) {
        let result = [];
        for (let i = 0; i < len(arr); set i = i + 1) {
          set result = push(result, [i, arr[i]]);
        }
        result
      },
      "take": fn(arr, n) {
        let result = [];
        let count = n;
        if (count > len(arr)) { set count = len(arr); }
        for (let i = 0; i < count; set i = i + 1) {
          set result = push(result, arr[i]);
        }
        result
      },
      "drop": fn(arr, n) {
        let result = [];
        for (let i = n; i < len(arr); set i = i + 1) {
          set result = push(result, arr[i]);
        }
        result
      }
    };
    collections
  `
};
