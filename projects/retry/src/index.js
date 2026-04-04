// ===== Retry Utility =====

export async function retry(fn, options = {}) {
  const { maxRetries = 3, delay = 100, backoff = 2, jitter = true, onRetry } = options;
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        let wait = delay * Math.pow(backoff, attempt);
        if (jitter) wait += Math.random() * wait * 0.1;
        if (onRetry) onRetry(err, attempt + 1, wait);
        await sleep(wait);
      }
    }
  }
  throw lastError;
}

export function retrySync(fn, options = {}) {
  const { maxRetries = 3 } = options;
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try { return fn(attempt); }
    catch (err) { lastError = err; }
  }
  throw lastError;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
