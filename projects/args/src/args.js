// Tiny args parser — minimist-like
export function parse(args, { boolean = [], string = [], alias = {}, default: defaults = {} } = {}) {
  const result = { _: [], ...defaults };
  const boolSet = new Set(boolean);
  const strSet = new Set(string);
  const aliasMap = {};
  for (const [key, val] of Object.entries(alias)) {
    const aliases = Array.isArray(val) ? val : [val];
    for (const a of aliases) aliasMap[a] = key;
  }

  function setVal(key, val) {
    const realKey = aliasMap[key] || key;
    if (boolSet.has(realKey)) val = val === 'false' ? false : true;
    else if (strSet.has(realKey)) val = String(val);
    else if (/^-?\d+\.?\d*$/.test(val)) val = Number(val);
    if (result[realKey] !== undefined && result[realKey] !== defaults[realKey]) {
      if (!Array.isArray(result[realKey])) result[realKey] = [result[realKey]];
      result[realKey].push(val);
    } else result[realKey] = val;
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--') { result._.push(...args.slice(i + 1)); break; }
    if (arg.startsWith('--')) {
      const eqIdx = arg.indexOf('=');
      if (eqIdx >= 0) { setVal(arg.slice(2, eqIdx), arg.slice(eqIdx + 1)); }
      else if (boolSet.has(aliasMap[arg.slice(2)] || arg.slice(2))) { setVal(arg.slice(2), true); }
      else if (i + 1 < args.length && !args[i + 1].startsWith('-')) { setVal(arg.slice(2), args[++i]); }
      else { setVal(arg.slice(2), true); }
    } else if (arg.startsWith('-') && arg.length > 1) {
      for (let j = 1; j < arg.length; j++) {
        const ch = arg[j];
        if (j === arg.length - 1 && i + 1 < args.length && !args[i + 1].startsWith('-') && !boolSet.has(aliasMap[ch] || ch)) { setVal(ch, args[++i]); }
        else { setVal(ch, true); }
      }
    } else result._.push(arg);
  }
  return result;
}
