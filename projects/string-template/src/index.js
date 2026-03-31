/**
 * Tiny String Template (Tagged)
 * 
 * - Basic interpolation: {{name}}
 * - Dot notation: {{user.name}}
 * - Filters: {{name | upper}}, {{price | currency}}
 * - Conditionals: {{#if cond}}...{{/if}}, {{#if cond}}...{{else}}...{{/if}}
 * - Loops: {{#each items}}...{{/each}}
 * - Partials: {{> partialName}}
 * - Escape HTML by default, triple {{{ }}} for raw
 * - Custom filters
 * - Tagged template literal support
 */

const defaultFilters = {
  upper: v => String(v).toUpperCase(),
  lower: v => String(v).toLowerCase(),
  trim: v => String(v).trim(),
  capitalize: v => { const s = String(v); return s.charAt(0).toUpperCase() + s.slice(1); },
  reverse: v => String(v).split('').reverse().join(''),
  length: v => (Array.isArray(v) ? v : String(v)).length,
  json: v => JSON.stringify(v),
  currency: v => `$${Number(v).toFixed(2)}`,
  default: (v, ...args) => v || args[0] || '',
  truncate: (v, ...args) => { const n = args[0] || 50; const s = String(v); return s.length > n ? s.slice(0, n) + '...' : s; },
};

function get(obj, path) {
  return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function compile(template, options = {}) {
  const filters = { ...defaultFilters, ...options.filters };
  const partials = options.partials || {};

  return function render(data) {
    return processTemplate(template, data, filters, partials);
  };
}

function processTemplate(template, data, filters, partials) {
  let result = '';
  let i = 0;

  while (i < template.length) {
    // Raw output {{{ }}}
    if (template.startsWith('{{{', i)) {
      const end = template.indexOf('}}}', i + 3);
      if (end === -1) break;
      const expr = template.slice(i + 3, end).trim();
      result += resolveExpr(expr, data, filters);
      i = end + 3;
      continue;
    }

    // Block tags: {{#if}}, {{#each}}, {{>partial}}
    if (template.startsWith('{{#', i)) {
      const tagEnd = template.indexOf('}}', i);
      const tag = template.slice(i + 3, tagEnd).trim();
      
      if (tag.startsWith('if ')) {
        const cond = tag.slice(3).trim();
        const [body, elseBody, endIdx] = extractBlock(template, tagEnd + 2, 'if');
        const val = get(data, cond);
        result += processTemplate(val ? body : (elseBody || ''), data, filters, partials);
        i = endIdx;
        continue;
      }

      if (tag.startsWith('each ')) {
        const arrName = tag.slice(5).trim();
        const [body, , endIdx] = extractBlock(template, tagEnd + 2, 'each');
        const arr = get(data, arrName);
        if (Array.isArray(arr)) {
          for (let j = 0; j < arr.length; j++) {
            const itemData = typeof arr[j] === 'object' ? { ...data, ...arr[j], '@index': j, '@first': j === 0, '@last': j === arr.length - 1 } : { ...data, '.': arr[j], '@index': j };
            result += processTemplate(body, itemData, filters, partials);
          }
        }
        i = endIdx;
        continue;
      }
    }

    // Partials {{> name}}
    if (template.startsWith('{{>', i)) {
      const end = template.indexOf('}}', i);
      const name = template.slice(i + 3, end).trim();
      if (partials[name]) {
        result += processTemplate(partials[name], data, filters, partials);
      }
      i = end + 2;
      continue;
    }

    // Interpolation {{ }}
    if (template.startsWith('{{', i)) {
      const end = template.indexOf('}}', i + 2);
      if (end === -1) break;
      const expr = template.slice(i + 2, end).trim();
      const val = resolveExpr(expr, data, filters);
      result += escapeHtml(val);
      i = end + 2;
      continue;
    }

    result += template[i++];
  }

  return result;
}

function resolveExpr(expr, data, filters) {
  const parts = expr.split('|').map(s => s.trim());
  let val = parts[0] === '.' ? data['.'] : get(data, parts[0]);
  if (val === undefined) val = '';
  
  for (let i = 1; i < parts.length; i++) {
    const filterParts = parts[i].split(/\s+/);
    const filterName = filterParts[0];
    const args = filterParts.slice(1);
    const fn = filters[filterName];
    if (fn) val = fn(val, ...args);
  }
  
  return val === undefined || val === null ? '' : val;
}

function extractBlock(template, start, tagName) {
  let depth = 1;
  let i = start;
  let elseIdx = -1;
  
  while (i < template.length && depth > 0) {
    if (template.startsWith(`{{#${tagName}`, i)) depth++;
    if (template.startsWith(`{{/${tagName}}}`, i)) {
      depth--;
      if (depth === 0) {
        const endTag = `{{/${tagName}}}`;
        const body = elseIdx >= 0 ? template.slice(start, elseIdx) : template.slice(start, i);
        const elseBody = elseIdx >= 0 ? template.slice(elseIdx + 8, i) : null; // {{else}} = 8 chars
        return [body, elseBody, i + endTag.length];
      }
    }
    if (template.startsWith('{{else}}', i) && depth === 1) {
      elseIdx = i;
    }
    i++;
  }
  
  return [template.slice(start), null, template.length];
}

// Tagged template literal
function html(strings, ...values) {
  return strings.reduce((result, str, i) => {
    const val = i < values.length ? escapeHtml(values[i]) : '';
    return result + str + val;
  }, '');
}

function render(template, data, options) {
  return compile(template, options)(data);
}

module.exports = { compile, render, html, escapeHtml, defaultFilters };
