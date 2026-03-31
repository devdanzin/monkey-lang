import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createLogger, arrayTransport, jsonFormat } from '../src/index.js';

describe('createLogger', () => {
  it('logs at level', () => {
    const entries = [];
    const log = createLogger({ level: 'info', transports: [arrayTransport(entries)] });
    log.info('hello');
    assert.equal(entries.length, 1);
    assert.ok(entries[0].includes('INFO'));
  });

  it('filters below level', () => {
    const entries = [];
    const log = createLogger({ level: 'warn', transports: [arrayTransport(entries)] });
    log.debug('hidden');
    log.info('hidden');
    log.warn('shown');
    assert.equal(entries.length, 1);
  });

  it('all levels', () => {
    const entries = [];
    const log = createLogger({ level: 'trace', transports: [arrayTransport(entries)] });
    log.trace('t'); log.debug('d'); log.info('i'); log.warn('w'); log.error('e'); log.fatal('f');
    assert.equal(entries.length, 6);
  });
});

describe('formats', () => {
  it('json format', () => {
    const entries = [];
    const log = createLogger({ level: 'info', format: jsonFormat, transports: [arrayTransport(entries)] });
    log.info('test');
    const parsed = JSON.parse(entries[0]);
    assert.equal(parsed.level, 'info');
    assert.equal(parsed.message, 'test');
  });
});

describe('child logger', () => {
  it('inherits and adds meta', () => {
    const entries = [];
    const log = createLogger({ level: 'info', format: jsonFormat, transports: [arrayTransport(entries)] });
    const child = log.child({ service: 'api' });
    child.info('request');
    const parsed = JSON.parse(entries[0]);
    assert.equal(parsed.service, 'api');
  });
});
