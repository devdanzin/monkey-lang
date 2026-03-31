// Event Bus — typed event system
export class EventBus {
  constructor() { this._handlers = new Map(); }
  on(event, handler) { if (!this._handlers.has(event)) this._handlers.set(event, []); this._handlers.get(event).push(handler); return () => this.off(event, handler); }
  off(event, handler) { const h = this._handlers.get(event); if (h) { const i = h.indexOf(handler); if (i>=0) h.splice(i,1); } }
  once(event, handler) { const unsub = this.on(event, (...args) => { unsub(); handler(...args); }); return unsub; }
  emit(event, ...args) { for (const h of (this._handlers.get(event) || [])) h(...args); for (const h of (this._handlers.get('*') || [])) h(event, ...args); }
  clear(event) { if (event) this._handlers.delete(event); else this._handlers.clear(); }
  get listenerCount() { let n = 0; for (const h of this._handlers.values()) n += h.length; return n; }
}
