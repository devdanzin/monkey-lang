// ===== REPL (Read-Eval-Print Loop) =====
// Programmable REPL with history, tab completion, commands

export class REPL {
  constructor(options = {}) {
    this.prompt = options.prompt ?? '> ';
    this.evaluator = options.evaluator ?? ((input) => input);
    this.history = new History(options.maxHistory ?? 100);
    this.completions = options.completions ?? [];
    this.commands = new Map();
    this.output = [];
    this._running = false;
    
    // Register built-in commands
    this.registerCommand('help', () => {
      const cmds = [...this.commands.keys()].sort();
      return 'Commands: ' + cmds.join(', ');
    });
    this.registerCommand('history', () => this.history.entries().join('\n'));
    this.registerCommand('clear', () => { this.output = []; return 'Cleared'; });
  }

  registerCommand(name, handler) {
    this.commands.set(name, handler);
  }

  // Process a line of input
  processInput(line) {
    const trimmed = line.trim();
    if (!trimmed) return null;
    
    this.history.add(trimmed);
    
    // Check for commands (prefixed with /)
    if (trimmed.startsWith('/')) {
      const parts = trimmed.slice(1).split(/\s+/);
      const cmd = parts[0];
      const args = parts.slice(1);
      
      const handler = this.commands.get(cmd);
      if (handler) {
        const result = handler(args);
        this.output.push({ type: 'command', input: trimmed, result });
        return result;
      }
      this.output.push({ type: 'error', input: trimmed, result: `Unknown command: ${cmd}` });
      return `Unknown command: ${cmd}`;
    }
    
    // Evaluate
    try {
      const result = this.evaluator(trimmed);
      this.output.push({ type: 'result', input: trimmed, result });
      return result;
    } catch (err) {
      const errorMsg = err.message || String(err);
      this.output.push({ type: 'error', input: trimmed, result: errorMsg });
      return `Error: ${errorMsg}`;
    }
  }

  // Tab completion
  complete(partial) {
    const matches = this.completions.filter(c => c.startsWith(partial));
    if (matches.length === 1) return { text: matches[0], isComplete: true };
    if (matches.length > 1) {
      // Find longest common prefix
      let prefix = matches[0];
      for (const m of matches) {
        while (!m.startsWith(prefix)) prefix = prefix.slice(0, -1);
      }
      return { text: prefix, matches, isComplete: false };
    }
    return { text: partial, matches: [], isComplete: false };
  }

  // Get formatted output
  getLastOutput() {
    return this.output[this.output.length - 1];
  }
}

// ===== Command History =====

export class History {
  constructor(maxSize = 100) {
    this._entries = [];
    this._maxSize = maxSize;
    this._cursor = -1;
  }

  add(entry) {
    // Don't add duplicates of last entry
    if (this._entries.length > 0 && this._entries[this._entries.length - 1] === entry) return;
    this._entries.push(entry);
    if (this._entries.length > this._maxSize) this._entries.shift();
    this._cursor = this._entries.length;
  }

  // Navigate up (older)
  up() {
    if (this._cursor > 0) {
      this._cursor--;
      return this._entries[this._cursor];
    }
    return this._entries[0] ?? null;
  }

  // Navigate down (newer)
  down() {
    if (this._cursor < this._entries.length - 1) {
      this._cursor++;
      return this._entries[this._cursor];
    }
    this._cursor = this._entries.length;
    return null; // back to empty prompt
  }

  entries() { return [...this._entries]; }
  get size() { return this._entries.length; }

  search(query) {
    return this._entries.filter(e => e.includes(query));
  }
}
