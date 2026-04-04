// ===== Pub/Sub Message Broker =====

let msgId = 0;

class Message {
  constructor(topic, data) {
    this.id = ++msgId;
    this.topic = topic;
    this.data = data;
    this.timestamp = Date.now();
    this.acked = false;
  }
}

class Subscription {
  constructor(id, topic, handler, { group, filter, maxRetries = 3 } = {}) {
    this.id = id;
    this.topic = topic;
    this.handler = handler;
    this.group = group;
    this.filter = filter;
    this.maxRetries = maxRetries;
    this.pending = []; // unacked messages
    this.delivered = 0;
    this.failed = 0;
  }
}

export class Broker {
  constructor() {
    this.topics = new Map();         // topic → [messages]
    this.subscriptions = new Map();  // subId → Subscription
    this.topicSubs = new Map();      // topic → Set of subIds
    this._nextSubId = 1;
    this.deadLetter = [];            // failed messages
  }

  // Create a topic
  createTopic(name) {
    if (!this.topics.has(name)) {
      this.topics.set(name, []);
      this.topicSubs.set(name, new Set());
    }
    return this;
  }

  // Subscribe to a topic
  subscribe(topic, handler, options = {}) {
    this.createTopic(topic);
    const id = this._nextSubId++;
    const sub = new Subscription(id, topic, handler, options);
    this.subscriptions.set(id, sub);
    this.topicSubs.get(topic).add(id);
    return id;
  }

  // Unsubscribe
  unsubscribe(subId) {
    const sub = this.subscriptions.get(subId);
    if (!sub) return false;
    this.topicSubs.get(sub.topic)?.delete(subId);
    this.subscriptions.delete(subId);
    return true;
  }

  // Publish a message
  publish(topic, data) {
    this.createTopic(topic);
    const msg = new Message(topic, data);
    this.topics.get(topic).push(msg);
    
    // Deliver to subscribers
    const subs = this.topicSubs.get(topic);
    if (!subs) return msg;

    // Group by consumer group
    const groups = new Map();
    const ungrouped = [];
    
    for (const subId of subs) {
      const sub = this.subscriptions.get(subId);
      if (!sub) continue;
      
      // Apply filter
      if (sub.filter && !sub.filter(msg)) continue;
      
      if (sub.group) {
        if (!groups.has(sub.group)) groups.set(sub.group, []);
        groups.get(sub.group).push(sub);
      } else {
        ungrouped.push(sub);
      }
    }

    // Deliver to all ungrouped subscribers
    for (const sub of ungrouped) {
      this._deliver(sub, msg);
    }

    // Deliver to one subscriber per group (round-robin)
    for (const [, members] of groups) {
      // Pick member with least pending
      const target = members.reduce((a, b) => 
        a.pending.length <= b.pending.length ? a : b
      );
      this._deliver(target, msg);
    }

    return msg;
  }

  _deliver(sub, msg, attempt = 1) {
    try {
      const ack = sub.handler(msg.data, {
        id: msg.id,
        topic: msg.topic,
        timestamp: msg.timestamp,
        ack: () => { msg.acked = true; },
      });
      
      if (ack === false) throw new Error('Handler returned false');
      
      sub.delivered++;
      // Auto-ack if not explicitly acked
      msg.acked = true;
    } catch (err) {
      sub.failed++;
      if (attempt < sub.maxRetries) {
        this._deliver(sub, msg, attempt + 1);
      } else {
        this.deadLetter.push({ msg, error: err.message, subId: sub.id });
      }
    }
  }

  // Publish to wildcard topics (e.g., "user.*" matches "user.login")
  publishWild(topic, data) {
    const msg = new Message(topic, data);
    
    for (const [subTopic, subs] of this.topicSubs) {
      // Check if topic matches subscription pattern
      if (this._topicMatch(subTopic, topic)) {
        for (const subId of subs) {
          const sub = this.subscriptions.get(subId);
          if (sub && (!sub.filter || sub.filter(msg))) {
            this._deliver(sub, msg);
          }
        }
      }
    }
    
    return msg;
  }

  _topicMatch(pattern, topic) {
    if (pattern === topic) return true;
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '[^.]+') + '$');
      return regex.test(topic);
    }
    if (pattern.endsWith('#')) {
      const prefix = pattern.slice(0, -1);
      return topic.startsWith(prefix);
    }
    return false;
  }

  // Get topic stats
  stats(topic) {
    return {
      messages: this.topics.get(topic)?.length ?? 0,
      subscribers: this.topicSubs.get(topic)?.size ?? 0,
      deadLetterCount: this.deadLetter.length,
    };
  }

  // Get all topics
  getTopics() { return [...this.topics.keys()]; }
}
