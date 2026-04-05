// middleware.js — Middleware compose (Koa-style)

export function compose(middlewares) {
  return function (context, next) {
    let index = -1;
    
    function dispatch(i) {
      if (i <= index) return Promise.reject(new Error('next() called multiple times'));
      index = i;
      
      let fn = middlewares[i];
      if (i === middlewares.length) fn = next;
      if (!fn) return Promise.resolve();
      
      try {
        return Promise.resolve(fn(context, function next() { return dispatch(i + 1); }));
      } catch (err) {
        return Promise.reject(err);
      }
    }
    
    return dispatch(0);
  };
}

// ===== Named middleware =====
export function named(name, fn) { fn._name = name; return fn; }

// ===== Conditional middleware =====
export function when(condition, fn) {
  return async (ctx, next) => {
    if (typeof condition === 'function' ? condition(ctx) : condition) {
      return fn(ctx, next);
    }
    return next();
  };
}

// ===== Error handling middleware =====
export function errorHandler(handler) {
  return async (ctx, next) => {
    try { await next(); }
    catch (err) { await handler(err, ctx); }
  };
}

// ===== App =====
export class App {
  constructor() { this.middlewares = []; }
  
  use(fn) { this.middlewares.push(fn); return this; }
  
  async run(context = {}) {
    const fn = compose(this.middlewares);
    await fn(context);
    return context;
  }
}
