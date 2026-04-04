// ===== Event Loop Simulation =====
// Models JavaScript's event loop: macrotasks, microtasks, timers

export class EventLoop {
  constructor() {
    this.macroQueue = [];     // macrotask queue (setTimeout, I/O)
    this.microQueue = [];     // microtask queue (Promise.then, queueMicrotask)
    this.timerHeap = [];      // timers sorted by fire time
    this.currentTime = 0;
    this.log = [];            // execution log
    this._running = false;
  }

  // Add a macrotask
  enqueueTask(fn, label = 'task') {
    this.macroQueue.push({ fn, label });
  }

  // Add a microtask
  enqueueMicrotask(fn, label = 'microtask') {
    this.microQueue.push({ fn, label });
  }

  // Add a timer (like setTimeout)
  setTimeout(fn, delay, label = `timer(${delay})`) {
    const fireAt = this.currentTime + delay;
    this.timerHeap.push({ fn, fireAt, label });
    this.timerHeap.sort((a, b) => a.fireAt - b.fireAt);
    return this.timerHeap.length - 1;
  }

  // Add an interval (like setInterval)
  setInterval(fn, interval, label = `interval(${interval})`) {
    const wrapper = () => {
      fn();
      this.setTimeout(wrapper, interval, label);
    };
    this.setTimeout(wrapper, interval, label);
  }

  // Run one tick of the event loop
  tick() {
    // 1. Execute one macrotask
    if (this.macroQueue.length > 0) {
      const task = this.macroQueue.shift();
      this.log.push(`[macro] ${task.label}`);
      task.fn(this);
    } else {
      // Check timers
      this._fireTimers();
    }

    // 2. Drain microtask queue
    while (this.microQueue.length > 0) {
      const micro = this.microQueue.shift();
      this.log.push(`[micro] ${micro.label}`);
      micro.fn(this);
    }
  }

  _fireTimers() {
    while (this.timerHeap.length > 0 && this.timerHeap[0].fireAt <= this.currentTime) {
      const timer = this.timerHeap.shift();
      this.log.push(`[timer] ${timer.label}`);
      this.macroQueue.push({ fn: timer.fn, label: timer.label });
    }
  }

  // Run the event loop until empty or maxTicks
  run(maxTicks = 100) {
    this._running = true;
    let ticks = 0;

    while (this._running && ticks < maxTicks) {
      this._fireTimers();

      if (this.macroQueue.length === 0 && this.microQueue.length === 0 && this.timerHeap.length === 0) {
        break;
      }

      if (this.macroQueue.length === 0 && this.timerHeap.length > 0) {
        // Advance time to next timer
        this.currentTime = this.timerHeap[0].fireAt;
        this._fireTimers();
      }

      this.tick();
      ticks++;
    }

    this._running = false;
    return this.log;
  }

  stop() { this._running = false; }

  get isEmpty() {
    return this.macroQueue.length === 0 && this.microQueue.length === 0 && this.timerHeap.length === 0;
  }
}
