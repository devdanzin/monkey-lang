// logger.js — Logger

export const Level = { TRACE: 0, DEBUG: 1, INFO: 2, WARN: 3, ERROR: 4, FATAL: 5, SILENT: 6 };
const LEVEL_NAMES = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];

export class Logger {
  constructor(options = {}) {
    this.level = options.level ?? Level.INFO;
    this.name = options.name || '';
    this.context = options.context || {};
    this.transports = options.transports || [consoleTransport()];
    this.formatter = options.formatter || defaultFormatter;
    this._muted = false;
    this._parent = options._parent || null;
  }

  trace(msg, meta) { this._log(Level.TRACE, msg, meta); }
  debug(msg, meta) { this._log(Level.DEBUG, msg, meta); }
  info(msg, meta) { this._log(Level.INFO, msg, meta); }
  warn(msg, meta) { this._log(Level.WARN, msg, meta); }
  error(msg, meta) { this._log(Level.ERROR, msg, meta); }
  fatal(msg, meta) { this._log(Level.FATAL, msg, meta); }

  _log(level, msg, meta = {}) {
    if (this._muted || level < this.level) return;
    const entry = {
      level, levelName: LEVEL_NAMES[level], message: msg, timestamp: new Date(),
      name: this.name, ...this.context, ...meta,
    };
    const formatted = this.formatter(entry);
    for (const transport of this.transports) transport(formatted, entry);
  }

  child(context = {}) {
    return new Logger({
      level: this.level, name: this.name,
      context: { ...this.context, ...context },
      transports: this.transports, formatter: this.formatter, _parent: this,
    });
  }

  setLevel(level) { this.level = level; return this; }
  mute() { this._muted = true; return this; }
  unmute() { this._muted = false; return this; }

  isLevelEnabled(level) { return level >= this.level && !this._muted; }
}

// ===== Formatters =====
export function defaultFormatter(entry) {
  const ts = entry.timestamp.toISOString();
  const name = entry.name ? ` [${entry.name}]` : '';
  const { level, levelName, message, timestamp, name: _, ...rest } = entry;
  const meta = Object.keys(rest).length ? ' ' + JSON.stringify(rest) : '';
  return `${ts} ${levelName}${name}: ${message}${meta}`;
}

export function jsonFormatter(entry) { return JSON.stringify(entry); }

// ===== Transports =====
export function consoleTransport() {
  return (formatted, entry) => {
    if (entry.level >= Level.ERROR) console.error(formatted);
    else if (entry.level >= Level.WARN) console.warn(formatted);
    else console.log(formatted);
  };
}

export function arrayTransport(arr) { return (formatted) => arr.push(formatted); }
export function callbackTransport(fn) { return (formatted, entry) => fn(formatted, entry); }
