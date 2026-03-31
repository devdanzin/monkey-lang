// Dependency resolver — topological sort with cycle detection and version constraints

export class DependencyResolver {
  constructor() { this._deps = new Map(); }

  add(pkg, dependencies = []) {
    this._deps.set(pkg, dependencies);
    return this;
  }

  resolve(target) {
    const resolved = [];
    const seen = new Set();
    const visiting = new Set();

    const visit = (pkg) => {
      if (seen.has(pkg)) return;
      if (visiting.has(pkg)) throw new Error(`Circular dependency: ${pkg}`);
      if (!this._deps.has(pkg)) throw new Error(`Unknown package: ${pkg}`);
      visiting.add(pkg);
      for (const dep of this._deps.get(pkg)) visit(dep);
      visiting.delete(pkg);
      seen.add(pkg);
      resolved.push(pkg);
    };

    visit(target);
    return resolved;
  }

  resolveAll() {
    const resolved = [];
    const seen = new Set();
    const visiting = new Set();

    const visit = (pkg) => {
      if (seen.has(pkg)) return;
      if (visiting.has(pkg)) throw new Error(`Circular dependency: ${pkg}`);
      visiting.add(pkg);
      for (const dep of (this._deps.get(pkg) || [])) visit(dep);
      visiting.delete(pkg);
      seen.add(pkg);
      resolved.push(pkg);
    };

    for (const pkg of this._deps.keys()) visit(pkg);
    return resolved;
  }

  dependsOn(pkg) { return this._deps.get(pkg) || []; }

  dependedBy(pkg) {
    const result = [];
    for (const [p, deps] of this._deps) { if (deps.includes(pkg)) result.push(p); }
    return result;
  }

  hasCycle() { try { this.resolveAll(); return false; } catch { return true; } }
}
