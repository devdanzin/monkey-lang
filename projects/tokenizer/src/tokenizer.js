// Generic tokenizer/lexer — configurable rules

export class Tokenizer {
  constructor(rules = []) { this._rules = rules; }

  addRule(name, pattern, { skip = false, transform } = {}) {
    this._rules.push({ name, pattern: typeof pattern === 'string' ? new RegExp('^' + pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) : new RegExp('^' + pattern.source, pattern.flags), skip, transform });
    return this;
  }

  tokenize(input) {
    const tokens = [];
    let pos = 0;
    while (pos < input.length) {
      let matched = false;
      for (const rule of this._rules) {
        const m = input.slice(pos).match(rule.pattern);
        if (m) {
          if (!rule.skip) {
            const value = rule.transform ? rule.transform(m[0]) : m[0];
            tokens.push({ type: rule.name, value, pos });
          }
          pos += m[0].length;
          matched = true;
          break;
        }
      }
      if (!matched) throw new Error(`Unexpected character at ${pos}: '${input[pos]}'`);
    }
    return tokens;
  }
}

// Pre-built tokenizers
export function jsTokenizer() {
  return new Tokenizer()
    .addRule('whitespace', /\s+/, { skip: true })
    .addRule('comment', /\/\/[^\n]*/, { skip: true })
    .addRule('comment', /\/\*[\s\S]*?\*\//, { skip: true })
    .addRule('string', /"(?:[^"\\]|\\.)*"/)
    .addRule('string', /'(?:[^'\\]|\\.)*'/)
    .addRule('number', /\d+\.?\d*/)
    .addRule('keyword', /\b(if|else|for|while|return|function|const|let|var|class|import|export)\b/)
    .addRule('identifier', /[a-zA-Z_$]\w*/)
    .addRule('operator', /[+\-*/%=<>!&|^~?:]+/)
    .addRule('punctuation', /[{}()\[\];,.]/);
}
