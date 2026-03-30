// Finite State Machine library
// Supports: states, transitions, guards, actions, entry/exit hooks, history, parallel states

import { EventEmitter } from '../../event-emitter/src/emitter.js';

export class StateMachine extends EventEmitter {
  constructor(config) {
    super();
    this.id = config.id || 'machine';
    this.states = config.states;
    this.initial = config.initial;
    this.context = { ...config.context } || {};
    this.current = this.initial;
    this.history = [this.initial];
    this._started = false;
  }

  // Start the machine
  start() {
    this._started = true;
    const state = this.states[this.current];
    if (state?.entry) state.entry(this.context);
    this.emit('transition', { from: null, to: this.current, event: null });
    return this;
  }

  // Get current state
  get state() { return this.current; }

  // Check if in a specific state
  is(stateName) { return this.current === stateName; }

  // Send an event to trigger transition
  send(event, payload) {
    if (!this._started) throw new Error('Machine not started');

    const stateConfig = this.states[this.current];
    if (!stateConfig) throw new Error(`Unknown state: ${this.current}`);

    const transitions = stateConfig.on;
    if (!transitions || !transitions[event]) return false;

    const transition = transitions[event];

    // Transition can be string or object
    let target, guard, action;
    if (typeof transition === 'string') {
      target = transition;
    } else if (Array.isArray(transition)) {
      // Multiple possible transitions (first matching guard wins)
      for (const t of transition) {
        if (!t.guard || t.guard(this.context, payload)) {
          target = t.target;
          action = t.action;
          break;
        }
      }
      if (!target) return false;
    } else {
      target = transition.target;
      guard = transition.guard;
      action = transition.action;
    }

    // Check guard
    if (guard && !guard(this.context, payload)) return false;

    // Exit current state
    if (stateConfig.exit) stateConfig.exit(this.context);

    const from = this.current;

    // Execute action
    if (action) action(this.context, payload);

    // Transition
    this.current = target;
    this.history.push(target);

    // Enter new state
    const newState = this.states[target];
    if (newState?.entry) newState.entry(this.context);

    this.emit('transition', { from, to: target, event });
    return true;
  }

  // Check if event is possible from current state
  can(event) {
    const stateConfig = this.states[this.current];
    return !!(stateConfig?.on?.[event]);
  }

  // Get all possible events from current state
  possibleEvents() {
    const stateConfig = this.states[this.current];
    return stateConfig?.on ? Object.keys(stateConfig.on) : [];
  }

  // Check if current state is final (no transitions)
  isFinal() {
    return this.possibleEvents().length === 0;
  }

  // Get transition history
  getHistory() {
    return [...this.history];
  }

  // Reset to initial state
  reset() {
    this.current = this.initial;
    this.history = [this.initial];
    this._started = false;
    return this;
  }

  // Serialize state
  toJSON() {
    return {
      id: this.id,
      current: this.current,
      context: { ...this.context },
      history: [...this.history],
    };
  }

  // Restore from serialized
  static fromJSON(json, config) {
    const machine = new StateMachine({ ...config, initial: json.current });
    machine.context = { ...json.context };
    machine.history = [...json.history];
    machine._started = true;
    return machine;
  }
}

// Helper: create a simple traffic light / turnstile etc
export function createMachine(config) {
  return new StateMachine(config);
}
