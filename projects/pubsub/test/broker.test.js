import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Broker } from '../src/index.js';

describe('Basic pub/sub', () => {
  it('subscribe and publish', () => {
    const broker = new Broker();
    const msgs = [];
    broker.subscribe('test', msg => msgs.push(msg));
    broker.publish('test', 'hello');
    assert.deepEqual(msgs, ['hello']);
  });

  it('multiple subscribers', () => {
    const broker = new Broker();
    const a = [], b = [];
    broker.subscribe('x', msg => a.push(msg));
    broker.subscribe('x', msg => b.push(msg));
    broker.publish('x', 1);
    assert.deepEqual(a, [1]);
    assert.deepEqual(b, [1]);
  });

  it('returns delivery count', () => {
    const broker = new Broker();
    broker.subscribe('x', () => {});
    broker.subscribe('x', () => {});
    assert.equal(broker.publish('x', 'msg'), 2);
  });

  it('unsubscribe', () => {
    const broker = new Broker();
    const msgs = [];
    const unsub = broker.subscribe('x', msg => msgs.push(msg));
    broker.publish('x', 1);
    unsub();
    broker.publish('x', 2);
    assert.deepEqual(msgs, [1]);
  });
});

describe('Wildcard patterns', () => {
  it('* matches one level', () => {
    const broker = new Broker();
    const msgs = [];
    broker.subscribe('user.*', (msg, topic) => msgs.push(topic));
    broker.publish('user.created', 1);
    broker.publish('user.deleted', 1);
    broker.publish('order.created', 1);
    assert.deepEqual(msgs, ['user.created', 'user.deleted']);
  });

  it('# matches multiple levels', () => {
    const broker = new Broker();
    const msgs = [];
    broker.subscribe('app.#', (msg, topic) => msgs.push(topic));
    broker.publish('app.user.created', 1);
    broker.publish('app.order', 1);
    broker.publish('other', 1);
    assert.deepEqual(msgs, ['app.user.created', 'app.order']);
  });
});

describe('subscribeOnce', () => {
  it('fires only once', () => {
    const broker = new Broker();
    let count = 0;
    broker.subscribeOnce('x', () => count++);
    broker.publish('x', 1);
    broker.publish('x', 2);
    assert.equal(count, 1);
  });
});

describe('History', () => {
  it('stores messages', () => {
    const broker = new Broker();
    broker.publish('x', 1);
    broker.publish('x', 2);
    broker.publish('x', 3);
    assert.deepEqual(broker.getHistory('x', 2), [2, 3]);
  });

  it('replay on subscribe', () => {
    const broker = new Broker();
    broker.publish('x', 1);
    broker.publish('x', 2);
    const msgs = [];
    broker.subscribe('x', msg => msgs.push(msg), { replay: 2 });
    assert.deepEqual(msgs, [1, 2]);
  });
});

describe('Middleware', () => {
  it('transforms messages', () => {
    const broker = new Broker();
    broker.use((topic, msg) => msg.toUpperCase());
    const msgs = [];
    broker.subscribe('x', msg => msgs.push(msg));
    broker.publish('x', 'hello');
    assert.deepEqual(msgs, ['HELLO']);
  });

  it('filters messages', () => {
    const broker = new Broker();
    broker.use((topic, msg) => msg > 5 ? msg : undefined);
    const msgs = [];
    broker.subscribe('x', msg => msgs.push(msg));
    broker.publish('x', 3);
    broker.publish('x', 10);
    assert.deepEqual(msgs, [10]);
  });
});

describe('Dead letter', () => {
  it('handles undelivered messages', () => {
    const broker = new Broker();
    const dead = [];
    broker.onDeadLetter((msg, topic) => dead.push({ topic, msg }));
    broker.publish('nobody', 'lost');
    assert.equal(dead.length, 1);
    assert.equal(dead[0].topic, 'nobody');
  });
});

describe('Utility', () => {
  it('subscriberCount', () => {
    const broker = new Broker();
    broker.subscribe('x', () => {});
    broker.subscribe('x', () => {});
    assert.equal(broker.subscriberCount('x'), 2);
  });

  it('activeTopics', () => {
    const broker = new Broker();
    broker.subscribe('a', () => {});
    broker.subscribe('b', () => {});
    assert.deepEqual(broker.activeTopics().sort(), ['a', 'b']);
  });

  it('clear', () => {
    const broker = new Broker();
    broker.subscribe('x', () => {});
    broker.publish('x', 1);
    broker.clear();
    assert.deepEqual(broker.activeTopics(), []);
    assert.deepEqual(broker.getHistory('x'), []);
  });
});

describe('Request/reply', () => {
  it('request and respond', async () => {
    const broker = new Broker();
    broker.subscribe('service', (msg) => {
      broker.publish(msg.replyTo, { result: msg.payload * 2 });
    });
    const response = await broker.request('service', 21);
    assert.equal(response.result, 42);
  });
});
