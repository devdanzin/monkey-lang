import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { 
  Database, createTable, insert, select, update, deleteFrom,
  eq, neq, lt, gt, lte, gte, and, or, like, inList,
  count, sum, avg, min, max
} from '../src/index.js';

function seedDB() {
  const db = new Database();
  db.execute(createTable('users', [
    { name: 'id', type: 'int' },
    { name: 'name', type: 'string' },
    { name: 'age', type: 'int' },
    { name: 'city', type: 'string' },
  ]));
  db.execute(insert('users', ['name', 'age', 'city'], ['Alice', 30, 'NYC']));
  db.execute(insert('users', ['name', 'age', 'city'], ['Bob', 25, 'SF']));
  db.execute(insert('users', ['name', 'age', 'city'], ['Charlie', 35, 'NYC']));
  db.execute(insert('users', ['name', 'age', 'city'], ['Diana', 28, 'LA']));
  db.execute(insert('users', ['name', 'age', 'city'], ['Eve', 32, 'SF']));
  return db;
}

describe('SQL — CREATE TABLE', () => {
  it('creates a table', () => {
    const db = new Database();
    const r = db.execute(createTable('users', [{ name: 'id' }, { name: 'name' }]));
    assert.equal(r.type, 'ok');
  });

  it('fails on duplicate table', () => {
    const db = new Database();
    db.execute(createTable('users', []));
    assert.throws(() => db.execute(createTable('users', [])));
  });
});

describe('SQL — INSERT', () => {
  it('inserts a row', () => {
    const db = new Database();
    db.execute(createTable('users', [{ name: 'name' }]));
    const r = db.execute(insert('users', ['name'], ['Alice']));
    assert.equal(r.type, 'ok');
  });

  it('auto-increments id', () => {
    const db = seedDB();
    const r = db.execute(select('*').FROM('users'));
    assert.equal(r.rows[0].id, 1);
    assert.equal(r.rows[1].id, 2);
  });
});

describe('SQL — SELECT', () => {
  it('selects all rows', () => {
    const db = seedDB();
    const r = db.execute(select('*').FROM('users'));
    assert.equal(r.count, 5);
  });

  it('selects with WHERE =', () => {
    const db = seedDB();
    const r = db.execute(select('*').FROM('users').WHERE(eq('city', 'NYC')));
    assert.equal(r.count, 2);
  });

  it('selects with WHERE <', () => {
    const db = seedDB();
    const r = db.execute(select('*').FROM('users').WHERE(lt('age', 30)));
    assert.equal(r.count, 2); // Bob (25), Diana (28)
  });

  it('selects with AND condition', () => {
    const db = seedDB();
    const r = db.execute(select('*').FROM('users').WHERE(
      and(eq('city', 'NYC'), gt('age', 30))
    ));
    assert.equal(r.count, 1); // Charlie
    assert.equal(r.rows[0].name, 'Charlie');
  });

  it('selects with OR condition', () => {
    const db = seedDB();
    const r = db.execute(select('*').FROM('users').WHERE(
      or(eq('city', 'LA'), eq('city', 'SF'))
    ));
    assert.equal(r.count, 3); // Bob, Diana, Eve
  });

  it('selects with LIKE', () => {
    const db = seedDB();
    const r = db.execute(select('*').FROM('users').WHERE(like('name', 'A%')));
    assert.equal(r.count, 1);
    assert.equal(r.rows[0].name, 'Alice');
  });

  it('selects with IN', () => {
    const db = seedDB();
    const r = db.execute(select('*').FROM('users').WHERE(inList('name', ['Alice', 'Bob'])));
    assert.equal(r.count, 2);
  });

  it('selects with ORDER BY ASC', () => {
    const db = seedDB();
    const r = db.execute(select('*').FROM('users').ORDER_BY('age', 'ASC'));
    assert.equal(r.rows[0].name, 'Bob');
    assert.equal(r.rows[4].name, 'Charlie');
  });

  it('selects with ORDER BY DESC', () => {
    const db = seedDB();
    const r = db.execute(select('*').FROM('users').ORDER_BY('age', 'DESC'));
    assert.equal(r.rows[0].name, 'Charlie');
  });

  it('selects with LIMIT', () => {
    const db = seedDB();
    const r = db.execute(select('*').FROM('users').LIMIT(2));
    assert.equal(r.count, 2);
  });

  it('ORDER BY + LIMIT', () => {
    const db = seedDB();
    const r = db.execute(select('*').FROM('users').ORDER_BY('age', 'DESC').LIMIT(3));
    assert.equal(r.count, 3);
    assert.equal(r.rows[0].name, 'Charlie');
  });
});

describe('SQL — UPDATE', () => {
  it('updates matching rows', () => {
    const db = seedDB();
    db.execute(update('users').SET({ city: 'Boston' }).WHERE(eq('name', 'Alice')));
    const r = db.execute(select('*').FROM('users').WHERE(eq('name', 'Alice')));
    assert.equal(r.rows[0].city, 'Boston');
  });

  it('updates all rows without WHERE', () => {
    const db = seedDB();
    db.execute(update('users').SET({ city: 'Nowhere' }));
    const r = db.execute(select('*').FROM('users'));
    for (const row of r.rows) assert.equal(row.city, 'Nowhere');
  });
});

describe('SQL — DELETE', () => {
  it('deletes matching rows', () => {
    const db = seedDB();
    db.execute(deleteFrom('users').WHERE(eq('city', 'NYC')));
    const r = db.execute(select('*').FROM('users'));
    assert.equal(r.count, 3);
  });
});

describe('SQL — GROUP BY + aggregates', () => {
  it('groups by city with COUNT', () => {
    const db = seedDB();
    const r = db.execute(
      select([count('*', 'count')]).FROM('users').GROUP_BY('city')
    );
    const nyc = r.rows.find(r => r.city === 'NYC');
    assert.equal(nyc.count, 2);
    const sf = r.rows.find(r => r.city === 'SF');
    assert.equal(sf.count, 2);
  });

  it('groups by city with AVG age', () => {
    const db = seedDB();
    const r = db.execute(
      select([avg('age', 'avg_age')]).FROM('users').GROUP_BY('city')
    );
    const nyc = r.rows.find(r => r.city === 'NYC');
    assert.equal(nyc.avg_age, 32.5); // (30+35)/2
  });
});

describe('SQL — JOIN', () => {
  it('inner join', () => {
    const db = seedDB();
    db.execute(createTable('orders', [
      { name: 'id' }, { name: 'user_id' }, { name: 'product' }, { name: 'amount' },
    ]));
    db.execute(insert('orders', ['user_id', 'product', 'amount'], [1, 'Widget', 100]));
    db.execute(insert('orders', ['user_id', 'product', 'amount'], [2, 'Gadget', 200]));
    db.execute(insert('orders', ['user_id', 'product', 'amount'], [1, 'Gizmo', 50]));
    
    const r = db.execute(
      select('*').FROM('users').JOIN('orders', { left: 'id', right: 'orders.user_id' })
    );
    assert.equal(r.count, 3); // Alice has 2 orders, Bob has 1
  });
});

describe('SQL — DROP TABLE', () => {
  it('drops existing table', () => {
    const db = seedDB();
    db.execute({ type: 'drop', table: 'users' });
    assert.throws(() => db.getTable('users'));
  });
});
