# BlueBubbles

## What
- iMessage bridge server — lets OpenClaw send/receive iMessages via REST API
- Runs on this Mac, exposes API on localhost:1234
- Uses Cloudflare quick tunnels for external access

## Status
- Server: running, API reachable
- Private API: enabled, helper connected (macOS 11 dylib on macOS 15)
- OpenClaw plugin: loaded, webhook at /bluebubbles-webhook
- **iMessage activation: BLOCKED** — Apple servers rejecting registration

## The Problem (2026-03-17)
- After machine reset, iMessage won't stay signed in (signs out after ~10 seconds)
- Error 22 on all sent messages, zero messages ever delivered from this Mac
- ReRegisteredForDevices counter at 1,862 (server-side, can't reset locally)
- Previous agent on this Apple ID likely triggered Apple's spam/abuse detection
- Nuclear resets of all local IDS/iMessage caches didn't help
- Jordan contacted Apple Support, waiting for resolution

## Config
- Server URL: http://localhost:1234
- Password: stored in Keychain as "bluebubbles-password"
- webhookPath: /bluebubbles-webhook
- Private API mode: process-dylib
- Cloudflare tunnel URL: changes on each restart (quick tunnel)

## API Notes
- Auth: password as query param (?password=xxx), NOT as header
- Send: POST /api/v1/message/text?password=xxx
- chatGuid format: "iMessage;-;+1XXXXXXXXXX"
- method: "private-api" for Private API sends
