const { test } = require('node:test');
const assert = require('node:assert/strict');
const { compile, render, html, escapeHtml } = require('../src/index.js');

test('basic interpolation', () => {
  assert.equal(render('Hello {{name}}!', { name: 'World' }), 'Hello World!');
});

test('dot notation', () => {
  assert.equal(render('{{user.name}}', { user: { name: 'Alice' } }), 'Alice');
});

test('filters', () => {
  assert.equal(render('{{name | upper}}', { name: 'hello' }), 'HELLO');
  assert.equal(render('{{name | capitalize}}', { name: 'hello' }), 'Hello');
  assert.equal(render('{{price | currency}}', { price: 42 }), '$42.00');
});

test('chained filters', () => {
  assert.equal(render('{{name | trim | upper}}', { name: '  hello  ' }), 'HELLO');
});

test('HTML escaping', () => {
  assert.equal(render('{{text}}', { text: '<b>bold</b>' }), '&lt;b&gt;bold&lt;/b&gt;');
});

test('raw output', () => {
  assert.equal(render('{{{html}}}', { html: '<b>bold</b>' }), '<b>bold</b>');
});

test('if block', () => {
  const tpl = '{{#if show}}visible{{/if}}';
  assert.equal(render(tpl, { show: true }), 'visible');
  assert.equal(render(tpl, { show: false }), '');
});

test('if/else', () => {
  const tpl = '{{#if logged}}Hi!{{else}}Login{{/if}}';
  assert.equal(render(tpl, { logged: true }), 'Hi!');
  assert.equal(render(tpl, { logged: false }), 'Login');
});

test('each loop', () => {
  const tpl = '{{#each items}}{{.}},{{/each}}';
  assert.equal(render(tpl, { items: ['a', 'b', 'c'] }), 'a,b,c,');
});

test('each with objects', () => {
  const tpl = '{{#each users}}{{name}} {{/each}}';
  assert.equal(render(tpl, { users: [{ name: 'A' }, { name: 'B' }] }), 'A B ');
});

test('partials', () => {
  const tpl = 'Header: {{> header}}';
  assert.equal(render(tpl, { title: 'Hi' }, { partials: { header: '{{title}}' } }), 'Header: Hi');
});

test('missing values → empty string', () => {
  assert.equal(render('{{missing}}', {}), '');
});

test('tagged template', () => {
  const name = '<script>alert(1)</script>';
  assert.equal(html`Hello ${name}!`, 'Hello &lt;script&gt;alert(1)&lt;/script&gt;!');
});

test('compile returns reusable function', () => {
  const fn = compile('Hello {{name}}!');
  assert.equal(fn({ name: 'A' }), 'Hello A!');
  assert.equal(fn({ name: 'B' }), 'Hello B!');
});

test('custom filters', () => {
  const result = render('{{n | double}}', { n: 5 }, { filters: { double: v => v * 2 } });
  assert.equal(result, '10');
});
