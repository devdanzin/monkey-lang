import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Logger, Level, defaultFormatter, jsonFormatter, arrayTransport, callbackTransport } from './logger.js';

describe('Log levels', () => {
  it('logs at level', () => {
    const logs = [];
    const logger = new Logger({ level: Level.INFO, transports: [arrayTransport(logs)] });
    logger.info('test');
    assert.equal(logs.length, 1);
  });
  it('filters below level', () => {
    const logs = [];
    const logger = new Logger({ level: Level.WARN, transports: [arrayTransport(logs)] });
    logger.info('filtered');
    logger.debug('filtered');
    assert.equal(logs.length, 0);
  });
  it('all levels work', () => {
    const logs = [];
    const logger = new Logger({ level: Level.TRACE, transports: [arrayTransport(logs)] });
    logger.trace('t'); logger.debug('d'); logger.info('i'); logger.warn('w'); logger.error('e'); logger.fatal('f');
    assert.equal(logs.length, 6);
  });
  it('isLevelEnabled', () => {
    const logger = new Logger({ level: Level.WARN });
    assert.ok(!logger.isLevelEnabled(Level.INFO));
    assert.ok(logger.isLevelEnabled(Level.WARN));
    assert.ok(logger.isLevelEnabled(Level.ERROR));
  });
});

describe('Formatting', () => {
  it('default format includes message', () => {
    const logs = [];
    const logger = new Logger({ level: Level.INFO, transports: [arrayTransport(logs)] });
    logger.info('hello');
    assert.ok(logs[0].includes('hello'));
    assert.ok(logs[0].includes('INFO'));
  });
  it('JSON formatter', () => {
    const logs = [];
    const logger = new Logger({ level: Level.INFO, transports: [arrayTransport(logs)], formatter: jsonFormatter });
    logger.info('test');
    const parsed = JSON.parse(logs[0]);
    assert.equal(parsed.message, 'test');
    assert.equal(parsed.levelName, 'INFO');
  });
  it('name in output', () => {
    const logs = [];
    const logger = new Logger({ level: Level.INFO, name: 'myapp', transports: [arrayTransport(logs)] });
    logger.info('hi');
    assert.ok(logs[0].includes('myapp'));
  });
  it('metadata', () => {
    const logs = [];
    const logger = new Logger({ level: Level.INFO, transports: [arrayTransport(logs)] });
    logger.info('request', { method: 'GET', path: '/' });
    assert.ok(logs[0].includes('GET'));
  });
});

describe('Child loggers', () => {
  it('inherits level', () => {
    const logs = [];
    const parent = new Logger({ level: Level.WARN, transports: [arrayTransport(logs)] });
    const child = parent.child({ requestId: '123' });
    child.info('filtered');
    assert.equal(logs.length, 0);
  });
  it('includes context', () => {
    const entries = [];
    const parent = new Logger({ level: Level.INFO, transports: [callbackTransport((_, e) => entries.push(e))] });
    const child = parent.child({ userId: '42' });
    child.info('action');
    assert.equal(entries[0].userId, '42');
  });
  it('merges context', () => {
    const entries = [];
    const parent = new Logger({ level: Level.INFO, context: { app: 'test' }, transports: [callbackTransport((_, e) => entries.push(e))] });
    const child = parent.child({ requestId: 'abc' });
    child.info('hi');
    assert.equal(entries[0].app, 'test');
    assert.equal(entries[0].requestId, 'abc');
  });
});

describe('Mute', () => {
  it('mute silences', () => {
    const logs = [];
    const logger = new Logger({ level: Level.INFO, transports: [arrayTransport(logs)] });
    logger.mute();
    logger.info('silenced');
    assert.equal(logs.length, 0);
  });
  it('unmute restores', () => {
    const logs = [];
    const logger = new Logger({ level: Level.INFO, transports: [arrayTransport(logs)] });
    logger.mute();
    logger.unmute();
    logger.info('back');
    assert.equal(logs.length, 1);
  });
});

describe('setLevel', () => {
  it('changes level', () => {
    const logs = [];
    const logger = new Logger({ level: Level.ERROR, transports: [arrayTransport(logs)] });
    logger.setLevel(Level.DEBUG);
    logger.debug('now visible');
    assert.equal(logs.length, 1);
  });
});
