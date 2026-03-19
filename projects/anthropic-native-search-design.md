# Anthropic Native Web Search — Design Doc

## Overview
Add `"anthropic"` as a web search provider option that uses Anthropic's server-side
`web_search_20260209` tool instead of routing to an external search API.

## Architecture

### Current flow (external providers like Brave):
1. OpenClaw creates a `web_search` tool via `createWebSearchTool()`
2. Claude calls `web_search` → OpenClaw intercepts → routes to Brave API → returns results
3. Results appear as regular tool results in the conversation

### Anthropic native flow:
1. `web_search_20260209` is injected as a **server tool** in the Anthropic Messages API payload
2. Claude executes searches server-side during generation
3. Results come back as `server_tool_use` + `web_search_tool_result` content blocks
4. Cited text doesn't count toward token usage (encrypted content)

### Key difference
This is NOT a regular web search provider. The search happens inside the Anthropic API,
not as a separate OpenClaw tool call. This means:
- No separate API key needed (uses existing Anthropic key)
- No tool interception loop
- Results are embedded in the response stream

## Implementation

### Files created:
- `extensions/anthropic/src/anthropic-web-search-provider.ts` — Provider definition
- `extensions/anthropic/src/anthropic-native-search-wrapper.ts` — Stream wrapper

### Files modified:
- `extensions/anthropic/index.ts` — Register web search provider
- `src/plugins/bundled-web-search.ts` — Add "anthropic" to bundled list

### Remaining work (critical):
1. **Stream wrapper wiring** — Need to add `wrapStreamFn` to the anthropic provider
   registration that conditionally applies the native search wrapper when
   `tools.web.search.provider === "anthropic"`. This requires reading the config
   in the `wrapStreamFn` context.

2. **nativeWebSearchTool compat flag** — When provider is "anthropic" AND the model
   is anthropic-messages, set `nativeWebSearchTool: true` to suppress OpenClaw's
   regular `web_search` tool (prevents collision).

3. **pi-ai server tool support** — UNKNOWN whether pi-ai v0.60.0 handles:
   - `server_tool_use` content blocks in the response stream
   - `web_search_tool_result` content blocks with encrypted content
   - If NOT supported, this feature is BLOCKED until pi-ai adds support.

4. **Config schema** — Add anthropic-specific web search config to the Zod schema:
   ```json5
   tools.web.search.anthropic: {
     toolVersion: "web_search_20260209",
     allowedDomains: ["example.com"],
     blockedDomains: ["untrusted.com"],
     maxUses: 5,
     userLocation: { city, region, country, timezone }
   }
   ```

5. **Tests** — Unit tests for provider, wrapper, config resolution

6. **Documentation** — Update docs/tools/web.md with the new provider option

## Configuration
```json5
{
  tools: {
    web: {
      search: {
        provider: "anthropic",
        anthropic: {
          toolVersion: "web_search_20260209",  // or web_search_20250305
          allowedDomains: ["docs.anthropic.com"],
          blockedDomains: [],
          maxUses: 5,
          userLocation: {
            type: "approximate",
            city: "Denver",
            region: "Colorado",
            country: "US",
            timezone: "America/Denver"
          }
        }
      }
    }
  }
}
```

## Open questions
1. Does pi-ai handle server tool content blocks? (Likely yes for pass-through, but
   structured parsing is uncertain)
2. Should the provider auto-detect when using direct Anthropic API (not proxied)?
3. How should OpenClaw display server tool results in the TUI/web UI?
4. Should Bedrock Anthropic models also support this? (Bedrock has its own search integration)
