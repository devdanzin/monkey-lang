import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { render, TemplateEngine } from '../src/index.js';

describe('Template — variables', () => {
  it('interpolates variable', () => {
    assert.equal(render('Hello {{name}}!', { name: 'World' }), 'Hello World!');
  });

  it('nested path', () => {
    assert.equal(render('{{user.name}}', { user: { name: 'Alice' } }), 'Alice');
  });

  it('escapes HTML', () => {
    assert.equal(render('{{html}}', { html: '<b>bold</b>' }), '&lt;b&gt;bold&lt;/b&gt;');
  });

  it('unescaped with triple braces', () => {
    assert.equal(render('{{{html}}}', { html: '<b>bold</b>' }), '<b>bold</b>');
  });

  it('unescaped with ampersand', () => {
    assert.equal(render('{{& html}}', { html: '<em>hi</em>' }), '<em>hi</em>');
  });

  it('missing variable → empty', () => {
    assert.equal(render('{{missing}}', {}), '');
  });
});

describe('Template — conditionals', () => {
  it('truthy section renders', () => {
    assert.equal(render('{{#show}}visible{{/show}}', { show: true }), 'visible');
  });

  it('falsy section hidden', () => {
    assert.equal(render('{{#show}}visible{{/show}}', { show: false }), '');
  });

  it('inverted section', () => {
    assert.equal(render('{{^items}}No items{{/items}}', { items: [] }), 'No items');
  });

  it('inverted section hidden when truthy', () => {
    assert.equal(render('{{^show}}hidden{{/show}}', { show: true }), '');
  });
});

describe('Template — loops', () => {
  it('iterates array of objects', () => {
    const result = render('{{#items}}{{name}} {{/items}}', {
      items: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
    });
    assert.equal(result.trim(), 'A B C');
  });

  it('iterates array of primitives', () => {
    const result = render('{{#items}}{{.}} {{/items}}', {
      items: [1, 2, 3],
    });
    assert.equal(result.trim(), '1 2 3');
  });

  it('provides @index', () => {
    const result = render('{{#items}}{{@index}} {{/items}}', { items: ['a', 'b', 'c'] });
    assert.equal(result.trim(), '0 1 2');
  });

  it('empty array → nothing', () => {
    assert.equal(render('{{#items}}x{{/items}}', { items: [] }), '');
  });
});

describe('Template — partials', () => {
  it('renders partial', () => {
    const result = render('Header: {{> header}}', { title: 'Hi' }, {
      partials: { header: '{{title}}' },
    });
    assert.equal(result, 'Header: Hi');
  });
});

describe('Template — helpers', () => {
  it('calls helper', () => {
    const result = render('{{upper name}}', { name: 'hello' }, {
      helpers: { upper: (str) => String(str).toUpperCase() },
    });
    assert.equal(result, 'HELLO');
  });
});

describe('Template — complex', () => {
  it('renders a full page', () => {
    const template = `
<h1>{{title}}</h1>
{{#items}}<li>{{name}}: {{price}}</li>
{{/items}}
{{^items}}<p>No items</p>{{/items}}`;

    const result = render(template, {
      title: 'Shop',
      items: [{ name: 'Widget', price: 9.99 }, { name: 'Gadget', price: 19.99 }],
    });

    assert.ok(result.includes('<h1>Shop</h1>'));
    assert.ok(result.includes('Widget: 9.99'));
    assert.ok(result.includes('Gadget: 19.99'));
    assert.ok(!result.includes('No items'));
  });
});
