// ===== Task Runner / Build System =====

export class TaskRunner {
  constructor() {
    this.tasks = new Map();
    this.results = new Map();
    this.running = new Set();
  }

  task(name, deps, fn) {
    if (typeof deps === 'function') { fn = deps; deps = []; }
    this.tasks.set(name, { name, deps, fn });
  }

  async run(name) {
    if (this.results.has(name)) return this.results.get(name);
    if (this.running.has(name)) throw new Error(`Circular dependency: ${name}`);

    const task = this.tasks.get(name);
    if (!task) throw new Error(`Task not found: ${name}`);

    this.running.add(name);

    // Run dependencies first
    const depResults = {};
    for (const dep of task.deps) {
      depResults[dep] = await this.run(dep);
    }

    // Run this task
    const result = await task.fn(depResults);
    this.results.set(name, result);
    this.running.delete(name);
    return result;
  }

  async runAll(names) {
    const results = {};
    for (const name of names) results[name] = await this.run(name);
    return results;
  }

  // Run tasks in parallel where possible
  async runParallel(name) {
    const order = this._topologicalSort(name);
    const levels = this._levelSort(order);
    
    for (const level of levels) {
      await Promise.all(level.map(t => this.run(t)));
    }
    return this.results.get(name);
  }

  _topologicalSort(start) {
    const visited = new Set();
    const order = [];
    const visit = (name) => {
      if (visited.has(name)) return;
      visited.add(name);
      const task = this.tasks.get(name);
      if (task) for (const dep of task.deps) visit(dep);
      order.push(name);
    };
    visit(start);
    return order;
  }

  _levelSort(order) {
    const levels = [];
    const placed = new Set();
    
    while (placed.size < order.length) {
      const level = [];
      for (const name of order) {
        if (placed.has(name)) continue;
        const task = this.tasks.get(name);
        if (task.deps.every(d => placed.has(d))) level.push(name);
      }
      if (level.length === 0) break;
      levels.push(level);
      for (const n of level) placed.add(n);
    }
    return levels;
  }

  // Reset results for re-running
  reset() { this.results.clear(); this.running.clear(); }
  
  getTaskNames() { return [...this.tasks.keys()]; }
  
  getDependencies(name) {
    const task = this.tasks.get(name);
    return task ? task.deps : [];
  }
}
