// Scheduler — priority queue with deadlines and delayed execution

export class Scheduler {
  constructor() { this._tasks = []; this._nextId = 1; }

  schedule(fn, { priority = 0, delay = 0, deadline, name } = {}) {
    const id = this._nextId++;
    const task = { id, fn, priority, delay, deadline, name: name || `task-${id}`, scheduledAt: Date.now(), status: 'pending' };
    this._tasks.push(task);
    this._tasks.sort((a, b) => b.priority - a.priority || a.scheduledAt - b.scheduledAt);
    return id;
  }

  cancel(id) {
    const idx = this._tasks.findIndex(t => t.id === id);
    if (idx >= 0) { this._tasks[idx].status = 'cancelled'; this._tasks.splice(idx, 1); return true; }
    return false;
  }

  async run() {
    const results = [];
    while (this._tasks.length > 0) {
      const task = this._tasks.shift();
      if (task.status === 'cancelled') continue;
      if (task.deadline && Date.now() > task.deadline) { results.push({ id: task.id, status: 'expired' }); continue; }
      if (task.delay > 0) await new Promise(r => setTimeout(r, task.delay));
      try {
        const result = await task.fn();
        results.push({ id: task.id, status: 'completed', result });
      } catch (error) {
        results.push({ id: task.id, status: 'failed', error: error.message });
      }
    }
    return results;
  }

  async runNext() {
    if (this._tasks.length === 0) return null;
    const task = this._tasks.shift();
    if (task.delay > 0) await new Promise(r => setTimeout(r, task.delay));
    try {
      const result = await task.fn();
      return { id: task.id, status: 'completed', result };
    } catch (error) {
      return { id: task.id, status: 'failed', error: error.message };
    }
  }

  get pending() { return this._tasks.length; }
  get tasks() { return this._tasks.map(t => ({ id: t.id, name: t.name, priority: t.priority })); }
}
