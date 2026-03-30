import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createMachine, StateMachine } from '../src/index.js';

describe('Basic transitions', () => {
  it('starts in initial state', () => {
    const m = createMachine({ initial: 'idle', states: { idle: {} } }).start();
    assert.equal(m.state, 'idle');
  });

  it('transitions on event', () => {
    const m = createMachine({
      initial: 'off',
      states: {
        off: { on: { TOGGLE: 'on' } },
        on: { on: { TOGGLE: 'off' } },
      }
    }).start();

    assert.equal(m.state, 'off');
    m.send('TOGGLE');
    assert.equal(m.state, 'on');
    m.send('TOGGLE');
    assert.equal(m.state, 'off');
  });

  it('ignores unknown events', () => {
    const m = createMachine({
      initial: 'idle',
      states: { idle: { on: { START: 'running' } }, running: {} }
    }).start();

    assert.equal(m.send('STOP'), false);
    assert.equal(m.state, 'idle');
  });
});

describe('Guards', () => {
  it('blocks transition when guard fails', () => {
    const m = createMachine({
      initial: 'locked',
      context: { coins: 0 },
      states: {
        locked: {
          on: {
            INSERT_COIN: {
              target: 'unlocked',
              guard: (ctx) => ctx.coins >= 1,
              action: (ctx) => { ctx.coins--; }
            },
            ADD_COIN: {
              target: 'locked',
              action: (ctx) => { ctx.coins++; }
            }
          }
        },
        unlocked: {
          on: { PUSH: 'locked' }
        }
      }
    }).start();

    assert.equal(m.send('INSERT_COIN'), false); // No coins
    assert.equal(m.state, 'locked');

    m.send('ADD_COIN');
    assert.equal(m.context.coins, 1);

    m.send('INSERT_COIN');
    assert.equal(m.state, 'unlocked');
  });
});

describe('Conditional transitions', () => {
  it('picks first matching guard', () => {
    const m = createMachine({
      initial: 'checking',
      context: { age: 20 },
      states: {
        checking: {
          on: {
            CHECK: [
              { target: 'child', guard: (ctx) => ctx.age < 13 },
              { target: 'teen', guard: (ctx) => ctx.age < 18 },
              { target: 'adult' },
            ]
          }
        },
        child: {}, teen: {}, adult: {}
      }
    }).start();

    m.send('CHECK');
    assert.equal(m.state, 'adult');
  });
});

describe('Entry/exit hooks', () => {
  it('calls entry on start', () => {
    let entered = false;
    const m = createMachine({
      initial: 'idle',
      states: {
        idle: { entry: () => { entered = true; } }
      }
    }).start();
    assert.equal(entered, true);
  });

  it('calls exit and entry on transition', () => {
    const log = [];
    const m = createMachine({
      initial: 'a',
      states: {
        a: { exit: () => log.push('exit-a'), on: { GO: 'b' } },
        b: { entry: () => log.push('enter-b') }
      }
    }).start();

    m.send('GO');
    assert.deepEqual(log, ['exit-a', 'enter-b']);
  });
});

describe('Actions', () => {
  it('executes action on transition', () => {
    const m = createMachine({
      initial: 'idle',
      context: { count: 0 },
      states: {
        idle: {
          on: {
            INC: { target: 'idle', action: (ctx) => { ctx.count++; } }
          }
        }
      }
    }).start();

    m.send('INC');
    m.send('INC');
    m.send('INC');
    assert.equal(m.context.count, 3);
  });
});

describe('Utility methods', () => {
  it('can() checks if event possible', () => {
    const m = createMachine({
      initial: 'a',
      states: { a: { on: { GO: 'b' } }, b: {} }
    }).start();

    assert.equal(m.can('GO'), true);
    assert.equal(m.can('STOP'), false);
  });

  it('is() checks current state', () => {
    const m = createMachine({ initial: 'idle', states: { idle: {} } }).start();
    assert.equal(m.is('idle'), true);
    assert.equal(m.is('running'), false);
  });

  it('possibleEvents()', () => {
    const m = createMachine({
      initial: 'a',
      states: { a: { on: { GO: 'b', STOP: 'a' } }, b: {} }
    }).start();
    assert.deepEqual(m.possibleEvents().sort(), ['GO', 'STOP']);
  });

  it('isFinal()', () => {
    const m = createMachine({
      initial: 'a',
      states: { a: { on: { GO: 'b' } }, b: {} }
    }).start();
    assert.equal(m.isFinal(), false);
    m.send('GO');
    assert.equal(m.isFinal(), true);
  });

  it('getHistory()', () => {
    const m = createMachine({
      initial: 'a',
      states: { a: { on: { GO: 'b' } }, b: { on: { GO: 'c' } }, c: {} }
    }).start();
    m.send('GO'); m.send('GO');
    assert.deepEqual(m.getHistory(), ['a', 'b', 'c']);
  });
});

describe('Events', () => {
  it('emits transition events', () => {
    const m = createMachine({
      initial: 'a',
      states: { a: { on: { GO: 'b' } }, b: {} }
    }).start();

    let ev;
    m.on('transition', (e) => { ev = e; });
    m.send('GO');
    assert.equal(ev.from, 'a');
    assert.equal(ev.to, 'b');
    assert.equal(ev.event, 'GO');
  });
});

describe('Serialization', () => {
  it('toJSON/fromJSON roundtrip', () => {
    const config = {
      initial: 'a',
      context: { count: 0 },
      states: {
        a: { on: { GO: { target: 'b', action: ctx => ctx.count++ } } },
        b: { on: { BACK: 'a' } }
      }
    };
    const m = createMachine(config).start();
    m.send('GO');

    const json = m.toJSON();
    assert.equal(json.current, 'b');
    assert.equal(json.context.count, 1);

    const restored = StateMachine.fromJSON(json, config);
    assert.equal(restored.state, 'b');
    assert.equal(restored.context.count, 1);
  });
});

describe('Traffic light example', () => {
  it('cycles through states', () => {
    const m = createMachine({
      initial: 'green',
      states: {
        green: { on: { NEXT: 'yellow' } },
        yellow: { on: { NEXT: 'red' } },
        red: { on: { NEXT: 'green' } },
      }
    }).start();

    assert.equal(m.state, 'green');
    m.send('NEXT'); assert.equal(m.state, 'yellow');
    m.send('NEXT'); assert.equal(m.state, 'red');
    m.send('NEXT'); assert.equal(m.state, 'green');
  });
});
