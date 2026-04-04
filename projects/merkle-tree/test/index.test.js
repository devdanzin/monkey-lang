import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MerkleTree } from '../src/index.js';

describe('MerkleTree — basic', () => {
  it('creates tree from data', () => {
    const tree = new MerkleTree(['a', 'b', 'c', 'd']);
    assert.ok(tree.rootHash);
    assert.equal(tree.rootHash.length, 64); // SHA-256 hex
  });

  it('single element', () => {
    const tree = new MerkleTree(['hello']);
    assert.ok(tree.rootHash);
  });

  it('deterministic hashing', () => {
    const tree1 = new MerkleTree(['a', 'b', 'c']);
    const tree2 = new MerkleTree(['a', 'b', 'c']);
    assert.equal(tree1.rootHash, tree2.rootHash);
  });

  it('different data → different hash', () => {
    const tree1 = new MerkleTree(['a', 'b']);
    const tree2 = new MerkleTree(['a', 'c']);
    assert.notEqual(tree1.rootHash, tree2.rootHash);
  });

  it('leaf hashes', () => {
    const tree = new MerkleTree(['x', 'y']);
    assert.equal(tree.leafHashes.length, 2);
  });
});

describe('MerkleTree — proof', () => {
  it('generates proof', () => {
    const tree = new MerkleTree(['a', 'b', 'c', 'd']);
    const proof = tree.getProof(0);
    assert.ok(proof);
    assert.ok(proof.length > 0);
  });

  it('verifies valid proof', () => {
    const tree = new MerkleTree(['a', 'b', 'c', 'd']);
    const proof = tree.getProof(2);
    const valid = MerkleTree.verify('c', proof, tree.rootHash);
    assert.equal(valid, true);
  });

  it('rejects invalid data', () => {
    const tree = new MerkleTree(['a', 'b', 'c', 'd']);
    const proof = tree.getProof(0);
    const valid = MerkleTree.verify('WRONG', proof, tree.rootHash);
    assert.equal(valid, false);
  });

  it('verifies all elements', () => {
    const data = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'];
    const tree = new MerkleTree(data);
    for (let i = 0; i < data.length; i++) {
      const proof = tree.getProof(i);
      assert.equal(MerkleTree.verify(data[i], proof, tree.rootHash), true);
    }
  });

  it('proof for out-of-range returns null', () => {
    const tree = new MerkleTree(['a', 'b']);
    assert.equal(tree.getProof(-1), null);
    assert.equal(tree.getProof(5), null);
  });
});

describe('MerkleTree — integrity', () => {
  it('verify returns true for unmodified', () => {
    const tree = new MerkleTree(['a', 'b', 'c']);
    assert.equal(tree.verify(), true);
  });
});

describe('MerkleTree — diff', () => {
  it('no diff for identical trees', () => {
    const a = new MerkleTree(['x', 'y', 'z']);
    const b = new MerkleTree(['x', 'y', 'z']);
    assert.equal(MerkleTree.diff(a, b).length, 0);
  });

  it('finds differences', () => {
    const a = new MerkleTree(['x', 'y', 'z']);
    const b = new MerkleTree(['x', 'y', 'w']);
    const diffs = MerkleTree.diff(a, b);
    assert.ok(diffs.length > 0);
  });
});

describe('MerkleTree — odd number of elements', () => {
  it('handles odd count', () => {
    const tree = new MerkleTree(['a', 'b', 'c']);
    assert.ok(tree.rootHash);
    const proof = tree.getProof(2);
    assert.equal(MerkleTree.verify('c', proof, tree.rootHash), true);
  });
});
