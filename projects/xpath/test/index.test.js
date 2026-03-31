const { test } = require('node:test');
const assert = require('node:assert/strict');
const { select, selectOne } = require('../src/index.js');

const data = {
  store: {
    books: [
      { title: 'HP', author: 'Rowling', price: 10 },
      { title: 'LOTR', author: 'Tolkien', price: 15 },
      { title: 'Dune', author: 'Herbert', price: 12 },
    ],
    music: { name: 'Jazz', price: 8 },
  },
  meta: { version: 1 },
};

test('direct child', () => {
  assert.deepEqual(selectOne(data, '/store/music/name'), 'Jazz');
});

test('nested path', () => {
  const books = selectOne(data, '/store/books');
  assert.equal(books.length, 3);
});

test('array index', () => {
  assert.equal(selectOne(data, '/store/books[0]/title'), 'HP');
  assert.equal(selectOne(data, '/store/books[2]/title'), 'Dune');
});

test('last()', () => {
  assert.equal(selectOne(data, '/store/books[last()]/title'), 'Dune');
});

test('filter by attribute', () => {
  const results = select(data, "/store/books[@author='Tolkien']/title");
  assert.deepEqual(results, ['LOTR']);
});

test('numeric filter', () => {
  const results = select(data, '/store/books[@price>11]/title');
  assert.deepEqual(results, ['LOTR', 'Dune']);
});

test('recursive descent', () => {
  const prices = select(data, '//price');
  assert.deepEqual(prices.sort((a,b) => a-b), [8, 10, 12, 15]);
});

test('wildcard', () => {
  const meta = select(data, '/meta/*');
  assert.deepEqual(meta, [1]);
});

test('exists filter', () => {
  const results = select(data, '/store/books[@price]');
  assert.equal(results.length, 3);
});

test('selectOne returns undefined for no match', () => {
  assert.equal(selectOne(data, '/nonexistent'), undefined);
});
