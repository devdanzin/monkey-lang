// Undo/Redo — command pattern with history, grouping, size limits

export class UndoManager {
  constructor({ maxHistory = 100 } = {}) {
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistory = maxHistory;
    this._group = null;
  }

  // Execute a command and push to undo stack
  execute(command) {
    command.execute();
    if (this._group) {
      this._group.commands.push(command);
    } else {
      this.undoStack.push(command);
      if (this.undoStack.length > this.maxHistory) this.undoStack.shift();
      this.redoStack = []; // Clear redo on new action
    }
    return this;
  }

  undo() {
    const cmd = this.undoStack.pop();
    if (!cmd) return false;
    cmd.undo();
    this.redoStack.push(cmd);
    return true;
  }

  redo() {
    const cmd = this.redoStack.pop();
    if (!cmd) return false;
    cmd.execute();
    this.undoStack.push(cmd);
    return true;
  }

  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }
  get undoCount() { return this.undoStack.length; }
  get redoCount() { return this.redoStack.length; }

  // Group multiple operations as one undo step
  beginGroup() { this._group = { commands: [] }; return this; }
  endGroup() {
    if (!this._group) return this;
    const group = new GroupCommand(this._group.commands);
    this._group = null;
    this.undoStack.push(group);
    if (this.undoStack.length > this.maxHistory) this.undoStack.shift();
    this.redoStack = [];
    return this;
  }

  clear() { this.undoStack = []; this.redoStack = []; return this; }
}

// Group of commands that undo/redo together
class GroupCommand {
  constructor(commands) { this.commands = commands; }
  execute() { for (const cmd of this.commands) cmd.execute(); }
  undo() { for (const cmd of [...this.commands].reverse()) cmd.undo(); }
}

// Helper: create a simple command from execute/undo functions
export function createCommand(executeFn, undoFn) {
  return { execute: executeFn, undo: undoFn };
}

// Helper: create a property-set command
export function setProperty(obj, key, newValue) {
  const oldValue = obj[key];
  return createCommand(
    () => { obj[key] = newValue; },
    () => { obj[key] = oldValue; }
  );
}
