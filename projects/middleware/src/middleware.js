// Tiny middleware engine — Koa/Express-like

export class Pipeline {
  constructor() { this._middlewares = []; }

  use(fn) { this._middlewares.push(fn); return this; }

  async execute(ctx = {}) {
    let index = -1;
    const dispatch = async (i) => {
      if (i <= index) throw new Error('next() called multiple times');
      index = i;
      if (i >= this._middlewares.length) return;
      await this._middlewares[i](ctx, () => dispatch(i + 1));
    };
    await dispatch(0);
    return ctx;
  }

  compose() {
    return (ctx, next) => {
      let index = -1;
      const dispatch = async (i) => {
        if (i <= index) throw new Error('next() called multiple times');
        index = i;
        const fn = i < this._middlewares.length ? this._middlewares[i] : next;
        if (!fn) return;
        await fn(ctx, () => dispatch(i + 1));
      };
      return dispatch(0);
    };
  }
}

export function compose(...fns) {
  return (ctx, next) => {
    let index = -1;
    const dispatch = (i) => {
      if (i <= index) return Promise.reject(new Error('next() called multiple times'));
      index = i;
      const fn = i < fns.length ? fns[i] : next;
      if (!fn) return Promise.resolve();
      return Promise.resolve(fn(ctx, () => dispatch(i + 1)));
    };
    return dispatch(0);
  };
}
