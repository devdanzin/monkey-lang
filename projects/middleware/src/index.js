// ===== Middleware Pipeline =====
// Koa-style compose with async/await and context

export class Pipeline {
  constructor() { this._middleware = []; this._errorHandler = null; }

  use(fn) { this._middleware.push(fn); return this; }
  onError(fn) { this._errorHandler = fn; return this; }

  async execute(context = {}) {
    let index = -1;
    const dispatch = async (i) => {
      if (i <= index) throw new Error('next() called multiple times');
      index = i;
      const fn = this._middleware[i];
      if (!fn) return;
      try {
        await fn(context, () => dispatch(i + 1));
      } catch (err) {
        if (this._errorHandler) await this._errorHandler(err, context);
        else throw err;
      }
    };
    await dispatch(0);
    return context;
  }
}

// Functional compose
export function compose(...fns) {
  return async (ctx) => {
    let index = -1;
    const dispatch = async (i) => {
      if (i <= index) throw new Error('next() called multiple times');
      index = i;
      if (i >= fns.length) return;
      await fns[i](ctx, () => dispatch(i + 1));
    };
    await dispatch(0);
    return ctx;
  };
}
