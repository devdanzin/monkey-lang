import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { UndoManager, createCommand, setProperty } from '../src/index.js';

describe('Basic undo/redo', () => {
  it('undo reverses execute', () => {
    const mgr = new UndoManager();
    let value = 0;
    mgr.execute(createCommand(() => { value = 1; }, () => { value = 0; }));
    assert.equal(value, 1);
    mgr.undo();
    assert.equal(value, 0);
  });

  it('redo re-applies', () => {
    const mgr = new UndoManager();
    let value = 0;
    mgr.execute(createCommand(() => { value = 1; }, () => { value = 0; }));
    mgr.undo();
    mgr.redo();
    assert.equal(value, 1);
  });

  it('multiple undo/redo', () => {
    const mgr = new UndoManager();
    const arr = [];
    mgr.execute(createCommand(() => arr.push(1), () => arr.pop()));
    mgr.execute(createCommand(() => arr.push(2), () => arr.pop()));
    mgr.execute(createCommand(() => arr.push(3), () => arr.pop()));
    assert.deepEqual(arr, [1, 2, 3]);
    mgr.undo();
    assert.deepEqual(arr, [1, 2]);
    mgr.undo();
    assert.deepEqual(arr, [1]);
    mgr.redo();
    assert.deepEqual(arr, [1, 2]);
  });

  it('new execute clears redo', () => {
    const mgr = new UndoManager();
    let v = 0;
    mgr.execute(createCommand(() => v = 1, () => v = 0));
    mgr.undo();
    assert.equal(mgr.canRedo, true);
    mgr.execute(createCommand(() => v = 2, () => v = 0));
    assert.equal(mgr.canRedo, false);
  });
});

describe('canUndo/canRedo', () => {
  it('reports correctly', () => {
    const mgr = new UndoManager();
    assert.equal(mgr.canUndo, false);
    assert.equal(mgr.canRedo, false);
    mgr.execute(createCommand(() => {}, () => {}));
    assert.equal(mgr.canUndo, true);
    mgr.undo();
    assert.equal(mgr.canRedo, true);
    assert.equal(mgr.canUndo, false);
  });
});

describe('setProperty helper', () => {
  it('undo/redo property changes', () => {
    const obj = { name: 'Alice' };
    const mgr = new UndoManager();
    mgr.execute(setProperty(obj, 'name', 'Bob'));
    assert.equal(obj.name, 'Bob');
    mgr.undo();
    assert.equal(obj.name, 'Alice');
    mgr.redo();
    assert.equal(obj.name, 'Bob');
  });
});

describe('Command groups', () => {
  it('groups undo as one step', () => {
    const mgr = new UndoManager();
    const arr = [];
    mgr.beginGroup();
    mgr.execute(createCommand(() => arr.push(1), () => arr.pop()));
    mgr.execute(createCommand(() => arr.push(2), () => arr.pop()));
    mgr.execute(createCommand(() => arr.push(3), () => arr.pop()));
    mgr.endGroup();
    assert.deepEqual(arr, [1, 2, 3]);
    assert.equal(mgr.undoCount, 1); // One group
    mgr.undo();
    assert.deepEqual(arr, []); // All three undone at once
  });
});

describe('Max history', () => {
  it('limits undo stack', () => {
    const mgr = new UndoManager({ maxHistory: 3 });
    for (let i = 0; i < 10; i++) mgr.execute(createCommand(() => {}, () => {}));
    assert.equal(mgr.undoCount, 3);
  });
});

describe('Clear', () => {
  it('clears all history', () => {
    const mgr = new UndoManager();
    mgr.execute(createCommand(() => {}, () => {}));
    mgr.clear();
    assert.equal(mgr.canUndo, false);
    assert.equal(mgr.canRedo, false);
  });
});
