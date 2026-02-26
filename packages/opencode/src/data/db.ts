import { Global } from "@/global"
import { Filesystem } from "@/util/filesystem"
import { randomBytes } from "crypto"
import path from "path"
import z from "zod"

const file = path.join(Global.Path.data, "db.json")

const sqlite = z.object({
  name: z.string().min(1),
  type: z.literal("sqlite"),
  path: z.string().min(1),
})

const postgres = z.object({
  name: z.string().min(1),
  type: z.literal("postgres"),
  uri: z.string().min(1),
})

const mysql = z.object({
  name: z.string().min(1),
  type: z.literal("mysql"),
  uri: z.string().min(1),
})

const config = z.discriminatedUnion("type", [sqlite, postgres, mysql])

const row = z.discriminatedUnion("type", [
  sqlite.extend({
    id: z.string(),
    created: z.number(),
  }),
  postgres.extend({
    id: z.string(),
    created: z.number(),
  }),
  mysql.extend({
    id: z.string(),
    created: z.number(),
  }),
])

const state = z.object({
  connections: z.array(row).default([]),
})

const table = z.object({
  schema: z.string(),
  name: z.string(),
})

const tableResult = z.object({
  ok: z.boolean(),
  tables: z.array(table).default([]),
  error: z.string().optional(),
})

const queryRow = z.record(z.string(), z.unknown())

const queryResult = z.object({
  ok: z.boolean(),
  columns: z.array(z.string()).default([]),
  rows: z.array(queryRow).default([]),
  row_count: z.number().optional(),
  truncated: z.boolean().optional(),
  message: z.string().optional(),
  error: z.string().optional(),
})

function managedPython() {
  const root = path.join(Global.Path.data, "data-python", ".venv")
  if (process.platform === "win32") return path.join(root, "Scripts", "python.exe")
  return path.join(root, "bin", "python")
}

async function pythonPath() {
  const env = process.env.OPENCODE_DATA_PYTHON?.trim()
  if (env && (await Filesystem.exists(env))) return env

  const managed = managedPython()
  if (await Filesystem.exists(managed)) return managed

  return Bun.which("python3") ?? Bun.which("python")
}

function help(input: string) {
  if (input.includes("Missing psycopg") || input.includes("Missing pymysql")) {
    return `${input} Run 'bun run data:env' to install Python DB adapters in an isolated venv.`
  }
  if (input.match(/permission denied/i)) {
    return "Permission refusée par la base. Utilise un user restreint (SELECT sur public, écriture sur _work) et reconnecte la DB."
  }
  const missing = input.match(/database "([^"]+)" does not exist/i)
  if (missing) {
    const db = missing[1]
    return `PostgreSQL: database "${db}" does not exist. Create it with 'createdb ${db}' or reconnect with an existing DB (for example 'postgres').`
  }
  return input
}

const py = `
import json
import sqlite3
import sys

def out(data):
  print(json.dumps(data))
  sys.stdout.flush()

def cap(value):
  try:
    row = int(value)
  except Exception:
    row = 100
  if row < 1:
    return 1
  if row > 500:
    return 500
  return row

def norm(value):
  if value is None:
    return None
  if isinstance(value, (str, int, float, bool)):
    return value
  if isinstance(value, (bytes, bytearray, memoryview)):
    return bytes(value).hex()
  if isinstance(value, (list, tuple)):
    return [norm(x) for x in value]
  if isinstance(value, dict):
    return {str(k): norm(v) for k, v in value.items()}
  if hasattr(value, "isoformat"):
    return value.isoformat()
  return str(value)

def pack(cur, limit):
  if cur.description is None:
    return {"ok": True, "columns": [], "rows": [], "row_count": cur.rowcount, "message": "Statement executed."}
  cols = [col[0] for col in cur.description]
  data = cur.fetchmany(limit + 1)
  trunc = len(data) > limit
  rows = [{cols[i]: norm(row[i]) for i in range(len(cols))} for row in data[:limit]]
  return {"ok": True, "columns": cols, "rows": rows, "row_count": len(rows), "truncated": trunc}

def sqlite_tables(cfg):
  con = sqlite3.connect(cfg["path"])
  cur = con.cursor()
  cur.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  rows = [{"schema": "main", "name": row[0]} for row in cur.fetchall()]
  con.close()
  out({"ok": True, "tables": rows})

def sqlite_query(cfg):
  con = sqlite3.connect(cfg["path"], timeout=8)
  con.execute("PRAGMA busy_timeout = 8000")
  cur = con.cursor()
  cur.execute(cfg["sql"])
  out(pack(cur, cap(cfg.get("limit"))))
  con.commit()
  con.close()

def postgres_tables(cfg):
  try:
    import psycopg
  except ModuleNotFoundError:
    out({"ok": False, "error": "Missing psycopg. Install with: pip install psycopg[binary]"})
    return

  con = psycopg.connect(cfg["uri"], connect_timeout=8)
  cur = con.cursor()
  cur.execute(
    "SELECT table_schema, table_name FROM information_schema.tables "
    "WHERE table_type = 'BASE TABLE' AND table_schema NOT IN ('pg_catalog', 'information_schema') "
    "ORDER BY table_schema, table_name"
  )
  rows = [{"schema": row[0], "name": row[1]} for row in cur.fetchall()]
  con.close()
  out({"ok": True, "tables": rows})

def postgres_query(cfg):
  try:
    import psycopg
  except ModuleNotFoundError:
    out({"ok": False, "error": "Missing psycopg. Install with: pip install psycopg[binary]"})
    return

  con = psycopg.connect(cfg["uri"], connect_timeout=8, autocommit=True)
  cur = con.cursor()
  cur.execute("SET statement_timeout = 15000")
  cur.execute(cfg["sql"])
  out(pack(cur, cap(cfg.get("limit"))))
  con.close()

def mysql_connect(cfg):
  from urllib.parse import urlparse
  con = None
  err = ""
  parsed = urlparse(cfg["uri"])
  db = parsed.path[1:] if parsed.path else None
  port = parsed.port if parsed.port else 3306

  try:
    import pymysql
    con = pymysql.connect(
      host=parsed.hostname,
      user=parsed.username,
      password=parsed.password,
      database=db,
      port=port,
      connect_timeout=8,
      read_timeout=8,
      write_timeout=8,
      autocommit=True,
    )
  except ModuleNotFoundError:
    err = "Missing pymysql. Install with: pip install pymysql"
  except Exception as e:
    err = str(e)

  return con, err

def mysql_tables(cfg):
  con, err = mysql_connect(cfg)

  if con is None:
    out({"ok": False, "error": err})
    return

  cur = con.cursor()
  cur.execute(
    "SELECT table_schema, table_name FROM information_schema.tables "
    "WHERE table_type = 'BASE TABLE' AND table_schema NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys') "
    "ORDER BY table_schema, table_name"
  )
  rows = [{"schema": row[0], "name": row[1]} for row in cur.fetchall()]
  con.close()
  out({"ok": True, "tables": rows})

def mysql_query(cfg):
  con, err = mysql_connect(cfg)

  if con is None:
    out({"ok": False, "error": err})
    return

  cur = con.cursor()
  cur.execute(cfg["sql"])
  out(pack(cur, cap(cfg.get("limit"))))
  con.close()

def main():
  payload = json.loads(sys.stdin.read() or "{}")
  kind = payload.get("type")
  action = payload.get("action") or "tables"

  if action == "tables":
    if kind == "sqlite":
      sqlite_tables(payload)
      return
    if kind == "postgres":
      postgres_tables(payload)
      return
    if kind == "mysql":
      mysql_tables(payload)
      return
    out({"ok": False, "error": "Unsupported database type"})
    return

  if action == "query":
    if kind == "sqlite":
      sqlite_query(payload)
      return
    if kind == "postgres":
      postgres_query(payload)
      return
    if kind == "mysql":
      mysql_query(payload)
      return
    out({"ok": False, "error": "Unsupported database type"})
    return

  out({"ok": False, "error": "Unsupported action"})

try:
  main()
except Exception as e:
  out({"ok": False, "error": str(e)})
`

function id() {
  return `db_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`
}

function pick(input: z.infer<typeof config> | z.infer<typeof row>) {
  if (input.type === "sqlite") return { type: input.type, path: input.path }
  return { type: input.type, uri: input.uri }
}

function parse(input: string) {
  return Promise.resolve(input)
    .then((x) => JSON.parse(x))
    .catch(() => undefined)
}

function clean(input: string) {
  return input
    .replace(/--.*$/gm, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function work(input: string) {
  return /(^|[\s(,])(?:"?_work"?|`_work`)\s*\./i.test(input)
}

function policy(input: z.infer<typeof config> | z.infer<typeof row>, sql: string) {
  const value = sql.trim()
  if (!value) return "SQL vide. Saisis une requête."

  const body = value.endsWith(";") ? value.slice(0, -1).trim() : value
  if (!body) return "SQL vide. Saisis une requête."
  if (body.includes(";")) {
    return "Une seule instruction SQL est autorisée à la fois."
  }

  const norm = clean(body).toLowerCase()
  const deny = [
    { rule: /\bdrop\b/i, label: "DROP" },
    { rule: /\btruncate\b/i, label: "TRUNCATE" },
    { rule: /\balter\b/i, label: "ALTER" },
    { rule: /\bgrant\b/i, label: "GRANT" },
    { rule: /\brevoke\b/i, label: "REVOKE" },
    { rule: /\bcreate\s+(user|role|database)\b/i, label: "CREATE USER/ROLE/DATABASE" },
    { rule: /\bset\s+role\b/i, label: "SET ROLE" },
    { rule: /\bcopy\b[\s\S]*\bprogram\b/i, label: "COPY ... PROGRAM" },
  ]
  const stop = deny.find((x) => x.rule.test(norm))
  if (stop) return `Requête bloquée par la policy SQL: ${stop.label}.`

  const first = norm.match(/^[a-z]+/)?.[0]
  if (!first) return "Impossible de détecter le type de requête SQL."

  const read = ["select", "with", "show", "describe", "desc", "explain", "pragma"]
  const write = /\b(insert|update|delete|create)\b/i
  const writes = write.test(norm)
  if (!writes && read.includes(first)) return
  if (!writes) return "Type de requête non supporté par la policy SQL."

  if (input.type === "sqlite") {
    return "Les écritures SQL sont bloquées pour SQLite dans opencode (mode safe)."
  }

  if (!work(norm)) {
    return "Écriture SQL autorisée uniquement sur le schéma _work (utilise des tables qualifiées, ex: _work.my_table)."
  }
}

async function run(payload: Record<string, unknown>, timeout: number) {
  const python = await pythonPath()
  if (!python) {
    return {
      value: undefined,
      error: "Python introuvable. Installe python3 puis lance 'bun run data:env'.",
    }
  }

  const proc = Bun.spawn([python, "-c", py], {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  })

  proc.stdin.write(JSON.stringify(payload))
  proc.stdin.end()

  const out = new Response(proc.stdout).text()
  const err = new Response(proc.stderr).text()
  let timer: NodeJS.Timeout | undefined
  const done = await Promise.race([
    proc.exited.then((code) => ({ type: "exit" as const, code })),
    new Promise<{ type: "timeout" }>((resolve) => {
      timer = setTimeout(() => resolve({ type: "timeout" }), timeout)
    }),
  ])
  if (timer) clearTimeout(timer)

  if (done.type === "timeout") {
    proc.kill()
    return {
      value: undefined,
      error: `La connexion DB a expiré (${Math.floor(timeout / 1000)}s). Vérifie le réseau, l'host, le port et les credentials.`,
    }
  }

  const stdout = await out
  const stderr = await err

  if (done.code !== 0) {
    const text = stderr.trim() || stdout.trim() || "Python a échoué"
    return {
      value: undefined,
      error: DataDB.mask(help(text)),
    }
  }

  const value = await parse(stdout)
  if (value === undefined) {
    return {
      value: undefined,
      error: "Réponse invalide de Python.",
    }
  }

  return {
    value,
    error: undefined as string | undefined,
  }
}

export namespace DataDB {
  export type Connection = z.infer<typeof row>
  export type Config = z.infer<typeof config>
  export type Table = z.infer<typeof table>
  export type QueryRow = z.infer<typeof queryRow>

  export async function list() {
    return Filesystem.readJson(file)
      .then((x) => state.parse(x).connections)
      .catch(() => [])
      .then((x) => x.toSorted((a, b) => a.name.localeCompare(b.name)))
  }

  export async function add(input: Config) {
    const rows = await list()
    const next = row.parse({
      ...input,
      id: id(),
      created: Date.now(),
    })
    await Filesystem.writeJson(file, { connections: [...rows, next] }, 0o600)
    return next
  }

  export async function remove(input: string) {
    const rows = await list()
    await Filesystem.writeJson(
      file,
      {
        connections: rows.filter((x) => x.id !== input),
      },
      0o600,
    )
  }

  export function mask(input: string) {
    const parsed = z.string().url().safeParse(input)
    if (parsed.success) {
      const url = new URL(parsed.data)
      if (url.password) url.password = "***"
      if (url.searchParams.has("password")) url.searchParams.set("password", "***")
      return url.toString()
    }
    return input
      .replace(/(\/\/[^:/\s]+:)([^@/\s]+)@/g, "$1***@")
      .replace(/(password=)([^&\s]+)/gi, "$1***")
      .replace(/(pwd=)([^&\s]+)/gi, "$1***")
  }

  export function describe(input: Connection) {
    if (input.type === "sqlite") return input.path
    return mask(input.uri)
  }

  export async function tables(input: Config | Connection) {
    const info = await run({ ...pick(input), action: "tables" }, 15_000)
    if (info.error) {
      return {
        tables: [] as Table[],
        error: info.error,
      }
    }

    const parsed = tableResult.safeParse(info.value)
    if (!parsed.success) {
      return {
        tables: [] as Table[],
        error: "Réponse invalide de l'introspection Python.",
      }
    }

    if (!parsed.data.ok) {
      return {
        tables: [] as Table[],
        error: mask(help(parsed.data.error ?? "Connexion DB échouée.")),
      }
    }

    return {
      tables: parsed.data.tables,
      error: undefined as string | undefined,
    }
  }

  export async function query(input: Config | Connection, sql: string, options?: { limit?: number }) {
    const blocked = policy(input, sql)
    if (blocked) {
      return {
        columns: [] as string[],
        rows: [] as QueryRow[],
        rowCount: 0,
        truncated: false,
        message: undefined as string | undefined,
        error: blocked,
      }
    }

    const limit = Math.max(1, Math.min(500, options?.limit ?? 100))
    const info = await run(
      {
        ...pick(input),
        action: "query",
        sql,
        limit,
      },
      20_000,
    )

    if (info.error) {
      return {
        columns: [] as string[],
        rows: [] as QueryRow[],
        rowCount: 0,
        truncated: false,
        message: undefined as string | undefined,
        error: info.error,
      }
    }

    const parsed = queryResult.safeParse(info.value)
    if (!parsed.success) {
      return {
        columns: [] as string[],
        rows: [] as QueryRow[],
        rowCount: 0,
        truncated: false,
        message: undefined as string | undefined,
        error: "Réponse invalide de l'exécution SQL Python.",
      }
    }

    if (!parsed.data.ok) {
      return {
        columns: [] as string[],
        rows: [] as QueryRow[],
        rowCount: 0,
        truncated: false,
        message: undefined as string | undefined,
        error: mask(help(parsed.data.error ?? "Exécution SQL échouée.")),
      }
    }

    return {
      columns: parsed.data.columns,
      rows: parsed.data.rows,
      rowCount: parsed.data.row_count ?? parsed.data.rows.length,
      truncated: parsed.data.truncated ?? false,
      message: parsed.data.message,
      error: undefined as string | undefined,
    }
  }
}
