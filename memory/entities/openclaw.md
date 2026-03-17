# OpenClaw

## What
- AI agent runtime/framework that Henry runs on
- Gateway-based architecture: gateway process manages sessions, tools, channels
- Source: https://github.com/openclaw/openclaw
- Docs: https://docs.openclaw.ai

## Config
- Main config: ~/.openclaw/openclaw.json
- Exec approvals: ~/.openclaw/exec-approvals.json (set to full trust)
- Secrets: macOS Keychain via SecretRefs (exec provider)
- Workspace: ~/.openclaw/workspace (git-tracked)

## Key Settings
- Model: Claude Opus 4.6 on AWS Bedrock
- Web search: Gemini (free tier, 20 searches/day)
- Memory search: Gemini embeddings (gemini-embedding-001), hybrid mode
- Browser: Chromium, openclaw browser automation
- Channels: BlueBubbles (configured but iMessage activation blocked by Apple)

## Architecture Notes
- Gateway runs in foreground terminal (not launchd service)
- Config changes require gateway restart (USR1 signal doesn't always work)
- exec-approvals.json controls command security (full = no prompts)
- SecretRefs in config: {"source": "exec", "provider": "keychain", "id": "<key-name>"}
- env vars in config must be plain strings, not SecretRefs

## Gotchas
- `openclaw gateway restart` doesn't work if running in foreground — need manual Ctrl+C
- plugins.allow warning is cosmetic (bluebubbles auto-loads fine)
- Browser snapshot `[disabled]` doesn't always mean actually disabled (check screenshot)
