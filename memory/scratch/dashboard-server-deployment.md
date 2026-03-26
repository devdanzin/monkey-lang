# Dashboard Server Deployment Notes

uses: 1
created: 2026-03-26
topics: dashboard, server, launchagent, PATH

## LaunchAgent PATH Limitation
The dashboard server runs as a macOS LaunchAgent. LaunchAgent processes have a minimal PATH that doesn't include `/usr/local/bin`. This means:
- `node` is not found when server spawns child processes (e.g., `execSync('node generate.cjs')`)
- `gh` CLI is not found for GitHub API calls
- **Fix:** Use absolute paths (`/usr/local/bin/node`) in server code, OR run generate.cjs from the agent context (work sessions) where PATH is full

## generate.cjs vs /api/regenerate
- `/api/regenerate` runs generate.cjs server-side — but `gh` CLI isn't available there, so PRs come back empty
- Better approach: run `node generate.cjs` from agent during MAINTAIN tasks, write to `data/rich.json`, server reads it on next request
- Server's `readRichData()` reads `data/rich.json` first, falls back to `data/dashboard.json`

## Rich Data Pipeline
1. Agent runs `node generate.cjs` (has full PATH including `gh`)
2. generate.cjs writes `data/dashboard.json` with all rich data
3. Extract rich keys into `data/rich.json` for server
4. Server merges live queue state + rich data on `/api/dashboard` requests
5. Frontend fetches from tunnel URL, renders all sections
