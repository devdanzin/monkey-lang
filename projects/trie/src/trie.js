// Trie — prefix tree for autocomplete, word lookup, prefix search

class TrieNode {
  constructor() { this.children = new Map(); this.isEnd = false; this.value = undefined; this.count = 0; }
}

export class Trie {
  constructor() { this.root = new TrieNode(); this._size = 0; }
  get size() { return this._size; }
  get isEmpty() { return this._size === 0; }

  // Insert word (optionally with value)
  insert(word, value = true) {
    let node = this.root;
    for (const ch of word) {
      if (!node.children.has(ch)) node.children.set(ch, new TrieNode());
      node = node.children.get(ch);
      node.count++;
    }
    if (!node.isEnd) this._size++;
    node.isEnd = true;
    node.value = value;
    return this;
  }

  // Search for exact word
  search(word) {
    const node = this._traverse(word);
    return node?.isEnd ? node.value : undefined;
  }

  has(word) {
    const node = this._traverse(word);
    return node ? node.isEnd : false;
  }

  // Check if any word starts with prefix
  startsWith(prefix) {
    return this._traverse(prefix) !== null;
  }

  // Get all words with given prefix
  autocomplete(prefix, limit = 10) {
    const node = this._traverse(prefix);
    if (!node) return [];
    const results = [];
    this._collect(node, prefix, results, limit);
    return results;
  }

  // Delete word
  delete(word) {
    if (!this.has(word)) return false;
    let node = this.root;
    for (const ch of word) {
      node = node.children.get(ch);
      node.count--;
    }
    node.isEnd = false;
    node.value = undefined;
    this._size--;
    // Cleanup empty branches
    this._cleanup(this.root, word, 0);
    return true;
  }

  // Count words with given prefix
  countPrefix(prefix) {
    const node = this._traverse(prefix);
    return node ? node.count : 0;
  }

  // Get all words
  words() {
    const results = [];
    this._collect(this.root, '', results, Infinity);
    return results;
  }

  // Longest common prefix
  longestCommonPrefix() {
    let prefix = '';
    let node = this.root;
    while (node.children.size === 1 && !node.isEnd) {
      const [ch, child] = [...node.children.entries()][0];
      prefix += ch;
      node = child;
    }
    return prefix;
  }

  // Clear
  clear() { this.root = new TrieNode(); this._size = 0; }

  // Internal: traverse to node at end of prefix
  _traverse(prefix) {
    let node = this.root;
    for (const ch of prefix) {
      if (!node.children.has(ch)) return null;
      node = node.children.get(ch);
    }
    return node;
  }

  // Internal: collect all words from a node
  _collect(node, prefix, results, limit) {
    if (results.length >= limit) return;
    if (node.isEnd) results.push(prefix);
    for (const [ch, child] of node.children) {
      this._collect(child, prefix + ch, results, limit);
    }
  }

  // Internal: remove empty branches
  _cleanup(node, word, depth) {
    if (depth === word.length) return;
    const ch = word[depth];
    const child = node.children.get(ch);
    if (!child) return;
    this._cleanup(child, word, depth + 1);
    if (!child.isEnd && child.children.size === 0) {
      node.children.delete(ch);
    }
  }
}
