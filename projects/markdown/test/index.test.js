import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parse, render } from '../src/index.js';

describe('Markdown — headings', () => {
  it('h1', () => assert.ok(render('# Hello').includes('<h1>')));
  it('h2', () => assert.ok(render('## World').includes('<h2>')));
  it('h6', () => assert.ok(render('###### Deep').includes('<h6>')));
});

describe('Markdown — inline', () => {
  it('bold **', () => assert.ok(render('**bold**').includes('<strong>bold</strong>')));
  it('italic *', () => assert.ok(render('*italic*').includes('<em>italic</em>')));
  it('code `', () => assert.ok(render('`code`').includes('<code>code</code>')));
  it('link', () => assert.ok(render('[text](url)').includes('<a href="url">text</a>')));
  it('image', () => assert.ok(render('![alt](src)').includes('<img src="src" alt="alt"')));
});

describe('Markdown — blocks', () => {
  it('paragraph', () => assert.ok(render('Hello world').includes('<p>Hello world</p>')));
  it('code block', () => {
    const md = '```js\nconst x = 1;\n```';
    const html = render(md);
    assert.ok(html.includes('<pre><code'));
    assert.ok(html.includes('const x = 1;'));
  });
  it('horizontal rule', () => assert.ok(render('---').includes('<hr />')));
  it('blockquote', () => assert.ok(render('> quote').includes('<blockquote>')));
});

describe('Markdown — lists', () => {
  it('unordered list', () => {
    const html = render('- a\n- b\n- c');
    assert.ok(html.includes('<ul>'));
    assert.ok(html.includes('<li>a</li>'));
  });
  it('ordered list', () => {
    const html = render('1. first\n2. second');
    assert.ok(html.includes('<ol>'));
    assert.ok(html.includes('<li>first</li>'));
  });
});

describe('Markdown — complex', () => {
  it('full document', () => {
    const md = `# Title

This is a **paragraph** with *emphasis*.

- Item 1
- Item 2

\`\`\`python
print("hello")
\`\`\`

> A quote

---

[Link](https://example.com)`;

    const html = render(md);
    assert.ok(html.includes('<h1>Title</h1>'));
    assert.ok(html.includes('<strong>paragraph</strong>'));
    assert.ok(html.includes('<em>emphasis</em>'));
    assert.ok(html.includes('<ul>'));
    assert.ok(html.includes('print(&quot;hello&quot;)') || html.includes('print("hello")'));
    assert.ok(html.includes('<blockquote>'));
    assert.ok(html.includes('<hr />'));
    assert.ok(html.includes('<a href='));
  });
});

describe('Markdown — parser tokens', () => {
  it('returns typed tokens', () => {
    const tokens = parse('# Heading\n\nParagraph');
    assert.equal(tokens[0].type, 'heading');
    assert.equal(tokens[1].type, 'paragraph');
  });
});
