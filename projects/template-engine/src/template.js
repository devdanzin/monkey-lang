// Template Engine — Mustache/Handlebars-like syntax
// Supports: {{var}}, {{#if}}, {{#each}}, {{#unless}}, {{else}}, {{> partial}}, filters

export function compile(template) {
  const tokens = tokenize(template);
  const ast = parseTokens(tokens);
  return function render(data, partials = {}) {
    return evaluate(ast, data, partials);
  };
}

export function render(template, data, partials) {
  return compile(template)(data, partials);
}

// ===== Tokenizer =====
function tokenize(template) {
  const tokens = [];
  let i = 0;

  while (i < template.length) {
    const start = template.indexOf('{{', i);
    if (start === -1) {
      tokens.push({ type: 'text', value: template.slice(i) });
      break;
    }

    if (start > i) {
      tokens.push({ type: 'text', value: template.slice(i, start) });
    }

    // Triple braces for unescaped
    if (template[start + 2] === '{') {
      const end = template.indexOf('}}}', start);
      if (end === -1) throw new Error('Unclosed {{{');
      tokens.push({ type: 'raw', value: template.slice(start + 3, end).trim() });
      i = end + 3;
    } else {
      const end = template.indexOf('}}', start);
      if (end === -1) throw new Error('Unclosed {{');
      const content = template.slice(start + 2, end).trim();

      if (content.startsWith('#')) {
        tokens.push({ type: 'block-open', value: content.slice(1).trim() });
      } else if (content.startsWith('/')) {
        tokens.push({ type: 'block-close', value: content.slice(1).trim() });
      } else if (content === 'else') {
        tokens.push({ type: 'else' });
      } else if (content.startsWith('>')) {
        tokens.push({ type: 'partial', value: content.slice(1).trim() });
      } else if (content.startsWith('!')) {
        // Comment — skip
      } else {
        tokens.push({ type: 'var', value: content });
      }
      i = end + 2;
    }
  }

  return tokens;
}

// ===== Parser =====
function parseTokens(tokens) {
  const ast = [];
  let i = 0;

  function parseBlock() {
    const nodes = [];
    while (i < tokens.length) {
      const token = tokens[i];
      if (token.type === 'block-close' || token.type === 'else') return nodes;
      nodes.push(parseNode());
    }
    return nodes;
  }

  function parseNode() {
    const token = tokens[i++];

    switch (token.type) {
      case 'text': return { type: 'text', value: token.value };
      case 'var': return { type: 'var', value: token.value };
      case 'raw': return { type: 'raw', value: token.value };
      case 'partial': return { type: 'partial', value: token.value };

      case 'block-open': {
        const parts = token.value.split(/\s+/);
        const keyword = parts[0];
        const arg = parts.slice(1).join(' ');

        const body = parseBlock();
        let elseBody = null;

        if (i < tokens.length && tokens[i].type === 'else') {
          i++; // skip else
          elseBody = parseBlock();
        }

        if (i < tokens.length && tokens[i].type === 'block-close') i++; // skip close

        if (keyword === 'if') return { type: 'if', condition: arg, body, elseBody };
        if (keyword === 'unless') return { type: 'unless', condition: arg, body, elseBody };
        if (keyword === 'each') return { type: 'each', collection: arg, body };
        if (keyword === 'with') return { type: 'with', context: arg, body };

        return { type: 'block', name: keyword, arg, body, elseBody };
      }

      default: return { type: 'text', value: '' };
    }
  }

  while (i < tokens.length) ast.push(parseNode());
  return ast;
}

// ===== Evaluator =====
function evaluate(ast, data, partials) {
  let output = '';

  for (const node of ast) {
    switch (node.type) {
      case 'text':
        output += node.value;
        break;

      case 'var': {
        const [path, ...filters] = node.value.split('|').map(s => s.trim());
        let val = resolve(data, path);
        for (const f of filters) val = applyFilter(val, f);
        output += escapeHtml(String(val ?? ''));
        break;
      }

      case 'raw': {
        const val = resolve(data, node.value);
        output += String(val ?? '');
        break;
      }

      case 'if': {
        const val = resolve(data, node.condition);
        if (isTruthy(val)) output += evaluate(node.body, data, partials);
        else if (node.elseBody) output += evaluate(node.elseBody, data, partials);
        break;
      }

      case 'unless': {
        const val = resolve(data, node.condition);
        if (!isTruthy(val)) output += evaluate(node.body, data, partials);
        else if (node.elseBody) output += evaluate(node.elseBody, data, partials);
        break;
      }

      case 'each': {
        const collection = resolve(data, node.collection);
        if (Array.isArray(collection)) {
          for (let idx = 0; idx < collection.length; idx++) {
            const item = collection[idx];
            const ctx = typeof item === 'object' ? { ...data, ...item, '@index': idx, '@first': idx === 0, '@last': idx === collection.length - 1 } : { ...data, '.': item, '@index': idx, '@first': idx === 0, '@last': idx === collection.length - 1 };
            output += evaluate(node.body, ctx, partials);
          }
        } else if (collection && typeof collection === 'object') {
          const entries = Object.entries(collection);
          for (let idx = 0; idx < entries.length; idx++) {
            const [key, value] = entries[idx];
            const ctx = { ...data, '@key': key, '@value': value, '@index': idx };
            output += evaluate(node.body, ctx, partials);
          }
        }
        break;
      }

      case 'with': {
        const ctx = resolve(data, node.context);
        if (ctx && typeof ctx === 'object') {
          output += evaluate(node.body, { ...data, ...ctx }, partials);
        }
        break;
      }

      case 'partial': {
        const partial = partials[node.value];
        if (partial) {
          if (typeof partial === 'function') output += partial(data);
          else output += render(partial, data, partials);
        }
        break;
      }
    }
  }

  return output;
}

// Resolve dotted path: "user.name" → data.user.name
function resolve(data, path) {
  if (path === '.') return data['.'] ?? data;
  if (path === 'this') return data;
  return path.split('.').reduce((obj, key) => obj?.[key], data);
}

function isTruthy(val) {
  if (val === false || val === null || val === undefined || val === 0 || val === '') return false;
  if (Array.isArray(val) && val.length === 0) return false;
  return true;
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Built-in filters
const FILTERS = {
  upper: v => String(v).toUpperCase(),
  lower: v => String(v).toLowerCase(),
  capitalize: v => String(v).charAt(0).toUpperCase() + String(v).slice(1),
  trim: v => String(v).trim(),
  json: v => JSON.stringify(v),
  length: v => (v?.length ?? 0),
  reverse: v => typeof v === 'string' ? [...v].reverse().join('') : v,
  default: v => v ?? '(empty)',
};

function applyFilter(value, filterName) {
  const fn = FILTERS[filterName];
  return fn ? fn(value) : value;
}

export function registerFilter(name, fn) {
  FILTERS[name] = fn;
}
