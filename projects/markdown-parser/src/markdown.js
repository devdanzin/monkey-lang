// Markdown Parser — converts Markdown to HTML
// Supports: headings, bold, italic, code, links, images, lists, blockquotes, horizontal rules, paragraphs

export function parse(markdown) {
  const lines = markdown.split('\n');
  const html = [];
  let i = 0;
  let inList = false, listType = '';

  while (i < lines.length) {
    const line = lines[i];

    // Empty line
    if (line.trim() === '') {
      if (inList) { html.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; }
      i++;
      continue;
    }

    // Heading (# to ######)
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      if (inList) { html.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; }
      const level = headingMatch[1].length;
      html.push(`<h${level}>${inline(headingMatch[2])}</h${level}>`);
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      if (inList) { html.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; }
      html.push('<hr>');
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      if (inList) { html.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; }
      const quoteLines = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      html.push(`<blockquote>${parse(quoteLines.join('\n'))}</blockquote>`);
      continue;
    }

    // Fenced code block
    if (line.startsWith('```')) {
      if (inList) { html.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; }
      const lang = line.slice(3).trim();
      i++;
      const codeLines = [];
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(escapeHtml(lines[i]));
        i++;
      }
      if (i < lines.length) i++; // Skip closing ```
      const langAttr = lang ? ` class="language-${lang}"` : '';
      html.push(`<pre><code${langAttr}>${codeLines.join('\n')}</code></pre>`);
      continue;
    }

    // Unordered list
    const ulMatch = line.match(/^(\s*)[-*+]\s+(.+)$/);
    if (ulMatch) {
      if (!inList || listType !== 'ul') {
        if (inList) html.push(listType === 'ul' ? '</ul>' : '</ol>');
        html.push('<ul>');
        inList = true; listType = 'ul';
      }
      html.push(`<li>${inline(ulMatch[2])}</li>`);
      i++;
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);
    if (olMatch) {
      if (!inList || listType !== 'ol') {
        if (inList) html.push(listType === 'ul' ? '</ul>' : '</ol>');
        html.push('<ol>');
        inList = true; listType = 'ol';
      }
      html.push(`<li>${inline(olMatch[2])}</li>`);
      i++;
      continue;
    }

    // Paragraph (default)
    if (inList) { html.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; }
    const paraLines = [];
    while (i < lines.length && lines[i].trim() !== '' && !lines[i].match(/^#{1,6}\s/) && !lines[i].startsWith('```') && !lines[i].startsWith('> ') && !lines[i].match(/^[-*+]\s/) && !lines[i].match(/^\d+\.\s/) && !lines[i].match(/^(-{3,}|\*{3,}|_{3,})\s*$/)) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length) {
      html.push(`<p>${inline(paraLines.join(' '))}</p>`);
    }
  }

  if (inList) html.push(listType === 'ul' ? '</ul>' : '</ol>');
  return html.join('\n');
}

// Inline formatting
function inline(text) {
  // Images: ![alt](url)
  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
  // Links: [text](url)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  // Bold + italic: ***text*** or ___text___
  text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  text = text.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
  // Bold: **text** or __text__
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');
  // Italic: *text* or _text_
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
  text = text.replace(/_(.+?)_/g, '<em>$1</em>');
  // Strikethrough: ~~text~~
  text = text.replace(/~~(.+?)~~/g, '<del>$1</del>');
  // Inline code: `code`
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Line break: two trailing spaces
  text = text.replace(/  $/gm, '<br>');
  return text;
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
