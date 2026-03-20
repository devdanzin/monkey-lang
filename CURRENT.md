status: done
mode: BUILD
task: OpenClaw contribution — investigate Telegram voice duplication (#51171)
context: Deep investigation of Telegram channel handler, message dispatch, and audio transcription flow. Cloned fork to /tmp/openclaw-src. Traced full inbound path from bot.on("message") → handleInboundMessageLike → debouncer → processMessage → buildTelegramMessageContext → dispatchTelegramMessage → getReply → applyMediaUnderstanding. Single delivery path confirmed. Leading theories: (1) alreadyTranscribed flag lost when normalizeAttachments creates new objects, causing double transcription within same turn, (2) echoTranscript sending message back to chat that gets re-ingested, (3) race condition in polling restart causing replay. Need to reproduce with a test setup or check verbose logs. Next step: write a targeted test case for the alreadyTranscribed flag loss, and check if echoTranscript could create a feedback loop.
context-files: lessons/openclaw-contributing.md
est: 2
next: Continue investigation — write test, check echoTranscript feedback loop theory
updated: 2026-03-20T13:04:00-06:00
