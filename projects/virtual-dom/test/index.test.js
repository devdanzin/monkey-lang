import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { h, VNode, VText, diff, PatchType, renderToString, applyPatches } from '../src/index.js';

describe('VNode creation', () => {
  it('h creates element', () => {
    const node = h('div', { id: 'app' }, 'hello');
    assert.ok(node instanceof VNode);
    assert.equal(node.tag, 'div');
    assert.equal(node.props.id, 'app');
    assert.equal(node.children.length, 1);
  });

  it('h creates text children', () => {
    const node = h('p', null, 'hello', ' ', 'world');
    assert.equal(node.children.length, 3);
    assert.ok(node.children[0] instanceof VText);
  });

  it('h nests elements', () => {
    const node = h('div', null, h('span', null, 'hi'));
    assert.ok(node.children[0] instanceof VNode);
    assert.equal(node.children[0].tag, 'span');
  });

  it('h flattens arrays', () => {
    const items = ['a', 'b', 'c'];
    const node = h('ul', null, items.map(i => h('li', null, i)));
    assert.equal(node.children.length, 3);
  });

  it('h filters null/false', () => {
    const node = h('div', null, null, false, 'visible');
    assert.equal(node.children.length, 1);
  });
});

describe('renderToString', () => {
  it('renders element', () => {
    assert.equal(renderToString(h('div', null)), '<div></div>');
  });

  it('renders with attributes', () => {
    assert.equal(renderToString(h('div', { id: 'app', class: 'main' })), 
      '<div id="app" class="main"></div>');
  });

  it('renders nested', () => {
    const tree = h('div', null, h('span', null, 'hello'));
    assert.equal(renderToString(tree), '<div><span>hello</span></div>');
  });

  it('renders self-closing', () => {
    assert.equal(renderToString(h('br', null)), '<br />');
    assert.equal(renderToString(h('img', { src: 'x.png' })), '<img src="x.png" />');
  });

  it('escapes HTML', () => {
    assert.equal(renderToString(h('div', null, '<script>alert(1)</script>')),
      '<div>&lt;script&gt;alert(1)&lt;/script&gt;</div>');
  });

  it('skips event handlers', () => {
    const tree = h('button', { onClick: () => {}, class: 'btn' }, 'click');
    const html = renderToString(tree);
    assert.ok(!html.includes('onClick'));
    assert.ok(html.includes('class="btn"'));
  });

  it('complex tree', () => {
    const tree = h('html', null,
      h('head', null, h('title', null, 'Test')),
      h('body', null, h('h1', null, 'Hello'), h('p', null, 'World'))
    );
    assert.equal(renderToString(tree),
      '<html><head><title>Test</title></head><body><h1>Hello</h1><p>World</p></body></html>');
  });
});

describe('diff — no changes', () => {
  it('identical trees produce no patches', () => {
    const tree = h('div', { id: 'app' }, 'hello');
    assert.equal(diff(tree, tree).length, 0);
  });

  it('equal trees produce no patches', () => {
    const a = h('div', { class: 'x' }, 'hi');
    const b = h('div', { class: 'x' }, 'hi');
    assert.equal(diff(a, b).length, 0);
  });
});

describe('diff — text changes', () => {
  it('detects text update', () => {
    const a = h('div', null, 'old');
    const b = h('div', null, 'new');
    const patches = diff(a, b);
    assert.ok(patches.some(p => p.type === PatchType.UPDATE_TEXT));
  });
});

describe('diff — prop changes', () => {
  it('detects added prop', () => {
    const a = h('div', {});
    const b = h('div', { class: 'new' });
    const patches = diff(a, b);
    assert.ok(patches.some(p => p.type === PatchType.UPDATE_PROPS && p.props.class === 'new'));
  });

  it('detects removed prop', () => {
    const a = h('div', { class: 'old' });
    const b = h('div', {});
    const patches = diff(a, b);
    assert.ok(patches.some(p => p.type === PatchType.UPDATE_PROPS && p.props.class === null));
  });

  it('detects changed prop', () => {
    const a = h('div', { class: 'old' });
    const b = h('div', { class: 'new' });
    const patches = diff(a, b);
    assert.ok(patches.some(p => p.type === PatchType.UPDATE_PROPS));
  });
});

describe('diff — structural changes', () => {
  it('detects tag change', () => {
    const a = h('div', null, 'hi');
    const b = h('span', null, 'hi');
    const patches = diff(a, b);
    assert.ok(patches.some(p => p.type === PatchType.REPLACE));
  });

  it('detects child added', () => {
    const a = h('div', null, 'one');
    const b = h('div', null, 'one', 'two');
    const patches = diff(a, b);
    assert.ok(patches.some(p => p.type === PatchType.CREATE));
  });

  it('detects child removed', () => {
    const a = h('div', null, 'one', 'two');
    const b = h('div', null, 'one');
    const patches = diff(a, b);
    assert.ok(patches.some(p => p.type === PatchType.REMOVE));
  });
});

describe('applyPatches', () => {
  it('applies text update', () => {
    const a = h('div', null, 'old');
    const b = h('div', null, 'new');
    const patches = diff(a, b);
    const result = applyPatches(a, patches);
    assert.equal(renderToString(result), '<div>new</div>');
  });

  it('applies prop update', () => {
    const a = h('div', { class: 'old' });
    const b = h('div', { class: 'new' });
    const patches = diff(a, b);
    const result = applyPatches(a, patches);
    assert.equal(renderToString(result), '<div class="new"></div>');
  });

  it('round-trip: diff + apply = target', () => {
    const a = h('div', { id: 'app' },
      h('h1', null, 'Old Title'),
      h('p', { class: 'text' }, 'Old content')
    );
    const b = h('div', { id: 'app' },
      h('h1', null, 'New Title'),
      h('p', { class: 'updated' }, 'New content'),
      h('footer', null, 'Added')
    );
    const patches = diff(a, b);
    const result = applyPatches(a, patches);
    assert.equal(renderToString(result), renderToString(b));
  });
});
