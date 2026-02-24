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
```

### Terminal Commands

```bash
bun run dev            # start terminal app
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

### Agents

OpenCode includes two built-in agents you can switch between with the `Tab` key.

- **build** - Default, full-access agent for development work
- **plan** - Read-only agent for analysis and code exploration
  - Denies file edits by default
  - Asks permission before running bash commands
  - Ideal for exploring unfamiliar codebases or planning changes

Also included is a **general** subagent for complex searches and multistep tasks.
This is used internally and can be invoked using `@general` in messages.

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
