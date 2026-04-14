# JIT Event Schema

The Monkey JIT can emit a per-event JSON Lines stream on stderr describing
its internal lifecycle: which loops became hot, which traces were recorded,
what IR each trace produced, when guards fired, when traces aborted and
why, when traces were blacklisted, when side traces were promoted, etc.
The stream is opt-in via the `JIT_EVENTS` environment variable and intended
for fuzzing tools (mimule, lafleur-style differential fuzzers) and
debugging.

## Modes

```
JIT_EVENTS=off       (default) no events emitted, no overhead
JIT_EVENTS=summary   end-of-run summary blob only (same as --trace-info)
JIT_EVENTS=full      summary blob + per-event JSON Lines stream
```

The `--trace-info` CLI flag is equivalent to `JIT_EVENTS=summary`. Setting
both is harmless; `JIT_EVENTS=full` is the strongest setting and supersedes
the others.

## Output format

When the stream is enabled, each event is one line of stderr containing a
single JSON object. Lines are independent — there is no surrounding array
or framing. Consumers should split on `\n` and parse each non-empty line
with `JSON.parse`.

Every event carries:

- `v`: schema version (currently always `1`)
- `t`: event type (string, see vocabulary below)
- `key`: trace identifier as `"<closureId>:<startIp>"` (most events)

Other fields are event-specific. Consumers MUST ignore unknown event types
and unknown fields so the schema can evolve additively without breaking
older clients.

## Event vocabulary

### `loop_hot`

A loop back-edge counter crossed `HOT_LOOP_THRESHOLD` (currently 16). A
trace recording will start at this site on the next dispatch.

```json
{"v":1,"t":"loop_hot","key":"42:108","count":16}
```

### `func_hot`

A function call counter crossed `HOT_FUNC_THRESHOLD` (currently 16). The
JIT will attempt to compile the function as a method (not a trace).

```json
{"v":1,"t":"func_hot","fn_id":7,"count":16}
```

### `trace_start`

Recorder began capturing a new trace. `kind` is one of:

- `"loop"` — root trace at a hot loop header
- `"side"` — side trace from a guard exit (also includes `parent` and `guard_idx`)
- `"func"` — function trace (also includes `num_args`)

```json
{"v":1,"t":"trace_start","key":"42:108","kind":"loop"}
{"v":1,"t":"trace_start","key":"42:200","kind":"side","parent":"42:108","guard_idx":3}
{"v":1,"t":"trace_start","key":"99:0","kind":"func","num_args":2}
```

### `uop`

One IR instruction emitted into the recording trace. This is the
**highest-volume event** — a typical hot trace produces 20–100 of these.
Payload is intentionally minimal (opcode + the most useful operand
identifiers, no values) to keep stream size manageable. Mimule's coverage
manager increments `uops[op]` on each one.

```json
{"v":1,"t":"uop","key":"42:108","op":"add_int"}
{"v":1,"t":"uop","key":"42:108","op":"load_local","slot":0}
{"v":1,"t":"uop","key":"42:108","op":"load_global","index":21}
{"v":1,"t":"uop","key":"42:108","op":"guard_int","ref":3}
```

The full opcode vocabulary is the `IR` enum in `src/jit.js` (46 opcodes
covering constants, loads/stores, arithmetic, comparison, guards,
control flow, function calls, array/hash ops, builtins, and boxing).

### `guard`

A guard instruction was emitted. Fires **in addition to** the `uop` event
for the same instruction — gives consumers a separate guard channel
without having to filter `uop` events by opcode prefix. Includes
`guard_idx` (the index in the trace's IR list) so it can be correlated
with later `trace_exit` events that name the same `guard_idx`.

```json
{"v":1,"t":"guard","key":"42:108","op":"guard_int","guard_idx":3,"ref":2}
```

### `trace_complete`

The recorder finished a trace successfully (reached the loop header again
for a loop trace, or returned for a function trace). The trace will be
optimized and compiled next.

```json
{"v":1,"t":"trace_complete","key":"42:108","ir":24,"guards":3}
```

`ir` and `guards` are the pre-optimization counts.

### `trace_abort`

The recorder bailed out mid-trace. `reason` is one of:

| Reason | When |
|-|-|
| `instr_count_max` | Trace exceeded 200 IR instructions |
| `instr_count_max_func` | Same, for function-trace path |
| `float_arith` | Float operands during int arithmetic |
| `float_negate` | Unary minus on a float |
| `bool_compare` | Comparison between booleans |
| `mixed_numeric_compare` | Comparison mixing int and float |
| `string_compare` | String comparison |
| `null_compare` | Comparison involving null |
| `enum_compare` | Comparison between enums |
| `array_lit` | Array literal construction |
| `hash_lit` | Hash literal construction |
| `index_unsupported` | Index op on something other than array+int or hash+key |
| `inline_too_deep` | Inline depth exceeded `MAX_INLINE_DEPTH` (3) |
| `inline_callee_has_loop` | Tried to inline a function containing a backward jump |
| `builtin_call` | Built-in call other than the inlinable `len()` / `push()` |
| `string_concat_localconst` | String concat in OpGetLocalAddConst path |

Future versions may add reasons; consumers should treat unknown reasons
as opaque strings.

```json
{"v":1,"t":"trace_abort","key":"99:50","reason":"float_arith","ir":3}
```

### `compile`

The optimizer + compiler ran on a completed trace. `ok` indicates whether
compilation produced a callable JS function. `kind` is `loop`, `side`, or
`func`. `ir` and `guards` are the **post-optimization** counts (typically
smaller than the `trace_complete` counts due to dedup and DCE).

```json
{"v":1,"t":"compile","key":"42:108","ok":true,"ir":19,"guards":3,"kind":"loop"}
```

### `recompile_inline`

A parent trace was recompiled with a side trace inlined into its body.

```json
{"v":1,"t":"recompile_inline","key":"42:108","side_traces":1}
```

### `trace_exit`

A compiled trace returned from execution with an exit reason. `exit` is
one of `guard`, `guard_falsy`, `guard_truthy`, `loop_back`, `max_iter`,
or `call`. For guard exits, `guard_idx` and `side_exit_count` are
included so consumers can track which guard sites are getting hot.

```json
{"v":1,"t":"trace_exit","key":"42:108","exit":"guard_falsy","guard_idx":8,"side_exit_count":1}
{"v":1,"t":"trace_exit","key":"42:108","exit":"loop_back"}
{"v":1,"t":"trace_exit","key":"42:108","exit":"max_iter"}
```

### `side_trace_promote`

A guard exit reached `HOT_EXIT_THRESHOLD` (currently 8) and the JIT will
start recording a side trace from it on the next exit.

```json
{"v":1,"t":"side_trace_promote","parent":"42:108","guard_idx":2}
```

### `trace_invalidate`

A `GUARD_CLOSURE` guard mismatched, indicating the parent trace was
recorded for a different closure than the one currently executing. The
trace is deleted and may be re-recorded.

```json
{"v":1,"t":"trace_invalidate","key":"42:108"}
```

### `inline_enter` / `inline_leave`

The recorder entered or left an inlined function frame. `depth` is the
new nesting depth (1, 2, 3...). `call_site_ip` is the bytecode IP of the
enclosing call instruction.

```json
{"v":1,"t":"inline_enter","key":"42:108","depth":1,"call_site_ip":150}
{"v":1,"t":"inline_leave","key":"42:108","depth":0}
```

### `inline_max_depth`

The recorder tried to enter an inlined frame but `MAX_INLINE_DEPTH` (3)
was already reached. The trace will abort with reason `inline_too_deep`.

```json
{"v":1,"t":"inline_max_depth","key":"42:108","depth":3}
```

### `blacklisted`

A trace key reached 3 aborts and was blacklisted. The JIT will no longer
attempt to record traces at this site.

```json
{"v":1,"t":"blacklisted","key":"99:50","abort_count":3}
```

## Summary blob

When `JIT_EVENTS=summary` (or the `--trace-info` CLI flag) is set, a
single JSON object is written to stderr at the end of the run. This is
the historical `--trace-info` output, now carrying `v:1`:

```json
{
  "v":1,
  "engine":"jit",
  "elapsed_ms":12.66,
  "traces":1,
  "side_traces":0,
  "total_ir":19,
  "total_guards":0,
  "hot_sites":1,
  "blacklisted":0,
  "aborts":0,
  "trace_details":[
    {"key":"27:159","ir_ops":19,"guards":0,"side_traces":0,"compiled":true}
  ]
}
```

The summary blob fields are unchanged from before the introduction of
`JIT_EVENTS` (the only addition is the `v` field). Existing consumers of
`--trace-info` continue to work without modification.

## Performance

When `JIT_EVENTS=off` (the default), the cost is one branch check at each
of ~25 emit sites. V8 inlines and folds these so the overhead is
unmeasurable in practice.

When `JIT_EVENTS=full`, the overhead depends entirely on how often the
recorder runs and how big the recorded traces are:

- Long compute loops (single trace, 100K iterations): ~38 events,
  ~2.5 KB stream, no measurable slowdown — the hot loop runs without
  emitting since events fire only during recording, not during compiled
  trace execution.
- Trace-churn workloads with many aborts (e.g. `examples/mandelbrot.monkey`,
  which exercises lots of inlining and side-trace promotion): ~108K
  events, ~6.6 MB stream, ~4.5× slowdown driven by `JSON.stringify` and
  unbuffered `stderr.write` per event.

Stream output is unbuffered (every event flushes), so consumers can read
line-by-line as the program runs without waiting for the program to
finish.

## Stability

The schema follows additive evolution: new event types and new fields can
appear in future versions, but existing fields will not change shape or
meaning within `v:1`. Breaking changes will bump the version.

Consumers should:
- Match on the `t` field as the dispatch key
- Ignore unknown event types and unknown fields
- Not assume a fixed event ordering except where causally implied
  (e.g. `trace_start` always precedes `trace_complete`/`trace_abort`
  for the same key)
