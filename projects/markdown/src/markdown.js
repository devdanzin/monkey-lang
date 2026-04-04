// markdown.js — Markdown parser and HTML renderer

export function render(markdown) {
  const lines = markdown.split('\n');
  const blocks = parseBlocks(lines);
  return blocks.map(renderBlock).join('\n');
}

// ===== Block-level parsing =====
function parseBlocks(lines) {
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Empty line
    if (line.trim() === '') { i++; continue; }

    // Fenced code block
    if (line.match(/^```/)) {
      const lang = line.slice(3).trim();
      i++;
      const codeLines = [];
      while (i < lines.length && !lines[i].match(/^```/)) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push({ type: 'code_block', lang, content: codeLines.join('\n') });
      continue;
    }

    // Heading (ATX)
    const headingMatch = line.match(/^(#{1,6})\s+(.+?)(?:\s+#+)?$/);
    if (headingMatch) {
      blocks.push({ type: 'heading', level: headingMatch[1].length, content: headingMatch[2] });
      i++;
      continue;
    }

    // Horizontal rule
    if (line.match(/^(\*{3,}|-{3,}|_{3,})$/)) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith('>')) {
      const quoteLines = [];
      while (i < lines.length && (lines[i].startsWith('>') || (lines[i].trim() !== '' && quoteLines.length > 0 && !lines[i].match(/^[#>*\-\d]/)))) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({ type: 'blockquote', content: render(quoteLines.join('\n')) });
      continue;
    }

    // Unordered list
    if (line.match(/^[\-*+]\s/)) {
      const items = [];
      while (i < lines.length && (lines[i].match(/^[\-*+]\s/) || (lines[i].match(/^\s+/) && items.length > 0))) {
        if (lines[i].match(/^[\-*+]\s/)) {
          items.push(lines[i].replace(/^[\-*+]\s/, ''));
        } else if (lines[i].trim()) {
          items[items.length - 1] += '\n' + lines[i].trim();
        }
        i++;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    // Ordered list
    if (line.match(/^\d+\.\s/)) {
      const items = [];
      while (i < lines.length && (lines[i].match(/^\d+\.\s/) || (lines[i].match(/^\s+/) && items.length > 0))) {
        if (lines[i].match(/^\d+\.\s/)) {
          items.push(lines[i].replace(/^\d+\.\s/, ''));
        } else if (lines[i].trim()) {
          items[items.length - 1] += '\n' + lines[i].trim();
        }
        i++;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    // Table (GFM)
    if (i + 1 < lines.length && lines[i + 1].match(/^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/)) {
      const headerLine = line;
      const alignLine = lines[i + 1];
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes('|')) {
        rows.push(parseTableRow(lines[i]));
        i++;
      }
      const headers = parseTableRow(headerLine);
      const aligns = parseTableAligns(alignLine);
      blocks.push({ type: 'table', headers, aligns, rows });
      continue;
    }

    // Paragraph
    const paraLines = [];
    while (i < lines.length && lines[i].trim() !== '' && !lines[i].match(/^[#>]/) && !lines[i].match(/^```/) && !lines[i].match(/^(\*{3,}|-{3,}|_{3,})$/) && !lines[i].match(/^[\-*+]\s/) && !lines[i].match(/^\d+\.\s/)) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: 'paragraph', content: paraLines.join('\n') });
    }
  }

  return blocks;
}

function parseTableRow(line) {
  return line.split('|').map(c => c.trim()).filter(c => c !== '');
}

function parseTableAligns(line) {
  return line.split('|').map(c => c.trim()).filter(c => c !== '').map(c => {
    if (c.startsWith(':') && c.endsWith(':')) return 'center';
    if (c.endsWith(':')) return 'right';
    return 'left';
  });
}

// ===== Block-level rendering =====
function renderBlock(block) {
  switch (block.type) {
    case 'heading':
      return `<h${block.level}>${renderInline(block.content)}</h${block.level}>`;
    case 'paragraph':
      return `<p>${renderInline(block.content)}</p>`;
    case 'code_block':
      const cls = block.lang ? ` class="language-${block.lang}"` : '';
      return `<pre><code${cls}>${escapeHtml(block.content)}</code></pre>`;
    case 'blockquote':
      return `<blockquote>${block.content}</blockquote>`;
    case 'hr':
      return '<hr>';
    case 'ul':
      return `<ul>\n${block.items.map(i => `<li>${renderInline(i)}</li>`).join('\n')}\n</ul>`;
    case 'ol':
      return `<ol>\n${block.items.map(i => `<li>${renderInline(i)}</li>`).join('\n')}\n</ol>`;
    case 'table':
      return renderTable(block);
    default:
      return '';
  }
}

function renderTable(block) {
  let html = '<table>\n<thead>\n<tr>\n';
  for (let i = 0; i < block.headers.length; i++) {
    const align = block.aligns[i] ? ` align="${block.aligns[i]}"` : '';
    html += `<th${align}>${renderInline(block.headers[i])}</th>\n`;
  }
  html += '</tr>\n</thead>\n<tbody>\n';
  for (const row of block.rows) {
    html += '<tr>\n';
    for (let i = 0; i < row.length; i++) {
      const align = block.aligns[i] ? ` align="${block.aligns[i]}"` : '';
      html += `<td${align}>${renderInline(row[i])}</td>\n`;
    }
    html += '</tr>\n';
  }
  html += '</tbody>\n</table>';
  return html;
}

// ===== Inline parsing =====
function renderInline(text) {
  let result = text;

  // Inline code (must be first to prevent other processing inside code)
  result = result.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Images (before links)
  result = result.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');

  // Links
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Bold + italic
  result = result.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');

  // Bold
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  result = result.replace(/__(.+?)__/g, '<strong>$1</strong>');

  // Italic
  result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');
  result = result.replace(/_(.+?)_/g, '<em>$1</em>');

  // Strikethrough (GFM)
  result = result.replace(/~~(.+?)~~/g, '<del>$1</del>');

  // Line breaks
  result = result.replace(/  \n/g, '<br>\n');

  return result;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export { renderInline, escapeHtml, parseBlocks };
