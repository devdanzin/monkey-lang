import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Logger, ArrayTransport, LEVELS } from '../src/index.js';

function makeLogger(level = 'trace') {
  const transport = new ArrayTransport();
  return { logger: new Logger({ level, transports: [transport] }), transport };
}

describe('Logger — levels', () => {
  it('logs at level', () => { const { logger, transport } = makeLogger(); logger.info('hello'); assert.equal(transport.entries.length, 1); });
  it('filters below level', () => { const { logger, transport } = makeLogger('warn'); logger.debug('skip'); assert.equal(transport.entries.length, 0); });
  it('logs at and above level', () => { const { logger, transport } = makeLogger('warn'); logger.warn('yes'); logger.error('yes'); assert.equal(transport.entries.length, 2); });
  it('all levels work', () => { const { logger, transport } = makeLogger(); logger.trace('t'); logger.debug('d'); logger.info('i'); logger.warn('w'); logger.error('e'); logger.fatal('f'); assert.equal(transport.entries.length, 6); });
});

describe('Logger — formatting', () => {
  it('includes message', () => { const { logger, transport } = makeLogger(); logger.info('hello world'); assert.equal(transport.entries[0].message, 'hello world'); });
  it('includes level', () => { const { logger, transport } = makeLogger(); logger.error('bad'); assert.equal(transport.entries[0].level, 'error'); });
  it('includes timestamp', () => { const { logger, transport } = makeLogger(); logger.info('x'); assert.ok(transport.entries[0].timestamp instanceof Date); });
});

describe('Logger — child', () => {
  it('creates child logger', () => {
    const { logger, transport } = makeLogger();
    const child = logger.child({ name: 'http' });
    child.info('request');
    assert.equal(transport.entries[0].name, 'http');
  });

  it('inherits level', () => {
    const { logger, transport } = makeLogger('error');
    const child = logger.child({ name: 'sub' });
    child.debug('skip');
    assert.equal(transport.entries.length, 0);
  });

  it('nested names', () => {
    const transport = new ArrayTransport();
    const root = new Logger({ name: 'app', level: 'trace', transports: [transport] });
    const child = root.child({ name: 'http' });
    child.info('req');
    assert.equal(transport.entries[0].name, 'app:http');
  });
});

describe('Logger — multiple args', () => {
  it('joins args', () => {
    const { logger, transport } = makeLogger();
    logger.info('a', 'b', 'c');
    assert.equal(transport.entries[0].message, 'a b c');
  });
});
