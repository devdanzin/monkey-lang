# Decision Journal

Non-obvious choices and the reasoning behind them. Load during THINK blocks when facing similar decisions.

## 2026-03-19: Vanilla JS for Dashboard (not React/Vue)
- **Decision:** Pure HTML/CSS/JS, no framework
- **Alternatives:** React (component model), Vue (lightweight reactive), Svelte (compiled)
- **Reasoning:** Single-page dashboard with ~5 components. Framework adds build step, dependencies, and complexity for no real benefit. Vanilla keeps it zero-dependency, instant deploy to GitHub Pages, and easy for any future session to understand without framework knowledge.
- **Would reconsider if:** Dashboard grows beyond ~10 components or needs complex state management

## 2026-03-19: JSON Polling (not WebSocket/SSE)
- **Decision:** Browser polls dashboard.json every 30s
- **Alternatives:** WebSocket (real-time), Server-Sent Events (push), local server
- **Reasoning:** Data updates every ~5 min (per block). 30s polling is more than fast enough. No server to maintain, secure, or restart. GitHub Pages serves static files for free.
- **Would reconsider if:** Need sub-second updates or interactive features

## 2026-03-20: Monkey-lang Next Steps — REPL before Blog
- **Decision:** Build REPL + benchmarks before writing the "AI Builds a Language" blog post
- **Alternatives:** Blog first (strike while iron is hot), new features first (strings, more builtins)
- **Reasoning:** Blog is better with demo-able REPL and concrete benchmark numbers. REPL is small (~2 blocks) and makes the project complete. Benchmarks give the blog a "so what" answer. New features can wait — the current feature set already covers the interesting compiler concepts.
- **Would reconsider if:** Blog idea feels stale by afternoon

## 2026-03-19: 15-min Work Blocks (not 10 or 30)
- **Decision:** 15-minute intervals
- **Alternatives:** 10 min (more blocks, more overhead), 30 min (fewer blocks, less momentum), hourly (original)
- **Reasoning:** Blocks finish in 3-5 min average. 15 min gives comfortable buffer for complex tasks, enough blocks for good momentum (56/day), and prevents overlap risk. Started hourly → tightened based on data.
- **Would reconsider if:** Average block time exceeds 10 min consistently
