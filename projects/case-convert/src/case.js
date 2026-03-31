// String case converters
export const camelCase = (s) => words(s).map((w, i) => i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()).join('');
export const pascalCase = (s) => words(s).map(w => w[0].toUpperCase() + w.slice(1).toLowerCase()).join('');
export const snakeCase = (s) => words(s).map(w => w.toLowerCase()).join('_');
export const kebabCase = (s) => words(s).map(w => w.toLowerCase()).join('-');
export const constantCase = (s) => words(s).map(w => w.toUpperCase()).join('_');
export const titleCase = (s) => words(s).map(w => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(' ');
export const sentenceCase = (s) => { const w = words(s); return w.map((x, i) => i === 0 ? x[0].toUpperCase() + x.slice(1).toLowerCase() : x.toLowerCase()).join(' '); };
export const dotCase = (s) => words(s).map(w => w.toLowerCase()).join('.');
function words(s) { return s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_\-./]+/g, ' ').trim().split(/\s+/); }
