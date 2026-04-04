// ===== Debounce & Throttle =====

export function debounce(fn, delay, { leading = false, trailing = true } = {}) {
  let timer = null;
  let lastArgs = null;
  
  function debounced(...args) {
    lastArgs = args;
    if (leading && !timer) fn(...args);
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (trailing && lastArgs) fn(...lastArgs);
      lastArgs = null;
    }, delay);
  }
  
  debounced.cancel = () => { clearTimeout(timer); timer = null; lastArgs = null; };
  debounced.flush = () => { if (timer) { clearTimeout(timer); timer = null; if (lastArgs) fn(...lastArgs); lastArgs = null; } };
  debounced.pending = () => timer !== null;
  
  return debounced;
}

export function throttle(fn, interval, { leading = true, trailing = true } = {}) {
  let lastCall = 0;
  let timer = null;
  let lastArgs = null;
  
  function throttled(...args) {
    const now = Date.now();
    const remaining = interval - (now - lastCall);
    lastArgs = args;
    
    if (remaining <= 0 || remaining > interval) {
      if (timer) { clearTimeout(timer); timer = null; }
      lastCall = now;
      if (leading || lastCall > 0) fn(...args);
    } else if (!timer && trailing) {
      timer = setTimeout(() => {
        lastCall = Date.now();
        timer = null;
        fn(...lastArgs);
      }, remaining);
    }
  }
  
  throttled.cancel = () => { clearTimeout(timer); timer = null; lastCall = 0; };
  return throttled;
}
