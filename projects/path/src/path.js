// Tiny path utilities — posix-style

export function join(...parts) {
  return normalize(parts.filter(Boolean).join('/'));
}

export function normalize(path) {
  const isAbsolute = path.startsWith('/');
  const parts = path.split('/').filter(Boolean);
  const result = [];
  for (const part of parts) {
    if (part === '..') { if (result.length && result[result.length - 1] !== '..') result.pop(); else if (!isAbsolute) result.push('..'); }
    else if (part !== '.') result.push(part);
  }
  return (isAbsolute ? '/' : '') + result.join('/') || '.';
}

export function dirname(path) {
  const idx = path.lastIndexOf('/');
  if (idx === -1) return '.';
  if (idx === 0) return '/';
  return path.slice(0, idx);
}

export function basename(path, ext) {
  let name = path.split('/').pop() || '';
  if (ext && name.endsWith(ext)) name = name.slice(0, -ext.length);
  return name;
}

export function extname(path) {
  const name = basename(path);
  const idx = name.lastIndexOf('.');
  return idx <= 0 ? '' : name.slice(idx);
}

export function isAbsolute(path) { return path.startsWith('/'); }

export function relative(from, to) {
  const fromParts = normalize(from).split('/').filter(Boolean);
  const toParts = normalize(to).split('/').filter(Boolean);
  let i = 0;
  while (i < fromParts.length && i < toParts.length && fromParts[i] === toParts[i]) i++;
  const ups = fromParts.length - i;
  return [...Array(ups).fill('..'), ...toParts.slice(i)].join('/') || '.';
}

export function resolve(...paths) {
  let resolved = '';
  for (let i = paths.length - 1; i >= 0; i--) {
    resolved = paths[i] + (resolved ? '/' + resolved : '');
    if (isAbsolute(resolved)) break;
  }
  return normalize(resolved);
}

export function parse(path) {
  return { dir: dirname(path), base: basename(path), ext: extname(path), name: basename(path, extname(path)) };
}

export function format({ dir, base, ext, name }) {
  const b = base || ((name || '') + (ext || ''));
  return dir ? dir + '/' + b : b;
}
