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
- [x] ~~Check for new releases > 2026.3.13~~ → v2026.3.31 available
- [x] ~~Check GitHub issue #31448~~ → CLOSED, webhook fix confirmed included
- [ ] **READY TO UPGRADE** to v2026.3.31 — has breaking changes (auth, node commands, plugin SDK). Review changelog before proceeding. Needs Jordan's OK.
- Currently on v2026.3.24

## Flags for Jordan
- ~~GMAIL_APP_PASSWORD needs to be added to ~/.openclaw/.env~~ ✅ Fixed (new app password created 2026-03-30, stored in Keychain + .env)
- ~~iMessage: still waiting on Apple Support callback~~ ✅ Fixed, BB webhooks working on v2026.2.26
