import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ORM, defineModel, field, hasMany, belongsTo } from './orm.js';

const User = defineModel('User', {
  name: field('string', { required: true }),
  email: field('string'),
  age: field('integer'),
  posts: hasMany('Post', 'userId'),
});

const Post = defineModel('Post', {
  title: field('string'),
  body: field('string'),
  userId: field('integer'),
  user: belongsTo('User', 'userId'),
});

describe('CRUD', () => {
  let db;
  beforeEach(() => { db = new ORM(); db.register(User).register(Post); });

  it('creates a record', () => {
    const user = db.create('User', { name: 'Alice', email: 'alice@test.com', age: 30 });
    assert.equal(user.id, 1);
    assert.equal(user.name, 'Alice');
    assert.ok(user.createdAt);
  });

  it('auto-increments ids', () => {
    db.create('User', { name: 'A' });
    db.create('User', { name: 'B' });
    const c = db.create('User', { name: 'C' });
    assert.equal(c.id, 3);
  });

  it('finds by id', () => {
    db.create('User', { name: 'Alice' });
    const user = db.findById('User', 1);
    assert.equal(user.name, 'Alice');
  });

  it('returns null for missing id', () => {
    assert.equal(db.findById('User', 999), null);
  });

  it('updates a record', () => {
    db.create('User', { name: 'Alice', age: 30 });
    const updated = db.update('User', 1, { age: 31 });
    assert.equal(updated.age, 31);
    assert.equal(updated.name, 'Alice');
  });

  it('deletes a record', () => {
    db.create('User', { name: 'Alice' });
    assert.ok(db.delete('User', 1));
    assert.equal(db.findById('User', 1), null);
  });

  it('delete returns false for missing', () => {
    assert.ok(!db.delete('User', 999));
  });
});

describe('Query Builder', () => {
  let db;
  beforeEach(() => {
    db = new ORM();
    db.register(User).register(Post);
    db.create('User', { name: 'Alice', age: 30 });
    db.create('User', { name: 'Bob', age: 25 });
    db.create('User', { name: 'Charlie', age: 35 });
  });

  it('findAll', async () => {
    const users = await db.query('User').findAll();
    assert.equal(users.length, 3);
  });

  it('where equality', async () => {
    const users = await db.query('User').where({ name: 'Bob' }).findAll();
    assert.equal(users.length, 1);
    assert.equal(users[0].name, 'Bob');
  });

  it('where comparison', async () => {
    const users = await db.query('User').where({ age: { $gt: 28 } }).findAll();
    assert.equal(users.length, 2);
  });

  it('orderBy', async () => {
    const users = await db.query('User').orderBy('age', 'DESC').findAll();
    assert.equal(users[0].name, 'Charlie');
  });

  it('limit', async () => {
    const users = await db.query('User').limit(2).findAll();
    assert.equal(users.length, 2);
  });

  it('offset', async () => {
    const users = await db.query('User').orderBy('id').offset(1).findAll();
    assert.equal(users[0].name, 'Bob');
  });

  it('select columns', async () => {
    const users = await db.query('User').select('name', 'age').findAll();
    assert.ok('name' in users[0]);
    assert.ok(!('email' in users[0]));
  });

  it('findOne', async () => {
    const user = await db.query('User').where({ name: 'Alice' }).findOne();
    assert.equal(user.name, 'Alice');
  });

  it('findOne returns null', async () => {
    const user = await db.query('User').where({ name: 'Nobody' }).findOne();
    assert.equal(user, null);
  });

  it('count', async () => {
    const count = await db.query('User').where({ age: { $gte: 30 } }).count();
    assert.equal(count, 2);
  });

  it('chained query', async () => {
    const users = await db.query('User').where({ age: { $gt: 20 } }).orderBy('age').limit(2).findAll();
    assert.equal(users.length, 2);
    assert.equal(users[0].name, 'Bob'); // youngest
  });
});

describe('Relationships', () => {
  let db;
  beforeEach(() => {
    db = new ORM();
    db.register(User).register(Post);
    db.create('User', { name: 'Alice' });
    db.create('User', { name: 'Bob' });
    db.create('Post', { title: 'Post 1', userId: 1 });
    db.create('Post', { title: 'Post 2', userId: 1 });
    db.create('Post', { title: 'Post 3', userId: 2 });
  });

  it('hasMany eager loading', async () => {
    const users = await db.query('User').include('posts').findAll();
    const alice = users.find(u => u.name === 'Alice');
    assert.equal(alice.posts.length, 2);
  });

  it('belongsTo eager loading', async () => {
    const posts = await db.query('Post').include('user').findAll();
    assert.equal(posts[0].user.name, 'Alice');
    assert.equal(posts[2].user.name, 'Bob');
  });
});

describe('Bulk Operations', () => {
  let db;
  beforeEach(() => { db = new ORM(); db.register(User); });

  it('bulkCreate', () => {
    const users = db.bulkCreate('User', [{ name: 'A' }, { name: 'B' }, { name: 'C' }]);
    assert.equal(users.length, 3);
    assert.equal(db.count('User'), 3);
  });

  it('truncate', () => {
    db.bulkCreate('User', [{ name: 'A' }, { name: 'B' }]);
    db.truncate('User');
    assert.equal(db.count('User'), 0);
  });
});

describe('Migrations', () => {
  let db;
  beforeEach(() => { db = new ORM(); db.register(User); });

  it('applies migration', () => {
    db.addMigration('add_role', (db) => {
      // Would alter table in real DB
    }, () => {});
    db.migrate();
    assert.ok(db.migrations[0].applied);
  });

  it('rollback migration', () => {
    let rolledBack = false;
    db.addMigration('test', () => {}, () => { rolledBack = true; });
    db.migrate();
    db.rollback();
    assert.ok(rolledBack);
    assert.ok(!db.migrations[0].applied);
  });
});
