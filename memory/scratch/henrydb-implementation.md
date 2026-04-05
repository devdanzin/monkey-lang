# HenryDB Implementation Notes
uses: 1
created: 2026-04-05
last-used: 2026-04-05
topics: database, SQL, B+tree, WAL, MVCC, query-planner, secondary-indexes

## Architecture (7 layers)
1. **Page storage** — 4KB slotted pages, buffer pool, heap file
2. **B+ tree** — unique/non-unique modes, range scan via linked leaves
3. **SQL parser** — recursive descent, tokenizer → AST
4. **Query executor** — table scan, index scan, JOIN, GROUP BY, subqueries
5. **Query planner** — cost-based, selectivity estimation, hash join vs nested-loop
6. **Transaction manager** — MVCC, WAL, snapshot isolation
7. **Schema DDL** — CREATE/DROP TABLE, CREATE/DROP INDEX, ALTER TABLE

## Key Design Decisions

### Non-unique B+ tree for secondary indexes
- Primary key indexes use `unique: true` (replace on duplicate key)
- Secondary indexes use `unique: false` (allow duplicate keys by always inserting)
- Use `range(key, key)` instead of `search(key)` for index lookups to get all matches

### Index scan in query planner
- Only used for equality WHERE on indexed column (no JOINs)
- AND expressions: try index on one side, residual filter on other
- JOINs still use full scan + nested loop (index could be added later)

### ALTER TABLE requires index rebuild
- Schema change rewrites all tuples → RIDs change → indexes become stale
- After ADD/DROP COLUMN: rebuild all indexes from scratch
- Expensive but correct; could optimize with in-place tuple modification

### GROUP BY implementation
- Hash-based grouping using Map with key = GROUP BY column values joined by \0
- Aggregates computed per group
- HAVING applied after grouping
- ORDER BY and LIMIT applied last

### Subquery execution
- Uncorrelated subqueries only (executed independently)
- Scalar subqueries: first column of first row
- IN (SELECT): compare against all values in result
- EXISTS: check if subquery returns any rows

## Test Patterns That Caught Bugs
- Index scan returning wrong results for JOINed queries (WHERE applied pre-JOIN)
- B+ tree overwriting values on duplicate keys (broke non-unique secondary indexes)
- ALTER TABLE invalidating index RIDs (required full rebuild)

## Growth: 126 → 282 tests in one session
- +24 secondary index tests
- +15 GROUP BY tests
- +15 subquery tests
- +21 ALTER TABLE tests
- +22 crash recovery stress tests
- +21 string function tests (LIKE, UPPER, LOWER, LENGTH, CONCAT, ||, BETWEEN)
- +14 window function tests (ROW_NUMBER, RANK, DENSE_RANK, aggregate OVER)
- +12 view tests (CREATE VIEW, DROP VIEW, query from views)
- +12 DISTINCT tests (SELECT DISTINCT, COUNT(DISTINCT))

## SQL Feature Coverage (comprehensive)
- DDL: CREATE TABLE, DROP TABLE, ALTER TABLE (ADD/DROP/RENAME COLUMN, RENAME TABLE), CREATE/DROP INDEX, CREATE/DROP VIEW
- DML: INSERT, SELECT, UPDATE, DELETE
- Expressions: arithmetic, string functions, LIKE, BETWEEN, IN, EXISTS, subqueries
- Aggregates: COUNT, SUM, AVG, MIN, MAX (with DISTINCT support)
- Clauses: WHERE, ORDER BY, LIMIT, OFFSET, GROUP BY, HAVING, DISTINCT
- Joins: INNER JOIN, LEFT JOIN
- Window functions: ROW_NUMBER, RANK, DENSE_RANK, COUNT/SUM OVER PARTITION
- Views: CREATE VIEW AS SELECT, query from views
- Indexes: B+ tree, unique/non-unique, auto-selection in query planner
- Transactions: MVCC, WAL, snapshot isolation, crash recovery
