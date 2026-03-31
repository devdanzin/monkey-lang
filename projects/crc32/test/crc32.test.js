import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { crc32, crc32hex, CRC32Stream } from '../src/index.js';

describe('crc32', () => {
  it('empty string', () => assert.equal(crc32(''), 0));
  it('known value', () => assert.equal(crc32hex('123456789'), 'cbf43926')); // Standard test vector
  it('hello', () => assert.equal(typeof crc32('hello'), 'number'));
  it('Uint8Array', () => assert.equal(crc32(new Uint8Array([0x31, 0x32, 0x33])), crc32('123')));
  it('deterministic', () => assert.equal(crc32('test'), crc32('test')));
  it('different inputs differ', () => assert.notEqual(crc32('abc'), crc32('xyz')));
});

describe('CRC32Stream', () => {
  it('streaming matches one-shot', () => {
    const stream = new CRC32Stream();
    stream.update('12345');
    stream.update('6789');
    assert.equal(stream.hex(), crc32hex('123456789'));
  });
  it('reset', () => {
    const stream = new CRC32Stream();
    stream.update('hello');
    stream.reset();
    stream.update('123456789');
    assert.equal(stream.hex(), 'cbf43926');
  });
});
