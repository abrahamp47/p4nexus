# P4Nexus

Graph-powered code intelligence for Perforce workspaces. Index any codebase managed by Perforce, query via MCP or CLI.

Based on [GitNexus](https://github.com/abhigyanpatwari/GitNexus) by Abhigyan Patwari, adapted for Perforce (Helix Core) version control.

## Features

- **Knowledge Graph Indexing** — AST-based code analysis using Tree-sitter (16 languages)
- **MCP Server** — Expose code intelligence to AI agents (Claude Code, Cursor, Codex)
- **Hybrid Search** — BM25 keyword + semantic vector search with Reciprocal Rank Fusion
- **Impact Analysis** — Blast radius detection before submitting changelists
- **Change Detection** — Map `p4 diff` hunks to indexed symbols and execution flows
- **Perforce Integration** — Workspace detection, changelist tracking, staleness monitoring

## Prerequisites

- Node.js >= 20.0.0
- Perforce command-line client (`p4`) installed and configured
- Active Perforce workspace (P4PORT, P4USER, P4CLIENT configured)

## Installation

```bash
cd p4nexus
npm install
npm run build
npm link  # makes `p4nexus` available globally
```

## Quick Start

```bash
# 1. Navigate to your Perforce workspace
cd /path/to/workspace

# 2. Index the codebase
p4nexus analyze

# 3. Configure MCP for your AI editor
p4nexus setup

# 4. Start using MCP tools in Claude Code / Cursor
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `p4nexus analyze [path]` | Index a codebase (full analysis) |
| `p4nexus setup` | Configure MCP for Cursor, Claude Code, OpenCode, Codex |
| `p4nexus mcp` | Start MCP server (stdio) |
| `p4nexus list` | List all indexed repositories |
| `p4nexus status` | Show index status for current workspace |
| `p4nexus query <search>` | Search the knowledge graph |
| `p4nexus context [name]` | 360-degree symbol view |
| `p4nexus impact <target>` | Blast radius analysis |
| `p4nexus detect-changes` | Map pending changes to affected symbols |
| `p4nexus cypher <query>` | Execute raw Cypher queries |
| `p4nexus doctor` | Show runtime capabilities |
| `p4nexus clean` | Delete index for current workspace |

## MCP Tools

When running as an MCP server, P4Nexus exposes these tools to AI agents:

| Tool | Purpose |
|------|---------|
| `list_repos` | Discover indexed workspaces |
| `query` | Hybrid search for execution flows |
| `context` | 360-degree symbol view (callers, callees, processes) |
| `cypher` | Raw Cypher queries against the graph |
| `detect_changes` | Map `p4 diff` to affected symbols/processes |
| `impact` | Blast radius with risk scoring |
| `rename` | Multi-file coordinated renaming |

## Perforce Integration

P4Nexus integrates with Perforce for:

- **Workspace Detection** — Automatically finds workspace root via `p4 info`
- **Staleness Tracking** — Monitors if index is behind latest submitted changelist
- **Change Detection** — Analyzes files in default/numbered changelists and shelved changes
- **Identity** — Uses P4PORT + client name for workspace fingerprinting

### Configuration

P4Nexus respects standard Perforce environment variables:
- `P4PORT` — Server address
- `P4USER` — Username
- `P4CLIENT` — Workspace name
- `P4CONFIG` — Per-directory config file (default: `.p4config`)

### Analyze Options

```bash
# Index with semantic embeddings
p4nexus analyze --embeddings

# Force full re-index
p4nexus analyze --force

# Index without Perforce workspace discovery (any directory)
p4nexus analyze --skip-p4

# Register under a custom name
p4nexus analyze --name my-project
```

### Detect Changes

```bash
# Analyze default changelist
p4nexus detect-changes

# Analyze specific changelist
p4nexus detect-changes -c 12345

# Analyze all pending changes
p4nexus detect-changes -s all
```

## Architecture

```
p4nexus/
├── src/
│   ├── cli/           # Commander.js CLI commands
│   ├── mcp/           # MCP server (stdio transport)
│   ├── core/
│   │   ├── ingestion/ # Multi-phase indexing pipeline (Tree-sitter)
│   │   ├── graph/     # Knowledge graph construction
│   │   ├── search/    # BM25 + semantic search + RRF
│   │   ├── embeddings/# Semantic vector embeddings
│   │   └── lbug/      # LadybugDB storage layer
│   ├── storage/       # Repo registry + Perforce VCS utilities
│   └── config/        # Ignore rules, language support
├── vendor/            # Tree-sitter grammar builds
└── skills/            # Generated repo-specific skill files
```

## License

PolyForm Noncommercial 1.0.0 — see [LICENSE](LICENSE).

This project is a derivative of [GitNexus](https://github.com/abhigyanpatwari/GitNexus) by Abhigyan Patwari, used under the PolyForm Noncommercial 1.0.0 license. The Perforce adaptation and related modifications are by Abraham Philip.
