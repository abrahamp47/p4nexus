<!-- version: 1.7.0 -->
<!-- Last updated: 2026-04-23 -->

Last reviewed: 2026-04-23

**Project:** P4Nexus · **Environment:** dev · **Maintainer:** repository maintainers (see GitHub)

## Scope

| Boundary | Rule |
|----------|------|
| **Reads** | `p4nexus/`, `p4nexus-web/`, `eval/`, plugin packages, `.github/`, `.p4nexus/`, docs. |
| **Writes** | Only paths required for the change; keep diffs minimal. Update lockfiles when deps change. |
| **Executes** | `npm`, `npx`, `node` under `p4nexus/` and `p4nexus-web/`; `uv run` for Python under `eval/`; documented CI/dev workflows. |
| **Off-limits** | Real `.env` / secrets, production credentials, unrelated repos, destructive git ops without confirmation. |

## Model Configuration

- **Primary:** Use a named model (e.g. Claude Sonnet 4.x). Avoid `Auto` or unversioned `latest` when reproducibility matters.
- **Notes:** The P4Nexus CLI indexer does not call an LLM.

## Execution Sequence (complex tasks)

For multi-step work, state up front:
1. Which rules in this file and **[GUARDRAILS.md](GUARDRAILS.md)** apply (and any relevant Signs).
2. Current **Scope** boundaries.
3. Which **validation commands** you will run (`cd p4nexus && npm test`, `npx tsc --noEmit`).

On long threads, *"Remember: apply all AGENTS.md rules"* re-weights these instructions against context dilution.

## Claude Code hooks

**PreToolUse** hooks can block tools (e.g. `git_commit`) until checks pass. Adapt to this repo: `cd p4nexus && npm test` before commit.

## Context budget

Commands and gotchas live under **Repo reference** below and in **[CONTRIBUTING.md](CONTRIBUTING.md)**. If always-on rules grow, split into **`.cursor/rules/*.mdc`** (globs). **Cursor:** project-wide rules in `.cursor/index.mdc`. **Claude Code:** load `STANDARDS.md` only when needed.

## Reference docs

- **[ARCHITECTURE.md](ARCHITECTURE.md)**, **[CONTRIBUTING.md](CONTRIBUTING.md)**, **[GUARDRAILS.md](GUARDRAILS.md)**
- **Call-resolution DAG (legacy path):** See ARCHITECTURE.md § Call-Resolution DAG. Typed 6-stage DAG inside the `parse` phase; language-specific behavior behind `inferImplicitReceiver` / `selectDispatch` hooks on `LanguageProvider`. Shared code in `p4nexus/src/core/ingestion/` must not name languages. Types: `p4nexus/src/core/ingestion/call-types.ts`.
- **Scope-resolution pipeline (RFC #909 Ring 3):** See ARCHITECTURE.md § Scope-Resolution Pipeline. Replaces the legacy DAG for languages in `MIGRATED_LANGUAGES` (see `registry-primary-flag.ts`). A language plugs in by implementing `ScopeResolver` (`scope-resolution/contract/scope-resolver.ts`) and registering it in `SCOPE_RESOLVERS`. CI parity gate runs BOTH paths per migrated language on every PR.
- **Cursor:** `.cursor/index.mdc` (always-on); `.cursor/rules/*.mdc` (glob-scoped). Legacy `.cursorrules` deprecated.
- **P4Nexus:** skills in `.claude/skills/p4nexus/`; MCP rules in `p4nexus:start` block below.

## Changelog

| Date | Version | Change |
|------|---------|--------|
| 2026-04-23 | 1.7.0 | TypeScript added to `MIGRATED_LANGUAGES` (registry-primary call resolution by default). |
| 2026-04-20 | 1.6.0 | Added scope-resolution pipeline pointer (RFC #909 Ring 3); Python migrated to registry-primary. |
| 2026-04-19 | 1.5.0 | Cross-repo impact (#794): `impact`/`query`/`context` accept `repo: "@<group>"` + `service`. Removed `group_query`/`group_contracts`/`group_status` MCP tools; added `p4nexus://group/{name}/contracts` and `p4nexus://group/{name}/status` resources. |
| 2026-04-16 | 1.4.0 | Fixed: web UI description, pre-commit behavior, MCP tools (7->16), added p4nexus-shared, removed stale vite-plugin-wasm gotcha. |
| 2026-04-13 | 1.3.0 | Updated P4Nexus index stats after DAG refactor. |
| 2026-03-24 | 1.2.0 | Fixed p4nexus:start block duplication. |
| 2026-03-23 | 1.1.0 | Updated agent instructions, references, Cursor layout. |
| 2026-03-22 | 1.0.0 | Initial structured header and changelog. |

---

<!-- p4nexus:start -->
# P4Nexus — Code Intelligence

Indexed as **P4Nexus** (4325 symbols, 10556 relationships, 300 execution flows). Use MCP tools to understand code, assess impact, and navigate safely.

> If any tool warns the index is stale, run `npx p4nexus analyze` first.

## Always Do

- **MUST run impact analysis before editing any symbol.** `p4nexus_impact({target: "symbolName", direction: "upstream"})` — report blast radius to the user.
- **MUST run `p4nexus_detect_changes()` before committing** — verify only expected symbols and flows are affected.
- **MUST warn the user** if impact returns HIGH or CRITICAL risk.
- Explore unfamiliar code with `p4nexus_query({query: "concept"})` (process-grouped, ranked) instead of grepping.
- Full context on a symbol: `p4nexus_context({name: "symbolName"})`.

## When Debugging

1. `p4nexus_query({query: "<error or symptom>"})` — find related execution flows
2. `p4nexus_context({name: "<suspect function>"})` — callers, callees, process participation
3. `READ p4nexus://repo/P4Nexus/process/{processName}` — trace flow step by step
4. Regressions: `p4nexus_detect_changes({scope: "compare", base_ref: "main"})`

## When Refactoring

- **Rename:** `p4nexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` first. Graph edits are safe; text_search edits need manual review.
- **Extract/Split:** `p4nexus_context` (incoming/outgoing refs) then `p4nexus_impact` (upstream callers) before moving code.
- **After any refactor:** `p4nexus_detect_changes({scope: "all"})` to verify scope.

## Never Do

- Edit a symbol without running `p4nexus_impact` first.
- Ignore HIGH/CRITICAL risk warnings.
- Rename with find-and-replace — use `p4nexus_rename`.
- Commit without `p4nexus_detect_changes()`.
- Add language-specific behavior to shared ingestion code (`p4nexus/src/core/ingestion/`) — use a `LanguageProvider` hook. Seeing `provider.mroStrategy === 'xxx'` or an import from `languages/xxx.ts` in shared code means stop and add a hook.

## Tools Quick Reference

| Tool | When to use | Example |
|------|-------------|---------|
| `list_repos` | Discover indexed repos | `p4nexus_list_repos({})` |
| `query` | Find code by concept | `p4nexus_query({query: "auth validation"})` |
| `context` | 360-degree view of one symbol | `p4nexus_context({name: "validateUser"})` |
| `impact` | Blast radius before editing | `p4nexus_impact({target: "X", direction: "upstream"})` |
| `detect_changes` | Pre-commit scope check | `p4nexus_detect_changes({scope: "staged"})` |
| `rename` | Safe multi-file rename | `p4nexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` |
| `cypher` | Custom graph queries | `p4nexus_cypher({query: "MATCH ..."})` |
| `api_impact` | Pre-change API route impact | `p4nexus_api_impact({route: "/api/users", method: "GET"})` |
| `route_map` | Route → handler → consumer map | `p4nexus_route_map({})` |
| `tool_map` | MCP/RPC tool definitions | `p4nexus_tool_map({})` |
| `shape_check` | Response shape vs consumer access | `p4nexus_shape_check({route: "/api/users"})` |
| `group_list` | List repo groups | `p4nexus_group_list({})` |
| `group_sync` | Rebuild group Contract Registry | `p4nexus_group_sync({name: "myGroup"})` |
| `query` (group mode) | Cross-repo search in a group (RRF-merged) | `p4nexus_query({repo: "@myGroup", query: "auth"})` |
| `context` (group mode) | 360° view across all member repos | `p4nexus_context({repo: "@myGroup", name: "validateUser"})` |
| `impact` (group mode) | Cross-repo blast radius via Contract Bridge | `p4nexus_impact({repo: "@myGroup", target: "X", direction: "upstream"})` |

> Group mode: pass `repo: "@<groupName>"` to fan out across all member repos, or `repo: "@<groupName>/<memberPath>"` to target a single member (path keys from `group.yaml`). Optional `service: "<monorepo/path>"` filters by service root. Group-level state (contracts, staleness) lives in the resources table below — there are **no** `group_query` / `group_context` / `group_impact` / `group_contracts` / `group_status` MCP tools.
>
> For a full walkthrough of setting up a group across multiple repos that communicate over gRPC, see [docs/guides/microservices-grpc.md](docs/guides/microservices-grpc.md).

## Impact Risk Levels

| Depth | Meaning | Action |
|-------|---------|--------|
| d=1 | WILL BREAK — direct callers/importers | MUST update |
| d=2 | LIKELY AFFECTED — indirect deps | Should test |
| d=3 | MAY NEED TESTING — transitive | Test if critical path |

## Resources

| Resource | Use for |
|----------|---------|
| `p4nexus://repo/P4Nexus/context` | Codebase overview, index freshness |
| `p4nexus://repo/P4Nexus/clusters` | All functional areas |
| `p4nexus://repo/P4Nexus/processes` | All execution flows |
| `p4nexus://repo/P4Nexus/process/{name}` | Step-by-step execution trace |
| `p4nexus://group/{name}/contracts` | Group Contract Registry (provider/consumer rows + cross-links) |
| `p4nexus://group/{name}/status` | Per-member index + Contract Registry staleness report |

## Self-Check Before Finishing

1. `p4nexus_impact` was run for all modified symbols
2. No HIGH/CRITICAL warnings were ignored
3. `p4nexus_detect_changes()` confirms expected scope
4. All d=1 dependents were updated

## Keeping the Index Fresh

```bash
npx p4nexus analyze                 # basic refresh; preserves any existing embeddings
npx p4nexus analyze --embeddings    # also generate embeddings for new/changed nodes
npx p4nexus analyze --drop-embeddings  # explicit opt-in to wipe existing embeddings
```

Check `.p4nexus/meta.json` `stats.embeddings` (0 = none). A plain `analyze` no longer drops existing vectors — pass `--drop-embeddings` to wipe.

> Claude Code: PostToolUse hook detects a stale index after `git commit` and `git merge` and prompts the agent to run `analyze`. The hook does not invoke `analyze` itself.

## CLI Skills

| Task | Skill file |
|------|-----------|
| Architecture / "How does X work?" | `.claude/skills/p4nexus/p4nexus-exploring/SKILL.md` |
| Blast radius / "What breaks?" | `.claude/skills/p4nexus/p4nexus-impact-analysis/SKILL.md` |
| Debugging / "Why is X failing?" | `.claude/skills/p4nexus/p4nexus-debugging/SKILL.md` |
| Refactoring | `.claude/skills/p4nexus/p4nexus-refactoring/SKILL.md` |
| Tools/resources/schema reference | `.claude/skills/p4nexus/p4nexus-guide/SKILL.md` |
| CLI commands (index, status, clean, wiki) | `.claude/skills/p4nexus/p4nexus-cli/SKILL.md` |

<!-- p4nexus:end -->

## Repo reference

### Packages

| Package | Path | Purpose |
|---------|------|---------|
| **CLI/Core** | `p4nexus/` | TypeScript CLI, indexing pipeline, MCP server. Published to npm. |
| **Web UI** | `p4nexus-web/` | React/Vite thin client. All queries via `p4nexus serve` HTTP API. |
| **Shared** | `p4nexus-shared/` | Shared TypeScript types and constants. |
| Claude Plugin | `p4nexus-claude-plugin/` | Static config for Claude marketplace. |
| Cursor Integration | `p4nexus-cursor-integration/` | Static config for Cursor editor. |
| Eval | `eval/` | Python evaluation harness (Docker + LLM API keys). |

### Running services

```bash
cd p4nexus && npm run dev                 # CLI: tsx watch mode
cd p4nexus-web && npm run dev             # Web UI: Vite on port 5173
npx p4nexus serve                         # HTTP API on port 4747 (from any indexed repo)
```

### Testing

**CLI / Core (`p4nexus/`)**
- `npm test` — full vitest suite (~2000 tests)
- `npm run test:unit` — unit tests only
- `npm run test:integration` — integration (~1850 tests). LadybugDB file-locking tests may fail in containers (known env issue).
- `npx tsc --noEmit` — typecheck

**Web UI (`p4nexus-web/`)**
- `npm test` — vitest (~200 tests)
- `npm run test:e2e` — Playwright (7 spec files; requires `p4nexus serve` + `npm run dev`)
- `npx tsc -b --noEmit` — typecheck

**Pre-commit hook** (`.husky/pre-commit`): formatting (prettier via lint-staged) + typecheck for staged packages. Tests do **not** run in pre-commit — CI only.

### Gotchas

- `npm install` in `p4nexus/` triggers `prepare` (builds via `tsc`) and `postinstall` (patches tree-sitter-swift, builds tree-sitter-proto). Native bindings need `python3`, `make`, `g++`.
- `tree-sitter-kotlin` and `tree-sitter-swift` are optional — install warnings expected.
- ESLint configured via `eslint.config.mjs` (TS, React Hooks, unused-imports). No `npm run lint` script; use `npx eslint .`. Prettier runs via lint-staged. CI checks both in `ci-quality.yml`.
