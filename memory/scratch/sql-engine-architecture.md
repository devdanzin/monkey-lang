# SQL Engine Architecture (HenryDB)

uses: 1
created: 2026-04-05
status: active

## Pipeline
```
SQL String → Tokenizer → Parser → AST → Planner → Execution Plan → Executor → Result
```

## Key Components

### Parser
- Hand-written recursive descent (no parser generator)
- Handles: SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER, BEGIN/COMMIT/ROLLBACK
- Subquery support: IN, NOT IN, EXISTS, NOT EXISTS, scalar subqueries
- CTE: WITH...AS prefix before SELECT
- Window functions: OVER (PARTITION BY...ORDER BY...)

### Query Planner
- Converts AST to execution nodes (scan, filter, project, join, aggregate, sort, limit)
- Index scan when applicable
- Hash join for equi-joins
- Sort-merge for ORDER BY

### Execution Engine
- Pull-based (volcano model): each node has a `next()` method
- Materializes results into arrays
- Streaming where possible

### Storage
- B-tree for primary key indexes
- In-memory (no disk persistence yet)
- Page-based structure for future disk support

## SQL Feature Interactions That Are Tricky

### Window functions + WHERE
- WHERE executes before window functions
- So `WHERE rn = 1` doesn't work inline — must use CTE/subquery

### GROUP BY + HAVING
- HAVING can reference aggregate functions
- HAVING COUNT(*) works but HAVING with complex expressions may not

### Subqueries
- Correlated subqueries: re-evaluated per outer row
- Scalar subqueries: must return exactly one row, one column
- IN subqueries: can return multiple rows, one column

### JOIN + GROUP BY
- Table aliases (p.name) become the column key in results
- Qualified column names in expressions may not work in all positions

## What I Learned

### Testing SQL engines
- Each feature needs tests in isolation AND in combination
- Real bugs appear at feature intersections (JOIN + GROUP BY + ORDER BY)
- Error handling tests are as important as happy-path tests
- Need both "does it work?" and "does it fail correctly?"

### Performance considerations (not implemented)
- Query optimizer: choose join order, use indexes
- Predicate pushdown: filter before join
- Projection pushdown: only read needed columns
- Cost-based optimization: estimate row counts for planning

### Missing features that are hard to add
- CAST/COALESCE/NULLIF require function-call syntax in parser
- Multiple CTEs (WITH a AS (...), b AS (...)) need parser changes
- Recursive CTEs need a fixpoint evaluation loop
- GROUP BY with CASE requires expression hashing
