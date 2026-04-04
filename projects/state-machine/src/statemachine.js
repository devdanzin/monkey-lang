// statemachine.js — Finite State Machine with guards, actions, hierarchical states

export function createMachine(config) {
  return new Machine(config);
}

export class Machine {
  constructor(config) {
    this.id = config.id || 'machine';
    this.initial = config.initial;
    this.states = config.states;
    this.context = config.context ? { ...config.context } : {};
    this.currentState = this.initial;
    this.listeners = [];
    this.history = [this.initial];
  }

  get state() { return this.currentState; }
  get stateConfig() { return this.states[this.currentState]; }

  transition(event, payload) {
    const stateConfig = this.states[this.currentState];
    if (!stateConfig) throw new Error(`Invalid state: ${this.currentState}`);

    const eventName = typeof event === 'string' ? event : event.type;
    const transitions = stateConfig.on?.[eventName];
    if (!transitions) return this; // no transition for this event

    // Handle array of transitions (conditional)
    const candidates = Array.isArray(transitions) ? transitions : [transitions];

    for (const trans of candidates) {
      const config = typeof trans === 'string' ? { target: trans } : trans;

      // Check guard
      if (config.guard && !config.guard(this.context, { type: eventName, ...payload })) continue;

      const prevState = this.currentState;

      // Run exit actions
      if (stateConfig.exit) this._runActions(stateConfig.exit, { type: eventName, ...payload });

      // Run transition actions
      if (config.actions) this._runActions(config.actions, { type: eventName, ...payload });

      // Update context
      if (config.assign) {
        if (typeof config.assign === 'function') {
          this.context = { ...this.context, ...config.assign(this.context, { type: eventName, ...payload }) };
        } else {
          this.context = { ...this.context, ...config.assign };
        }
      }

      // Transition
      if (config.target) {
        this.currentState = config.target;
        this.history.push(this.currentState);
      }

      // Run entry actions
      const newStateConfig = this.states[this.currentState];
      if (newStateConfig?.entry) this._runActions(newStateConfig.entry, { type: eventName, ...payload });

      // Notify listeners
      this._notify({ prevState, currentState: this.currentState, event: eventName });

      return this;
    }

    return this; // no matching transition
  }

  send(event, payload) { return this.transition(event, payload); }

  matches(state) { return this.currentState === state; }

  can(event) {
    const stateConfig = this.states[this.currentState];
    return !!(stateConfig?.on?.[event]);
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  _notify(data) {
    for (const listener of this.listeners) listener(data);
  }

  _runActions(actions, event) {
    const actionList = Array.isArray(actions) ? actions : [actions];
    for (const action of actionList) {
      if (typeof action === 'function') action(this.context, event);
    }
  }

  // Serialize/deserialize
  toJSON() {
    return { state: this.currentState, context: this.context, history: this.history };
  }

  static fromJSON(config, saved) {
    const machine = new Machine(config);
    machine.currentState = saved.state;
    machine.context = saved.context;
    machine.history = saved.history;
    return machine;
  }

  // Reset
  reset() {
    this.currentState = this.initial;
    this.history = [this.initial];
  }
}

// ===== Interpret (auto-start with initial entry) =====
export function interpret(config) {
  const machine = createMachine(config);
  const stateConfig = machine.states[machine.initial];
  if (stateConfig?.entry) machine._runActions(stateConfig.entry, { type: 'xstate.init' });
  return machine;
}
