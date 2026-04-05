# Test Writing Patterns

uses: 1
created: 2026-04-05
status: active

## What Makes Tests Fast to Write

### Pattern: Read existing code → write tests that exercise it
- Read the module's public API
- Write tests for happy path, then edge cases, then errors
- Use `beforeEach` for setup, keep tests independent
- Name tests descriptively: what does it verify?

### Common test structure
1. Setup (create objects/data)
2. Execute (call the function)
3. Assert (verify result)

### When writing tests for existing code:
- Start with the simplest function/class
- Build up: unit tests → integration tests → edge cases
- Identify the "contract" each function provides
- Test boundaries: empty input, single input, large input, invalid input

## Project-Specific Patterns

### Database (HenryDB)
- Each test creates tables + inserts fresh data
- Test SQL features independently (WHERE, JOIN, GROUP BY, etc.)
- Verify both row count and specific values
- Test error cases: syntax errors, missing tables, duplicates

### Chess Engine
- Use known FEN positions for deterministic testing
- Perft tests: compare node counts against published values
- Search tests: verify it finds known tactical moves (mate, winning capture)
- Zobrist: same position = same hash, different = different

### Regex Engine
- Test both NFA (match) and DFA (compile+match) paths
- Verify capture groups return correct substrings
- Test pathological patterns for performance
- Compare our engine against native RegExp for correctness

### Type Checker
- Use AST constructors (Expr.Lam, Expr.App, etc.)
- Verify inferred type string matches expected
- Test both correct programs and type errors
- Important: resetFresh() before tests that depend on fresh var names

### Ray Tracer
- Use known geometry (sphere at origin, rays along axes)
- Verify intersection t values mathematically
- BVH: compare against brute-force linear search
- Materials: verify scatter direction is in correct hemisphere

## Velocity Insights
- Tests per hour: ~35-40 when in flow state
- Key bottleneck: discovering what features exist vs don't
- Failing tests tell you about unsupported features → adjust
- Round number milestones (100, 200, 500, 800) are motivating
