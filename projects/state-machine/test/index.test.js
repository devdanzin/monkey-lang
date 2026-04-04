import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createMachine } from '../src/index.js';

describe('StateMachine — basic', () => {
  const lightMachine = () => createMachine({
    id: 'light',
    initial: 'green',
    states: {
      green: { on: { TIMER: 'yellow' } },
      yellow: { on: { TIMER: 'red' } },
      red: { on: { TIMER: 'green' } },
    },
  });

  it('starts in initial state', () => {
    assert.equal(lightMachine().value, 'green');
  });

  it('transitions on event', () => {
    const m = lightMachine();
    m.send('TIMER');
    assert.equal(m.value, 'yellow');
  });

  it('multiple transitions', () => {
    const m = lightMachine();
    m.send('TIMER').send('TIMER').send('TIMER');
    assert.equal(m.value, 'green'); // full cycle
  });

  it('ignores unknown events', () => {
    const m = lightMachine();
    m.send('UNKNOWN');
    assert.equal(m.value, 'green');
  });

  it('matches()', () => {
    const m = lightMachine();
    assert.equal(m.matches('green'), true);
    assert.equal(m.matches('red'), false);
  });

  it('can()', () => {
    const m = lightMachine();
    assert.equal(m.can('TIMER'), true);
    assert.equal(m.can('UNKNOWN'), false);
  });

  it('events()', () => {
    const m = lightMachine();
    assert.deepEqual(m.events(), ['TIMER']);
  });
});

describe('StateMachine — guards', () => {
  it('transition blocked by guard', () => {
    const m = createMachine({
      initial: 'idle',
      context: { count: 0 },
      states: {
        idle: {
          on: {
            INC: { target: 'active', guard: (ctx) => ctx.count < 3 },
          },
        },
        active: { on: { RESET: 'idle' } },
      },
    });
    
    m.context.count = 5;
    m.send('INC');
    assert.equal(m.value, 'idle'); // guard blocked
    
    m.context.count = 1;
    m.send('INC');
    assert.equal(m.value, 'active');
  });
});

describe('StateMachine — actions', () => {
  it('transition action updates context', () => {
    const m = createMachine({
      initial: 'idle',
      context: { count: 0 },
      states: {
        idle: {
          on: {
            INC: { target: 'idle', action: (ctx) => { ctx.count++; } },
          },
        },
      },
    });
    
    m.send('INC').send('INC').send('INC');
    assert.equal(m.context.count, 3);
  });

  it('entry/exit actions', () => {
    const log = [];
    const m = createMachine({
      initial: 'a',
      states: {
        a: { 
          entry: () => log.push('enter-a'),
          exit: () => log.push('exit-a'),
          on: { GO: 'b' },
        },
        b: {
          entry: () => log.push('enter-b'),
          on: { BACK: 'a' },
        },
      },
    });
    
    assert.deepEqual(log, ['enter-a']);
    m.send('GO');
    assert.deepEqual(log, ['enter-a', 'exit-a', 'enter-b']);
  });
});

describe('StateMachine — event payload', () => {
  it('passes payload to action', () => {
    const m = createMachine({
      initial: 'idle',
      context: { data: null },
      states: {
        idle: {
          on: {
            SET: { target: 'idle', action: (ctx, event) => { ctx.data = event; } },
          },
        },
      },
    });
    
    m.send('SET', { value: 42 });
    assert.deepEqual(m.context.data, { value: 42 });
  });
});

describe('StateMachine — onChange', () => {
  it('notifies on transition', () => {
    const m = createMachine({
      initial: 'off',
      states: {
        off: { on: { TOGGLE: 'on' } },
        on: { on: { TOGGLE: 'off' } },
      },
    });
    
    const transitions = [];
    m.onChange(({ from, to, event }) => transitions.push({ from, to, event }));
    
    m.send('TOGGLE');
    assert.deepEqual(transitions, [{ from: 'off', to: 'on', event: 'TOGGLE' }]);
  });

  it('unsubscribe works', () => {
    const m = createMachine({
      initial: 'a',
      states: { a: { on: { GO: 'b' } }, b: { on: { GO: 'a' } } },
    });
    
    let count = 0;
    const unsub = m.onChange(() => count++);
    m.send('GO');
    assert.equal(count, 1);
    unsub();
    m.send('GO');
    assert.equal(count, 1);
  });
});

describe('StateMachine — final state', () => {
  it('done is true in final state', () => {
    const m = createMachine({
      initial: 'active',
      states: {
        active: { on: { FINISH: 'done' } },
        done: { type: 'final' },
      },
    });
    
    assert.equal(m.done, false);
    m.send('FINISH');
    assert.equal(m.done, true);
  });
});

describe('StateMachine — conditional transitions', () => {
  it('picks first matching transition', () => {
    const m = createMachine({
      initial: 'idle',
      context: { age: 20 },
      states: {
        idle: {
          on: {
            CHECK: [
              { target: 'senior', guard: (ctx) => ctx.age >= 65 },
              { target: 'adult', guard: (ctx) => ctx.age >= 18 },
              { target: 'minor' },
            ],
          },
        },
        minor: {}, adult: {}, senior: {},
      },
    });
    
    m.send('CHECK');
    assert.equal(m.value, 'adult');
  });
});

describe('StateMachine — reset', () => {
  it('resets to initial', () => {
    const m = createMachine({
      initial: 'a',
      states: { a: { on: { GO: 'b' } }, b: {} },
    });
    m.send('GO');
    assert.equal(m.value, 'b');
    m.reset();
    assert.equal(m.value, 'a');
  });
});
