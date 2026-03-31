// Huffman encoding — build tree, encode, decode

class HNode {
  constructor(char, freq, left, right) {
    this.char = char; this.freq = freq; this.left = left; this.right = right;
  }
  get isLeaf() { return !this.left && !this.right; }
}

export function buildTree(text) {
  const freq = new Map();
  for (const ch of text) freq.set(ch, (freq.get(ch) || 0) + 1);

  // Priority queue (simple sorted insert)
  const nodes = [...freq.entries()].map(([ch, f]) => new HNode(ch, f, null, null));
  nodes.sort((a, b) => a.freq - b.freq);

  while (nodes.length > 1) {
    const left = nodes.shift();
    const right = nodes.shift();
    const parent = new HNode(null, left.freq + right.freq, left, right);
    // Insert sorted
    let i = 0;
    while (i < nodes.length && nodes[i].freq <= parent.freq) i++;
    nodes.splice(i, 0, parent);
  }

  return nodes[0] || null;
}

export function buildCodeTable(tree) {
  const codes = {};
  if (!tree) return codes;
  if (tree.isLeaf) { codes[tree.char] = '0'; return codes; }

  function walk(node, code) {
    if (node.isLeaf) { codes[node.char] = code; return; }
    if (node.left) walk(node.left, code + '0');
    if (node.right) walk(node.right, code + '1');
  }
  walk(tree, '');
  return codes;
}

export function encode(text) {
  if (!text) return { encoded: '', tree: null };
  const tree = buildTree(text);
  const codes = buildCodeTable(tree);
  const encoded = [...text].map(ch => codes[ch]).join('');
  return { encoded, tree, codes };
}

export function decode(encoded, tree) {
  if (!tree || !encoded) return '';
  if (tree.isLeaf) return tree.char.repeat(encoded.length);

  let result = '';
  let node = tree;
  for (const bit of encoded) {
    node = bit === '0' ? node.left : node.right;
    if (node.isLeaf) { result += node.char; node = tree; }
  }
  return result;
}

export function compressionRatio(text) {
  if (!text) return 0;
  const { encoded } = encode(text);
  const originalBits = text.length * 8;
  return 1 - encoded.length / originalBits;
}
