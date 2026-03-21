# OpenClaw Contributing — Lessons

How to navigate, debug, and contribute to the OpenClaw codebase. Promoted from scratch note (3 uses, 2 days).

## Repo & Setup
- Fork: henry-the-frog/openclaw on GitHub
- Clone to /tmp/openclaw-src with `--depth 1` for investigation
- Branch naming: descriptive, e.g., `fix/telegram-allowfrom-truncation`

## Architecture: Message Flow (Telegram)
The chain: `bot.on("message")` → `handleInboundMessageLike` → auth checks → media fetch → debouncer.enqueue() → `onFlush` → `processMessage` → `buildTelegramMessageContext` → `dispatchTelegramMessage` → `dispatchReplyWithBufferedBlockDispatcher` → `getReplyFromConfig` → `getReply` → `applyMediaUnderstanding` → agent LLM call.

**Key files:**
- `bot-handlers.runtime.ts` — all Grammy bot handlers, debouncing, media groups
- `bot-message-context.body.ts` — builds inbound body, preflight audio transcription
- `bot-message-dispatch.ts` — streaming, lane delivery, reply formatting
- `src/media-understanding/apply.ts` — image/audio/video understanding
- `src/auto-reply/inbound-debounce.ts` — debounce engine

## Failover & Model Fallback
Two layers:
1. **Inner runner** (pi-embedded-runner/run.ts) — retries within a model candidate (auth rotation, compaction)
2. **Outer fallback** (model-fallback.ts) — cascades across model candidates

`classifyFailoverReasonFromHttpStatus` maps HTTP status → FailoverReason. Missing mappings = errors not classified = no fallback. Inner runner throws FailoverError to outer only when all auth profiles exhausted AND `fallbackConfigured`.

Auth profile cooldown: "auth"/"auth_permanent" → always skip. "rate_limit"/"overloaded" → probe with throttling.

**Gotcha:** Errors that don't classify as FailoverError in the inner runner get thrown raw, bypassing auth-profile rotation entirely.

## Error Surfacing to Users
- `agent-runner-execution.ts` catch block is where errors become user-facing messages
- Classifiers: isBilling, isContextOverflow, isCompactionFailure, isSessionCorruption, isRoleOrderingError, isTransientHttp, isSandboxOrSecurity
- Each classifier → specific safe message; catch-all is generic (never interpolates raw messages)
- Full error always logged via `defaultRuntime.error()` — visible in `openclaw logs --follow`

## Gotchas
- `normalizeAttachments(ctx)` rehydrates `alreadyTranscribed` from `ctx.PreflightTranscribedIndices` — the flag is NOT lost
- Debouncer skips voice messages (media → `shouldDebounce` returns false)
- Grammy has no handler for `edited_message` — silently dropped
- No instance locking for Telegram polling — duplicate processing risk with multiple instances
- ACP dispatch and standard dispatch are mutually exclusive per message

## PR Process
- Always check CI after pushing
- PR #51180 was a one-line fix — small focused PRs are fine
- PR #51803 — multi-file feature (persist followup queues across restart)
