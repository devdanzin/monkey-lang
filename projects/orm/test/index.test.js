import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Model, hasMany, hasOne, belongsTo } from '../src/index.js';

class User extends Model {}
class Post extends Model {}

beforeEach(() => Model.clearAll());

describe('ORM — CRUD', () => {
  it('create', () => { const u = User.create({ name: 'Alice' }); assert.ok(u.id > 0); assert.equal(u.name, 'Alice'); });
  it('findById', () => { const u = User.create({ name: 'Bob' }); assert.equal(User.findById(u.id).name, 'Bob'); });
  it('findAll', () => { User.create({ name: 'A' }); User.create({ name: 'B' }); assert.equal(User.findAll().length, 2); });
  it('update', () => { const u = User.create({ name: 'Old' }); User.update(u.id, { name: 'New' }); assert.equal(User.findById(u.id).name, 'New'); });
  it('delete', () => { const u = User.create({ name: 'X' }); User.delete(u.id); assert.equal(User.findById(u.id), null); });
  it('count', () => { User.create({}); User.create({}); assert.equal(User.count(), 2); });
  it('where', () => { User.create({ age: 20 }); User.create({ age: 30 }); assert.equal(User.where(u => u.age > 25).length, 1); });
});

describe('ORM — Query Builder', () => {
  it('where clause', () => {
    User.create({ name: 'Alice', age: 30 });
    User.create({ name: 'Bob', age: 25 });
    const results = User.query().where('age', '>', 27).execute();
    assert.equal(results.length, 1);
    assert.equal(results[0].name, 'Alice');
  });

  it('orderBy', () => {
    User.create({ name: 'B' }); User.create({ name: 'A' }); User.create({ name: 'C' });
    const results = User.query().orderBy('name').execute();
    assert.equal(results[0].name, 'A');
  });

  it('limit + offset', () => {
    for (let i = 0; i < 10; i++) User.create({ num: i });
    const results = User.query().orderBy('num').offset(3).limit(2).execute();
    assert.equal(results.length, 2);
    assert.equal(results[0].num, 3);
  });

  it('select fields', () => {
    User.create({ name: 'Alice', age: 30, email: 'a@b.c' });
    const [result] = User.query().select('name', 'age').execute();
    assert.equal(result.name, 'Alice');
    assert.equal(result.email, undefined);
  });

  it('first()', () => {
    User.create({ name: 'X' });
    assert.equal(User.query().first().name, 'X');
  });

  it('count()', () => {
    User.create({}); User.create({});
    assert.equal(User.query().count(), 2);
  });
});

describe('ORM — Relationships', () => {
  it('hasMany', () => {
    const u = User.create({ name: 'Alice' });
    Post.create({ title: 'Post 1', userId: u.id });
    Post.create({ title: 'Post 2', userId: u.id });
    Post.create({ title: 'Other', userId: 999 });
    
    const userPosts = hasMany(User, Post, 'userId');
    assert.equal(userPosts(u.id).length, 2);
  });

  it('belongsTo', () => {
    const u = User.create({ name: 'Bob' });
    const p = Post.create({ title: 'Hello', userId: u.id });
    
    const postAuthor = belongsTo(Post, User, 'userId');
    assert.equal(postAuthor(p).name, 'Bob');
  });
});
