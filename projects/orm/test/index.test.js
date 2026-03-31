const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Database } = require('../src/index.js');

test('create and find', async () => {
  const db = new Database();
  const User = db.define('User', {
    name: { type: 'string', required: true },
    age: { type: 'number', default: 0 },
  });
  const user = await User.create({ name: 'Alice', age: 30 });
  assert.equal(user.name, 'Alice');
  assert.equal(user.id, 1);
  assert.ok(user.createdAt);

  const found = User.findById(1);
  assert.equal(found.name, 'Alice');
});

test('auto-increment IDs', async () => {
  const db = new Database();
  const Item = db.define('Item', { name: { type: 'string' } });
  const a = await Item.create({ name: 'A' });
  const b = await Item.create({ name: 'B' });
  assert.equal(a.id, 1);
  assert.equal(b.id, 2);
});

test('defaults', async () => {
  const db = new Database();
  const Post = db.define('Post', {
    title: { type: 'string' },
    status: { type: 'string', default: 'draft' },
  });
  const p = await Post.create({ title: 'Hello' });
  assert.equal(p.status, 'draft');
});

test('validation — required', async () => {
  const db = new Database();
  const User = db.define('User', { name: { type: 'string', required: true } });
  await assert.rejects(() => User.create({}), /required/);
});

test('validation — type and range', async () => {
  const db = new Database();
  const User = db.define('User', {
    age: { type: 'number', min: 0, max: 150 },
  });
  await assert.rejects(() => User.create({ age: -1 }), /must be >= 0/);
  await assert.rejects(() => User.create({ age: 200 }), /must be <= 150/);
});

test('validation — enum', async () => {
  const db = new Database();
  const Task = db.define('Task', {
    status: { type: 'string', enum: ['open', 'closed'] },
  });
  await assert.rejects(() => Task.create({ status: 'maybe' }), /must be one of/);
});

test('update', async () => {
  const db = new Database();
  const User = db.define('User', { name: { type: 'string' }, age: { type: 'number' } });
  await User.create({ name: 'Bob', age: 25 });
  const count = await User.update({ name: 'Bob' }, { age: 26 });
  assert.equal(count, 1);
  assert.equal(User.findOne({ name: 'Bob' }).age, 26);
});

test('delete', async () => {
  const db = new Database();
  const User = db.define('User', { name: { type: 'string' } });
  await User.create({ name: 'A' });
  await User.create({ name: 'B' });
  const deleted = await User.delete({ name: 'A' });
  assert.equal(deleted, 1);
  assert.equal(User.count(), 1);
});

test('query builder — where, orderBy, limit, offset', async () => {
  const db = new Database();
  const User = db.define('User', { name: { type: 'string' }, age: { type: 'number' } });
  await User.create({ name: 'Alice', age: 30 });
  await User.create({ name: 'Bob', age: 25 });
  await User.create({ name: 'Charlie', age: 35 });

  const results = User.find().orderBy('age', 'desc').limit(2).exec();
  assert.equal(results.length, 2);
  assert.equal(results[0].name, 'Charlie');

  const young = User.find({ age: { $lt: 30 } }).exec();
  assert.equal(young.length, 1);
  assert.equal(young[0].name, 'Bob');
});

test('operator queries', async () => {
  const db = new Database();
  const Item = db.define('Item', { name: { type: 'string' }, price: { type: 'number' } });
  await Item.create({ name: 'A', price: 10 });
  await Item.create({ name: 'B', price: 20 });
  await Item.create({ name: 'C', price: 30 });

  assert.equal(Item.find({ price: { $gte: 20 } }).count(), 2);
  assert.equal(Item.find({ name: { $in: ['A', 'C'] } }).exec().length, 2);
  assert.equal(Item.find({ price: { $ne: 20 } }).exec().length, 2);
});

test('select fields', async () => {
  const db = new Database();
  const User = db.define('User', { name: { type: 'string' }, age: { type: 'number' } });
  await User.create({ name: 'Alice', age: 30 });
  const results = User.find().select('name').exec();
  assert.equal(results[0].name, 'Alice');
  assert.equal(results[0].age, undefined);
});

test('hooks', async () => {
  const db = new Database();
  const log = [];
  const User = db.define('User', { name: { type: 'string' } });
  User.hook('beforeCreate', (r) => { log.push(`before:${r.name}`); });
  User.hook('afterCreate', (r) => { log.push(`after:${r.name}`); });
  await User.create({ name: 'Alice' });
  assert.deepEqual(log, ['before:Alice', 'after:Alice']);
});

test('relations — hasMany / belongsTo', async () => {
  const db = new Database();
  const User = db.define('User', { name: { type: 'string' } });
  const Post = db.define('Post', { title: { type: 'string' }, UserId: { type: 'number' } });
  User.hasMany('Post');
  Post.belongsTo('User');

  const user = await User.create({ name: 'Alice' });
  await Post.create({ title: 'Post 1', UserId: user.id });
  await Post.create({ title: 'Post 2', UserId: user.id });

  const populated = await User.populate({ ...user }, 'Post');
  assert.equal(populated.Post.length, 2);
});

test('count', async () => {
  const db = new Database();
  const Item = db.define('Item', { name: { type: 'string' } });
  await Item.create({ name: 'A' });
  await Item.create({ name: 'B' });
  assert.equal(Item.count(), 2);
  assert.equal(Item.count({ name: 'A' }), 1);
});
