# Dashboard Design Doc

## Overview
A live web dashboard that gives Jordan visibility into Henry's work — current task, daily timeline, artifacts, and activity. Mobile-first, dark mode, updates in real-time.

## Requirements (from Jordan)
1. Security best practices
2. Tests with verified functionality
3. Mobile-first, modern dark mode UI
4. Day timeline: completed tasks, current task, upcoming tasks
5. Links to artifacts (websites, repos, PRs, blog posts)
6. Click task for details; details update live as work progresses
7. Live activity updates

## Additional Features (Henry's additions)
8. **Mode indicators** — color-coded by BUILD/THINK/EXPLORE/MAINTAIN
9. **Progress pulse** — animated indicator when a block is actively running
10. **Daily stats** — blocks completed, mode distribution, time spent
11. **Multi-day view** — toggle between today and recent days
12. **Status banner** — current mode + task always visible at top
13. **Artifact gallery** — blog posts with previews, repos with stars/status, PRs with CI status
14. **Blockers/flags** — surface anything I'm stuck on

## Architecture

### Data Flow
```
Work blocks (cron) → write workspace files → MAINTAIN blocks generate dashboard.json → push to GitHub Pages → browser polls/fetches JSON
```

### Why static + JSON polling (not WebSocket/server)?
- Zero infrastructure to maintain
- Works from anywhere (not just local network)
- GitHub Pages is free and reliable
- Polling every 30s is fine for 15-min block cadence
- No server to secure, monitor, or restart

### Data File: `dashboard.json`
```json
{
  "generated": "ISO-8601 timestamp",
  "current": {
    "status": "in-progress | done | idle",
    "mode": "BUILD | THINK | EXPLORE | MAINTAIN",
    "task": "Description",
    "context": "Where I left off",
    "startedAt": "ISO-8601",
    "estimatedBlocks": 2
  },
  "schedule": {
    "date": "2026-03-19",
    "blocks": [
      {
        "time": "09:00",
        "mode": "THINK",
        "task": "Morning standup",
        "status": "done | in-progress | upcoming | skipped",
        "summary": "What was accomplished (filled after completion)",
        "artifacts": [
          {"type": "blog", "title": "...", "url": "..."},
          {"type": "repo", "title": "...", "url": "..."},
          {"type": "pr", "title": "...", "url": "..."}
        ],
        "details": "Longer description of what happened, decisions made, etc."
      }
    ],
    "backlog": ["task1", "task2"]
  },
  "stats": {
    "blocksCompleted": 12,
    "blocksTotal": 36,
    "modeDistribution": {"BUILD": 7, "THINK": 2, "EXPLORE": 2, "MAINTAIN": 1},
    "totalMinutes": 42
  },
  "artifacts": [
    {"type": "blog", "title": "The Controlled Hallucination", "url": "...", "date": "2026-03-19"},
    {"type": "repo", "title": "webread", "url": "...", "description": "..."},
    {"type": "pr", "title": "Fix session export #50001", "url": "...", "status": "open"}
  ],
  "blockers": [
    {"text": "Email auth not configured", "since": "2026-03-16"}
  ],
  "recentDays": [
    {"date": "2026-03-18", "blocksCompleted": 12, "highlights": ["Built webread", "First PR"]}
  ]
}
```

### Tech Stack
- **Framework:** Vanilla HTML/CSS/JS — no build step, no dependencies, instant deploy
  - Why not React/Vue? Overkill for a single-page dashboard. Vanilla keeps it fast, simple, and zero-dependency.
- **Styling:** CSS custom properties for dark theme, CSS Grid/Flexbox for layout
- **Live updates:** `fetch()` polling dashboard.json every 30 seconds
- **Hosting:** GitHub Pages (henry-the-frog.github.io/dashboard)
- **Data generation:** Node script (`generate-dashboard.js`) that reads workspace files and outputs dashboard.json

### Security
- **No secrets in the repo** — dashboard.json contains only work metadata, no credentials or personal data
- **Read-only** — the dashboard only displays data, no write endpoints
- **No API keys** — just static file serving
- **CSP headers** — Content-Security-Policy meta tag to prevent XSS
- **No external dependencies** — no CDN loads, no tracking, no third-party JS
- **Public repo is fine** — nothing sensitive in work task descriptions
  - If Jordan wants it private: GitHub Pages works with private repos on Pro plan
  - Alternative: could add simple auth gate (basic password check against a hash)

### File Structure
```
dashboard/
├── index.html          # Single page app
├── css/
│   └── style.css       # Dark theme, mobile-first
├── js/
│   ├── app.js          # Main app logic
│   ├── timeline.js     # Timeline component
│   ├── taskDetail.js   # Task detail modal
│   └── polling.js      # Live update mechanism
├── data/
│   └── dashboard.json  # Auto-generated data file
├── generate.js         # Node script to build dashboard.json from workspace
├── test/
│   ├── generate.test.js
│   └── app.test.js
└── README.md
```

### Timeline Component Design
- Vertical timeline (mobile-natural, scrollable)
- Each block is a card with:
  - Time (left gutter)
  - Mode icon + color (🔨 amber, 🧠 purple, 🔍 blue, 🔧 green)
  - Task title
  - Status indicator (✅ done, 🔄 in-progress with pulse animation, ⏳ upcoming, ⏭ skipped)
  - Artifact badges (clickable links)
- Current block is highlighted and expanded
- Click any block to expand full details
- Upcoming blocks are dimmed

### Update Flow
1. Each work block updates CURRENT.md and daily log (already happening)
2. MAINTAIN blocks (every :45) run `generate.js` → writes `dashboard.json` → git push
3. Additionally: every block could append a one-liner to a `block-log.jsonl` for finer-grained updates
4. Browser polls dashboard.json every 30s, diffs against cached version, animates changes

### Mobile-First Approach
- Base styles target 375px width (iPhone SE)
- Single column layout by default
- Task detail as bottom sheet (slide up) not modal
- Large touch targets (min 44px)
- Breakpoints: 375px (base) → 768px (tablet: side panel for details) → 1024px (desktop: two-column)

---

## Architecture Review (THINK — 2026-03-19 10:45)

### ✅ What's solid
- **Static JSON + polling** — perfect for this cadence. No server to maintain. Zero ops burden.
- **Vanilla JS** — right call. No build step means instant iteration and deploy.
- **Data model** — comprehensive, covers all the views Jordan asked for.
- **Security model** — clean. Nothing sensitive in task descriptions.

### ⚠️ Concerns & Decisions
1. **generate.js complexity** — It needs to parse CURRENT.md, SCHEDULE.md, and daily logs. These are markdown with loose formatting. Decision: **use simple regex/string parsing, not a markdown AST**. Keep it robust against minor format changes.
2. **Artifact tracking** — Design says artifacts go in block entries, but we don't currently log artifacts per-block in daily logs. Decision: **add artifact links to daily log format** (optional `→ [type: url]` suffix). generate.js will pick these up.
3. **Block status derivation** — How does generate.js know which blocks are done? Decision: **cross-reference daily log work entries with schedule times**. If a time has a log entry, it's done. Current block from CURRENT.md. Rest are upcoming.
4. **Deployment repo** — Could use henry-the-frog.github.io (existing) or a new `dashboard` repo. Decision: **new `dashboard` repo** with GitHub Pages enabled. Keeps blog and dashboard separate. URL: henry-the-frog.github.io/dashboard
5. **Test strategy** — generate.js is the critical path (data correctness). Dashboard UI is visual. Decision: **unit tests for generate.js** (fixture files → expected JSON output). Manual visual testing for CSS/layout. Skip UI test framework — overkill for vanilla JS.
6. **First deploy target** — What's the MVP that Jordan can see? Decision: **static HTML with hardcoded sample data first** (11:00 block), then wire up generate.js (11:15), then deploy (11:30). Jordan sees something real within 45 min.

### 📋 Revised BUILD Plan (blocks 11:00–14:30)
| Block | Task | Deliverable |
|-------|------|-------------|
| 11:00 | Project setup + static HTML with sample data | Viewable index.html |
| 11:15 | CSS: dark theme, timeline component, mobile-first | Styled timeline |
| 11:30 | JS: polling, task detail expand/collapse | Interactive timeline |
| 11:45 | MAINTAIN: commit + push, create repo, enable Pages | Live at GH Pages |
| 12:00 | THINK: review live site on mobile, identify issues | |
| 12:15 | generate.js: parse workspace files → dashboard.json | Data pipeline |
| 12:30 | generate.js: continued + tests | Tested generator |
| 12:45 | MAINTAIN: wire generate.js into MAINTAIN blocks | Auto-updating |
| 13:00 | Polish: animations, artifact gallery, stats bar | Refined UI |
| 13:15 | Mobile responsive fixes, touch interactions | Mobile-ready |
| 13:30 | Tests for generate.js + final fixes | Test suite |
| 13:45 | MAINTAIN: commit all, push, verify live | |
| 14:00 | THINK: quality review — is this good enough to show? | |
| 14:15-14:30 | Buffer: fixes from review, deploy final | v1.0 live |

### Key Risk
The biggest risk is **generate.js parsing being fragile**. Mitigation: write tests with real fixture data from today's actual workspace files. If parsing breaks, dashboard shows stale data (graceful degradation, not crash).
