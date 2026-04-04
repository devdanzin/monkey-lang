// ===== State Machine =====
// XState-inspired finite state machine with guards, actions, context

export class StateMachine {
  constructor(config) {
    this.id = config.id || 'machine';
    this.states = config.states;
    this.initial = config.initial;
    this.context = config.context ? { ...config.context } : {};
    this.current = this.initial;
    this._listeners = [];
    
    // Run entry action for initial state
    const initialState = this.states[this.initial];
    if (initialState?.entry) initialState.entry(this.context);
  }

  // Send an event to the machine
  send(event, payload) {
    const eventName = typeof event === 'string' ? event : event.type;
    const eventData = typeof event === 'string' ? payload : event;
    
    const stateConfig = this.states[this.current];
    if (!stateConfig || !stateConfig.on) return this;
    
    const transition = stateConfig.on[eventName];
    if (!transition) return this;
    
    // Normalize transition
    const transitions = Array.isArray(transition) ? transition : [transition];
    
    for (const t of transitions) {
      const target = typeof t === 'string' ? t : t.target;
      const guard = typeof t === 'object' ? t.guard : undefined;
      const action = typeof t === 'object' ? t.action : undefined;
      
      // Check guard
      if (guard && !guard(this.context, eventData)) continue;
      
      const prevState = this.current;
      
      // Exit action
      if (stateConfig.exit) stateConfig.exit(this.context);
      
      // Transition action
      if (action) action(this.context, eventData);
      
      // Change state
      if (target) this.current = target;
      
      // Entry action
      const newStateConfig = this.states[this.current];
      if (newStateConfig?.entry) newStateConfig.entry(this.context);
      
      // Notify listeners
      for (const listener of this._listeners) {
        listener({ from: prevState, to: this.current, event: eventName, context: this.context });
      }
      
      return this;
    }
    
    return this;
  }

  // Check if in a specific state
  matches(state) {
    return this.current === state;
  }

  // Check if a transition is possible
  can(event) {
    const stateConfig = this.states[this.current];
    if (!stateConfig?.on) return false;
    
    const transition = stateConfig.on[event];
    if (!transition) return false;
    
    const transitions = Array.isArray(transition) ? transition : [transition];
    for (const t of transitions) {
      const guard = typeof t === 'object' ? t.guard : undefined;
      if (!guard || guard(this.context)) return true;
    }
    return true;
  }

  // Get available events
  events() {
    const stateConfig = this.states[this.current];
    return stateConfig?.on ? Object.keys(stateConfig.on) : [];
  }

  // Subscribe to transitions
  onChange(listener) {
    this._listeners.push(listener);
    return () => {
      this._listeners = this._listeners.filter(l => l !== listener);
    };
  }

  // Get current state info
  get value() { return this.current; }

  // Check if in final state
  get done() {
    const stateConfig = this.states[this.current];
    return stateConfig?.type === 'final';
  }

  // Reset to initial state
  reset() {
    this.current = this.initial;
    return this;
  }
}

// ===== Builder =====

export function createMachine(config) {
  return new StateMachine(config);
}
