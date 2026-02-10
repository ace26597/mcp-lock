# CLAUDE.md - mcp-lock

Supply chain security for MCP — pin, hash, detect drift in your AI tool chains.

## Quick Reference

| Command | Description |
|---------|-------------|
| `npm run build` | Build with tsup |
| `npm run dev` | Build in watch mode |
| `npm test` | Run tests with vitest |
| `npm run typecheck` | TypeScript type checking |
| `npm run lint` | ESLint |

## Architecture

```
src/
├── cli.ts                 # Entry point — Commander.js CLI
├── index.ts               # Public API for programmatic usage
├── commands/              # CLI command handlers
│   ├── pin.ts             # Generate lockfile from live MCP servers
│   ├── diff.ts            # Compare current state vs lockfile
│   ├── scan.ts            # Audit for vulnerabilities
│   └── ci.ts              # CI mode — fail build on drift
├── core/                  # Core logic
│   ├── types.ts           # Lockfile schema types
│   ├── lockfile.ts        # Read/write/generate lockfiles
│   ├── connector.ts       # MCP protocol client (stdio + HTTP)
│   ├── differ.ts          # Diff engine (lockfile vs live)
│   ├── scanner.ts         # Security scanner
│   └── capabilities.ts    # Capability inference from descriptions
├── parsers/               # Config file parsers
│   ├── types.ts           # Config types
│   └── config-discovery.ts # Auto-detect MCP configs across clients/OS
├── reporters/             # Output formatters
│   └── console.ts         # Terminal formatting helpers
├── rules/                 # Security rules
│   └── index.ts           # Built-in rules (no-auth, exposed-secrets, etc.)
└── utils/                 # Shared utilities
    ├── constants.ts       # Version, exit codes, defaults
    ├── hash.ts            # Canonical JSON hashing (SHA-256)
    └── logger.ts          # Colored console logger (NO_COLOR aware)
```

## Key Design Decisions

- **Local-first**: No cloud API calls. All analysis happens on the user's machine.
- **Hash-only storage**: Lockfile stores SHA-256 hashes of descriptions, never raw text (privacy).
- **Canonical JSON**: Deterministic hashing — same object always produces same hash.
- **NO_COLOR support**: Respects the NO_COLOR environment variable standard.
- **Exit codes**: 0 = clean, 1 = drift/findings, 2 = runtime error.
- **SARIF output**: For GitHub Security tab integration.

## MCP Clients Supported

Config auto-detection for: Claude Desktop, Claude Code CLI, Cursor, VS Code, Windsurf.
Cross-platform: macOS, Windows, Linux.

## Tech Stack

- TypeScript (strict mode, ESM)
- tsup (build)
- vitest (test)
- Commander.js (CLI parsing)
- chalk + ora (terminal UX)
- @modelcontextprotocol/sdk (MCP client)

## Conventions

- Functional style preferred over classes
- All async functions return `Promise<{ result, errors }>`
- Rule IDs are kebab-case strings
- Severity levels: low < medium < high < critical
