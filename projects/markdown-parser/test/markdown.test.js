import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/index.js';

describe('Headings', () => {
  it('h1 through h6', () => {
    assert.equal(parse('# Hello'), '<h1>Hello</h1>');
    assert.equal(parse('## Hello'), '<h2>Hello</h2>');
    assert.equal(parse('### Hello'), '<h3>Hello</h3>');
    assert.equal(parse('###### Hello'), '<h6>Hello</h6>');
  });
});

describe('Paragraphs', () => {
  it('wraps text in <p>', () => {
    assert.equal(parse('Hello world'), '<p>Hello world</p>');
  });

  it('joins consecutive lines', () => {
    assert.equal(parse('Line 1\nLine 2'), '<p>Line 1 Line 2</p>');
  });

  it('separates paragraphs with blank lines', () => {
    assert.equal(parse('Para 1\n\nPara 2'), '<p>Para 1</p>\n<p>Para 2</p>');
  });
});

describe('Inline formatting', () => {
  it('bold with **', () => {
    assert.equal(parse('**bold**'), '<p><strong>bold</strong></p>');
  });

  it('italic with *', () => {
    assert.equal(parse('*italic*'), '<p><em>italic</em></p>');
  });

  it('bold italic with ***', () => {
    assert.equal(parse('***both***'), '<p><strong><em>both</em></strong></p>');
  });

  it('inline code', () => {
    assert.equal(parse('Use `code` here'), '<p>Use <code>code</code> here</p>');
  });

  it('strikethrough', () => {
    assert.equal(parse('~~deleted~~'), '<p><del>deleted</del></p>');
  });
});

describe('Links and images', () => {
  it('link', () => {
    assert.equal(parse('[Google](https://google.com)'), '<p><a href="https://google.com">Google</a></p>');
  });

  it('image', () => {
    assert.equal(parse('![alt](img.png)'), '<p><img src="img.png" alt="alt"></p>');
  });
});

describe('Lists', () => {
  it('unordered list', () => {
    const result = parse('- Item 1\n- Item 2\n- Item 3');
    assert.ok(result.includes('<ul>'));
    assert.ok(result.includes('<li>Item 1</li>'));
    assert.ok(result.includes('<li>Item 2</li>'));
    assert.ok(result.includes('</ul>'));
  });

  it('ordered list', () => {
    const result = parse('1. First\n2. Second');
    assert.ok(result.includes('<ol>'));
    assert.ok(result.includes('<li>First</li>'));
    assert.ok(result.includes('</ol>'));
  });
});

describe('Blockquotes', () => {
  it('single line', () => {
    assert.ok(parse('> Quote').includes('<blockquote>'));
    assert.ok(parse('> Quote').includes('Quote'));
  });

  it('multi-line', () => {
    const result = parse('> Line 1\n> Line 2');
    assert.ok(result.includes('<blockquote>'));
  });
});

describe('Code blocks', () => {
  it('fenced code block', () => {
    const result = parse('```js\nconst x = 1;\n```');
    assert.ok(result.includes('<pre><code class="language-js">'));
    assert.ok(result.includes('const x = 1;'));
    assert.ok(result.includes('</code></pre>'));
  });

  it('escapes HTML in code blocks', () => {
    const result = parse('```\n<div>\n```');
    assert.ok(result.includes('&lt;div&gt;'));
  });
});

describe('Horizontal rules', () => {
  it('--- makes hr', () => {
    assert.equal(parse('---'), '<hr>');
  });

  it('*** makes hr', () => {
    assert.equal(parse('***'), '<hr>');
  });
});

describe('Mixed content', () => {
  it('heading then paragraph', () => {
    const result = parse('# Title\n\nSome text');
    assert.ok(result.includes('<h1>Title</h1>'));
    assert.ok(result.includes('<p>Some text</p>'));
  });

  it('paragraph with inline formatting', () => {
    const result = parse('This is **bold** and *italic* with `code`');
    assert.ok(result.includes('<strong>bold</strong>'));
    assert.ok(result.includes('<em>italic</em>'));
    assert.ok(result.includes('<code>code</code>'));
  });
});
