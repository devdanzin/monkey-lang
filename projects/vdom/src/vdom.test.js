import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { h, createElement, createTextNode, diff, PATCH, SimulatedDOM, Component, useState, renderToString } from './vdom.js';

describe('createElement', () => {
  it('creates element vnode', () => {
    const node = h('div', { id: 'app' }, 'Hello');
    assert.equal(node.type, 'div');
    assert.equal(node.props.id, 'app');
    assert.equal(node.children.length, 1);
  });

  it('flattens children', () => {
    const node = h('ul', null, [h('li', null, '1'), h('li', null, '2')]);
    assert.equal(node.children.length, 2);
  });

  it('wraps text in text nodes', () => {
    const node = h('p', null, 'text');
    assert.equal(node.children[0].type, 'TEXT');
    assert.equal(node.children[0].props.nodeValue, 'text');
  });

  it('filters null children', () => {
    const node = h('div', null, null, 'visible', false);
    assert.equal(node.children.length, 1);
  });
});

describe('Diff Algorithm', () => {
  it('no changes', () => {
    const old = h('div', null, 'hello');
    const patches = diff(old, old);
    assert.equal(patches.length, 0);
  });

  it('detects text change', () => {
    const old = h('p', null, 'old');
    const newNode = h('p', null, 'new');
    const patches = diff(old, newNode);
    assert.ok(patches.some(p => p.type === PATCH.UPDATE_TEXT));
  });

  it('detects element replacement', () => {
    const old = h('div');
    const newNode = h('span');
    const patches = diff(old, newNode);
    assert.ok(patches.some(p => p.type === PATCH.REPLACE));
  });

  it('detects prop change', () => {
    const old = h('div', { className: 'old' });
    const newNode = h('div', { className: 'new' });
    const patches = diff(old, newNode);
    assert.ok(patches.some(p => p.type === PATCH.UPDATE_PROPS));
  });

  it('detects prop removal', () => {
    const old = h('div', { id: 'x', className: 'y' });
    const newNode = h('div', { id: 'x' });
    const patches = diff(old, newNode);
    const propPatch = patches.find(p => p.type === PATCH.UPDATE_PROPS);
    assert.ok(propPatch.props.some(p => p.key === 'className' && p.action === 'remove'));
  });

  it('detects child addition', () => {
    const old = h('ul', null, h('li', null, '1'));
    const newNode = h('ul', null, h('li', null, '1'), h('li', null, '2'));
    const patches = diff(old, newNode);
    assert.ok(patches.some(p => p.type === PATCH.CREATE));
  });

  it('detects child removal', () => {
    const old = h('ul', null, h('li', null, '1'), h('li', null, '2'));
    const newNode = h('ul', null, h('li', null, '1'));
    const patches = diff(old, newNode);
    assert.ok(patches.some(p => p.type === PATCH.REMOVE));
  });

  it('handles null to node', () => {
    const patches = diff(null, h('div'));
    assert.ok(patches.some(p => p.type === PATCH.CREATE));
  });

  it('handles node to null', () => {
    const patches = diff(h('div'), null);
    assert.ok(patches.some(p => p.type === PATCH.REMOVE));
  });

  it('nested changes', () => {
    const old = h('div', null, h('p', null, 'old'));
    const newNode = h('div', null, h('p', null, 'new'));
    const patches = diff(old, newNode);
    assert.ok(patches.some(p => p.type === PATCH.UPDATE_TEXT));
    assert.ok(patches.some(p => p.path.length > 1)); // nested path
  });
});

describe('SimulatedDOM', () => {
  it('renders vnode', () => {
    const dom = new SimulatedDOM();
    dom.render(h('div', { id: 'app' }, 'Hello'));
    assert.equal(dom.root.tag, 'div');
    assert.equal(dom.root.props.id, 'app');
    assert.equal(dom.root.children[0].text, 'Hello');
  });

  it('applies CREATE patch', () => {
    const dom = new SimulatedDOM();
    dom.render(h('ul'));
    dom.applyPatches([{ type: PATCH.CREATE, path: [0], node: h('li', null, 'item') }]);
    assert.equal(dom.root.children.length, 1);
  });

  it('applies UPDATE_TEXT patch', () => {
    const dom = new SimulatedDOM();
    dom.render(h('p', null, 'old'));
    dom.applyPatches([{ type: PATCH.UPDATE_TEXT, path: [0], text: 'new' }]);
    assert.equal(dom.root.children[0].text, 'new');
  });

  it('applies UPDATE_PROPS patch', () => {
    const dom = new SimulatedDOM();
    dom.render(h('div', { className: 'old' }));
    dom.applyPatches([{
      type: PATCH.UPDATE_PROPS, path: [],
      props: [{ key: 'className', value: 'new', action: 'set' }]
    }]);
    assert.equal(dom.root.props.className, 'new');
  });

  it('full diff + patch cycle', () => {
    const dom = new SimulatedDOM();
    const old = h('div', { id: 'app' }, h('h1', null, 'Old Title'), h('p', null, 'Old text'));
    dom.render(old);

    const updated = h('div', { id: 'app' }, h('h1', null, 'New Title'), h('p', null, 'New text'));
    const patches = diff(old, updated);
    dom.applyPatches(patches);

    assert.equal(dom.root.children[0].children[0].text, 'New Title');
    assert.equal(dom.root.children[1].children[0].text, 'New text');
  });
});

describe('Component Model', () => {
  it('renders component', () => {
    class App extends Component {
      render() { return h('div', null, 'Hello ', this.props.name); }
    }
    const app = new App({ name: 'World' });
    const vdom = app.mount();
    assert.equal(vdom.type, 'div');
  });

  it('setState triggers re-render', () => {
    class Counter extends Component {
      constructor() { super(); this.state = { count: 0 }; }
      render() { return h('span', null, String(this.state.count)); }
    }
    const counter = new Counter();
    counter.mount();
    counter.setState({ count: 42 });
    assert.equal(counter._vdom.children[0].props.nodeValue, '42');
  });

  it('setState with updater function', () => {
    class Counter extends Component {
      constructor() { super(); this.state = { count: 10 }; }
      render() { return h('span', null, String(this.state.count)); }
    }
    const counter = new Counter();
    counter.mount();
    counter.setState(prev => ({ count: prev.count + 1 }));
    assert.equal(counter.state.count, 11);
  });
});

describe('renderToString', () => {
  it('renders simple element', () => {
    assert.equal(renderToString(h('div')), '<div></div>');
  });

  it('renders with props', () => {
    assert.equal(renderToString(h('div', { id: 'app' })), '<div id="app"></div>');
  });

  it('renders with className', () => {
    assert.equal(renderToString(h('div', { className: 'container' })), '<div class="container"></div>');
  });

  it('renders text content', () => {
    assert.equal(renderToString(h('p', null, 'Hello')), '<p>Hello</p>');
  });

  it('renders nested elements', () => {
    const html = renderToString(h('ul', null, h('li', null, '1'), h('li', null, '2')));
    assert.equal(html, '<ul><li>1</li><li>2</li></ul>');
  });

  it('renders self-closing tags', () => {
    assert.equal(renderToString(h('br')), '<br />');
    assert.equal(renderToString(h('img', { src: 'pic.jpg' })), '<img src="pic.jpg" />');
  });

  it('escapes HTML in text', () => {
    assert.equal(renderToString(h('p', null, '<script>')), '<p>&lt;script&gt;</p>');
  });

  it('renders complex tree', () => {
    const tree = h('div', { id: 'app' },
      h('h1', null, 'Title'),
      h('ul', null,
        h('li', null, 'Item 1'),
        h('li', null, 'Item 2'),
      ),
      h('br'),
    );
    const html = renderToString(tree);
    assert.ok(html.includes('<h1>Title</h1>'));
    assert.ok(html.includes('<li>Item 1</li>'));
    assert.ok(html.includes('<br />'));
  });
});
