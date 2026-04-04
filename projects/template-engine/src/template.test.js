import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compile, escapeHtml } from './template.js';

describe('Template Engine', () => {
  describe('Variables', () => {
    it('interpolates variable', () => {
      assert.equal(compile('Hello {{name}}!')({ name: 'World' }), 'Hello World!');
    });
    it('nested property', () => {
      assert.equal(compile('{{user.name}}')({ user: { name: 'Alice' } }), 'Alice');
    });
    it('missing variable is empty', () => {
      assert.equal(compile('Hi {{name}}')({}), 'Hi ');
    });
    it('escapes HTML by default', () => {
      assert.equal(compile('{{html}}')({ html: '<b>bold</b>' }), '&lt;b&gt;bold&lt;/b&gt;');
    });
    it('raw output with triple braces', () => {
      assert.equal(compile('{{{html}}}')({ html: '<b>bold</b>' }), '<b>bold</b>');
    });
  });

  describe('Conditionals', () => {
    it('#if true', () => {
      assert.equal(compile('{{#if show}}yes{{/if}}')({ show: true }), 'yes');
    });
    it('#if false', () => {
      assert.equal(compile('{{#if show}}yes{{/if}}')({ show: false }), '');
    });
    it('#if with else', () => {
      assert.equal(compile('{{#if show}}yes{{else}}no{{/if}}')({ show: false }), 'no');
    });
    it('#unless', () => {
      assert.equal(compile('{{#unless hidden}}visible{{/unless}}')({ hidden: false }), 'visible');
    });
    it('#if with truthy string', () => {
      assert.equal(compile('{{#if name}}hi {{name}}{{/if}}')({ name: 'Bob' }), 'hi Bob');
    });
    it('#if with empty array is falsy', () => {
      assert.equal(compile('{{#if items}}yes{{else}}no{{/if}}')({ items: [] }), 'no');
    });
  });

  describe('Loops', () => {
    it('#each array', () => {
      const tpl = compile('{{#each items}}{{.}} {{/each}}');
      assert.equal(tpl({ items: ['a', 'b', 'c'] }), 'a b c ');
    });
    it('#each with properties', () => {
      const tpl = compile('{{#each users}}{{name}} {{/each}}');
      assert.equal(tpl({ users: [{ name: 'Alice' }, { name: 'Bob' }] }), 'Alice Bob ');
    });
    it('#each with @index', () => {
      const tpl = compile('{{#each items}}{{@index}}:{{.}} {{/each}}');
      assert.equal(tpl({ items: ['a', 'b'] }), '0:a 1:b ');
    });
    it('#each with @first/@last', () => {
      const tpl = compile('{{#each items}}{{#if @first}}[{{/if}}{{.}}{{#if @last}}]{{/if}}{{/each}}');
      assert.equal(tpl({ items: ['a', 'b', 'c'] }), '[abc]');
    });
    it('#each empty array', () => {
      assert.equal(compile('{{#each items}}x{{/each}}')({ items: [] }), '');
    });
  });

  describe('With', () => {
    it('#with changes context', () => {
      const tpl = compile('{{#with user}}{{name}} ({{age}}){{/with}}');
      assert.equal(tpl({ user: { name: 'Alice', age: 30 } }), 'Alice (30)');
    });
  });

  describe('Comments', () => {
    it('strips comments', () => {
      assert.equal(compile('Hello {{! this is a comment }}World')(), 'Hello World');
    });
  });

  describe('Partials', () => {
    it('includes partial', () => {
      const tpl = compile('Header: {{> header}}');
      assert.equal(tpl({ title: 'Test' }, { header: '{{title}}' }), 'Header: Test');
    });
    it('partial as function', () => {
      const tpl = compile('{{> greeting}}');
      assert.equal(tpl({ name: 'Bob' }, { greeting: (data) => `Hi ${data.name}!` }), 'Hi Bob!');
    });
  });

  describe('HTML Escaping', () => {
    it('escapes &', () => { assert.equal(escapeHtml('a & b'), 'a &amp; b'); });
    it('escapes <>', () => { assert.equal(escapeHtml('<div>'), '&lt;div&gt;'); });
    it('escapes quotes', () => { assert.equal(escapeHtml('"hi"'), '&quot;hi&quot;'); });
  });

  describe('Complex templates', () => {
    it('renders a page', () => {
      const tpl = compile(`
<h1>{{title}}</h1>
<ul>
{{#each items}}
  <li>{{name}} - \${{price}}</li>
{{/each}}
</ul>
{{#if footer}}<footer>{{footer}}</footer>{{/if}}`);
      const result = tpl({
        title: 'Store',
        items: [{ name: 'Widget', price: 9.99 }, { name: 'Gadget', price: 19.99 }],
        footer: '© 2026'
      });
      assert.ok(result.includes('<h1>Store</h1>'));
      assert.ok(result.includes('Widget'));
      assert.ok(result.includes('© 2026'));
    });

    it('nested conditionals and loops', () => {
      const tpl = compile('{{#each users}}{{#if active}}{{name}} {{/if}}{{/each}}');
      assert.equal(tpl({ users: [
        { name: 'Alice', active: true },
        { name: 'Bob', active: false },
        { name: 'Charlie', active: true },
      ] }), 'Alice Charlie ');
    });
  });
});
