import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { h, diff } from '../src/index.js';

// Test the h() function and diff algorithm (no DOM needed)

describe('h() — VNode creation', () => {
  it('creates element vnode', () => {
    const node = h('div', { id: 'app' }, 'Hello');
    assert.equal(node.type, 'div');
    assert.equal(node.props.id, 'app');
    assert.deepEqual(node.children, ['Hello']);
  });

  it('handles null props', () => {
    const node = h('span', null, 'text');
    assert.deepEqual(node.props, {});
  });

  it('flattens nested children', () => {
    const node = h('ul', {}, [h('li', {}, '1'), h('li', {}, '2')]);
    assert.equal(node.children.length, 2);
  });

  it('filters null/boolean children', () => {
    const node = h('div', {}, null, false, 'text', true, undefined);
    assert.deepEqual(node.children, ['text']);
  });

  it('converts numbers to strings', () => {
    const node = h('span', {}, 42);
    assert.deepEqual(node.children, ['42']);
  });

  it('nested elements', () => {
    const node = h('div', {},
      h('h1', {}, 'Title'),
      h('p', { className: 'text' }, 'Content')
    );
    assert.equal(node.children.length, 2);
    assert.equal(node.children[0].type, 'h1');
    assert.equal(node.children[1].props.className, 'text');
  });
});

describe('diff — same types', () => {
  it('identical vnodes → NONE', () => {
    const a = h('div', { id: 'x' }, 'text');
    const b = h('div', { id: 'x' }, 'text');
    assert.equal(diff(a, b).type, 'NONE');
  });

  it('text change → UPDATE', () => {
    const a = h('div', {}, 'old');
    const b = h('div', {}, 'new');
    const d = diff(a, b);
    assert.equal(d.type, 'UPDATE');
  });

  it('prop change → UPDATE with prop patches', () => {
    const a = h('div', { id: 'a', className: 'old' });
    const b = h('div', { id: 'a', className: 'new' });
    const d = diff(a, b);
    assert.equal(d.type, 'UPDATE');
    assert.equal(d.propPatches.length, 1);
    assert.equal(d.propPatches[0].key, 'className');
    assert.equal(d.propPatches[0].value, 'new');
  });

  it('prop added', () => {
    const a = h('div', {});
    const b = h('div', { title: 'hello' });
    const d = diff(a, b);
    assert.equal(d.propPatches[0].type, 'SET');
    assert.equal(d.propPatches[0].key, 'title');
  });

  it('prop removed', () => {
    const a = h('div', { title: 'hello' });
    const b = h('div', {});
    const d = diff(a, b);
    assert.equal(d.propPatches[0].type, 'REMOVE');
    assert.equal(d.propPatches[0].key, 'title');
  });
});

describe('diff — different types', () => {
  it('different element → REPLACE', () => {
    const a = h('div', {});
    const b = h('span', {});
    assert.equal(diff(a, b).type, 'REPLACE');
  });

  it('text vs element → REPLACE', () => {
    assert.equal(diff('text', h('div')).type, 'REPLACE');
  });

  it('element vs text → REPLACE', () => {
    assert.equal(diff(h('div'), 'text').type, 'REPLACE');
  });
});

describe('diff — add/remove', () => {
  it('null → vnode → CREATE', () => {
    const d = diff(null, h('div'));
    assert.equal(d.type, 'CREATE');
  });

  it('vnode → null → REMOVE', () => {
    const d = diff(h('div'), null);
    assert.equal(d.type, 'REMOVE');
  });

  it('null → null → NONE', () => {
    assert.equal(diff(null, null).type, 'NONE');
  });
});

describe('diff — children', () => {
  it('child added', () => {
    const a = h('ul', {}, h('li', {}, '1'));
    const b = h('ul', {}, h('li', {}, '1'), h('li', {}, '2'));
    const d = diff(a, b);
    assert.equal(d.type, 'UPDATE');
    assert.equal(d.childPatches.length, 2);
    assert.equal(d.childPatches[1].type, 'CREATE');
  });

  it('child removed', () => {
    const a = h('ul', {}, h('li', {}, '1'), h('li', {}, '2'));
    const b = h('ul', {}, h('li', {}, '1'));
    const d = diff(a, b);
    assert.equal(d.childPatches[1].type, 'REMOVE');
  });

  it('child text changed', () => {
    const a = h('div', {}, 'old');
    const b = h('div', {}, 'new');
    const d = diff(a, b);
    assert.equal(d.childPatches[0].type, 'REPLACE');
  });
});
