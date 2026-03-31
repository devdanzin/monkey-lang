// Tiny dot-env parser

export function parse(input) {
  const env = {};
  for (const rawLine of input.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;
    let key = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 1).trim();
    if (key.startsWith('export ')) key = key.slice(7).trim();
    // Strip quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      const q = value[0];
      value = value.slice(1, -1);
      if (q === '"') value = value.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"');
    }
    // Variable expansion
    value = value.replace(/\$\{(\w+)\}/g, (_, name) => env[name] || process.env[name] || '');
    value = value.replace(/\$(\w+)/g, (_, name) => env[name] || process.env[name] || '');
    env[key] = value;
  }
  return env;
}

export function config(input, { override = false } = {}) {
  const env = parse(input);
  for (const [key, value] of Object.entries(env)) {
    if (override || !(key in process.env)) process.env[key] = value;
  }
  return env;
}

export function stringify(env) {
  return Object.entries(env).map(([k, v]) => {
    const needsQuotes = v.includes(' ') || v.includes('\n') || v.includes('"');
    return needsQuotes ? `${k}="${v.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"` : `${k}=${v}`;
  }).join('\n');
}
