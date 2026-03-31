export function slugify(str, { separator = '-', lowercase = true } = {}) {
  let s = str.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // strip accents
  if (lowercase) s = s.toLowerCase();
  return s.replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, separator).replace(new RegExp(`${separator}+`, 'g'), separator).replace(new RegExp(`^${separator}|${separator}$`, 'g'), '');
}
