# Anthropic Native Web Search — Design Doc

## Overview
Add `"anthropic"` as a web search provider option that uses Anthropic's server-side
`web_search_20260209` tool instead of routing to an external search API.

**Issue:** openclaw/openclaw#49949

## Architecture

### Current flow (external providers like Brave):
1. OpenClaw creates a `web_search` tool via plugin `WebSearchProviderPlugin`
2. Claude calls `web_search` → OpenClaw intercepts → routes to external API → returns results
3. Results appear as regular tool results in the conversation

### Anthropic native flow:
1. `web_search_20260209` is injected as a **server tool** in the Anthropic Messages API `tools` array
2. Claude executes searches server-side during generation
3. Results come back as `server_tool_use` + `web_search_tool_result` content blocks
4. Cited text doesn't count toward token usage (encrypted content)

### Key difference
This is NOT a regular web search provider. The search happens inside the Anthropic API,
not as a separate OpenClaw tool call. This means:
- No separate API key needed (uses existing Anthropic key)
- No tool interception loop
- Results are embedded in the response stream

## Codebase Analysis (2026-03-19)

### Extension plugin pattern
Each search provider is an extension in `extensions/<name>/`:
- `extensions/brave/` → `createBraveWebSearchProvider()` → `WebSearchProviderPlugin`
- `extensions/google/` → Gemini search
- `extensions/xai/` → Grok search (interesting: also uses native search)
- `extensions/perplexity/`, `extensions/moonshot/`, `extensions/firecrawl/`

Bundled list in `src/plugins/bundled-web-search.ts`:
```ts
export const BUNDLED_WEB_SEARCH_PLUGIN_IDS = ["brave", "firecrawl", "google", "moonshot", "perplexity", "xai"];
```

### WebSearchProviderPlugin interface (`src/plugins/types.ts:882`)
```ts
type WebSearchProviderPlugin = {
  id: WebSearchProviderId;
  label: string;
  hint: string;
  envVars: string[];
  placeholder: string;
  signupUrl: string;
  createTool: (ctx) => WebSearchProviderToolDefinition | null;
  // ... credential management methods
};
```

The `createTool()` method returns `{ description, parameters, execute }` — a function-calling tool that OpenClaw intercepts. **This pattern doesn't work for Anthropic native search** because the search isn't a client-side tool call.

### Existing precedent: xAI/Grok native search
xAI already uses native web search! Key files:
- `src/agents/model-compat.ts:42` — sets `nativeWebSearchTool: true` for xAI models
- `src/agents/pi-tools.ts:98-103` — strips OpenClaw's `web_search` tool when native is active
- The xAI API handles search server-side automatically

### Payload patching hook
`src/agents/pi-embedded-runner/anthropic-stream-wrappers.ts` wraps Anthropic API calls
using `streamWithPayloadPatch()` which gives access to modify the request payload before
it's sent. This is where we inject the server tool:

```ts
streamWithPayloadPatch(underlying, model, context, options, (payloadObj) => {
  // Inject: payloadObj.tools.push({ type: "web_search_20260209", ... })
});
```

### Config schema
`src/config/zod-schema.core.ts:207` already has `nativeWebSearchTool: z.boolean().optional()`
in the model compat config. `src/config/types.models.ts:38` has the TypeScript type.

## Implementation Plan

### Approach A: Hybrid (WebSearchProviderPlugin + payload patch)
Register as a normal `WebSearchProviderPlugin` but with a twist:
1. `createTool()` returns `null` (no client-side tool)
2. Plugin sets `nativeWebSearchTool: true` on model compat when selected
3. A new stream wrapper in `anthropic-stream-wrappers.ts` injects the server tool into the payload

**Pros:** Integrates with existing provider selection UI/config.
**Cons:** Somewhat awkward — the plugin doesn't actually create a tool.

### Approach B: Pure stream wrapper (config-driven)
Skip the plugin system. When `tools.web.search.provider === "anthropic"`:
1. Set `nativeWebSearchTool: true` to suppress OpenClaw's `web_search` tool
2. A stream wrapper detects the config and injects the server tool into Anthropic API payloads
3. Config validation ensures this only activates for `anthropic-messages` API models

**Pros:** Cleaner — doesn't pretend to be a regular search provider.
**Cons:** Doesn't appear in `openclaw configure --section web` provider list.

### Recommended: Approach A (Hybrid)
Better UX — users select it the same way as other providers.

### Files to create:
- `extensions/anthropic/src/anthropic-web-search-provider.ts` — Provider plugin
- `extensions/anthropic/src/anthropic-native-search-config.ts` — Config resolution

### Files to modify:
- `extensions/anthropic/index.ts` — Register the web search provider
- `src/plugins/bundled-web-search.ts` — Add "anthropic" to bundled list (BUT: it's already the anthropic extension, just needs `registerWebSearchProvider()`)
- `src/agents/pi-embedded-runner/anthropic-stream-wrappers.ts` — Add payload patch to inject server tool
- `src/config/zod-schema.core.ts` — Add anthropic web search config schema
- `src/agents/pi-tools.ts` — Ensure `web_search` is stripped when anthropic native is active

### Config schema addition:
```ts
// In zod-schema.core.ts, extend web search provider union:
z.literal("anthropic")

// New anthropic-specific config:
anthropic: z.object({
  toolVersion: z.enum(["web_search_20250305", "web_search_20260209"]).default("web_search_20260209"),
  allowedDomains: z.array(z.string()).optional(),
  blockedDomains: z.array(z.string()).optional(),
  maxUses: z.number().int().positive().optional(),
  userLocation: z.object({
    type: z.literal("approximate"),
    city: z.string().optional(),
    region: z.string().optional(),
    country: z.string().optional(),
    timezone: z.string().optional(),
  }).optional(),
}).optional()
```

### Payload injection (in anthropic-stream-wrappers.ts):
```ts
// When provider is "anthropic", inject into tools array:
payloadObj.tools = [
  ...(payloadObj.tools ?? []),
  {
    type: config.toolVersion ?? "web_search_20260209",
    ...(config.allowedDomains?.length ? { allowed_domains: config.allowedDomains } : {}),
    ...(config.blockedDomains?.length ? { blocked_domains: config.blockedDomains } : {}),
    ...(config.maxUses ? { max_uses: config.maxUses } : {}),
    ...(config.userLocation ? { user_location: config.userLocation } : {}),
  },
];
```

## Open questions
1. **pi-ai stream handling** — Does `@mariozechner/pi-ai` handle `server_tool_use` and `web_search_tool_result` content blocks? If it treats them as opaque pass-through, it should work. If it tries to parse them as regular tool_use, it might break. **Need to test.**
2. **Bedrock models** — Bedrock has its own search. Should `provider: "anthropic"` only work with direct Anthropic API? (Yes, initially.)
3. **UI display** — How should search results appear in TUI/web? Server tool results might not have the same structure as regular search results.
4. **Fallback** — If someone sets `provider: "anthropic"` but uses a non-Anthropic model, should it gracefully fall back to another provider?

## Execution estimate
- 3-4 BUILD blocks for core implementation
- 1 block for tests
- 1 block for docs + PR
- Total: ~5-6 blocks across today/tomorrow
