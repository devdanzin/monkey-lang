import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createMachine, interpret, Machine } from './statemachine.js';

describe('Basic State Machine', () => {
  const lightConfig = {
    id: 'light',
    initial: 'green',
    states: {
      green: { on: { TIMER: 'yellow' } },
      yellow: { on: { TIMER: 'red' } },
      red: { on: { TIMER: 'green' } },
    }
  };

  it('starts in initial state', () => {
    const m = createMachine(lightConfig);
    assert.equal(m.state, 'green');
  });

  it('transitions on event', () => {
    const m = createMachine(lightConfig);
    m.send('TIMER');
    assert.equal(m.state, 'yellow');
  });

  it('full cycle', () => {
    const m = createMachine(lightConfig);
    m.send('TIMER').send('TIMER').send('TIMER');
    assert.equal(m.state, 'green');
  });

  it('ignores unknown events', () => {
    const m = createMachine(lightConfig);
    m.send('UNKNOWN');
    assert.equal(m.state, 'green');
  });

  it('matches state', () => {
    const m = createMachine(lightConfig);
    assert.ok(m.matches('green'));
    assert.ok(!m.matches('red'));
  });

  it('can check available events', () => {
    const m = createMachine(lightConfig);
    assert.ok(m.can('TIMER'));
    assert.ok(!m.can('RESET'));
  });

  it('tracks history', () => {
    const m = createMachine(lightConfig);
    m.send('TIMER').send('TIMER');
    assert.deepStrictEqual(m.history, ['green', 'yellow', 'red']);
  });
});

describe('Guards', () => {
  it('allows transition when guard passes', () => {
    const m = createMachine({
      initial: 'idle',
      context: { count: 5 },
      states: {
        idle: { on: { SUBMIT: [
          { target: 'submitted', guard: (ctx) => ctx.count > 0 },
          { target: 'error' },
        ] } },
        submitted: {},
        error: {},
      }
    });
    m.send('SUBMIT');
    assert.equal(m.state, 'submitted');
  });

  it('falls through when guard fails', () => {
    const m = createMachine({
      initial: 'idle',
      context: { count: 0 },
      states: {
        idle: { on: { SUBMIT: [
          { target: 'submitted', guard: (ctx) => ctx.count > 0 },
          { target: 'error' },
        ] } },
        submitted: {},
        error: {},
      }
    });
    m.send('SUBMIT');
    assert.equal(m.state, 'error');
  });
});

describe('Actions', () => {
  it('runs entry actions', () => {
    let entered = false;
    const m = createMachine({
      initial: 'a',
      states: {
        a: { on: { GO: 'b' } },
        b: { entry: () => { entered = true; } },
      }
    });
    m.send('GO');
    assert.ok(entered);
  });

  it('runs exit actions', () => {
    let exited = false;
    const m = createMachine({
      initial: 'a',
      states: {
        a: { on: { GO: 'b' }, exit: () => { exited = true; } },
        b: {},
      }
    });
    m.send('GO');
    assert.ok(exited);
  });

  it('runs transition actions', () => {
    let actionRan = false;
    const m = createMachine({
      initial: 'a',
      states: {
        a: { on: { GO: { target: 'b', actions: () => { actionRan = true; } } } },
        b: {},
      }
    });
    m.send('GO');
    assert.ok(actionRan);
  });
});

describe('Context', () => {
  it('assigns context on transition', () => {
    const m = createMachine({
      initial: 'idle',
      context: { count: 0 },
      states: {
        idle: { on: {
          INCREMENT: { target: 'idle', assign: (ctx) => ({ count: ctx.count + 1 }) },
        } },
      }
    });
    m.send('INCREMENT').send('INCREMENT').send('INCREMENT');
    assert.equal(m.context.count, 3);
  });

  it('assigns with payload', () => {
    const m = createMachine({
      initial: 'idle',
      context: { name: '' },
      states: {
        idle: { on: { SET_NAME: { target: 'idle', assign: (ctx, event) => ({ name: event.name }) } } },
      }
    });
    m.send('SET_NAME', { name: 'Alice' });
    assert.equal(m.context.name, 'Alice');
  });
});

describe('Subscribers', () => {
  it('notifies on transition', () => {
    const events = [];
    const m = createMachine({
      initial: 'a',
      states: { a: { on: { GO: 'b' } }, b: {} }
    });
    m.subscribe(e => events.push(e));
    m.send('GO');
    assert.equal(events.length, 1);
    assert.equal(events[0].prevState, 'a');
    assert.equal(events[0].currentState, 'b');
  });

  it('unsubscribes', () => {
    const events = [];
    const m = createMachine({ initial: 'a', states: { a: { on: { GO: 'b' } }, b: { on: { GO: 'a' } } } });
    const unsub = m.subscribe(e => events.push(e));
    m.send('GO');
    unsub();
    m.send('GO');
    assert.equal(events.length, 1);
  });
});

describe('Serialization', () => {
  it('serializes and deserializes', () => {
    const config = { initial: 'a', context: { x: 42 }, states: { a: { on: { GO: 'b' } }, b: {} } };
    const m = createMachine(config);
    m.send('GO');
    const json = m.toJSON();
    const restored = Machine.fromJSON(config, json);
    assert.equal(restored.state, 'b');
    assert.equal(restored.context.x, 42);
  });
});

describe('Reset', () => {
  it('resets to initial state', () => {
    const m = createMachine({ initial: 'a', states: { a: { on: { GO: 'b' } }, b: {} } });
    m.send('GO');
    m.reset();
    assert.equal(m.state, 'a');
  });
});

describe('Interpret', () => {
  it('runs entry action on initial state', () => {
    let ran = false;
    interpret({ initial: 'a', states: { a: { entry: () => { ran = true; } } } });
    assert.ok(ran);
  });
});

describe('Complex: Traffic Light with Timer', () => {
  it('full simulation', () => {
    const m = createMachine({
      initial: 'green',
      context: { ticks: 0 },
      states: {
        green: { on: { TICK: [
          { target: 'yellow', guard: (ctx) => ctx.ticks >= 3, assign: { ticks: 0 } },
          { assign: (ctx) => ({ ticks: ctx.ticks + 1 }) },
        ] } },
        yellow: { on: { TICK: [
          { target: 'red', guard: (ctx) => ctx.ticks >= 1, assign: { ticks: 0 } },
          { assign: (ctx) => ({ ticks: ctx.ticks + 1 }) },
        ] } },
        red: { on: { TICK: [
          { target: 'green', guard: (ctx) => ctx.ticks >= 2, assign: { ticks: 0 } },
          { assign: (ctx) => ({ ticks: ctx.ticks + 1 }) },
        ] } },
      }
    });

    // Green for 4 ticks (3 to accumulate, 4th transitions)
    for (let i = 0; i < 4; i++) m.send('TICK');
    assert.equal(m.state, 'yellow');

    // Yellow for 2 ticks
    for (let i = 0; i < 2; i++) m.send('TICK');
    assert.equal(m.state, 'red');

    // Red for 3 ticks
    for (let i = 0; i < 3; i++) m.send('TICK');
    assert.equal(m.state, 'green');
  });
});
