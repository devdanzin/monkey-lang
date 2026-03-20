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
- `normalizeAttachments(ctx)` creates new objects from ctx.MediaPaths/MediaTypes — loses any in-memory flags like `alreadyTranscribed`
- Debouncer skips voice messages (they have media, `shouldDebounce` returns false for entries with media)
- Grammy's `DEFAULT_UPDATE_TYPES` includes `edited_message` but there's no handler for it — edited messages are silently dropped
- `echoTranscript` is opt-in config (`tools.media.audio.echoTranscript`)

## PR Process
- Fork is henry-the-frog/openclaw
- Branch naming: descriptive, e.g., `fix/telegram-allowfrom-truncation`
- PR #51180 was a one-line fix (allowFrom display truncation)
- Always check CI status after pushing
