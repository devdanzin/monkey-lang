// ===== Logger =====
const LEVELS = { trace: 0, debug: 1, info: 2, warn: 3, error: 4, fatal: 5, silent: 6 };

export class Logger {
  constructor(options = {}) {
    this.level = LEVELS[options.level ?? 'info'];
    this.name = options.name ?? '';
    this._transports = options.transports ?? [new ConsoleTransport()];
    this._formatter = options.formatter ?? defaultFormatter;
  }

  _log(level, ...args) {
    if (LEVELS[level] < this.level) return;
    const entry = { level, timestamp: new Date(), name: this.name, args, message: args.map(String).join(' ') };
    const formatted = this._formatter(entry);
    for (const t of this._transports) t.write(entry, formatted);
  }

  trace(...args) { this._log('trace', ...args); }
  debug(...args) { this._log('debug', ...args); }
  info(...args) { this._log('info', ...args); }
  warn(...args) { this._log('warn', ...args); }
  error(...args) { this._log('error', ...args); }
  fatal(...args) { this._log('fatal', ...args); }

  child(options) {
    return new Logger({ ...options, level: Object.keys(LEVELS).find(k => LEVELS[k] === this.level), name: this.name ? `${this.name}:${options.name}` : options.name, transports: this._transports, formatter: this._formatter });
  }
}

function defaultFormatter(entry) {
  const ts = entry.timestamp.toISOString();
  const prefix = entry.name ? `[${entry.name}]` : '';
  return `${ts} ${entry.level.toUpperCase().padEnd(5)} ${prefix} ${entry.message}`;
}

export class ConsoleTransport {
  write(entry, formatted) { console.log(formatted); }
}

export class ArrayTransport {
  constructor() { this.entries = []; }
  write(entry) { this.entries.push(entry); }
}

export { LEVELS };
