// JIT event instrumentation tests
//
// Verifies the per-event JSON Lines stream that fires when JIT_EVENTS=full.
// Spawns a child node process for each test so the env var can be set
// independently — the JIT_EVENTS_FULL constant is captured at module load
// time, so we can't toggle it from inside the same process.

import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strict as assert } from 'node:assert';
import { describe, it, before, after } from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPL = join(__dirname, 'repl.js');

let TMP;
before(() => { TMP = mkdtempSync(join(tmpdir(), 'jit-events-')); });
after(() => { rmSync(TMP, { recursive: true, force: true }); });

function runWithEvents(source, env = {}) {
  const path = join(TMP, `prog-${Math.random().toString(36).slice(2)}.monkey`);
  writeFileSync(path, source);
  const result = spawnSync('node', [REPL, path], {
    env: { ...process.env, ...env },
    encoding: 'utf-8',
  });
  // Parse stderr line-by-line as JSONL; ignore non-JSON lines.
  const events = [];
  for (const line of result.stderr.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) continue;
    try { events.push(JSON.parse(trimmed)); } catch {}
  }
  return { events, stdout: result.stdout, stderr: result.stderr, status: result.status };
}

const HOT_LOOP = `
let sum = 0;
let i = 0;
while (i < 30) { sum = sum + i; i = i + 1; }
puts(sum);
`;

describe('JIT events: gate', () => {
  it('emits no events when JIT_EVENTS is unset', () => {
    const { events } = runWithEvents(HOT_LOOP, { JIT_EVENTS: '' });
    assert.equal(events.length, 0, 'JIT_EVENTS=off should suppress all event lines');
  });

  it('emits no events when JIT_EVENTS=summary (only the end-of-run blob if --trace-info)', () => {
    const { events } = runWithEvents(HOT_LOOP, { JIT_EVENTS: 'summary' });
    // JIT_EVENTS=summary triggers the same end-of-run blob as --trace-info.
    // No per-event stream lines should appear.
    const streamEvents = events.filter(e => e.t);
    assert.equal(streamEvents.length, 0, 'summary tier should not emit per-event lines');
    // The summary blob should be present and carry the schema version.
    const blob = events.find(e => !e.t && e.v === 1);
    assert.ok(blob, 'summary tier should still emit the end-of-run blob');
    assert.equal(blob.v, 1);
  });

  it('emits the per-event stream when JIT_EVENTS=full', () => {
    const { events } = runWithEvents(HOT_LOOP, { JIT_EVENTS: 'full' });
    const streamEvents = events.filter(e => e.t);
    assert.ok(streamEvents.length > 0, 'full tier should emit stream events');
  });
});

describe('JIT events: schema', () => {
  it('every event carries v:1', () => {
    const { events } = runWithEvents(HOT_LOOP, { JIT_EVENTS: 'full' });
    const stream = events.filter(e => e.t);
    for (const e of stream) {
      assert.equal(e.v, 1, `event ${e.t} missing schema version`);
    }
  });

  it('summary blob carries v:1', () => {
    const { events } = runWithEvents(HOT_LOOP, { JIT_EVENTS: 'summary' });
    const blob = events.find(e => !e.t);
    assert.ok(blob);
    assert.equal(blob.v, 1);
  });
});

describe('JIT events: lifecycle', () => {
  it('emits loop_hot → trace_start → trace_complete → compile sequence', () => {
    const { events } = runWithEvents(HOT_LOOP, { JIT_EVENTS: 'full' });
    const types = events.filter(e => e.t).map(e => e.t);
    const hotIdx = types.indexOf('loop_hot');
    const startIdx = types.indexOf('trace_start');
    const completeIdx = types.indexOf('trace_complete');
    const compileIdx = types.indexOf('compile');
    assert.ok(hotIdx >= 0, 'loop_hot event missing');
    assert.ok(startIdx > hotIdx, 'trace_start must follow loop_hot');
    assert.ok(completeIdx > startIdx, 'trace_complete must follow trace_start');
    assert.ok(compileIdx > completeIdx, 'compile must follow trace_complete');
  });

  it('compile event reports ok=true and IR/guard counts', () => {
    const { events } = runWithEvents(HOT_LOOP, { JIT_EVENTS: 'full' });
    const compile = events.find(e => e.t === 'compile');
    assert.ok(compile, 'compile event missing');
    assert.equal(compile.ok, true);
    assert.equal(typeof compile.ir, 'number');
    assert.equal(typeof compile.guards, 'number');
    assert.ok(compile.ir > 0);
  });

  it('trace_complete reports IR and guard counts', () => {
    const { events } = runWithEvents(HOT_LOOP, { JIT_EVENTS: 'full' });
    const complete = events.find(e => e.t === 'trace_complete');
    assert.ok(complete);
    assert.ok(complete.ir > 0);
    assert.ok(complete.guards >= 0);
  });
});

describe('JIT events: uop and guard streams', () => {
  it('emits uop events with opcode names', () => {
    const { events } = runWithEvents(HOT_LOOP, { JIT_EVENTS: 'full' });
    const uops = events.filter(e => e.t === 'uop');
    assert.ok(uops.length > 0);
    // Should see several distinct IR ops in a hot loop body
    const ops = new Set(uops.map(u => u.op));
    assert.ok(ops.has('add_int'), 'add_int uop expected for hot int loop');
    assert.ok(ops.has('load_global'), 'load_global uop expected');
  });

  it('emits guard events distinct from uop events for guard ops', () => {
    const { events } = runWithEvents(HOT_LOOP, { JIT_EVENTS: 'full' });
    const guards = events.filter(e => e.t === 'guard');
    assert.ok(guards.length > 0);
    // Each guard event has a guard_idx
    for (const g of guards) {
      assert.equal(typeof g.guard_idx, 'number');
      assert.ok(g.op.startsWith('guard_'));
    }
  });

  it('uop events carry minimal operand identifiers', () => {
    const { events } = runWithEvents(HOT_LOOP, { JIT_EVENTS: 'full' });
    const uops = events.filter(e => e.t === 'uop');
    const loadGlobals = uops.filter(u => u.op === 'load_global');
    assert.ok(loadGlobals.length > 0);
    // load_global should have an `index` operand
    assert.ok(loadGlobals.every(u => typeof u.index === 'number'));
  });
});

describe('JIT events: trace_exit', () => {
  it('emits trace_exit events with exit reason', () => {
    const { events } = runWithEvents(HOT_LOOP, { JIT_EVENTS: 'full' });
    const exits = events.filter(e => e.t === 'trace_exit');
    assert.ok(exits.length > 0, 'trace_exit event missing');
    for (const e of exits) {
      assert.ok(e.exit, `trace_exit missing exit field: ${JSON.stringify(e)}`);
    }
  });
});

describe('JIT events: abort path', () => {
  const ABORT_PROG = `
let i = 0.0;
let total = 0.0;
while (i < 50.0) { total = total + i; i = i + 1.0; }
puts(total);
`;

  it('emits trace_abort with reason for bailout-triggering programs', () => {
    const { events } = runWithEvents(ABORT_PROG, { JIT_EVENTS: 'full' });
    const aborts = events.filter(e => e.t === 'trace_abort');
    assert.ok(aborts.length > 0, 'expected at least one trace_abort');
    for (const a of aborts) {
      assert.ok(a.reason, 'trace_abort missing reason');
      assert.notEqual(a.reason, 'unknown', 'reason should be specific, not "unknown"');
    }
  });

  it('emits blacklisted event after 3 aborts at the same site', () => {
    const { events } = runWithEvents(ABORT_PROG, { JIT_EVENTS: 'full' });
    const blacklisted = events.filter(e => e.t === 'blacklisted');
    assert.equal(blacklisted.length, 1, 'blacklist should fire exactly once per key');
    assert.ok(blacklisted[0].abort_count >= 3);
  });
});

describe('JIT events: --trace-info compatibility', () => {
  it('--trace-info still emits the summary blob with v:1', () => {
    const path = join(TMP, 'compat.monkey');
    writeFileSync(path, HOT_LOOP);
    const result = spawnSync('node', [REPL, path, '--trace-info'], { encoding: 'utf-8' });
    const lines = result.stderr.split('\n').filter(l => l.trim().startsWith('{'));
    const blob = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).find(o => o && !o.t);
    assert.ok(blob, '--trace-info should emit one summary blob');
    assert.equal(blob.v, 1);
    assert.ok('traces' in blob);
    assert.ok('hot_sites' in blob);
  });

  it('--trace-info preserves all preexisting summary fields', () => {
    const path = join(TMP, 'compat2.monkey');
    writeFileSync(path, HOT_LOOP);
    const result = spawnSync('node', [REPL, path, '--trace-info'], { encoding: 'utf-8' });
    const lines = result.stderr.split('\n').filter(l => l.trim().startsWith('{'));
    const blob = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).find(o => o && !o.t);
    // These fields existed before this PR — must still be present.
    for (const field of ['engine', 'elapsed_ms', 'traces', 'side_traces',
                         'total_ir', 'total_guards', 'hot_sites', 'blacklisted',
                         'aborts', 'trace_details']) {
      assert.ok(field in blob, `summary blob missing preexisting field: ${field}`);
    }
  });
});
