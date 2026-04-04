// ===== Template Engine =====
// Mustache/Handlebars-like with variables, conditionals, loops, partials

export class TemplateEngine {
  constructor() {
    this.partials = new Map();
    this.helpers = new Map();
  }

  registerPartial(name, template) { this.partials.set(name, template); }
  registerHelper(name, fn) { this.helpers.set(name, fn); }

  render(template, data) {
    return this._render(template, data);
  }

  _render(template, data) {
    let result = template;

    // Partials: {{> partialName}}
    result = result.replace(/\{\{>\s*(\w+)\s*\}\}/g, (_, name) => {
      const partial = this.partials.get(name);
      return partial ? this._render(partial, data) : '';
    });

    // Sections (conditionals/loops): {{#key}}...{{/key}}
    result = result.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key, body) => {
      const value = this._resolve(data, key);
      
      if (Array.isArray(value)) {
        return value.map((item, index) => {
          const itemData = typeof item === 'object' ? { ...data, ...item, '@index': index, '@first': index === 0, '@last': index === value.length - 1 } : { ...data, '.': item, '@index': index };
          return this._render(body, itemData);
        }).join('');
      }
      
      if (value && typeof value === 'object') {
        return this._render(body, { ...data, ...value });
      }
      
      return value ? this._render(body, data) : '';
    });

    // Inverted sections: {{^key}}...{{/key}}
    result = result.replace(/\{\{\^(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key, body) => {
      const value = this._resolve(data, key);
      if (!value || (Array.isArray(value) && value.length === 0)) {
        return this._render(body, data);
      }
      return '';
    });

    // Helpers: {{helper arg}}
    result = result.replace(/\{\{(\w+)\s+([^}]+)\}\}/g, (match, name, args) => {
      const helper = this.helpers.get(name);
      if (helper) {
        const resolvedArgs = args.trim().split(/\s+/).map(a => this._resolve(data, a) ?? a);
        return String(helper(...resolvedArgs));
      }
      return match;
    });

    // Unescaped variables: {{{key}}} or {{& key}}
    result = result.replace(/\{\{\{(\S+?)\}\}\}/g, (_, key) => {
      const value = this._resolve(data, key);
      return value != null ? String(value) : '';
    });
    result = result.replace(/\{\{&\s*(\S+?)\s*\}\}/g, (_, key) => {
      const value = this._resolve(data, key);
      return value != null ? String(value) : '';
    });

    // Escaped variables: {{key}}
    result = result.replace(/\{\{(\S+?)\}\}/g, (_, key) => {
      const value = this._resolve(data, key);
      return value != null ? escapeHtml(String(value)) : '';
    });

    return result;
  }

  _resolve(data, path) {
    if (path === '.') return data['.'] ?? data;
    const parts = path.split('.');
    let current = data;
    for (const part of parts) {
      if (current == null) return undefined;
      current = current[part];
    }
    return current;
  }
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Convenience
export function render(template, data, options = {}) {
  const engine = new TemplateEngine();
  if (options.partials) for (const [k, v] of Object.entries(options.partials)) engine.registerPartial(k, v);
  if (options.helpers) for (const [k, v] of Object.entries(options.helpers)) engine.registerHelper(k, v);
  return engine.render(template, data);
}
