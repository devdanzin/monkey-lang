// ===== Simple Markdown Parser =====

export function parse(markdown) {
  const lines = markdown.split('\n');
  const tokens = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      tokens.push({ type: 'heading', level: headingMatch[1].length, text: parseInline(headingMatch[2]) });
      i++; continue;
    }

    // Code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) { codeLines.push(lines[i]); i++; }
      tokens.push({ type: 'code_block', lang, code: codeLines.join('\n') });
      i++; continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      tokens.push({ type: 'hr' });
      i++; continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const quoteLines = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      tokens.push({ type: 'blockquote', text: parseInline(quoteLines.join('\n')) });
      continue;
    }

    // Unordered list
    if (/^[-*+]\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*+]\s/.test(lines[i])) {
        items.push(parseInline(lines[i].replace(/^[-*+]\s/, '')));
        i++;
      }
      tokens.push({ type: 'ul', items });
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(parseInline(lines[i].replace(/^\d+\.\s/, '')));
        i++;
      }
      tokens.push({ type: 'ol', items });
      continue;
    }

    // Empty line
    if (line.trim() === '') { i++; continue; }

    // Paragraph
    const paraLines = [];
    while (i < lines.length && lines[i].trim() !== '' && !/^#{1,6}\s/.test(lines[i]) && !lines[i].startsWith('```')) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      tokens.push({ type: 'paragraph', text: parseInline(paraLines.join(' ')) });
    }
  }

  return tokens;
}

function parseInline(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

// ===== Render to HTML =====

export function toHTML(tokens) {
  return tokens.map(token => {
    switch (token.type) {
      case 'heading': return `<h${token.level}>${token.text}</h${token.level}>`;
      case 'paragraph': return `<p>${token.text}</p>`;
      case 'code_block': return `<pre><code${token.lang ? ` class="language-${token.lang}"` : ''}>${escapeHtml(token.code)}</code></pre>`;
      case 'hr': return '<hr />';
      case 'blockquote': return `<blockquote><p>${token.text}</p></blockquote>`;
      case 'ul': return `<ul>${token.items.map(i => `<li>${i}</li>`).join('')}</ul>`;
      case 'ol': return `<ol>${token.items.map(i => `<li>${i}</li>`).join('')}</ol>`;
      default: return '';
    }
  }).join('\n');
}

function escapeHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

export function render(markdown) { return toHTML(parse(markdown)); }
