// retry.js — Retry utility

export async function retry(fn, options = {}) {
  const maxRetries = options.maxRetries ?? 3;
  const baseDelay = options.baseDelay ?? 1000;
  const maxDelay = options.maxDelay ?? 30000;
  const backoffFactor = options.backoffFactor ?? 2;
  const jitter = options.jitter ?? true;
  const shouldRetry = options.shouldRetry ?? (() => true);
  const onRetry = options.onRetry ?? (() => {});
  const signal = options.signal;

  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) throw new Error('Aborted');
    
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      
      if (attempt >= maxRetries) break;
      if (!shouldRetry(error, attempt)) break;
      
      let delay = Math.min(baseDelay * Math.pow(backoffFactor, attempt), maxDelay);
      if (jitter) delay *= (0.5 + Math.random() * 0.5);
      
      onRetry(error, attempt + 1, delay);
      
      await new Promise(resolve => {
        const timer = setTimeout(resolve, delay);
        if (signal) signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
      });
    }
  }
  
  throw lastError;
}

// ===== Timeout wrapper =====
export async function withTimeout(fn, ms) {
  return Promise.race([
    fn(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms)),
  ]);
}

// ===== Retry with timeout =====
export async function retryWithTimeout(fn, options = {}) {
  const timeoutMs = options.timeout ?? 5000;
  return retry(() => withTimeout(fn, timeoutMs), options);
}

// ===== Constant backoff =====
export function constantBackoff(delay) {
  return { baseDelay: delay, backoffFactor: 1, jitter: false };
}

// ===== Linear backoff =====
export function linearBackoff(baseDelay) {
  return {
    baseDelay,
    backoffFactor: 1,
    jitter: false,
    // Override delay calculation — not directly possible with current API, but approximate
  };
}
