# lessons.md

## Self-Improvement Loop

After ANY correction from the user:

1. Update this file with the correction pattern.
2. Add or refine a rule that prevents the same mistake.
3. Iterate on these rules until mistake rate drops.
4. Review relevant lessons at the start of each session.

## Lessons

- When adding integrations that depend on external runtimes/drivers (like Python DB libs), always:
  - surface explicit install guidance in the UI error message,
  - add connection timeouts to avoid "freeze" perception,
  - show a loading state while long checks are running.
- For Python DB adapters, never assume installing a DB client solves Python imports:
  - explicitly distinguish `psql`/CLI tools from Python packages (`psycopg`, `pymysql`),
  - verify imports with the exact interpreter path used by the app (`python3 -c "import ..."`).
- Do not rely on user-global package installs for app features:
  - provide a repo-owned/bootstrap script to provision isolated runtime dependencies,
  - make runtime code prefer the managed environment before falling back to system binaries.
- When the user asks for a chat-native workflow, do not stop at slash commands/UI:
  - add agent-callable tools so natural-language requests work directly in conversation,
  - keep slash commands as optional fallback, not the primary path.
- When adding connection selectors for agent tools:
  - support human-friendly aliases (`postgres`, `mysql`, `sqlite`) in addition to ids/names,
  - error messages must include both name and type to avoid ambiguity.
