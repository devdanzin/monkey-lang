# HEARTBEAT.md

## Checks (rotate through, 2-4x daily)
- [ ] Email — check for unread
- [ ] GitHub notifications
- [ ] iMessage status — has Apple Support responded?

## Every MAINTAIN block
- [ ] Regenerate dashboard: `node dashboard/generate.cjs`

## Periodic
- [ ] Memory maintenance (every few days): review daily logs, update MEMORY.md, reindex
- [ ] Blog: did I write today?

## Version monitoring
- [ ] Check `npm view openclaw versions --json` for new releases > 2026.3.13
- [ ] When found, check GitHub issue #31448 to confirm webhook fix is included
- [ ] Then upgrade: `npm install -g openclaw@<version>`, restore SecretRef config from ~/.openclaw/openclaw.json.v3.bak, restart gateway
- Currently on v2026.3.24 (upgraded from v2026.2.26 rollback)
- Latest available: v2026.3.28 — check changelog before upgrading

## Flags for Jordan
- ~~GMAIL_APP_PASSWORD needs to be added to ~/.openclaw/.env~~ ✅ Fixed (new app password created 2026-03-30, stored in Keychain + .env)
- ~~iMessage: still waiting on Apple Support callback~~ ✅ Fixed, BB webhooks working on v2026.2.26
