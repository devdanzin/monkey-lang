// Tiny logger — levels, formatters, transports

const LEVELS = { trace: 0, debug: 1, info: 2, warn: 3, error: 4, fatal: 5, silent: 6 };

export function createLogger({ level = 'info', format = defaultFormat, transports = [consoleTransport()] } = {}) {
  const logger = {};
  const minLevel = LEVELS[level] ?? 2;

  for (const [name, lvl] of Object.entries(LEVELS)) {
    if (name === 'silent') continue;
    logger[name] = (...args) => {
      if (lvl < minLevel) return;
      const entry = { level: name, timestamp: new Date(), message: args.map(String).join(' ') };
      const formatted = format(entry);
      for (const transport of transports) transport(formatted, entry);
    };
  }

  logger.child = (meta) => createLogger({
    level, transports,
    format: (entry) => format({ ...entry, ...meta }),
  });

  return logger;
}

export function defaultFormat({ level, timestamp, message, ...meta }) {
  const ts = timestamp.toISOString();
  const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
  return `[${ts}] ${level.toUpperCase().padEnd(5)} ${message}${metaStr}`;
}

export function jsonFormat(entry) { return JSON.stringify(entry); }

export function consoleTransport() {
  return (formatted, entry) => {
    const fn = entry.level === 'error' || entry.level === 'fatal' ? console.error : entry.level === 'warn' ? console.warn : console.log;
    fn(formatted);
  };
}

export function arrayTransport(arr = []) {
  const fn = (formatted) => arr.push(formatted);
  fn.entries = arr;
  return fn;
}
