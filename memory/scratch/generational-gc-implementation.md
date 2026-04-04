# Generational GC Implementation Notes

uses: 1
created: 2026-04-04
topics: gc, generational, nursery, tenured, write-barrier, promotion

## Address Space Encoding

Using a simple offset trick: nursery addresses are raw (0, 3, 6...), tenured addresses are offset by 1,000,000. This avoids needing separate pointer tag bits.

```javascript
const TENURED_OFFSET = 1_000_000;
function isTenuredAddr(addr) { return addr >= TENURED_OFFSET; }
```

## The Age Tracking Bug

**Critical lesson:** During nursery collection, DON'T update the ages map as you copy objects. The problem: copied objects' new addresses (in to-space) can collide with original addresses (in from-space) because to-space starts at offset 0.

Example: Object A at from-space addr 0 gets copied to to-space addr 0 with age 1. Then when scanning A's children, child B (also at from-space addr 0 originally!) looks up ages.get(0) and gets age 1 (from the pair, not B's actual age). This causes premature promotion.

**Fix:** Use a separate `pendingAges` map during collection. Only assign to `this.ages` after the swap:

```javascript
const pendingAges = new Map();
// In copyOrPromote:
pendingAges.set(newAddr, age);
// After swap:
this.ages = pendingAges;
```

## Write Barrier Design

When a tenured object stores a pointer to a nursery object, record the tenured address in a remembered set. During nursery collection, scan the remembered set as additional roots.

Simple "card table" approach would be more efficient for large tenured spaces, but a Set works fine for our simulator.

## Promotion Mechanics

Objects are promoted when their age reaches `promotionAge`. During promotion:
1. Copy object to tenured space (using `_tenuredAlloc`)
2. Record in `promotedObjects` list for post-scan
3. After main Cheney scan of to-space, scan promoted objects' fields
4. Update any nursery pointers in promoted objects to forwarded addresses

The key: promoted objects may point to other nursery objects that haven't been processed yet. The post-scan phase handles this by re-running `copyOrPromote` on those children.
