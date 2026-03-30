// Task Queue — priority job queue with concurrency control, retries, timeouts

export class TaskQueue {
  constructor({ concurrency = 1, retries = 0, retryDelay = 1000, timeout = 0 } = {}) {
    this.concurrency = concurrency;
    this.retries = retries;
    this.retryDelay = retryDelay;
    this.timeout = timeout;
    this._queue = [];        // {task, priority, resolve, reject, attempts}
    this._running = 0;
    this._paused = false;
    this._completed = 0;
    this._failed = 0;
    this._listeners = { done: [], error: [], drain: [], progress: [] };
  }

  // Add a task (function returning a promise)
  add(task, { priority = 0, timeout } = {}) {
    return new Promise((resolve, reject) => {
      this._queue.push({ task, priority, resolve, reject, attempts: 0, timeout: timeout ?? this.timeout });
      this._queue.sort((a, b) => b.priority - a.priority); // Higher priority first
      this._process();
    });
  }

  // Add multiple tasks
  addAll(tasks, options) {
    return Promise.all(tasks.map(t => this.add(t, options)));
  }

  // Pause processing
  pause() { this._paused = true; return this; }

  // Resume processing
  resume() { this._paused = false; this._process(); return this; }

  // Clear pending tasks
  clear() {
    for (const item of this._queue) item.reject(new Error('Queue cleared'));
    this._queue = [];
    return this;
  }

  // Stats
  get pending() { return this._queue.length; }
  get running() { return this._running; }
  get completed() { return this._completed; }
  get failed() { return this._failed; }
  get size() { return this._queue.length + this._running; }
  get isPaused() { return this._paused; }

  // Event listeners
  on(event, handler) {
    if (this._listeners[event]) this._listeners[event].push(handler);
    return this;
  }

  // Wait until queue is empty and all tasks complete
  onIdle() {
    if (this._queue.length === 0 && this._running === 0) return Promise.resolve();
    return new Promise(resolve => this.on('drain', resolve));
  }

  async _process() {
    while (!this._paused && this._running < this.concurrency && this._queue.length > 0) {
      const item = this._queue.shift();
      this._running++;
      this._run(item);
    }
  }

  async _run(item) {
    item.attempts++;
    try {
      let result;
      if (item.timeout > 0) {
        result = await Promise.race([
          item.task(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Task timeout')), item.timeout))
        ]);
      } else {
        result = await item.task();
      }

      this._running--;
      this._completed++;
      item.resolve(result);
      this._emit('done', result);
      this._emit('progress', { completed: this._completed, failed: this._failed, pending: this._queue.length });
    } catch (err) {
      if (item.attempts <= this.retries) {
        // Retry
        await new Promise(r => setTimeout(r, this.retryDelay));
        this._running--;
        this._queue.unshift(item); // Re-add to front
        this._process();
        return;
      }

      this._running--;
      this._failed++;
      item.reject(err);
      this._emit('error', err);
    }

    // Check if drained
    if (this._queue.length === 0 && this._running === 0) {
      this._emit('drain');
    }

    this._process();
  }

  _emit(event, data) {
    for (const handler of (this._listeners[event] || [])) {
      try { handler(data); } catch {}
    }
  }
}
