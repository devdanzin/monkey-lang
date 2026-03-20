# OpenClaw Contributing

## Fork
- GitHub: henry-the-frog/openclaw
- Clone to /tmp/openclaw-src for investigation (use --depth 1 for speed)

## Architecture (Telegram channel)
- Extension: `extensions/telegram/src/`
- Bot handlers: `bot-handlers.runtime.ts` — registers `bot.on("message")`, `bot.on("callback_query")`, etc.
- Message flow: `bot.on("message")` → `handleInboundMessageLike` → auth checks → media fetch → debouncer.enqueue() → `onFlush` → `processMessage`
- `processMessage` = `createTelegramMessageProcessor` (bot-message.ts) → `buildTelegramMessageContext` (bot-message-context.ts) → `dispatchTelegramMessage` (bot-message-dispatch.ts)
- Dispatch calls `dispatchReplyWithBufferedBlockDispatcher` which internally calls `getReplyFromConfig` → `getReply` → `applyMediaUnderstanding` → agent LLM call
- Voice/audio preflight: `resolveTelegramInboundBody` (bot-message-context.body.ts) does preflight transcription for group chats with requireMention to check mention in voice
- Main transcription: `applyMediaUnderstanding` (src/media-understanding/apply.ts) runs during getReply
- Echo transcript: `sendTranscriptEcho` (src/media-understanding/echo-transcript.ts) — optional feature that sends transcript text back to chat

## Key Files
- `bot-message-context.body.ts` — builds inbound body, handles preflight audio transcription
- `bot-handlers.runtime.ts` — all Grammy bot handlers, debouncing, media groups
- `bot-message-dispatch.ts` — streaming, lane delivery, sticker cache, reply formatting
- `src/media-understanding/apply.ts` — main media understanding (image, audio, video)
- `src/media-understanding/audio-preflight.ts` — pre-mention-check transcription
- `src/media-understanding/echo-transcript.ts` — sends transcript back to originating chat
- `src/auto-reply/inbound-debounce.ts` — debounce engine for rapid messages

## Gotchas
- `normalizeAttachments(ctx)` creates fresh objects BUT rehydrates `alreadyTranscribed` from `ctx.PreflightTranscribedIndices` — the flag is NOT lost (previous theory was wrong)
- Debouncer skips voice messages (they have media, `shouldDebounce` returns false for entries with media in non-forward lane)
- Grammy's `DEFAULT_UPDATE_TYPES` includes `edited_message` but there's no handler for it — edited messages are silently dropped
- `echoTranscript` is opt-in config (`tools.media.audio.echoTranscript`)
- No instance locking for Telegram polling — running multiple gateway instances with the same bot token can cause duplicate processing
- ACP dispatch (`tryDispatchAcpReply`) and standard dispatch (`getReplyFromConfig`) are mutually exclusive — never both called for same message
- `selectAttachments` properly skips `alreadyTranscribed` audio — preflight + main transcription cannot double-transcribe

## PR Process
- Fork is henry-the-frog/openclaw
- Branch naming: descriptive, e.g., `fix/telegram-allowfrom-truncation`
- PR #51180 was a one-line fix (allowFrom display truncation)
- Always check CI status after pushing

## Failover / Model Fallback Architecture
- Two layers: **inner runner** (pi-embedded-runner/run.ts) retries within a single model candidate (auth profile rotation, runtime auth refresh, compaction), **outer fallback** (model-fallback.ts) cascades across model candidates.
- `classifyFailoverReasonFromHttpStatus` (pi-embedded-helpers/errors.ts) maps HTTP status → FailoverReason. Missing mappings = errors not classified = no fallback.
- `coerceToFailoverError` (failover-error.ts) wraps raw errors into FailoverError using status, message, and symbolic codes. If it returns null, the error is "unrecognized" but still continues fallback for non-last candidates.
- Inner runner throws FailoverError to outer fallback only when: all auth profiles exhausted AND `fallbackConfigured` is true.
- Auth profile cooldown in outer fallback: "auth"/"auth_permanent" → always skip candidate. "rate_limit"/"overloaded" → probe with throttling.
- Key gotcha: errors that don't classify as FailoverError in the inner runner get thrown as raw errors, bypassing the auth-profile-rotation logic entirely.

## Error Surfacing to Channels
- `agent-runner-execution.ts` catch block is where agent errors become user-facing messages
- Error classifiers: isBilling, isContextOverflow, isCompactionFailure, isSessionCorruption, isRoleOrderingError, isTransientHttp, isSandboxOrSecurity
- Each classifier gets a specific safe message; catch-all is generic (no raw message interpolation)
- Full error always logged via `defaultRuntime.error()` — visible in `openclaw logs --follow`
- `sanitizeUserFacingText` exists but was only used for transient HTTP errors; now unnecessary since we never interpolate raw messages
