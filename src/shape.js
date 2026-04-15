// shape.js — Hidden Classes for MonkeyHash
//
// Inspired by V8's hidden classes. A Shape defines the "layout" of a hash:
// which keys exist and what slot index each maps to.
//
// Two hashes with the same keys (regardless of values) share the same Shape.
// Property access becomes slots[shape.getSlot(key)] instead of Map.get(key).
//
// Shapes form a transition tree: adding a key to a shape creates a child shape.
// The transition is cached so the same key addition reuses the same child.

let nextShapeId = 0;

export class Shape {
  /**
   * @param {Map<string, number>} keyMap - Maps key name → slot index
   * @param {Shape|null} parent - Parent shape in transition chain
   * @param {string|null} lastKey - Key that was added to create this shape from parent
   */
  constructor(keyMap, parent = null, lastKey = null) {
    this.id = nextShapeId++;
    this.keyMap = keyMap;        // Map<string, slotIndex>
    this.slotCount = keyMap.size;
    this.parent = parent;
    this.lastKey = lastKey;
    this._transitions = null;    // Lazy: Map<string, Shape>
    // Precompute sorted key string for identity
    this._keySignature = [...keyMap.keys()].sort().join('\0');
  }

  /** Get slot index for a key, or -1 if not present */
  getSlot(key) {
    const slot = this.keyMap.get(key);
    return slot !== undefined ? slot : -1;
  }

  /** Check if this shape has a given key */
  hasKey(key) {
    return this.keyMap.has(key);
  }

  /** Get or create a transition shape by adding a new key */
  transition(key) {
    if (this._transitions) {
      const existing = this._transitions.get(key);
      if (existing) return existing;
    }

    // Create new shape with the additional key
    const newKeyMap = new Map(this.keyMap);
    newKeyMap.set(key, this.slotCount); // New key gets next slot
    const child = new Shape(newKeyMap, this, key);

    if (!this._transitions) this._transitions = new Map();
    this._transitions.set(key, child);

    // Also register in the global registry
    shapeRegistry.set(child._keySignature, child);

    return child;
  }

  /** Get all keys in slot order */
  keys() {
    const result = new Array(this.slotCount);
    for (const [key, slot] of this.keyMap) {
      result[slot] = key;
    }
    return result;
  }
}

// --- Shape Registry (global deduplication) ---

/** @type {Map<string, Shape>} signature → Shape */
const shapeRegistry = new Map();

/** The empty shape (no keys) */
export const EMPTY_SHAPE = new Shape(new Map());
shapeRegistry.set('', EMPTY_SHAPE);

/**
 * Get or create a shape for a given set of keys.
 * Keys are provided in insertion order; the shape assigns slots in that order.
 *
 * @param {string[]} keys - Key names in insertion order
 * @returns {Shape}
 */
export function getShape(keys) {
  if (keys.length === 0) return EMPTY_SHAPE;

  // Check registry by sorted signature
  const signature = [...keys].sort().join('\0');
  const existing = shapeRegistry.get(signature);
  if (existing) return existing;

  // Build shape via transitions from empty (preserves insertion order for slots)
  let shape = EMPTY_SHAPE;
  for (const key of keys) {
    shape = shape.transition(key);
  }

  return shape;
}

/**
 * Convert a key object to its string representation for shape lookup.
 * Handles MonkeyInteger, MonkeyString, MonkeyBoolean.
 */
export function keyToString(keyObj) {
  if (typeof keyObj === 'string') return keyObj;
  if (keyObj && keyObj.value !== undefined) {
    // MonkeyInteger, MonkeyString, MonkeyBoolean
    return String(keyObj.value);
  }
  if (keyObj && typeof keyObj.inspect === 'function') {
    return keyObj.inspect();
  }
  return String(keyObj);
}

// --- Inline Cache ---

/**
 * An inline cache entry for a single bytecode site.
 * Monomorphic: caches one (shapeId, slotIndex) pair.
 * Polymorphic: up to MAX_POLY entries.
 */
const MAX_POLY = 4;

export class InlineCache {
  constructor() {
    // Monomorphic state
    this.shapeId = -1;
    this.slotIndex = -1;
    this.keyStr = null;

    // Polymorphic state (only allocated on first miss after mono hit)
    this.poly = null;   // Array of {shapeId, slotIndex}
    this.megamorphic = false;  // Too many shapes, give up caching
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Try to look up a value using the cache.
   * @param {Shape} shape - The hash's shape
   * @param {string} keyStr - String representation of the key
   * @param {any[]} slots - The hash's slot array
   * @returns {any|undefined} The value if cache hits, undefined if miss
   */
  lookup(shape, keyStr, slots) {
    // Fast path: monomorphic (most common case)
    if (this.shapeId === shape.id && this.keyStr === keyStr) {
      this.hits++;
      return this.slotIndex >= 0 ? slots[this.slotIndex] : undefined;
    }

    // Polymorphic path
    if (this.poly) {
      for (let i = 0; i < this.poly.length; i++) {
        const entry = this.poly[i];
        if (entry.shapeId === shape.id && entry.keyStr === keyStr) {
          this.hits++;
          return entry.slotIndex >= 0 ? slots[entry.slotIndex] : undefined;
        }
      }
    }

    this.misses++;
    return undefined;
  }

  /**
   * Update the cache after a miss.
   * @param {Shape} shape
   * @param {string} keyStr
   * @param {number} slotIndex - The resolved slot index (-1 if key not found)
   */
  update(shape, keyStr, slotIndex) {
    if (this.megamorphic) return; // Give up

    if (this.shapeId === -1) {
      // First use — set monomorphic
      this.shapeId = shape.id;
      this.keyStr = keyStr;
      this.slotIndex = slotIndex;
      return;
    }

    // Already monomorphic with different shape/key — go polymorphic
    if (!this.poly) {
      this.poly = [
        { shapeId: this.shapeId, keyStr: this.keyStr, slotIndex: this.slotIndex },
        { shapeId: shape.id, keyStr: keyStr, slotIndex: slotIndex }
      ];
      return;
    }

    // Already polymorphic — add entry or go megamorphic
    if (this.poly.length < MAX_POLY) {
      this.poly.push({ shapeId: shape.id, keyStr: keyStr, slotIndex: slotIndex });
    } else {
      this.megamorphic = true;
      this.poly = null; // Free memory
    }
  }

  /** Reset the cache */
  reset() {
    this.shapeId = -1;
    this.slotIndex = -1;
    this.keyStr = null;
    this.poly = null;
    this.megamorphic = false;
    this.hits = 0;
    this.misses = 0;
  }
}

/**
 * Create an IC table for a bytecode program.
 * Returns a sparse object/Map indexed by instruction pointer.
 */
export function createICTable() {
  return new Map();
}

/**
 * Get or create an IC entry for a bytecode position.
 * @param {Map} icTable
 * @param {number} ip - Instruction pointer
 * @returns {InlineCache}
 */
export function getIC(icTable, ip) {
  let ic = icTable.get(ip);
  if (!ic) {
    ic = new InlineCache();
    icTable.set(ip, ic);
  }
  return ic;
}

// --- Stats ---

export function getShapeStats() {
  return {
    totalShapes: nextShapeId,
    registrySize: shapeRegistry.size,
  };
}

/** Reset for testing */
export function resetShapes() {
  nextShapeId = 1; // 0 is reserved for EMPTY_SHAPE
  shapeRegistry.clear();
  EMPTY_SHAPE.id = 0;
  EMPTY_SHAPE._transitions = null;
  shapeRegistry.set('', EMPTY_SHAPE);
}
