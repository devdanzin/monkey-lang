import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { render, renderInline, escapeHtml } from './markdown.js';

describe('Headings', () => {
  it('h1', () => { assert.equal(render('# Hello'), '<h1>Hello</h1>'); });
  it('h2', () => { assert.equal(render('## World'), '<h2>World</h2>'); });
  it('h3', () => { assert.equal(render('### Three'), '<h3>Three</h3>'); });
  it('h6', () => { assert.equal(render('###### Six'), '<h6>Six</h6>'); });
  it('heading with inline', () => { assert.ok(render('# **Bold** heading').includes('<strong>Bold</strong>')); });
});

describe('Inline formatting', () => {
  it('bold **', () => { assert.equal(renderInline('**bold**'), '<strong>bold</strong>'); });
  it('bold __', () => { assert.equal(renderInline('__bold__'), '<strong>bold</strong>'); });
  it('italic *', () => { assert.equal(renderInline('*italic*'), '<em>italic</em>'); });
  it('italic _', () => { assert.equal(renderInline('_italic_'), '<em>italic</em>'); });
  it('bold+italic', () => { assert.equal(renderInline('***both***'), '<strong><em>both</em></strong>'); });
  it('inline code', () => { assert.equal(renderInline('use `npm install`'), 'use <code>npm install</code>'); });
  it('strikethrough', () => { assert.equal(renderInline('~~deleted~~'), '<del>deleted</del>'); });
  it('link', () => { assert.equal(renderInline('[Google](https://google.com)'), '<a href="https://google.com">Google</a>'); });
  it('image', () => { assert.equal(renderInline('![alt](img.png)'), '<img src="img.png" alt="alt">'); });
  it('mixed inline', () => {
    const result = renderInline('**bold** and *italic* and `code`');
    assert.ok(result.includes('<strong>bold</strong>'));
    assert.ok(result.includes('<em>italic</em>'));
    assert.ok(result.includes('<code>code</code>'));
  });
});

describe('Paragraphs', () => {
  it('single paragraph', () => {
    assert.equal(render('Hello world'), '<p>Hello world</p>');
  });
  it('multiple paragraphs', () => {
    const result = render('First para\n\nSecond para');
    assert.ok(result.includes('<p>First para</p>'));
    assert.ok(result.includes('<p>Second para</p>'));
  });
});

describe('Code blocks', () => {
  it('fenced code block', () => {
    const result = render('```\nconst x = 1;\n```');
    assert.ok(result.includes('<pre><code>'));
    assert.ok(result.includes('const x = 1;'));
  });
  it('with language', () => {
    const result = render('```javascript\nlet x = 1;\n```');
    assert.ok(result.includes('class="language-javascript"'));
  });
  it('escapes HTML in code', () => {
    const result = render('```\n<div>&amp;</div>\n```');
    assert.ok(result.includes('&lt;div&gt;'));
  });
});

describe('Blockquotes', () => {
  it('simple blockquote', () => {
    const result = render('> This is quoted');
    assert.ok(result.includes('<blockquote>'));
    assert.ok(result.includes('This is quoted'));
  });
  it('multi-line blockquote', () => {
    const result = render('> Line 1\n> Line 2');
    assert.ok(result.includes('<blockquote>'));
  });
});

describe('Lists', () => {
  it('unordered list', () => {
    const result = render('- Item 1\n- Item 2\n- Item 3');
    assert.ok(result.includes('<ul>'));
    assert.ok(result.includes('<li>Item 1</li>'));
    assert.ok(result.includes('<li>Item 3</li>'));
  });
  it('ordered list', () => {
    const result = render('1. First\n2. Second\n3. Third');
    assert.ok(result.includes('<ol>'));
    assert.ok(result.includes('<li>First</li>'));
  });
  it('list with inline formatting', () => {
    const result = render('- **bold item**\n- *italic item*');
    assert.ok(result.includes('<strong>bold item</strong>'));
    assert.ok(result.includes('<em>italic item</em>'));
  });
});

describe('Horizontal rule', () => {
  it('---', () => { assert.ok(render('---').includes('<hr>')); });
  it('***', () => { assert.ok(render('***').includes('<hr>')); });
  it('___', () => { assert.ok(render('___').includes('<hr>')); });
});

describe('Tables (GFM)', () => {
  it('basic table', () => {
    const md = '| Name | Age |\n| --- | --- |\n| Alice | 30 |\n| Bob | 25 |';
    const result = render(md);
    assert.ok(result.includes('<table>'));
    assert.ok(result.includes('<th'));
    assert.ok(result.includes('Name'));
    assert.ok(result.includes('<td'));
    assert.ok(result.includes('Alice'));
  });
  it('aligned table', () => {
    const md = '| Left | Center | Right |\n| :--- | :---: | ---: |\n| a | b | c |';
    const result = render(md);
    assert.ok(result.includes('align="left"'));
    assert.ok(result.includes('align="center"'));
    assert.ok(result.includes('align="right"'));
  });
});

describe('HTML escaping', () => {
  it('escapes &', () => { assert.equal(escapeHtml('a & b'), 'a &amp; b'); });
  it('escapes <>', () => { assert.equal(escapeHtml('<div>'), '&lt;div&gt;'); });
});

describe('Complex documents', () => {
  it('renders a full document', () => {
    const md = `# Title

This is a **paragraph** with *inline* formatting.

## Features

- Item one
- Item two
- **Bold** item

\`\`\`javascript
const x = 42;
\`\`\`

> A blockquote

---

| Name | Score |
| --- | --- |
| Alice | 95 |
| Bob | 87 |

[Link](https://example.com)`;

    const html = render(md);
    assert.ok(html.includes('<h1>Title</h1>'));
    assert.ok(html.includes('<strong>paragraph</strong>'));
    assert.ok(html.includes('<ul>'));
    assert.ok(html.includes('<pre><code'));
    assert.ok(html.includes('<blockquote>'));
    assert.ok(html.includes('<hr>'));
    assert.ok(html.includes('<table>'));
    assert.ok(html.includes('<a href'));
  });
});
