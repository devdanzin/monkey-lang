// Virtual DOM — create, diff, patch
// Inspired by React's reconciliation algorithm

// ===== VNode creation =====
export function h(type, props = {}, ...children) {
  // Flatten and normalize children
  const flatChildren = children.flat(Infinity).map(child => {
    if (child == null || typeof child === 'boolean') return null;
    if (typeof child === 'string' || typeof child === 'number') return String(child);
    return child;
  }).filter(c => c !== null);

  return { type, props: props || {}, children: flatChildren };
}

// ===== Render VNode to real DOM =====
export function createElement(vnode) {
  if (typeof vnode === 'string') {
    return document.createTextNode(vnode);
  }

  const el = document.createElement(vnode.type);

  // Set props
  for (const [key, value] of Object.entries(vnode.props)) {
    setProp(el, key, value);
  }

  // Append children
  for (const child of vnode.children) {
    el.appendChild(createElement(child));
  }

  return el;
}

function setProp(el, key, value) {
  if (key === 'className') {
    el.setAttribute('class', value);
  } else if (key === 'style' && typeof value === 'object') {
    Object.assign(el.style, value);
  } else if (key.startsWith('on') && typeof value === 'function') {
    const event = key.slice(2).toLowerCase();
    el.addEventListener(event, value);
  } else if (key === 'ref' && typeof value === 'function') {
    value(el);
  } else if (typeof value === 'boolean') {
    if (value) el.setAttribute(key, '');
    else el.removeAttribute(key);
  } else {
    el.setAttribute(key, value);
  }
}

function removeProp(el, key, value) {
  if (key.startsWith('on') && typeof value === 'function') {
    el.removeEventListener(key.slice(2).toLowerCase(), value);
  } else {
    el.removeAttribute(key === 'className' ? 'class' : key);
  }
}

// ===== Diff =====
// Returns a list of patches to apply
export function diff(oldTree, newTree) {
  // Both null
  if (!oldTree && !newTree) return { type: 'NONE' };

  // Added
  if (!oldTree) return { type: 'CREATE', newTree };

  // Removed
  if (!newTree) return { type: 'REMOVE' };

  // Text nodes
  if (typeof oldTree === 'string' || typeof newTree === 'string') {
    if (oldTree !== newTree) return { type: 'REPLACE', newTree };
    return { type: 'NONE' };
  }

  // Different element types
  if (oldTree.type !== newTree.type) {
    return { type: 'REPLACE', newTree };
  }

  // Same type — diff props and children
  const propPatches = diffProps(oldTree.props, newTree.props);
  const childPatches = diffChildren(oldTree.children, newTree.children);

  if (propPatches.length === 0 && childPatches.every(p => p.type === 'NONE')) {
    return { type: 'NONE' };
  }

  return { type: 'UPDATE', propPatches, childPatches };
}

function diffProps(oldProps, newProps) {
  const patches = [];
  const allKeys = new Set([...Object.keys(oldProps), ...Object.keys(newProps)]);

  for (const key of allKeys) {
    const oldVal = oldProps[key];
    const newVal = newProps[key];

    if (newVal === undefined) {
      patches.push({ type: 'REMOVE', key, value: oldVal });
    } else if (oldVal !== newVal) {
      patches.push({ type: 'SET', key, value: newVal });
    }
  }

  return patches;
}

function diffChildren(oldChildren, newChildren) {
  const patches = [];
  const maxLen = Math.max(oldChildren.length, newChildren.length);

  for (let i = 0; i < maxLen; i++) {
    patches.push(diff(oldChildren[i], newChildren[i]));
  }

  return patches;
}

// ===== Patch =====
// Apply patches to real DOM
export function patch(parent, patches, index = 0) {
  const el = parent.childNodes[index];

  switch (patches.type) {
    case 'NONE':
      return;

    case 'CREATE': {
      const newEl = createElement(patches.newTree);
      parent.appendChild(newEl);
      return;
    }

    case 'REMOVE': {
      if (el) parent.removeChild(el);
      return;
    }

    case 'REPLACE': {
      const newEl = createElement(patches.newTree);
      if (el) parent.replaceChild(newEl, el);
      else parent.appendChild(newEl);
      return;
    }

    case 'UPDATE': {
      // Apply prop patches
      for (const p of patches.propPatches) {
        if (p.type === 'SET') setProp(el, p.key, p.value);
        else if (p.type === 'REMOVE') removeProp(el, p.key, p.value);
      }

      // Apply child patches
      // Process removals from end to preserve indices
      for (let i = patches.childPatches.length - 1; i >= 0; i--) {
        if (patches.childPatches[i].type === 'REMOVE') {
          patch(el, patches.childPatches[i], i);
        }
      }

      // Process creates and updates
      for (let i = 0; i < patches.childPatches.length; i++) {
        if (patches.childPatches[i].type !== 'REMOVE') {
          patch(el, patches.childPatches[i], i);
        }
      }
      return;
    }
  }
}

// ===== Component helper =====
export function mount(rootEl, renderFn) {
  let currentTree = null;

  function update(state) {
    const newTree = renderFn(state);
    if (currentTree) {
      const patches = diff(currentTree, newTree);
      patch(rootEl, patches, 0);
    } else {
      rootEl.appendChild(createElement(newTree));
    }
    currentTree = newTree;
  }

  return { update };
}
