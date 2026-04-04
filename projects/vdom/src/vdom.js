// vdom.js — Virtual DOM with diff/patch and component model

// ===== Virtual Node =====
export function createElement(type, props = {}, ...children) {
  const flatChildren = children.flat(Infinity).map(c =>
    typeof c === 'string' || typeof c === 'number' ? createTextNode(String(c)) : c
  ).filter(c => c != null && c !== false);

  return { type, props: props || {}, children: flatChildren, key: props?.key || null };
}

export function createTextNode(text) {
  return { type: 'TEXT', props: { nodeValue: text }, children: [] };
}

// Shorthand
export const h = createElement;

// ===== Diff Algorithm =====
// Returns a list of patches to transform oldTree into newTree

export const PATCH = {
  CREATE: 'CREATE',
  REMOVE: 'REMOVE',
  REPLACE: 'REPLACE',
  UPDATE_PROPS: 'UPDATE_PROPS',
  UPDATE_TEXT: 'UPDATE_TEXT',
  REORDER: 'REORDER',
};

export function diff(oldNode, newNode, path = []) {
  const patches = [];

  if (!oldNode && newNode) {
    patches.push({ type: PATCH.CREATE, path, node: newNode });
    return patches;
  }

  if (oldNode && !newNode) {
    patches.push({ type: PATCH.REMOVE, path });
    return patches;
  }

  if (!oldNode && !newNode) return patches;

  // Different types → replace
  if (oldNode.type !== newNode.type) {
    patches.push({ type: PATCH.REPLACE, path, node: newNode });
    return patches;
  }

  // Text node update
  if (oldNode.type === 'TEXT') {
    if (oldNode.props.nodeValue !== newNode.props.nodeValue) {
      patches.push({ type: PATCH.UPDATE_TEXT, path, text: newNode.props.nodeValue });
    }
    return patches;
  }

  // Props diff
  const propPatches = diffProps(oldNode.props, newNode.props);
  if (propPatches.length > 0) {
    patches.push({ type: PATCH.UPDATE_PROPS, path, props: propPatches });
  }

  // Children diff
  const maxLen = Math.max(oldNode.children.length, newNode.children.length);
  for (let i = 0; i < maxLen; i++) {
    const childPatches = diff(
      oldNode.children[i] || null,
      newNode.children[i] || null,
      [...path, i]
    );
    patches.push(...childPatches);
  }

  return patches;
}

function diffProps(oldProps, newProps) {
  const patches = [];
  const allKeys = new Set([...Object.keys(oldProps || {}), ...Object.keys(newProps || {})]);

  for (const key of allKeys) {
    if (key === 'key' || key === 'children') continue;
    const oldVal = oldProps?.[key];
    const newVal = newProps?.[key];

    if (oldVal === newVal) continue;
    if (newVal === undefined) {
      patches.push({ key, value: null, action: 'remove' });
    } else {
      patches.push({ key, value: newVal, action: 'set' });
    }
  }

  return patches;
}

// ===== Patch Application (simulated DOM) =====
export class SimulatedDOM {
  constructor() {
    this.root = null;
    this.operations = []; // log of DOM operations
  }

  render(vnode) {
    this.root = this._createNode(vnode);
    this.operations.push({ op: 'render', node: this.root });
    return this.root;
  }

  applyPatches(patches) {
    for (const patch of patches) {
      this.operations.push({ op: patch.type, path: patch.path });
      switch (patch.type) {
        case PATCH.CREATE: this._applyCreate(patch); break;
        case PATCH.REMOVE: this._applyRemove(patch); break;
        case PATCH.REPLACE: this._applyReplace(patch); break;
        case PATCH.UPDATE_PROPS: this._applyUpdateProps(patch); break;
        case PATCH.UPDATE_TEXT: this._applyUpdateText(patch); break;
      }
    }
  }

  _createNode(vnode) {
    if (vnode.type === 'TEXT') return { tag: 'TEXT', text: vnode.props.nodeValue, children: [] };
    return {
      tag: vnode.type,
      props: { ...vnode.props },
      children: vnode.children.map(c => this._createNode(c)),
    };
  }

  _findNode(path) {
    let node = this.root;
    for (const idx of path) {
      if (!node.children[idx]) return null;
      node = node.children[idx];
    }
    return node;
  }

  _findParent(path) {
    if (path.length === 0) return null;
    return this._findNode(path.slice(0, -1));
  }

  _applyCreate(patch) {
    const parent = this._findParent(patch.path);
    const newNode = this._createNode(patch.node);
    if (parent) parent.children.push(newNode);
    else this.root = newNode;
  }

  _applyRemove(patch) {
    const parent = this._findParent(patch.path);
    if (parent) parent.children.splice(patch.path[patch.path.length - 1], 1);
  }

  _applyReplace(patch) {
    const parent = this._findParent(patch.path);
    const newNode = this._createNode(patch.node);
    if (parent) parent.children[patch.path[patch.path.length - 1]] = newNode;
    else this.root = newNode;
  }

  _applyUpdateProps(patch) {
    const node = this._findNode(patch.path);
    if (!node) return;
    for (const { key, value, action } of patch.props) {
      if (action === 'remove') delete node.props[key];
      else node.props[key] = value;
    }
  }

  _applyUpdateText(patch) {
    const node = this._findNode(patch.path);
    if (node) node.text = patch.text;
  }
}

// ===== Component Model =====
let currentComponent = null;
let hookIndex = 0;

export class Component {
  constructor(props = {}) {
    this.props = props;
    this.state = {};
    this.hooks = [];
    this.effects = [];
    this._vdom = null;
  }

  setState(updater) {
    if (typeof updater === 'function') {
      this.state = { ...this.state, ...updater(this.state) };
    } else {
      this.state = { ...this.state, ...updater };
    }
    this._rerender();
  }

  _rerender() {
    const oldVdom = this._vdom;
    hookIndex = 0;
    currentComponent = this;
    this._vdom = this.render();
    currentComponent = null;
    if (oldVdom) {
      this._patches = diff(oldVdom, this._vdom);
    }
  }

  mount() {
    hookIndex = 0;
    currentComponent = this;
    this._vdom = this.render();
    currentComponent = null;
    // Run effects
    for (const effect of this.effects) {
      if (effect.cleanup) effect.cleanup();
      effect.cleanup = effect.fn();
    }
    return this._vdom;
  }

  unmount() {
    for (const effect of this.effects) {
      if (effect.cleanup) effect.cleanup();
    }
  }

  render() { throw new Error('Components must implement render()'); }
}

// ===== Hooks =====
export function useState(initialValue) {
  const comp = currentComponent;
  const idx = hookIndex++;

  if (comp.hooks.length <= idx) {
    comp.hooks.push(typeof initialValue === 'function' ? initialValue() : initialValue);
  }

  const setState = (newValue) => {
    const val = typeof newValue === 'function' ? newValue(comp.hooks[idx]) : newValue;
    if (comp.hooks[idx] !== val) {
      comp.hooks[idx] = val;
      comp._rerender();
    }
  };

  return [comp.hooks[idx], setState];
}

export function useEffect(fn, deps = undefined) {
  const comp = currentComponent;
  const idx = hookIndex++;

  if (comp.hooks.length <= idx) {
    comp.hooks.push({ deps: undefined });
    comp.effects.push({ fn, cleanup: null });
  }

  const prevDeps = comp.hooks[idx].deps;
  const shouldRun = deps === undefined ||
    prevDeps === undefined ||
    deps.some((d, i) => d !== prevDeps[i]);

  if (shouldRun) {
    comp.hooks[idx].deps = deps;
    const effectIdx = comp.effects.findIndex(e => e.fn === fn);
    if (effectIdx >= 0) comp.effects[effectIdx] = { fn, cleanup: null };
    else comp.effects.push({ fn, cleanup: null });
  }
}

// ===== Render to string (SSR) =====
export function renderToString(vnode) {
  if (vnode.type === 'TEXT') return escapeHtml(vnode.props.nodeValue);

  const { type, props, children } = vnode;
  const attrs = Object.entries(props || {})
    .filter(([k]) => k !== 'key' && k !== 'children' && !k.startsWith('on'))
    .map(([k, v]) => {
      if (k === 'className') return ` class="${escapeHtml(v)}"`;
      return ` ${k}="${escapeHtml(String(v))}"`;
    })
    .join('');

  const childHtml = children.map(renderToString).join('');

  const selfClosing = ['br', 'hr', 'img', 'input', 'meta', 'link'];
  if (selfClosing.includes(type)) return `<${type}${attrs} />`;

  return `<${type}${attrs}>${childHtml}</${type}>`;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
