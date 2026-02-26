import z from "zod"
import { Tool } from "./tool"
import { DataDB } from "@/data/db"
import DESCRIPTION from "./data.txt"

const params = z.object({
  action: z
    .enum(["list_connections", "list_tables", "run_query"])
    .describe("Action to run on connected databases."),
  connection: z
    .string()
    .optional()
    .describe("Optional connection selector (name, id, or type alias like postgres/mysql/sqlite)."),
  sql: z.string().optional().describe("SQL statement for action=run_query."),
  limit: z
    .coerce.number()
    .optional()
    .describe("Optional row limit for action=run_query. Defaults to 50, max 200."),
})

function connection(input: DataDB.Connection) {
  return `${input.name} [${input.type}] -> ${DataDB.describe(input)}`
}

function list(input: DataDB.Connection[]) {
  if (!input.length) return "No database connected. Use /connectDB first."
  return input.map(connection).join("\n")
}

function available(input: DataDB.Connection[]) {
  return input.map((item) => `${item.name}[${item.type}]`).join(", ")
}

function type(input: string) {
  const value = input.trim().toLowerCase()
  if (["postgres", "postgresql", "pg"].includes(value)) return "postgres" as const
  if (["mysql", "mariadb"].includes(value)) return "mysql" as const
  if (["sqlite", "sqlite3"].includes(value)) return "sqlite" as const
}

function find(input: DataDB.Connection[], key?: string) {
  if (!input.length) {
    throw new Error("No database connected. Use /connectDB first.")
  }

  if (!key?.trim()) {
    if (input.length === 1) return input[0]
    throw new Error(
      `Multiple databases are connected. Provide 'connection' with one of: ${available(input)}`,
    )
  }

  const value = key.trim().toLowerCase()
  const exact = input.find((item) => item.id.toLowerCase() === value || item.name.toLowerCase() === value)
  if (exact) return exact

  const kind = type(value)
  if (kind) {
    const typed = input.filter((item) => item.type === kind)
    if (typed.length === 1) return typed[0]
    if (typed.length > 1) {
      throw new Error(
        `Ambiguous connection type '${key}'. Matches: ${typed.map((item) => item.name).join(", ")}. Use exact name or id.`,
      )
    }
  }

  const match = input.filter((item) => item.id.toLowerCase().includes(value) || item.name.toLowerCase().includes(value))
  if (match.length === 1) return match[0]
  if (match.length > 1) {
    throw new Error(
      `Ambiguous connection '${key}'. Matches: ${match.map((item) => item.name).join(", ")}. Use exact name or id.`,
    )
  }

  throw new Error(`Connection '${key}' not found. Available: ${available(input)}`)
}

function trim(input: string[], max: number) {
  const items = input.slice(0, max)
  const rest = input.length - items.length
  if (rest <= 0) return items.join("\n")
  return `${items.join("\n")}\n... (${rest} more not shown)`
}

function meta(input?: {
  count?: number
  connection?: string
  columns?: number
  rows?: number
  total?: number
  truncated?: boolean
}) {
  return {
    count: input?.count ?? 0,
    connection: input?.connection ?? "",
    columns: input?.columns ?? 0,
    rows: input?.rows ?? 0,
    total: input?.total ?? 0,
    truncated: input?.truncated ?? false,
  }
}

export const DataTool = Tool.define("database", {
  description: DESCRIPTION,
  parameters: params,
  async execute(input) {
    const items = await DataDB.list()

    if (input.action === "list_connections") {
      return {
        title: "Database connections",
        metadata: meta({ count: items.length }),
        output: list(items),
      }
    }

    const db = find(items, input.connection)

    if (input.action === "list_tables") {
      const data = await DataDB.tables(db)
      if (data.error) throw new Error(data.error)
      const names = data.tables.map((item) => `${item.schema}.${item.name}`)
      return {
        title: `Tables: ${db.name}`,
        metadata: meta({ connection: db.name, count: names.length }),
        output: names.length
          ? trim(names, 400)
          : `No visible tables found for ${db.name}.`,
      }
    }

    if (input.action === "run_query") {
      const sql = input.sql?.trim()
      if (!sql) throw new Error("Missing sql for action=run_query.")
      const limit = Math.max(1, Math.min(200, input.limit ?? 50))
      const data = await DataDB.query(db, sql, { limit })
      if (data.error) throw new Error(data.error)

      return {
        title: `Query: ${db.name}`,
        metadata: meta({
          connection: db.name,
          columns: data.columns.length,
          rows: data.rows.length,
          total: data.rowCount,
          truncated: data.truncated,
        }),
        output: [
          `connection: ${db.name}`,
          `sql: ${sql}`,
          `columns: ${data.columns.join(", ") || "(none)"}`,
          `rows_returned: ${data.rows.length}`,
          `row_count: ${data.rowCount}`,
          `truncated: ${data.truncated ? "yes" : "no"}`,
          data.message ? `message: ${data.message}` : "",
          "rows_json:",
          JSON.stringify(data.rows, null, 2),
        ]
          .filter(Boolean)
          .join("\n"),
      }
    }

    throw new Error(`Unsupported action: ${input.action}`)
  },
})
