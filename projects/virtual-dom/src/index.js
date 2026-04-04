// ===== Virtual DOM =====
// React-like virtual DOM with diff and patch algorithm

// ===== VNode =====

export class VNode {
  constructor(tag, props, children) {
    this.tag = tag;
    this.props = props || {};
    this.children = children || [];
    this.key = this.props.key;
  }
}

export class VText {
  constructor(text) {
    this.text = String(text);
  }
}

// ===== createElement (h function) =====

export function h(tag, props, ...children) {
  const flatChildren = children.flat(Infinity).map(child => {
    if (child instanceof VNode || child instanceof VText) return child;
    if (child == null || child === false) return null;
    return new VText(String(child));
  }).filter(Boolean);
  
  return new VNode(tag, props, flatChildren);
}

// ===== Diff Algorithm =====
// Produces a list of patches that transform oldTree into newTree

export const PatchType = {
  CREATE: 'CREATE',
  REMOVE: 'REMOVE',
  REPLACE: 'REPLACE',
  UPDATE_PROPS: 'UPDATE_PROPS',
  UPDATE_TEXT: 'UPDATE_TEXT',
  REORDER: 'REORDER',
};

export function diff(oldTree, newTree) {
  const patches = [];
  diffNode(oldTree, newTree, patches, []);
  return patches;
}

function diffNode(oldNode, newNode, patches, path) {
  // New node added
  if (!oldNode && newNode) {
    patches.push({ type: PatchType.CREATE, path: [...path], node: newNode });
    return;
  }
  
  // Old node removed
  if (oldNode && !newNode) {
    patches.push({ type: PatchType.REMOVE, path: [...path] });
    return;
  }
  
  // Both are text nodes
  if (oldNode instanceof VText && newNode instanceof VText) {
    if (oldNode.text !== newNode.text) {
      patches.push({ type: PatchType.UPDATE_TEXT, path: [...path], text: newNode.text });
    }
    return;
  }
  
  // Type changed (text↔element or different tags)
  if (
    (oldNode instanceof VText) !== (newNode instanceof VText) ||
    (oldNode instanceof VNode && newNode instanceof VNode && oldNode.tag !== newNode.tag)
  ) {
    patches.push({ type: PatchType.REPLACE, path: [...path], node: newNode });
    return;
  }
  
  // Both are VNodes with same tag — diff props and children
  if (oldNode instanceof VNode && newNode instanceof VNode) {
    const propPatches = diffProps(oldNode.props, newNode.props);
    if (propPatches) {
      patches.push({ type: PatchType.UPDATE_PROPS, path: [...path], props: propPatches });
    }
    
    diffChildren(oldNode.children, newNode.children, patches, path);
  }
}

function diffProps(oldProps, newProps) {
  const patches = {};
  let hasPatches = false;
  
  // Check for changed/added props
  for (const key of Object.keys(newProps)) {
    if (key === 'key') continue;
    if (oldProps[key] !== newProps[key]) {
      patches[key] = newProps[key];
      hasPatches = true;
    }
  }
  
  // Check for removed props
  for (const key of Object.keys(oldProps)) {
    if (key === 'key') continue;
    if (!(key in newProps)) {
      patches[key] = null;
      hasPatches = true;
    }
  }
  
  return hasPatches ? patches : null;
}

function diffChildren(oldChildren, newChildren, patches, parentPath) {
  const maxLen = Math.max(oldChildren.length, newChildren.length);
  
  // If children have keys, do keyed diff
  const oldKeyed = oldChildren.some(c => c instanceof VNode && c.key != null);
  const newKeyed = newChildren.some(c => c instanceof VNode && c.key != null);
  
  if (oldKeyed && newKeyed) {
    diffKeyedChildren(oldChildren, newChildren, patches, parentPath);
    return;
  }
  
  // Simple index-based diff
  for (let i = 0; i < maxLen; i++) {
    diffNode(
      i < oldChildren.length ? oldChildren[i] : null,
      i < newChildren.length ? newChildren[i] : null,
      patches,
      [...parentPath, i]
    );
  }
}

function diffKeyedChildren(oldChildren, newChildren, patches, parentPath) {
  const oldMap = new Map();
  oldChildren.forEach((child, i) => {
    if (child instanceof VNode && child.key != null) {
      oldMap.set(child.key, { child, index: i });
    }
  });
  
  // Track moves and updates
  const moves = [];
  
  for (let i = 0; i < newChildren.length; i++) {
    const newChild = newChildren[i];
    const key = newChild instanceof VNode ? newChild.key : null;
    
    if (key != null && oldMap.has(key)) {
      const old = oldMap.get(key);
      diffNode(old.child, newChild, patches, [...parentPath, i]);
      if (old.index !== i) {
        moves.push({ from: old.index, to: i });
      }
      oldMap.delete(key);
    } else {
      // New child
      diffNode(null, newChild, patches, [...parentPath, i]);
    }
  }
  
  // Remove old children not in new
  for (const [, { index }] of oldMap) {
    patches.push({ type: PatchType.REMOVE, path: [...parentPath, index] });
  }
  
  if (moves.length > 0) {
    patches.push({ type: PatchType.REORDER, path: [...parentPath], moves });
  }
}

// ===== Render to string (SSR-like) =====

export function renderToString(vnode) {
  if (vnode instanceof VText) return escapeHtml(vnode.text);
  if (!vnode) return '';
  
  const { tag, props, children } = vnode;
  const attrs = Object.entries(props)
    .filter(([k]) => k !== 'key' && !k.startsWith('on'))
    .map(([k, v]) => {
      if (v === true) return k;
      if (v === false || v == null) return '';
      return `${k}="${escapeHtml(String(v))}"`;
    })
    .filter(Boolean)
    .join(' ');
  
  const childrenHtml = children.map(renderToString).join('');
  
  // Self-closing tags
  const selfClosing = ['br', 'hr', 'img', 'input', 'meta', 'link'];
  if (selfClosing.includes(tag)) {
    return `<${tag}${attrs ? ' ' + attrs : ''} />`;
  }
  
  return `<${tag}${attrs ? ' ' + attrs : ''}>${childrenHtml}</${tag}>`;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ===== Apply patches (simulated DOM) =====

export function applyPatches(tree, patches) {
  // Returns new tree with patches applied
  let result = cloneTree(tree);
  
  for (const patch of patches) {
    result = applyPatch(result, patch);
  }
  
  return result;
}

function cloneTree(node) {
  if (node instanceof VText) return new VText(node.text);
  if (node instanceof VNode) {
    return new VNode(node.tag, { ...node.props }, node.children.map(cloneTree));
  }
  return node;
}

function getNode(tree, path) {
  let node = tree;
  for (let i = 0; i < path.length - 1; i++) {
    node = node.children[path[i]];
  }
  return { parent: node, index: path[path.length - 1] };
}

function applyPatch(tree, patch) {
  if (patch.path.length === 0) {
    // Root replacement
    if (patch.type === PatchType.REPLACE) return cloneTree(patch.node);
    if (patch.type === PatchType.UPDATE_TEXT) return new VText(patch.text);
    if (patch.type === PatchType.UPDATE_PROPS) {
      const node = tree;
      const newProps = { ...node.props };
      for (const [k, v] of Object.entries(patch.props)) {
        if (v === null) delete newProps[k];
        else newProps[k] = v;
      }
      return new VNode(node.tag, newProps, node.children);
    }
    return tree;
  }
  
  const { parent, index } = getNode(tree, patch.path);
  
  switch (patch.type) {
    case PatchType.CREATE:
      parent.children[index] = cloneTree(patch.node);
      break;
    case PatchType.REMOVE:
      parent.children.splice(index, 1);
      break;
    case PatchType.REPLACE:
      parent.children[index] = cloneTree(patch.node);
      break;
    case PatchType.UPDATE_TEXT:
      parent.children[index] = new VText(patch.text);
      break;
    case PatchType.UPDATE_PROPS: {
      const node = parent.children[index];
      for (const [k, v] of Object.entries(patch.props)) {
        if (v === null) delete node.props[k];
        else node.props[k] = v;
      }
      break;
    }
  }
  
  return tree;
}
