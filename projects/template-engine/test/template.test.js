import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { render, compile, registerFilter } from '../src/index.js';

describe('Variable interpolation', () => {
  it('simple variable', () => {
    assert.equal(render('Hello {{name}}!', { name: 'World' }), 'Hello World!');
  });

  it('dotted path', () => {
    assert.equal(render('{{user.name}}', { user: { name: 'Alice' } }), 'Alice');
  });

  it('missing variable', () => {
    assert.equal(render('Hello {{name}}!', {}), 'Hello !');
  });

  it('escapes HTML', () => {
    assert.equal(render('{{html}}', { html: '<b>bold</b>' }), '&lt;b&gt;bold&lt;/b&gt;');
  });

  it('raw output with triple braces', () => {
    assert.equal(render('{{{html}}}', { html: '<b>bold</b>' }), '<b>bold</b>');
  });
});

describe('If blocks', () => {
  it('truthy condition', () => {
    assert.equal(render('{{#if show}}yes{{/if}}', { show: true }), 'yes');
  });

  it('falsy condition', () => {
    assert.equal(render('{{#if show}}yes{{/if}}', { show: false }), '');
  });

  it('if/else', () => {
    assert.equal(render('{{#if x}}yes{{else}}no{{/if}}', { x: false }), 'no');
  });

  it('empty array is falsy', () => {
    assert.equal(render('{{#if items}}yes{{else}}no{{/if}}', { items: [] }), 'no');
  });
});

describe('Unless blocks', () => {
  it('renders when falsy', () => {
    assert.equal(render('{{#unless done}}pending{{/unless}}', { done: false }), 'pending');
  });

  it('does not render when truthy', () => {
    assert.equal(render('{{#unless done}}pending{{/unless}}', { done: true }), '');
  });
});

describe('Each blocks', () => {
  it('iterates array', () => {
    assert.equal(render('{{#each items}}{{.}} {{/each}}', { items: ['a', 'b', 'c'] }), 'a b c ');
  });

  it('iterates objects in array', () => {
    const data = { users: [{ name: 'Alice' }, { name: 'Bob' }] };
    assert.equal(render('{{#each users}}{{name}} {{/each}}', data), 'Alice Bob ');
  });

  it('@index variable', () => {
    assert.equal(render('{{#each items}}{{@index}}{{/each}}', { items: ['a', 'b'] }), '01');
  });

  it('@first and @last', () => {
    const tpl = '{{#each items}}{{@first}}-{{@last}} {{/each}}';
    assert.equal(render(tpl, { items: ['a', 'b', 'c'] }), 'true-false false-false false-true ');
  });
});

describe('With blocks', () => {
  it('changes context', () => {
    assert.equal(render('{{#with user}}{{name}} ({{age}}){{/with}}', { user: { name: 'Alice', age: 30 } }), 'Alice (30)');
  });
});

describe('Partials', () => {
  it('includes partial template', () => {
    const partials = { header: '<h1>{{title}}</h1>' };
    assert.equal(render('{{> header}}', { title: 'Hello' }, partials), '<h1>Hello</h1>');
  });
});

describe('Comments', () => {
  it('strips comments', () => {
    assert.equal(render('Hello {{! this is a comment }}World', {}), 'Hello World');
  });
});

describe('Filters', () => {
  it('upper', () => {
    assert.equal(render('{{name | upper}}', { name: 'hello' }), 'HELLO');
  });

  it('lower', () => {
    assert.equal(render('{{name | lower}}', { name: 'HELLO' }), 'hello');
  });

  it('capitalize', () => {
    assert.equal(render('{{name | capitalize}}', { name: 'hello' }), 'Hello');
  });

  it('chained filters', () => {
    assert.equal(render('{{name | trim | upper}}', { name: '  hello  ' }), 'HELLO');
  });

  it('custom filter', () => {
    registerFilter('double', v => String(v).repeat(2));
    assert.equal(render('{{x | double}}', { x: 'ha' }), 'haha');
  });
});

describe('compile', () => {
  it('returns reusable render function', () => {
    const tpl = compile('Hello {{name}}!');
    assert.equal(tpl({ name: 'Alice' }), 'Hello Alice!');
    assert.equal(tpl({ name: 'Bob' }), 'Hello Bob!');
  });
});

describe('Complex template', () => {
  it('renders full page', () => {
    const tpl = `<ul>
{{#each users}}
<li>{{name}} - {{#if active}}active{{else}}inactive{{/if}}</li>
{{/each}}
</ul>`;
    const data = { users: [{ name: 'Alice', active: true }, { name: 'Bob', active: false }] };
    const html = render(tpl, data);
    assert.ok(html.includes('Alice - active'));
    assert.ok(html.includes('Bob - inactive'));
  });
});
