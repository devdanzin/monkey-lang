// Debounce/Throttle utilities

export function debounce(fn, delay, { leading = false, trailing = true, maxWait } = {}) {
  let timer = null, lastArgs = null, lastCall = 0, maxTimer = null;

  function invoke() {
    const args = lastArgs; lastArgs = null;
    if (timer) { clearTimeout(timer); timer = null; }
    if (maxTimer) { clearTimeout(maxTimer); maxTimer = null; }
    fn(...args);
    lastCall = Date.now();
  }

  function debounced(...args) {
    lastArgs = args;
    const now = Date.now();

    if (leading && !timer) {
      invoke();
      timer = setTimeout(() => { timer = null; }, delay);
      return;
    }

    if (timer) clearTimeout(timer);
    if (trailing) timer = setTimeout(invoke, delay);

    if (maxWait && !maxTimer) {
      maxTimer = setTimeout(invoke, maxWait);
    }
  }

  debounced.cancel = () => { if (timer) clearTimeout(timer); if (maxTimer) clearTimeout(maxTimer); timer = maxTimer = null; lastArgs = null; };
  debounced.flush = () => { if (lastArgs) invoke(); };
  debounced.pending = () => timer !== null;

  return debounced;
}

export function throttle(fn, interval, { leading = true, trailing = true } = {}) {
  let timer = null, lastArgs = null, lastCall = 0;

  function throttled(...args) {
    const now = Date.now();
    const remaining = interval - (now - lastCall);

    if (remaining <= 0 || remaining > interval) {
      if (timer) { clearTimeout(timer); timer = null; }
      lastCall = now;
      if (leading || lastCall > 0) fn(...args);
    } else {
      lastArgs = args;
      if (!timer && trailing) {
        timer = setTimeout(() => {
          lastCall = Date.now();
          timer = null;
          if (lastArgs) { fn(...lastArgs); lastArgs = null; }
        }, remaining);
      }
    }
  }

  throttled.cancel = () => { if (timer) clearTimeout(timer); timer = null; lastArgs = null; };

  return throttled;
}

// Delay
export function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// Sleep with value
export function sleep(ms, value) { return new Promise(r => setTimeout(() => r(value), ms)); }

// Run with timeout
export function timeout(promise, ms, msg = 'Timeout') {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(msg)), ms))]);
}

// Measure execution time
export async function measure(fn) {
  const start = performance.now();
  const result = await fn();
  return { result, duration: performance.now() - start };
}
