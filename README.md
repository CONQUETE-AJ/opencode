<p align="center">Terminal-first fork focused on data analysis and data science.</p>
<p align="center">
  <a href="https://opencode.ai/discord"><img alt="Discord" src="https://img.shields.io/discord/1391832426048651334?style=flat-square&label=discord" /></a>
  <a href="https://www.npmjs.com/package/opencode-ai"><img alt="npm" src="https://img.shields.io/npm/v/opencode-ai?style=flat-square" /></a>
  <a href="https://github.com/anomalyco/opencode/actions/workflows/publish.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/anomalyco/opencode/publish.yml?style=flat-square&branch=dev" /></a>
</p>

<p align="center"><strong>Single README policy:</strong> this repository maintains only <code>README.md</code>.</p>

---

### Scope

This fork keeps only the terminal product surface.

- Non-terminal packages were removed from this fork.
- Remaining package scope: `packages/opencode`, `packages/plugin`, `packages/script`, `packages/sdk`, `packages/util`.
- Development is centered on `packages/opencode`.
- Architecture and changes should stay modular to keep upstream merges from `dev` easy.

### Installation

```bash
bun install
bun run dev
# or use the bootstrap launcher
./start.sh
```

### Terminal Commands

```bash
./start.sh            # bootstrap deps/env then start terminal app
bun run dev            # start terminal app
bun run data:env       # setup isolated Python DB env (psycopg + pymysql) for /connectDB, /data, /sql
bun run typecheck      # terminal typecheck
bun run test:terminal  # terminal tests
bun run build          # terminal build
```

### Data Analysis / Data Science Direction

This fork is being specialized for data analysis and data science workflows in terminal:

- ingestion (CSV/JSON/Parquet/SQL),
- profiling (schema, nulls, distributions),
- transformations (filter/map/group/join),
- reproducible runs and report generation.
- interactive DB helpers in TUI:
  - run `bun run data:env` once per machine/environment
  - `/connectDB` to connect SQLite/PostgreSQL/MySQL databases
  - `/data` to browse tables by connected database
  - `/sql` to run SQL queries on a connected database with built-in safety policy
  - chat-native DB analysis: once connected, ask in natural language in chat (the agent can use the `database` tool to list tables and execute safe SQL automatically)
  - table mention autocomplete in chat: type `#` in prompt to suggest connected DB tables (similar to `@`)
  - chat DB resolver accepts connection name/id and type aliases like `postgres` when unambiguous

Recommended production posture for SQL execution:

- connect with a dedicated restricted DB user (example: `opencode_agent`)
- grant read-only access on source schemas (ex: `public`)
- grant write access only on a sandbox schema (ex: `_work`)
- keep OpenCode SQL safety policy enabled:
  - blocks destructive/admin statements (`DROP`, `TRUNCATE`, `ALTER`, `GRANT`, `REVOKE`, etc.)
  - allows writes only when query explicitly targets `_work.<table>`
  - allows only one SQL statement per execution

Example PostgreSQL grants:

```sql
CREATE USER opencode_agent WITH PASSWORD '...';

GRANT USAGE ON SCHEMA public TO opencode_agent;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO opencode_agent;

CREATE SCHEMA IF NOT EXISTS _work;
GRANT ALL ON SCHEMA _work TO opencode_agent;
```

### Agents

OpenCode includes two built-in agents you can switch between with the `Tab` key.

- **build** - Default, full-access agent for development work
- **plan** - Read-only agent for analysis and code exploration
  - Denies file edits by default
  - Asks permission before running bash commands
  - Ideal for exploring unfamiliar codebases or planning changes

Also included is a **general** subagent for complex searches and multistep tasks.
This is used internally and can be invoked using `@general` in messages.

This fork also includes a custom **data** agent for data workflows, defined in `.opencode/agent/data.md`.

Learn more about [agents](https://opencode.ai/docs/agents).

### Documentation

For more info on how to configure OpenCode, [**head over to our docs**](https://opencode.ai/docs).

### Contributing

If you're interested in contributing to OpenCode, please read our [contributing docs](./CONTRIBUTING.md) before submitting a pull request.

### Building on OpenCode

If you are working on a project that's related to OpenCode and is using "opencode" as part of its name, for example "opencode-dashboard" or "opencode-mobile", please add a note to your README to clarify that it is not built by the OpenCode team and is not affiliated with us in any way.

### FAQ

#### How is this different from Claude Code?

It's very similar to Claude Code in terms of capability. Here are the key differences:

- 100% open source
- Not coupled to any provider. Although we recommend the models we provide through [OpenCode Zen](https://opencode.ai/zen), OpenCode can be used with Claude, OpenAI, Google, or even local models. As models evolve, the gaps between them will close and pricing will drop, so being provider-agnostic is important.
- Out-of-the-box LSP support
- A focus on TUI. OpenCode is built by neovim users and the creators of [terminal.shop](https://terminal.shop); we are going to push the limits of what's possible in the terminal.
- This fork is terminal-first and optimized for data analysis/data science workflows.

---

**Join our community** [Discord](https://discord.gg/opencode) | [X.com](https://x.com/opencode)
