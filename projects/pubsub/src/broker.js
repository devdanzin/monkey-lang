// Pub/Sub Message Broker — topic-based publish/subscribe with patterns, history, middleware

export class Broker {
  constructor() {
    this.topics = new Map();       // topic → Set of subscribers
    this.patterns = [];            // {pattern, handler} for wildcard subscriptions
    this.history = new Map();      // topic → last N messages
    this.middleware = [];           // pre-publish transforms
    this.historySize = 100;
    this._deadLetterHandler = null;
  }

  // Subscribe to a topic
  subscribe(topic, handler, { replay = 0 } = {}) {
    if (topic.includes('*') || topic.includes('#')) {
      // Wildcard pattern
      const regex = this._topicToRegex(topic);
      const entry = { pattern: topic, regex, handler };
      this.patterns.push(entry);

      // Replay matching history
      if (replay > 0) {
        for (const [t, msgs] of this.history) {
          if (regex.test(t)) {
            const replayMsgs = msgs.slice(-replay);
            for (const msg of replayMsgs) handler(msg, t);
          }
        }
      }

      return () => {
        const idx = this.patterns.indexOf(entry);
        if (idx >= 0) this.patterns.splice(idx, 1);
      };
    }

    if (!this.topics.has(topic)) this.topics.set(topic, new Set());
    this.topics.get(topic).add(handler);

    // Replay history
    if (replay > 0 && this.history.has(topic)) {
      const msgs = this.history.get(topic).slice(-replay);
      for (const msg of msgs) handler(msg, topic);
    }

    return () => {
      const subs = this.topics.get(topic);
      if (subs) {
        subs.delete(handler);
        if (subs.size === 0) this.topics.delete(topic);
      }
    };
  }

  // Publish a message to a topic
  publish(topic, message) {
    // Run middleware
    let msg = message;
    for (const mw of this.middleware) {
      msg = mw(topic, msg);
      if (msg === undefined) return 0; // Middleware filtered it
    }

    // Store in history
    if (!this.history.has(topic)) this.history.set(topic, []);
    const hist = this.history.get(topic);
    hist.push(msg);
    if (hist.length > this.historySize) hist.shift();

    let delivered = 0;

    // Exact subscribers
    const subs = this.topics.get(topic);
    if (subs) {
      for (const handler of subs) {
        try { handler(msg, topic); delivered++; }
        catch (e) { /* swallow errors */ }
      }
    }

    // Pattern subscribers
    for (const { regex, handler } of this.patterns) {
      if (regex.test(topic)) {
        try { handler(msg, topic); delivered++; }
        catch (e) { /* swallow */ }
      }
    }

    // Dead letter if nobody received it
    if (delivered === 0 && this._deadLetterHandler) {
      this._deadLetterHandler(msg, topic);
    }

    return delivered;
  }

  // Subscribe and automatically unsubscribe after N messages
  subscribeOnce(topic, handler) {
    const unsub = this.subscribe(topic, (msg, t) => {
      unsub();
      handler(msg, t);
    });
    return unsub;
  }

  // Add middleware (runs before publish)
  use(fn) {
    this.middleware.push(fn);
    return this;
  }

  // Set dead letter handler
  onDeadLetter(handler) {
    this._deadLetterHandler = handler;
    return this;
  }

  // Get subscriber count for a topic
  subscriberCount(topic) {
    let count = this.topics.get(topic)?.size || 0;
    for (const { regex } of this.patterns) {
      if (regex.test(topic)) count++;
    }
    return count;
  }

  // Get message history for a topic
  getHistory(topic, count = 10) {
    return (this.history.get(topic) || []).slice(-count);
  }

  // Get all active topics
  activeTopics() {
    return [...this.topics.keys()];
  }

  // Clear all subscriptions
  clear() {
    this.topics.clear();
    this.patterns = [];
    this.history.clear();
    this.middleware = [];
  }

  // Topic wildcard → regex
  // * matches one level, # matches multiple levels
  _topicToRegex(pattern) {
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '[^.]+')
      .replace(/#/g, '.*');
    return new RegExp(`^${escaped}$`);
  }

  // Request/reply pattern
  request(topic, message, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const replyTopic = `_reply.${Date.now()}.${Math.random().toString(36).slice(2)}`;
      const timer = setTimeout(() => {
        unsub();
        reject(new Error(`Request timeout on ${topic}`));
      }, timeout);

      const unsub = this.subscribe(replyTopic, (msg) => {
        clearTimeout(timer);
        unsub();
        resolve(msg);
      });

      this.publish(topic, { payload: message, replyTo: replyTopic });
    });
  }
}
