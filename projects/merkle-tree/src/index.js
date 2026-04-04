// ===== Merkle Tree =====
// Hash tree for efficient data verification

import { createHash } from 'node:crypto';

function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

class MerkleNode {
  constructor(hash, left = null, right = null, data = null) {
    this.hash = hash;
    this.left = left;
    this.right = right;
    this.data = data;
    this.isLeaf = left === null && right === null;
  }
}

export class MerkleTree {
  constructor(data, hashFn = sha256) {
    this.hashFn = hashFn;
    this.leaves = data.map(d => new MerkleNode(hashFn(String(d)), null, null, d));
    this.root = this._build(this.leaves);
  }

  _build(nodes) {
    if (nodes.length === 0) return new MerkleNode(this.hashFn(''));
    if (nodes.length === 1) return nodes[0];

    const next = [];
    for (let i = 0; i < nodes.length; i += 2) {
      const left = nodes[i];
      const right = i + 1 < nodes.length ? nodes[i + 1] : left; // duplicate if odd
      const hash = this.hashFn(left.hash + right.hash);
      next.push(new MerkleNode(hash, left, right));
    }
    return this._build(next);
  }

  get rootHash() { return this.root.hash; }

  // Generate proof for item at index
  getProof(index) {
    if (index < 0 || index >= this.leaves.length) return null;

    const proof = [];
    let nodes = [...this.leaves];

    let idx = index;
    while (nodes.length > 1) {
      const next = [];
      for (let i = 0; i < nodes.length; i += 2) {
        const left = nodes[i];
        const right = i + 1 < nodes.length ? nodes[i + 1] : left;

        if (i === idx || i + 1 === idx) {
          if (idx % 2 === 0) {
            proof.push({ hash: right.hash, position: 'right' });
          } else {
            proof.push({ hash: left.hash, position: 'left' });
          }
        }

        next.push(new MerkleNode(this.hashFn(left.hash + right.hash), left, right));
      }
      idx = Math.floor(idx / 2);
      nodes = next;
    }

    return proof;
  }

  // Verify a proof
  static verify(data, proof, rootHash, hashFn = sha256) {
    let hash = hashFn(String(data));

    for (const step of proof) {
      if (step.position === 'right') {
        hash = hashFn(hash + step.hash);
      } else {
        hash = hashFn(step.hash + hash);
      }
    }

    return hash === rootHash;
  }

  // Verify integrity (recompute root)
  verify() {
    const recomputed = this._build(
      this.leaves.map(l => new MerkleNode(this.hashFn(String(l.data)), null, null, l.data))
    );
    return recomputed.hash === this.root.hash;
  }

  // Get all leaf hashes
  get leafHashes() { return this.leaves.map(l => l.hash); }

  // Compare two trees (find differences)
  static diff(tree1, tree2) {
    const diffs = [];
    MerkleTree._diffNodes(tree1.root, tree2.root, diffs, 0);
    return diffs;
  }

  static _diffNodes(a, b, diffs, depth) {
    if (!a || !b) return;
    if (a.hash === b.hash) return;
    if (a.isLeaf || b.isLeaf) {
      diffs.push({ depth, hashA: a.hash, hashB: b.hash, dataA: a.data, dataB: b.data });
      return;
    }
    MerkleTree._diffNodes(a.left, b.left, diffs, depth + 1);
    MerkleTree._diffNodes(a.right, b.right, diffs, depth + 1);
  }
}
