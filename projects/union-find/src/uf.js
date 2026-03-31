// Union-Find (Disjoint Set) with path compression and union by rank

export class UnionFind {
  constructor(n) {
    this._parent = Array.from({ length: n }, (_, i) => i);
    this._rank = new Array(n).fill(0);
    this._size = new Array(n).fill(1);
    this._count = n;
  }

  find(x) {
    if (this._parent[x] !== x) this._parent[x] = this.find(this._parent[x]); // path compression
    return this._parent[x];
  }

  union(x, y) {
    const rx = this.find(x), ry = this.find(y);
    if (rx === ry) return false;
    // Union by rank
    if (this._rank[rx] < this._rank[ry]) { this._parent[rx] = ry; this._size[ry] += this._size[rx]; }
    else if (this._rank[rx] > this._rank[ry]) { this._parent[ry] = rx; this._size[rx] += this._size[ry]; }
    else { this._parent[ry] = rx; this._size[rx] += this._size[ry]; this._rank[rx]++; }
    this._count--;
    return true;
  }

  connected(x, y) { return this.find(x) === this.find(y); }
  componentSize(x) { return this._size[this.find(x)]; }
  get count() { return this._count; }

  components() {
    const groups = new Map();
    for (let i = 0; i < this._parent.length; i++) {
      const root = this.find(i);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root).push(i);
    }
    return [...groups.values()];
  }
}
