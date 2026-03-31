// Printf-like string formatter

export function sprintf(fmt, ...args) {
  let i = 0;
  return fmt.replace(/%([#0\- +]*)(\d+)?(?:\.(\d+))?([diouxXeEfgGscbj%])/g,
    (match, flags, widthStr, precStr, type) => {
      if (type === '%') return '%';
      const arg = args[i++];
      const width = widthStr ? parseInt(widthStr) : 0;
      const prec = precStr !== undefined ? parseInt(precStr) : undefined;
      const leftAlign = flags.includes('-');
      const padZero = flags.includes('0') && !leftAlign;
      const plus = flags.includes('+');
      const space = flags.includes(' ');
      const hash = flags.includes('#');

      let result;
      switch (type) {
        case 'd': case 'i': result = formatInt(arg, 10, plus, space); break;
        case 'o': result = (hash ? '0' : '') + Math.abs(arg >>> 0).toString(8); break;
        case 'u': result = (arg >>> 0).toString(10); break;
        case 'x': result = (hash ? '0x' : '') + (arg >>> 0).toString(16); break;
        case 'X': result = (hash ? '0X' : '') + (arg >>> 0).toString(16).toUpperCase(); break;
        case 'f': result = formatFloat(arg, prec !== undefined ? prec : 6, plus, space); break;
        case 'e': result = formatExp(arg, prec !== undefined ? prec : 6, plus, space, false); break;
        case 'E': result = formatExp(arg, prec !== undefined ? prec : 6, plus, space, true); break;
        case 'g': case 'G': {
          const p = prec !== undefined ? prec : 6;
          const exp = Math.floor(Math.log10(Math.abs(arg) || 1));
          result = (exp < -4 || exp >= p) ? formatExp(arg, p - 1, plus, space, type === 'G') : formatFloat(arg, p - 1 - exp, plus, space);
          break;
        }
        case 's': result = prec !== undefined ? String(arg).slice(0, prec) : String(arg); break;
        case 'c': result = typeof arg === 'number' ? String.fromCharCode(arg) : String(arg)[0]; break;
        case 'b': result = (arg >>> 0).toString(2); break;
        case 'j': result = JSON.stringify(arg); break;
        default: result = String(arg);
      }

      return pad(result, width, leftAlign, padZero && !'scej'.includes(type) ? '0' : ' ');
    });
}

function formatInt(n, radix, plus, space) {
  const num = Math.trunc(n);
  const prefix = num < 0 ? '-' : plus ? '+' : space ? ' ' : '';
  return prefix + Math.abs(num).toString(radix);
}

function formatFloat(n, prec, plus, space) {
  const prefix = n < 0 ? '' : plus ? '+' : space ? ' ' : '';
  return prefix + n.toFixed(prec);
}

function formatExp(n, prec, plus, space, upper) {
  const prefix = n < 0 ? '' : plus ? '+' : space ? ' ' : '';
  let s = n.toExponential(prec);
  if (upper) s = s.toUpperCase();
  return prefix + s;
}

function pad(str, width, leftAlign, padChar) {
  if (str.length >= width) return str;
  const padding = padChar.repeat(width - str.length);
  return leftAlign ? str + padding : padding + str;
}

export function printf(fmt, ...args) {
  process.stdout.write(sprintf(fmt, ...args));
}
