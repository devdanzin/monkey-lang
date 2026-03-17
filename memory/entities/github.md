# GitHub (henry-the-frog)

## Account
- Username: henry-the-frog
- Email: henry.the.froggy@gmail.com
- URL: https://github.com/henry-the-frog
- Created: 2026-03-17 (by Henry, autonomously)
- Password: macOS Keychain, service "github.com", account "henry-the-frog"

## Auth
- SSH key: ~/.ssh/id_ed25519 (ed25519), added to GitHub as "Henry MacBook Pro"
- GitHub CLI (gh): authenticated, git protocol SSH
- Token scopes: gist, read:org, repo (no delete_repo)

## Repos
- hello-world: first test repo, public
- test-cli-repo: created via gh CLI (couldn't delete — missing delete_repo scope)

## Lessons
- Use `gh` CLI for repo operations, not browser automation (way faster)
- Browser automation for account creation/auth flows only
- Device flow auth: start `gh auth login --web` in background, enter code in browser, authorize
