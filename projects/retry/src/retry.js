// Retry with backoff
export async function retry(fn, { maxRetries = 3, delay = 100, backoff = 'exponential', maxDelay = 30000, onRetry, jitter = false, retryIf } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try { return await fn(attempt); }
    catch (err) {
      lastError = err;
      if (retryIf && !retryIf(err)) throw err;
      if (attempt >= maxRetries) throw err;
      let wait;
      if (backoff === 'exponential') wait = Math.min(delay * Math.pow(2, attempt), maxDelay);
      else if (backoff === 'linear') wait = Math.min(delay * (attempt + 1), maxDelay);
      else wait = delay;
      if (jitter) wait += Math.random() * wait * 0.2;
      if (onRetry) onRetry(err, attempt + 1, wait);
      await new Promise(r => setTimeout(r, wait));
    }
  }
  throw lastError;
}

export function withRetry(fn, options) { return (...args) => retry(() => fn(...args), options); }
