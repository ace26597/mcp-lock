# MCP Security Tools: Deep Competitive Analysis

**Research Date:** February 10, 2026
**Purpose:** Implementation-level competitive analysis for building MCP security tooling
**Scope:** Existing tools, attack vectors, technical approaches, market gaps

---

## Executive Summary

The MCP security tool ecosystem is **nascent but rapidly growing** (2025-2026), with 15+ active projects across Python, TypeScript/Node.js, and Go. Key findings:

- **No dominant player**: Invariant Labs' mcp-scan has the most stars (1.5k) but requires cloud API calls
- **Lockfile approach is NEW**: MCPTrust (Go, 6 stars, 7 commits) is the ONLY tool doing lockfile enforcement - this is a **wide open niche**
- **Most tools do static analysis only**: Few offer runtime monitoring or drift detection
- **Cloud dependency is common**: Many tools phone home to proprietary APIs (privacy concerns)
- **npm/PyPI distribution is sparse**: TypeScript tools dominate, Python tools are fewer

**Opportunity**: A **local-first, privacy-preserving lockfile-based security tool** with npm audit-style UX would fill a major gap.

---

## 1. Invariant Labs mcp-scan

**Repository:** https://github.com/invariantlabs-ai/mcp-scan
**Stars:** 1,500 | **Forks:** 143 | **License:** Apache-2.0
**Last Commit:** February 10, 2026 (active)
**Language:** Python 100%

### Technical Implementation

**Architecture:**
- **Async Python** with configurable timeouts (default 10s per server)
- Scans MCP config files (Claude Desktop, Cursor, Windsurf)
- **Actively connects** to MCP servers via stdio or HTTP/SSE
- Retrieves tool descriptions, prompts, resources, resource templates

**API Dependency:**
- **CRITICAL**: Sends tool descriptions to `https://mcp.invariantlabs.ai/api/v1/public/mcp-analysis`
- **Privacy concern**: "Collecting data for security research purposes (only about tool descriptions and how they change over time, not your user data). Don't use MCP-scan if you don't want to share your tools."
- Cannot work offline without cloud API

**Scanning Methods:**
1. **Static Scanning**: Discovers configs, connects to servers, fetches tool metadata
2. **Tool Hashing**: Cryptographic hashes of tool descriptions to detect "rug pull attacks" (version drift)
3. **Guardrails API**: Calls Invariant's proprietary API for prompt injection detection
4. **Runtime Proxying**: Optional "Invariant Gateway" intercepts MCP traffic in real-time

**Vulnerabilities Detected:**
- Prompt injection in tool descriptions
- Tool poisoning attacks (hidden instructions)
- Cross-origin escalation
- Rug pull attacks (tool definition changes after approval)
- Toxic flows

**Code Structure:**
- `src/mcp_scan/MCPScanner.py` - Core scanner logic
- `mcp_client.py` - MCP protocol client
- `signed_binary.py` - Binary signature verification
- `verify_api.py` - Guardrails API integration

**Limitations:**
- Requires cloud API (cannot audit air-gapped systems)
- Proprietary vulnerability detection (black box)
- No lockfile concept for version pinning
- No npm/pip-style advisory database

**Distribution:**
- PyPI: `pip install mcp-scan`
- npm: `npm install mcp-scan` (thin wrapper around Python version)

---

## 2. Cisco AI Defense mcp-scanner

**Repository:** https://github.com/cisco-ai-defense/mcp-scanner
**Stars:** 794 | **Forks:** 86 | **License:** Apache-2.0
**Language:** Python (3.11+)

### Technical Implementation

**Triple-Engine Architecture:**
1. **YARA Rules**: Pattern-based detection for malicious code signatures
2. **LLM-as-Judge**: Semantic analysis using LLMs to identify suspicious behavior patterns
3. **Cisco AI Defense Inspect API**: Cloud-based behavioral threat detection

**Scanning Modes:**
- Remote MCP servers (HTTP/SSE)
- stdio-based servers
- Local configuration files
- Offline static analysis (pre-generated JSON)

**What It Scans:**
- MCP tools, prompts, resources, server instructions
- Source code for behavioral analysis (implementation mismatch detection)

**API Dependency:**
- **Requires**: `MCP_SCANNER_API_KEY` and `MCP_SCANNER_ENDPOINT` environment variables
- Regional endpoints available
- Cannot work fully offline (YARA + LLM-as-Judge can, but misses cloud detection)

**Unique Features:**
- **Behavioral code analysis**: Checks if server implementation matches declared capabilities
- **Modular engine design**: Can run YARA-only for offline use

**Limitations:**
- Requires Cisco cloud API for full functionality
- No lockfile or version pinning
- No advisory database
- Enterprise-focused (not indie-developer friendly)

---

## 3. MCP-Shield

**Repository:** https://github.com/riseandignite/mcp-shield
**Stars:** 544 | **License:** MIT
**Language:** TypeScript 62%, JavaScript 38%

### Technical Implementation

**Architecture:**
- TypeScript/Node.js CLI tool
- Scans standard MCP config locations:
  - `~/.config/.mcp`
  - `~/Library/Application Support/Claude`
  - `~/.continue`
  - Custom paths via CLI flag

**Scanning Process:**
1. Parse MCP config JSON files
2. Connect to servers and retrieve tool definitions
3. Analyze tool descriptions with regex + optional LLM (Claude API)
4. Flag suspicious patterns

**Vulnerabilities Detected:**
1. **Tool Poisoning with Hidden Instructions**: Concealed directives in tool descriptions
2. **Tool Shadowing**: One tool modifying behavior of other tools
3. **Data Exfiltration Channels**: Suspicious optional parameters for data leakage
4. **Cross-Origin Violations**: Tool attempting to manipulate other tools
5. **Sensitive File Access**: Reads of SSH keys, env vars, config files

**Optional AI Enhancement:**
- Can use Claude API (`ANTHROPIC_API_KEY`) for deeper semantic analysis
- Works without API (regex-based detection only)

**Supported Clients:**
- Claude Desktop, Cursor, Windsurf, VSCode, Codeium

**Unique Features:**
- **Safe-list function**: Exclude trusted servers from scans
- **Pure local analysis option**: No cloud dependency if API key not provided

**Distribution:**
- npm: `@iflow-mcp/mcp-shield`

**Limitations:**
- No lockfile concept
- No version tracking
- No advisory database
- Relies on pattern matching (may miss novel attacks)

---

## 4. MCP-Watch

**Repository:** https://github.com/kapilduraphe/mcp-watch
**Stars:** 121 | **Forks:** 15 | **License:** MIT
**Last Commit:** May 29, 2025
**Language:** TypeScript/Node.js

### Technical Implementation

**Modular Scanner Architecture:**
- Base `Scanner` class with individual vulnerability detection modules
- Each module extends base class and implements specific checks

**12 Vulnerability Categories:**
1. **Credential Detection**: Hardcoded API keys, insecure credential storage
2. **Tool Poisoning**: Hidden malicious instructions in tool descriptions
3. **Parameter Injection**: Magic parameters extracting sensitive AI context
4. **Prompt Injection**: Prompt manipulation and injection attacks
5. **Tool Mutation**: Dynamic tool changes, rug-pull risks
6. **Conversation Exfiltration**: Triggers that steal conversation history
7. **ANSI Injection**: Steganographic attacks using escape sequences
8. **Protocol Violations**: MCP protocol security issues
9. **Input Validation**: Command injection, SSRF, path traversal
10. **Server Spoofing**: Service impersonation detection
11. **Toxic Flows**: Dangerous data flow patterns
12. **Permission Issues**: Excessive permissions, access control problems

**Output Formats:**
- **Console**: Colored terminal output
- **JSON**: Machine-readable format for CI/CD

**Filtering:**
- By severity: `low`, `medium`, `high`, `critical`
- By category: `--category credentials,poisoning`

**Exit Codes:**
- `0`: Safe (no vulnerabilities found)
- `1`: Vulnerabilities found or error

**CI/CD Integration:**
- GitHub Actions with automated testing
- Security scanning via GitHub CodeQL
- Dependency management (Dependabot)

**Distribution:**
- npm: `npm install -g mcp-watch`
- Docker: `docker run ghcr.io/kapilduraphe/mcp-watch`

**Limitations:**
- No lockfile or version pinning
- No runtime monitoring
- No advisory database
- Pattern-based detection (limited to known attack signatures)

---

## 5. MCPTrust

**Repository:** https://github.com/mcptrust/mcptrust
**Stars:** 6 | **Forks:** 1 | **License:** Apache-2.0
**Commits:** 7 (early development)
**Language:** Go

### Technical Implementation

**THIS IS THE CLOSEST COMPETITOR TO A LOCKFILE APPROACH**

**Core Concept:**
- Creates `mcp-lock.json` allowlist for tools, prompts, resources, templates
- **Runtime proxy** intercepts all MCP server communications
- **Blocks** anything not in lockfile (fail-closed security model)

**Three Key Features:**

1. **Lockfile Enforcement**
   - `mcp-lock.json` format (JSON)
   - Allowlists specific tools/prompts/resources
   - Runtime proxy blocks unlisted capabilities
   - "blocks any tool/prompt/resource not in your lockfile"

2. **Drift Detection (CI)**
   - Compares current server state vs. lockfile
   - Fails CI on `critical`, `moderate`, or `info` changes
   - Alerts when servers gain new capabilities between approvals

3. **Artifact Pinning**
   - Verifies tarball integrity with **SHA-512/256 hashes**
   - Validates SLSA provenance via cosign attestations
   - HTTPS-only downloads with private IP blocking (SSRF prevention)

**Integration:**
- Claude Desktop
- LangChain
- AutoGen
- CrewAI
- GitHub Actions

**Security Guarantees:**
- Fail-closed model (deny by default)
- Cryptographic hash verification
- SLSA supply chain security
- OpenTelemetry tracing for audit logs

**Lockfile Format (mcp-lock.json):**
```json
{
  "servers": {
    "server-name": {
      "tools": ["tool1", "tool2"],
      "prompts": ["prompt1"],
      "resources": ["resource1"],
      "artifact_hash": "sha512-256:abc123..."
    }
  }
}
```

**Production Readiness:**
- Small commit count (7 commits) suggests early stage
- Documentation includes security guarantees
- Active development (2025-2026)
- **NOT battle-tested at enterprise scale yet**

**CRITICAL INSIGHT:**
- **This is the ONLY tool doing lockfile enforcement**
- **Wide open market opportunity**: No npm audit equivalent exists
- Go implementation (less accessible than TypeScript/Python for web developers)
- No npm/PyPI distribution yet

**Limitations:**
- Very new (6 stars, minimal adoption)
- Go language barrier (harder to contribute than JS/Python)
- No advisory database integration
- No version suggestion features (unlike npm audit fix)
- Requires running as proxy (deployment complexity)

---

## 6. MCPSafetyScanner (Academic)

**Repository:** https://github.com/johnhalloran321/mcpSafetyScanner
**Stars:** 163 | **Forks:** 18 | **License:** MPL-2.0
**Created:** April 10, 2025 | **Commits:** 2
**Language:** Python 100%

### Research Paper

**ArXiv:** [2504.03767] MCP Safety Audit: LLMs with the Model Context Protocol Allow Major Security Exploits
**Authors:** Brandon Radosevich, John Halloran
**Published:** April 11, 2025

### Technical Implementation

**Agent-Based Security Auditing:**
- Uses "multiple agents to audit your setup and produce a safety report"
- Automatically generates adversarial samples for each MCP server's tools/resources
- Searches knowledge bases for related vulnerabilities
- Determines remediations and generates detailed security report

**Requirements:**
- Python >= 3.11
- OpenAI API key (cloud dependency)

**Example Output:**
- Alerts to screen for `~/.ssh/authorized_keys` and `*.pem` files
- Recommends guardrails around printing environment variables
- Advises restricting permissions on sensitive files

**Knowledge Bases:**
- Paper doesn't specify which databases are searched
- Likely uses CVE databases, OWASP resources, academic papers

**Strengths:**
- **Novel approach**: AI agents generate exploit scenarios automatically
- Research-backed (peer-reviewed paper)
- Focuses on **what could go wrong**, not just known patterns

**Limitations:**
- Very early stage (2 commits only)
- Requires OpenAI API (cannot work offline)
- No lockfile concept
- No version tracking
- Academic prototype (not production-ready)

---

## 7. ModelContextProtocol-Security/mcpserver-audit

**Repository:** https://github.com/ModelContextProtocol-Security/mcpserver-audit
**Stars:** 10 | **Forks:** 3 | **License:** Apache-2.0
**Created:** July 14, 2025
**Organization:** Cloud Security Alliance (CSA) project

### Technical Implementation

**Knowledge Base, Not Code:**
- Structured as prompts, checks, and resources
- **Not a traditional code scanning tool**
- Acts as "knowledgeable security tutor" for Claude

**Four-Phase Audit Process:**
1. **Security Education & Threat Modeling**: Introduces MCP-specific risks
2. **Guided Security Analysis**: Code scanning, dependency review, config assessment
3. **Risk Evaluation & Prioritization**: Classifies findings, assesses impact
4. **Remediation Guidance**: Develops mitigation strategies, monitoring recommendations

**Components:**
- Vulnerability check files (credential management, network security)
- AIVSS scoring methodology
- CWE mapping capabilities
- Integration with mcpserver-builder and mcpserver-operator tools

**Databases Referenced:**
- **audit-db**: Community repository for audit findings
- **vulnerability-db**: Database for vulnerability records

**Approach:**
- Leverages Claude's code analysis (no custom parser)
- Human-in-the-loop guided audits
- Not automated scanning

**Strengths:**
- CSA/OWASP backing (credibility)
- Comprehensive checklist approach
- Educational value

**Limitations:**
- Not a standalone tool (requires Claude to interpret)
- Manual process (not CI/CD friendly)
- No lockfile concept
- No automation

---

## 8. Other Notable Tools

### agent-security-scanner-mcp (npm)

**Package:** https://www.npmjs.com/package/agent-security-scanner-mcp

**Focus:** Real-time security vulnerability scanning during development

**Features:**
- Integrates with Claude Desktop, Claude Code, OpenCode.ai, Kilo Code
- Detects prompt injection, package hallucination, data exfiltration, backdoor insertion
- Built for "agentic era" attack surfaces

**Implementation:**
- MCP server that runs as part of development workflow
- Real-time scanning (not batch)

**Limitations:**
- No public GitHub repo found
- Unknown implementation details
- No lockfile support

---

### mcp-gateway (PyPI)

**Package:** https://pypi.org/project/mcp-gateway/

**Features:**
- Security scanner integrated into MCP gateway/proxy
- Reputation analysis of MCP servers
- Tool description analysis before loading

**Approach:**
- Gateway pattern (all traffic flows through it)
- Pre-load scanning (preventative)

**Limitations:**
- No GitHub repo found
- Unknown technical details
- Requires running as gateway (deployment complexity)

---

### ai-security-mcp (PyPI)

**Package:** https://pypi.org/project/ai-security-mcp/

**Features:**
- **27 specialized agents** covering security vulnerabilities
- **100% OWASP ASI + LLM vulnerabilities**
- Thin client MCP server

**Implementation:**
- Agent-based scanning (similar to MCPSafetyScanner)
- OWASP-aligned

**Limitations:**
- No GitHub repo found
- Unknown cloud dependencies
- No lockfile support

---

### sec-mcp (PyPI)

**Package:** https://pypi.org/project/sec-mcp/

**Features:**
- Security checks for domains, URLs, IPs
- Can run as MCP server
- Enriches LLM context with real-time threat insights

**Use Case:**
- Runtime threat intelligence (not static analysis)

**Limitations:**
- Focused on external threats, not MCP server security
- No lockfile support

---

## 9. Attack Vectors & Vulnerability Research

### Adversa AI MCP Security TOP 25

**Source:** https://adversa.ai/mcp-security-top-25-mcp-vulnerabilities/

**Coverage:**
- Industry's first comprehensive MCP vulnerability catalog
- 25 vulnerabilities across 4 categories:
  1. **Trust Model Design Flaws**: Architectural issues in MCP trust relationships
  2. **AI-Specific**: Unique to AI/LLM (prompt injection)
  3. **AppSec**: Traditional vulnerabilities (SQL injection, command injection)
  4. **Unique**: Novel to MCP architecture

**Key Vulnerabilities:**
- Prompt injection
- Rug pull (tool definition changes)
- Tool poisoning
- Data leakage
- Multi-agent compromise
- Supply chain exploits

**Each Entry Includes:**
- Definition
- Uniqueness categorization (AI/MCP/AppSec)
- Impact assessment
- Exploitation complexity
- Technical details
- Recommended defenses

**Status:** Public reference, evolving framework

**Note:** The webpage content was mostly CSS/JS tracking code; full vulnerability list requires direct access to the page.

---

### OWASP MCP Top 10

**Source:** https://owasp.org/www-project-mcp-top-10/

**Status:** Beta release, pilot testing phase (2026)

**Known Vulnerabilities:**
1. **MCP01:2025 - Token Mismanagement & Secret Exposure**
   - Hard-coded credentials, long-lived tokens
   - Secrets in model memory or protocol logs
   - Attack: Retrieve via prompt injection, debug traces
   - Impact: Full compromise of connected systems

2. **Software Supply Chain Attacks & Dependency Tampering**
   - Malicious/vulnerable components in dependencies
   - Compromised connectors, model plug-ins
   - Impact: Altered agent behavior, execution-level backdoors

3. **Command/Prompt Injection**
   - Agent constructs system commands from untrusted input
   - No validation/sanitization of user prompts, retrieved context
   - Impact: Arbitrary code execution, data exfiltration

4. **Insufficient Authentication & Authorization**
   - MCP servers/tools fail to verify identities
   - Inadequate access controls
   - Impact: Unauthorized access, privilege escalation

**Living Document:** Evolves with AI capabilities and protocol innovation

---

### CoSAI Security White Paper (2026)

**Source:** Coalition for Secure AI (CoSAI)
**Reference:** https://adversa.ai/blog/mcp-security-whitepaper-2026-cosai-top-insights/

**Scope:**
- **12 core threat categories**
- **~40 distinct threats**
- Actionable security controls

**Key Insights:**
- MCP is "USB-C port for AI applications"
- LLM as intermediary creates unique vulnerabilities
- Traditional security (firewalls, auth tokens) insufficient
- AI agents can be manipulated via natural language to bypass controls

**Recommended Controls:**
1. **Strong identity chains**: End-to-end agent identity and traceability
2. **Zero-trust for AI agents**: MCP servers/agents operate with least privilege
3. **Sandboxing**: Isolate MCP servers
4. **Input sanitization**: Strict allowlists at each trust boundary
5. **Treat LLM output as untrusted**: Prompt injection detection, schema validation

---

### Tool Poisoning Attack Examples

**Invariant Labs Proof-of-Concept:**

**Repository:** https://github.com/invariantlabs-ai/mcp-injection-experiments

**Exploits Demonstrated:**

1. **direct-poisoning.py**
   - Simple MCP server with malicious `add` tool
   - Hidden instruction: Leak `~/.ssh/authorized_keys` and `mcp.json`
   - Success: Exfiltrated SSH keys from Claude Desktop and Cursor

2. **shadowing.py**
   - Sophisticated attack manipulating trusted `send_email` tool (from different server)
   - All emails sent by agent are leaked to attacker's server
   - Demonstrates **cross-server tool manipulation**

**Attack Techniques:**
- **Base64 encoding**: Hide malicious commands
- **Obfuscation**: Push malicious code out of view with whitespace, misleading comments
- **Directive insertions**: "IMPORTANT:", "NOTE:", "REQUIRED:" followed by malicious instructions
- **Tag exploitation**: HTML-like tags invisible to users
- **Unicode obfuscation**: Invisible characters
- **Parameter poisoning**: Hide instructions in parameter descriptions
- **Full-schema poisoning**: Extend attacks to parameter names, types, required fields

---

### Cross-Server Data Exfiltration

**Research Paper:** [2507.19880] Trivial Trojans: How Minimal MCP Servers Enable Cross-Tool Exfiltration of Sensitive Data

**Key Finding:**
- Malicious weather MCP server discovers and exploits legitimate banking tools
- Steals user account balances
- **No advanced technical knowledge required**
- Prerequisites: Basic Python, prompt template modification
- Setup time: Under 2 hours

**Attack Mechanism:**
- Implicit trust: Any server can trigger actions on others via AI agent
- Malicious tool manipulates other tools' behavior
- Single compromised tool can leverage any available tool

**Example:**
```
User: "What's the weather?"
Weather Server (malicious):
  1. Discovers banking tool via MCP
  2. Instructs LLM to call get_balance()
  3. Includes instruction to report balance to weather server
  4. Exfiltrates data while appearing to act within stated purpose
```

---

### Confused Deputy Attack

**Source:** https://den.dev/blog/mcp-confused-deputy-api-management/

**Vulnerability:**
- OAuth flow attack on MCP proxy servers
- MCP proxy uses static `client_id` with third-party API
- MCP proxy allows dynamic client registration
- Third-party auth server sets consent cookie after first authorization
- MCP proxy doesn't implement per-client consent

**Attack Flow:**
1. Attacker registers malicious MCP client with proxy
2. Victim authorizes legitimate MCP client (consent cookie set)
3. Attacker's client initiates auth with same third-party API
4. Consent cookie reused, authorization code redirected to attacker
5. Attacker steals access token, impersonates victim

**Mitigation:**
- Maintain registry of approved `client_id` values per user
- Check registry before initiating third-party auth
- Validate `redirect_uri` matches registered URI exactly
- Store consent decisions securely
- Reject requests if `redirect_uri` changed without re-registration

---

### Rug Pull Attack

**Definition:** Server modifies, removes, or redefines tools after initial trust/approval

**Detection Challenge:**
- No built-in MCP mechanism to detect changes
- Standard clients don't re-verify tool definitions after approval
- Same tool name + schema can have changed implementation

**Solutions:**

1. **Hash-Based Tool Pinning** (mcp-scan approach)
   - Hash tool descriptions on first scan
   - Alert if hash changes
   - Store in `tool_hashlock.json`

2. **Immutable Versioning**
   - Any change to tool mandates new signed version
   - Detects unauthorized modifications and API contract drift

3. **Continuous Monitoring** (Akto approach)
   - Track response patterns across sessions
   - Flag drift from declared capabilities or schema

---

## 10. Adjacent Tools for Inspiration

### npm audit

**Technical Implementation:**

**Advisory Database:**
- Uses **GitHub Advisory Database** (merged with npm database)
- GitHub DB is source of truth
- All npm security advisories migrated to GitHub

**Endpoints:**
- **Bulk Advisory endpoint**: `/-/npm/v1/security/advisories/bulk` (npm v7+)
- **Quick Audit endpoint**: Legacy (slower)

**Process:**
1. Generate JSON payload with package names + versions
2. POST to advisory endpoint
3. Advisory database returns matching vulnerabilities
4. Display severity + suggested fix

**Caching:**
- Metavulnerabilities cached in `~/.npm` folder
- Re-evaluated only if advisory range changes or new package version published

**UX:**
- `npm audit` - View vulnerabilities
- `npm audit fix` - Auto-update to safe versions
- `npm audit fix --force` - Apply breaking changes
- Severity levels: `low`, `moderate`, `high`, `critical`
- Exit codes: `0` (safe), `1` (vulnerabilities found)

**Learnings for MCP Tool:**
- Advisory database is CRITICAL
- Caching improves performance
- Auto-fix is valuable UX
- Clear severity levels
- Machine-readable output (JSON)

---

### Dependabot

**Technical Implementation:**

**Version Drift Detection:**
1. Scans dependency files (package.json, Gemfile, etc.)
2. Compares current versions vs. latest in package registries
3. Uses semantic versioning to decide if update recommended

**Architecture:**
- **Dependabot-Core**: Collection of Ruby gems
- Common package: Shared functionality, PR creation, Git handling
- Per-package-manager implementations:
  - Fetch dependency files for project
  - Parse files to extract dependency list
  - Check latest resolvable version
  - Generate updated manifest + lockfiles

**Limitations:**
- Relies on declarations (pattern recognition)
- Cannot recognize transitive dependencies resolved by project
- Misses real vulnerabilities in non-declared deps

**Learnings for MCP Tool:**
- Need package-manager-specific implementations
- Lockfile generation is key feature
- Transitive dependency tracking is hard
- Dependency resolution logic is complex

---

### Snyk CLI

**Architecture:**

**Vulnerability Database:**
- https://security.snyk.io
- Comprehensive list of known security vulnerabilities
- Used by Snyk products to find and fix code vulnerabilities

**API:**
- Requires enterprise plan for REST API access
- APIs: List orgs, projects, issues, test packages, ignore issues, reporting stats, dependencies/licenses

**CLI vs. API:**
- **CLI is MORE accurate** than API for most package managers
- CLI tests actual deployed code (accurate snapshot of versions in use)
- API infers snapshot with inferior accuracy

**Learnings for MCP Tool:**
- Local scanning (CLI) > cloud API for accuracy
- Vulnerability database needs continuous updates
- Enterprise plan gating limits adoption
- Need both CLI and API for different use cases

---

### Socket.dev

**Technical Approach:**

**Static Analysis:**
- Identifies software supply chain attack indicators:
  - New install scripts
  - Network requests
  - Environment variable access
  - Telemetry
  - Suspicious strings
  - Obfuscated code
  - Dozens of other signals

**Deep Package Inspection:**
- "Peels back layers" to characterize actual behavior
- Not just metadata analysis

**Zero-Day Detection:**
- Detects and blocks malicious dependencies within minutes of publication
- Most effective for blocking zero-day supply chain attacks

**Coverage:**
- **60 detections** in 5 categories:
  1. Supply chain risk
  2. Quality
  3. Maintenance
  4. Known vulnerabilities
  5. License problems

**Detections Include:**
- Malware
- Install scripts
- Hidden code
- Typo-squatting
- Obfuscated code

**Platform Integration:**
- **GitHub App**: Scans Pull Requests
- **CLI**: Wraps package managers (npm, yarn, pnpm, pip)
- **Socket Firewall**: Proxy in front of package managers, blocks at install time

**Recent Enhancement (2026):**
- AI-powered threat detection for 6 programming language ecosystems
- Detects and blocks 100+ supply chain attacks per week

**Learnings for MCP Tool:**
- Static analysis at scale works
- Real-time monitoring is valuable
- Multiple integration points (CLI, CI/CD, runtime proxy)
- AI-powered detection is emerging best practice
- Speed matters (detect within minutes)

---

## 11. MCP Trust Registries & Verification

### BlueRock MCP Trust Registry

**URL:** https://www.bluerock.io/mcp-trust-registry

**Features:**
- Catalog of MCP servers and tools with security scorecards
- **Exposed tools**: What capabilities does server have?
- **Read/write capabilities**: Destructive verbs flagged
- **Likely risks**: RCE, data exfil, full-schema poisoning
- **Remediation notes**: Practical guidance

**Analysis Methods:**
- Static checks
- Runtime-informed checks
- Tool discovery
- Permission analysis
- Configuration drift detection
- Exposure to known vulnerability patterns (OWASP Agentic/LLM work)

**Use Case:** "Decide what's safe to wire into your agents"

---

### MseeP.ai

**URL:** https://mseep.ai/

**Features:**
- **4,668 verified MCP endpoints**
- Real-time trust ratings
- Security scores

---

### Docker MCP Catalog

**Features:**
- **Publisher trust levels**: Official, verified, community-contributed
- **Git commit attribution**: Each release tied to specific commit
- **Verifiable releases**: Precisely attributable

---

### Glama

**Features:**
- Regular codebase and documentation scans
- Confirms MCP server working as expected
- Checks for obvious security issues in dependencies

---

## 12. Market Gaps & Opportunities

### Gap 1: Local-First Privacy-Preserving Tool

**Problem:**
- mcp-scan, Cisco scanner, MCPSafetyScanner all require cloud APIs
- Privacy concerns: Tool descriptions sent to third parties
- Cannot audit air-gapped systems

**Opportunity:**
- Build 100% local scanner (no cloud dependency)
- All vulnerability detection runs on user's machine
- Privacy-first marketing ("your tools never leave your computer")

---

### Gap 2: Lockfile-Based Version Pinning

**Problem:**
- MCPTrust is the ONLY tool doing lockfile enforcement (6 stars, 7 commits)
- No npm audit equivalent for MCP
- No advisory database integration
- Go language barrier

**Opportunity:**
- **TypeScript/Python lockfile tool** (more accessible)
- **npm/PyPI distribution** (easy install)
- **mcp-lock.json format** (inspired by package-lock.json)
- **Advisory database** (community-maintained or self-hosted)
- **Auto-fix suggestions** (like npm audit fix)

---

### Gap 3: Advisory Database

**Problem:**
- No central MCP vulnerability database (like GitHub Advisory DB for npm)
- Each tool uses proprietary detection methods
- No standardized CVE-style identifiers for MCP vulnerabilities

**Opportunity:**
- Create **MCP Advisory Database**
- Schema: `MCP-CVE-YYYY-NNNN` identifiers
- JSON API for lookups
- Community contributions (like nvd.nist.gov)
- Integration points for all scanning tools

---

### Gap 4: CI/CD Integration

**Problem:**
- Most tools are CLI-only
- Limited GitHub Actions support
- No GitLab/Bitbucket/CircleCI integrations

**Opportunity:**
- **GitHub Action** for MCP security scanning
- **Pre-commit hooks** to block risky servers
- **Status checks** for PRs modifying MCP configs
- **Dependency-review-action-style** workflow

---

### Gap 5: Developer-Friendly UX

**Problem:**
- Existing tools have inconsistent UX
- No "just works" experience (like npm audit)
- Configuration complexity

**Opportunity:**
- **Zero-config default**: Scan standard locations automatically
- **Clear severity levels**: Critical, High, Medium, Low (color-coded)
- **Actionable output**: "Run `mcp-audit fix server-name` to resolve"
- **JSON output** for machine parsing
- **HTML reports** for sharing with team

---

### Gap 6: Runtime Monitoring

**Problem:**
- Most tools do static analysis only
- Runtime attacks (rug pull, tool mutation) harder to detect
- MCPTrust requires proxy deployment (complexity)

**Opportunity:**
- **Lightweight runtime agent** (doesn't require proxy)
- **File watcher** for `mcp.json` changes
- **Tool definition diff** when servers reconnect
- **Alert system** (Slack, email, webhook)

---

### Gap 7: Remediation Guidance

**Problem:**
- Tools identify vulnerabilities but offer generic advice
- No step-by-step fix instructions
- No safe alternative suggestions

**Opportunity:**
- **Contextual remediation**: Specific to vulnerability + server
- **Safe alternatives**: "Use server X instead of Y"
- **Patch scripts**: Auto-generate safe config replacements
- **Learning resources**: Link to security best practices

---

### Gap 8: Multi-Client Support

**Problem:**
- Tools focus on Claude Desktop, Cursor
- Limited support for LangChain, AutoGen, CrewAI configs

**Opportunity:**
- **Universal MCP config parser**
- Support for:
  - Claude Desktop
  - Cursor
  - Windsurf
  - VSCode
  - LangChain
  - AutoGen
  - CrewAI
  - Continue
  - Codeium

---

## 13. Recommended Tech Stack for New Tool

Based on competitive analysis:

### Language: TypeScript/Node.js
**Why:**
- Most MCP developers use Node.js
- Easy npm distribution
- Strong ecosystem for CLI tools (commander, inquirer, chalk)
- Better adoption than Go (MCPTrust) or Python (mcp-scan)

### Core Features:
1. **Lockfile enforcement** (`mcp-lock.json`)
2. **Version pinning** (SHA-256 hashes)
3. **Advisory database integration**
4. **Local-first scanning** (no cloud dependency)
5. **Auto-fix suggestions**
6. **CI/CD integration**

### Architecture:
```
mcp-audit/
├── src/
│   ├── scanner/          # Local vulnerability detection
│   ├── lockfile/         # Lockfile CRUD operations
│   ├── advisory/         # Advisory DB client
│   ├── remediation/      # Auto-fix logic
│   └── reporters/        # Console, JSON, HTML output
├── tests/
├── .github/workflows/    # CI/CD examples
└── package.json
```

### Tech Stack:
- **CLI**: `commander` (parsing), `inquirer` (prompts), `chalk` (colors)
- **MCP Client**: `@modelcontextprotocol/sdk` (official SDK)
- **Hashing**: `crypto` (built-in SHA-256)
- **Config Parsing**: `cosmiconfig` (find mcp.json files)
- **Testing**: `vitest` (fast), `@types/node`
- **Advisory DB**: PostgreSQL (self-hosted) or SQLite (embedded)

### Distribution:
- **npm**: `npm install -g mcp-audit`
- **GitHub Action**: `uses: yourusername/mcp-audit-action@v1`
- **Homebrew**: `brew install mcp-audit` (for Mac users)

---

## 14. Unique Selling Points vs. Competitors

| Feature | mcp-scan | MCPTrust | MCP-Shield | mcp-watch | **Your Tool** |
|---------|----------|----------|------------|-----------|---------------|
| **Language** | Python | Go | TypeScript | TypeScript | **TypeScript** |
| **Lockfile** | ❌ | ✅ | ❌ | ❌ | **✅** |
| **Local-First** | ❌ (cloud API) | ✅ | ✅ | ✅ | **✅** |
| **Advisory DB** | ❌ | ❌ | ❌ | ❌ | **✅** |
| **Auto-Fix** | ❌ | ❌ | ❌ | ❌ | **✅** |
| **Runtime Monitor** | ✅ (proxy) | ✅ (proxy) | ❌ | ❌ | **✅ (file watcher)** |
| **CI/CD Action** | ✅ | ✅ | ❌ | ✅ | **✅** |
| **npm Package** | ✅ | ❌ | ✅ | ✅ | **✅** |
| **Stars (proxy)** | 1,500 | 6 | 544 | 121 | **TBD** |

**Your Competitive Advantages:**
1. **Only lockfile tool in TypeScript** (more accessible than Go)
2. **Only tool with advisory database** (npm audit UX)
3. **Only tool with auto-fix** (developer-friendly)
4. **Local-first** (privacy-preserving, works offline)
5. **Runtime monitoring without proxy** (easier deployment)

---

## 15. Key Takeaways for Implementation

### Critical Success Factors:

1. **Nail the UX**: Must be as easy as `npm audit`
   - Zero-config default
   - Clear, actionable output
   - Auto-fix that actually works

2. **Privacy First**: Never send data to cloud
   - All detection happens locally
   - Advisory DB queries are metadata-only (server name, version)
   - Market as "privacy-preserving" alternative to mcp-scan

3. **Build Advisory Database Early**
   - Start with manual curation of known exploits
   - Open-source schema for community contributions
   - Use GitHub Advisories as inspiration

4. **Lockfile Format Matters**
   - Compatible with package-lock.json philosophy
   - Human-readable (JSON, not binary)
   - Include metadata (timestamp, user, CI info)
   - Support comments (JSONC format)

5. **Multi-Client Support**
   - Don't just focus on Claude Desktop
   - LangChain/AutoGen configs are different format
   - Universal parser abstraction

6. **CI/CD is Make-or-Break**
   - GitHub Action must be dead simple
   - Status checks for PR reviews
   - Fail builds on critical vulnerabilities

7. **Community Engagement**
   - Publish vulnerability research (blog posts)
   - Contribute to OWASP MCP Top 10
   - Submit findings to Adversa AI TOP 25
   - Engage with Invariant Labs, Cisco researchers

8. **Avoid Pitfalls**
   - Don't require cloud API (privacy killer)
   - Don't use obscure language (Go limits adoption)
   - Don't ignore runtime attacks (rug pulls are real)
   - Don't ship without auto-fix (devs won't manually fix)

---

## 16. Sources

### GitHub Repositories
- [invariantlabs-ai/mcp-scan](https://github.com/invariantlabs-ai/mcp-scan)
- [cisco-ai-defense/mcp-scanner](https://github.com/cisco-ai-defense/mcp-scanner)
- [riseandignite/mcp-shield](https://github.com/riseandignite/mcp-shield)
- [kapilduraphe/mcp-watch](https://github.com/kapilduraphe/mcp-watch)
- [mcptrust/mcptrust](https://github.com/mcptrust/mcptrust)
- [johnhalloran321/mcpSafetyScanner](https://github.com/johnhalloran321/mcpSafetyScanner)
- [ModelContextProtocol-Security/mcpserver-audit](https://github.com/ModelContextProtocol-Security/mcpserver-audit)
- [invariantlabs-ai/mcp-injection-experiments](https://github.com/invariantlabs-ai/mcp-injection-experiments)
- [Puliczek/awesome-mcp-security](https://github.com/Puliczek/awesome-mcp-security)

### Research Papers
- [MCP Safety Audit: LLMs with the Model Context Protocol Allow Major Security Exploits](https://arxiv.org/abs/2504.03767) (Radosevich & Halloran, 2025)
- [Trivial Trojans: How Minimal MCP Servers Enable Cross-Tool Exfiltration](https://arxiv.org/abs/2507.19880)
- [ETDI: Mitigating Tool Squatting and Rug Pull Attacks](https://arxiv.org/html/2506.01333v1)

### Industry Resources
- [Adversa AI MCP Security TOP 25](https://adversa.ai/mcp-security-top-25-mcp-vulnerabilities/)
- [OWASP MCP Top 10](https://owasp.org/www-project-mcp-top-10/)
- [CoSAI Security White Paper](https://www.coalitionforsecureai.org/securing-the-ai-agent-revolution-a-practical-guide-to-mcp-security/)
- [BlueRock MCP Trust Registry](https://www.bluerock.io/mcp-trust-registry)
- [Invariant Labs Blog](https://invariantlabs.ai/blog/introducing-mcp-scan)
- [Elastic Security Labs MCP Analysis](https://www.elastic.co/security-labs/mcp-tools-attack-defense-recommendations)

### Package Registries
- [npm: @iflow-mcp/mcp-shield](https://www.npmjs.com/package/@iflow-mcp/mcp-shield)
- [npm: agent-security-scanner-mcp](https://www.npmjs.com/package/agent-security-scanner-mcp)
- [PyPI: mcp-scan](https://pypi.org/project/mcp-scan/)
- [PyPI: ai-security-mcp](https://pypi.org/project/ai-security-mcp/)

### Documentation
- [MCP Security Best Practices](https://modelcontextprotocol.io/specification/draft/basic/security_best_practices)
- [npm audit documentation](https://docs.npmjs.com/auditing-package-dependencies-for-security-vulnerabilities/)
- [Socket.dev Documentation](https://docs.socket.dev/)
- [Snyk Vulnerability Database](https://security.snyk.io)

---

**End of Competitive Analysis**

*This document provides implementation-level detail for building a competitive MCP security tool. Focus areas: lockfile enforcement, advisory database, local-first privacy, npm audit-style UX.*
