// Tiny CSS Parser — tokenize and parse CSS into AST

export function parse(css) {
  const rules = [];
  let i = 0;

  while (i < css.length) {
    skipWhitespace();
    if (i >= css.length) break;

    // Comment
    if (css[i] === '/' && css[i+1] === '*') {
      i += 2;
      while (i < css.length - 1 && !(css[i] === '*' && css[i+1] === '/')) i++;
      i += 2;
      continue;
    }

    // At-rule
    if (css[i] === '@') {
      const rule = parseAtRule();
      if (rule) rules.push(rule);
      continue;
    }

    // Regular rule
    const rule = parseRule();
    if (rule) rules.push(rule);
  }

  function skipWhitespace() { while (i < css.length && /\s/.test(css[i])) i++; }

  function parseRule() {
    const selectors = parseSelectors();
    if (!selectors.length) return null;
    skipWhitespace();
    if (css[i] !== '{') return null;
    i++; // skip {
    const declarations = parseDeclarations();
    skipWhitespace();
    if (css[i] === '}') i++;
    return { type: 'rule', selectors, declarations };
  }

  function parseSelectors() {
    const selectors = [];
    let current = '';
    while (i < css.length && css[i] !== '{') {
      if (css[i] === ',') { selectors.push(current.trim()); current = ''; }
      else current += css[i];
      i++;
    }
    if (current.trim()) selectors.push(current.trim());
    return selectors;
  }

  function parseDeclarations() {
    const decls = [];
    while (i < css.length && css[i] !== '}') {
      skipWhitespace();
      if (css[i] === '}') break;

      // Property
      let prop = '';
      while (i < css.length && css[i] !== ':' && css[i] !== '}') { prop += css[i]; i++; }
      if (css[i] === ':') i++;

      // Value
      let value = '';
      while (i < css.length && css[i] !== ';' && css[i] !== '}') { value += css[i]; i++; }
      if (css[i] === ';') i++;

      prop = prop.trim();
      value = value.trim();
      if (prop && value) {
        const important = value.endsWith('!important');
        if (important) value = value.replace(/\s*!important\s*$/, '').trim();
        decls.push({ property: prop, value, important });
      }
    }
    return decls;
  }

  function parseAtRule() {
    let name = '';
    i++; // skip @
    while (i < css.length && /[a-zA-Z-]/.test(css[i])) { name += css[i]; i++; }
    skipWhitespace();

    let prelude = '';
    while (i < css.length && css[i] !== '{' && css[i] !== ';') { prelude += css[i]; i++; }

    if (css[i] === ';') { i++; return { type: 'at-rule', name, prelude: prelude.trim(), rules: [] }; }
    if (css[i] === '{') {
      i++;
      // Parse nested rules
      const nested = [];
      while (i < css.length && css[i] !== '}') {
        skipWhitespace();
        if (css[i] === '}') break;
        const rule = parseRule();
        if (rule) nested.push(rule);
        else break;
      }
      if (css[i] === '}') i++;
      return { type: 'at-rule', name, prelude: prelude.trim(), rules: nested };
    }
    return null;
  }

  return { type: 'stylesheet', rules };
}

// Stringify AST back to CSS
export function stringify(ast, { indent = 2, minify = false } = {}) {
  const pad = minify ? '' : ' '.repeat(indent);
  const nl = minify ? '' : '\n';
  const sp = minify ? '' : ' ';

  function stringifyRule(rule) {
    if (rule.type === 'at-rule') {
      if (rule.rules.length === 0) return `@${rule.name} ${rule.prelude};${nl}`;
      return `@${rule.name} ${rule.prelude}${sp}{${nl}${rule.rules.map(r => pad + stringifyRule(r)).join('')}}${nl}`;
    }
    const sels = rule.selectors.join(`,${sp}`);
    const decls = rule.declarations.map(d => `${pad}${d.property}:${sp}${d.value}${d.important ? ' !important' : ''};`).join(nl);
    return `${sels}${sp}{${nl}${decls}${nl}}${nl}`;
  }

  return ast.rules.map(stringifyRule).join(nl);
}

// Specificity calculator
export function specificity(selector) {
  let a = 0, b = 0, c = 0;
  // IDs
  a = (selector.match(/#/g) || []).length;
  // Classes, attributes, pseudo-classes
  b = (selector.match(/\.|:(?!:)|\[/g) || []).length;
  // Elements, pseudo-elements
  c = (selector.match(/(?:^|\s)[a-zA-Z]|::/g) || []).length;
  return [a, b, c];
}
