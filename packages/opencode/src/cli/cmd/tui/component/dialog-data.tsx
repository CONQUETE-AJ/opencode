import { DialogPrompt } from "@tui/ui/dialog-prompt"
import { DialogSelect } from "@tui/ui/dialog-select"
import { DataDB } from "@/data/db"
import type { DialogContext } from "@tui/ui/dialog"
import type { ToastContext } from "@tui/ui/toast"
import { Filesystem } from "@/util/filesystem"
import { Global } from "@/global"
import path from "path"
import { TextAttributes } from "@opentui/core"
import { useTheme } from "@tui/context/theme"

type Ctx = {
  dialog: DialogContext
  toast: ToastContext
}

function DialogBusy(props: { title: string; message: string }) {
  const { theme } = useTheme()
  return (
    <box paddingLeft={2} paddingRight={2} gap={1} paddingBottom={1}>
      <text attributes={TextAttributes.BOLD} fg={theme.text}>
        {props.title}
      </text>
      <text fg={theme.textMuted}>{props.message}</text>
    </box>
  )
}

function normalize(input: string) {
  if (input === "~") return Global.Path.home
  if (input.startsWith("~/")) return path.join(Global.Path.home, input.slice(2))
  if (path.isAbsolute(input)) return path.normalize(input)
  return path.resolve(process.cwd(), input)
}

function connectLabel(input: DataDB.Config["type"]) {
  if (input === "sqlite") return "SQLite"
  if (input === "postgres") return "PostgreSQL"
  return "MySQL"
}

function cut(input: string, max: number) {
  if (input.length <= max) return input
  if (max <= 3) return input.slice(0, max)
  return `${input.slice(0, max - 3)}...`
}

function value(input: unknown) {
  if (input === null || input === undefined) return "null"
  if (typeof input === "string") return cut(input, 64)
  if (typeof input === "number" || typeof input === "boolean" || typeof input === "bigint") return String(input)
  return cut(JSON.stringify(input) ?? String(input), 64)
}

function row(input: DataDB.QueryRow, columns: string[]) {
  const keys = (columns.length ? columns : Object.keys(input)).slice(0, 4)
  if (!keys.length) return "(empty row)"
  return cut(
    keys
      .map((key) => `${key}=${value(input[key])}`)
      .join(" | ")
      .replace(/\s+/g, " "),
    220,
  )
}

async function sql(ctx: Ctx, connection: DataDB.Connection, seed = "") {
  const text = await DialogPrompt.show(ctx.dialog, `SQL · ${connection.name}`, {
    value: seed,
    placeholder: "SELECT * FROM public.my_table LIMIT 20",
    description: () => (
      <text>Policy: single statement, no DROP/TRUNCATE/ALTER, writes only on _work.*</text>
    ),
  })
  if (text === null) return tables(ctx, connection)

  const query = text.trim()
  if (!query) return tables(ctx, connection)

  ctx.dialog.replace(() => <DialogBusy title={`SQL · ${connection.name}`} message="Running SQL query..." />)
  const result = await DataDB.query(connection, query, { limit: 100 })
  if (result.error) {
    ctx.toast.show({
      variant: "error",
      message: result.error,
      duration: 7000,
    })
    return sql(ctx, connection, query)
  }

  const info = [
    {
      title: result.message ?? `Rows: ${result.rowCount}${result.truncated ? "+" : ""}`,
      value: "result",
      category: "Result",
      description: result.columns.length ? `Columns: ${result.columns.join(", ")}` : "Statement executed (no row set).",
    },
  ]

  const items = result.rows.map((item, index) => ({
    title: `Row ${index + 1}`,
    value: `row-${index + 1}`,
    category: "Rows",
    description: row(item, result.columns),
    onSelect() {
      ctx.toast.show({
        variant: "info",
        message: row(item, result.columns),
        duration: 3500,
      })
    },
  }))

  const actions = [
    {
      title: "Run another query",
      value: "again",
      category: "Actions",
      onSelect() {
        sql(ctx, connection, query)
      },
    },
    {
      title: "Back to tables",
      value: "tables",
      category: "Actions",
      onSelect() {
        tables(ctx, connection)
      },
    },
  ]

  const options = [...info, ...items, ...actions]
  ctx.dialog.replace(() => (
    <DialogSelect title={`SQL · ${connection.name}`} placeholder="Search rows or actions" options={options} onFilter={() => {}} />
  ))
}

async function tables(ctx: Ctx, connection: DataDB.Connection) {
  ctx.dialog.replace(() => <DialogBusy title={`Tables · ${connection.name}`} message="Loading tables..." />)
  const data = await DataDB.tables(connection)
  if (data.error) {
    ctx.toast.show({
      variant: "error",
      message: data.error,
      duration: 6000,
    })
    return openData(ctx)
  }

  const items = data.tables.toSorted((a, b) => {
    if (a.schema === b.schema) return a.name.localeCompare(b.name)
    return a.schema.localeCompare(b.schema)
  })

  const options = [
    ...(items.length
      ? items.map((item) => ({
          title: item.name,
          value: `${item.schema}.${item.name}`,
          category: item.schema,
          description: `${item.schema}.${item.name}`,
          onSelect() {
            ctx.toast.show({
              variant: "info",
              message: `${item.schema}.${item.name}`,
              duration: 2000,
            })
          },
        }))
      : [
          {
            title: "No tables found",
            value: "empty",
            category: "Tables",
            description: "This database has no visible base tables.",
          },
        ]),
    {
      title: "Run SQL query",
      value: "query",
      category: "Actions",
      onSelect() {
        sql(ctx, connection)
      },
    },
    {
      title: "Refresh tables",
      value: "refresh",
      category: "Actions",
      onSelect() {
        tables(ctx, connection)
      },
    },
    {
      title: "Back to databases",
      value: "back",
      category: "Actions",
      onSelect() {
        openData(ctx)
      },
    },
  ]

  ctx.dialog.replace(() => (
    <DialogSelect
      title={`Tables · ${connection.name}`}
      placeholder="Search table"
      options={options}
      onFilter={() => {}}
    />
  ))
}

async function connect(ctx: Ctx, type: DataDB.Config["type"]) {
  const nameRaw = await DialogPrompt.show(ctx.dialog, "Database name", {
    placeholder: `${type}-main`,
  })
  if (nameRaw === null) return openConnectDB(ctx)
  const name = nameRaw.trim() || `${type}-${Date.now().toString(36)}`

  if (type === "sqlite") {
    const pathRaw = await DialogPrompt.show(ctx.dialog, "SQLite file path", {
      placeholder: "./data.db",
    })
    if (pathRaw === null) return openConnectDB(ctx)
    const next = normalize(pathRaw.trim())
    if (!next) return openConnectDB(ctx)

    const exists = await Filesystem.exists(next)
    if (!exists) {
      ctx.toast.show({
        variant: "error",
        message: "SQLite file not found. Provide an existing .db path.",
        duration: 5000,
      })
      return openConnectDB(ctx)
    }

    const cfg = {
      name,
      type,
      path: next,
    } as const

    const check = await DataDB.tables(cfg)
    if (check.error) {
      ctx.toast.show({
        variant: "error",
        message: check.error,
        duration: 6000,
      })
      return openConnectDB(ctx)
    }

    const saved = await DataDB.add(cfg)
    ctx.toast.show({
      variant: "success",
      message: `Connected ${saved.name}`,
      duration: 3000,
    })
    return tables(ctx, saved)
  }

  const uriRaw = await DialogPrompt.show(ctx.dialog, `${connectLabel(type)} URI`, {
    placeholder: type === "postgres" ? "postgresql://user:pass@host:5432/db" : "mysql://user:pass@host:3306/db",
  })
  if (uriRaw === null) return openConnectDB(ctx)
  const uri = uriRaw.trim()
  if (!uri) return openConnectDB(ctx)

  const cfg =
    type === "postgres"
      ? ({
          name,
          type: "postgres",
          uri,
        } as const)
      : ({
          name,
          type: "mysql",
          uri,
        } as const)

  ctx.dialog.replace(() => <DialogBusy title="Connect database" message="Testing database connection..." />)
  const check = await DataDB.tables(cfg)
  if (check.error) {
    ctx.toast.show({
      variant: "error",
      message: check.error,
      duration: 6000,
    })
    return openConnectDB(ctx)
  }

  const saved = await DataDB.add(cfg)
  ctx.toast.show({
    variant: "success",
    message: `Connected ${saved.name}`,
    duration: 3000,
  })
  return tables(ctx, saved)
}

export async function openConnectDB(ctx: Ctx) {
  ctx.dialog.replace(() => (
    <DialogSelect
      title="Connect database"
      options={[
        {
          title: "SQLite",
          value: "sqlite",
          description: "Connect to a local .db/.sqlite file",
          category: "Databases",
          onSelect() {
            connect(ctx, "sqlite")
          },
        },
        {
          title: "PostgreSQL",
          value: "postgres",
          description: "Connect using a PostgreSQL URI",
          category: "Databases",
          onSelect() {
            connect(ctx, "postgres")
          },
        },
        {
          title: "MySQL",
          value: "mysql",
          description: "Connect using a MySQL URI",
          category: "Databases",
          onSelect() {
            connect(ctx, "mysql")
          },
        },
      ]}
    />
  ))
}

export async function openData(ctx: Ctx) {
  const list = await DataDB.list()
  const options = [
    ...list.map((item) => ({
      title: item.name,
      value: item.id,
      description: DataDB.describe(item),
      category: connectLabel(item.type),
      onSelect() {
        tables(ctx, item)
      },
    })),
    {
      title: "Connect database",
      value: "connect",
      category: "Actions",
      onSelect() {
        openConnectDB(ctx)
      },
    },
    {
      title: "Run SQL query",
      value: "sql",
      category: "Actions",
      onSelect() {
        openSQL(ctx)
      },
    },
  ]

  if (!list.length) {
    ctx.toast.show({
      variant: "info",
      message: "No database connected yet. Use Connect database.",
      duration: 3000,
    })
  }

  ctx.dialog.replace(() => (
    <DialogSelect title="Data" placeholder="Search database" options={options} onFilter={() => {}} />
  ))
}

export async function openSQL(ctx: Ctx) {
  const list = await DataDB.list()
  const options = [
    ...list.map((item) => ({
      title: item.name,
      value: item.id,
      description: DataDB.describe(item),
      category: connectLabel(item.type),
      onSelect() {
        sql(ctx, item)
      },
    })),
    {
      title: "Connect database",
      value: "connect",
      category: "Actions",
      onSelect() {
        openConnectDB(ctx)
      },
    },
    {
      title: "Back to data",
      value: "data",
      category: "Actions",
      onSelect() {
        openData(ctx)
      },
    },
  ]

  if (!list.length) {
    ctx.toast.show({
      variant: "info",
      message: "No database connected yet. Use Connect database.",
      duration: 3000,
    })
  }

  ctx.dialog.replace(() => (
    <DialogSelect title="Run SQL" placeholder="Select database" options={options} onFilter={() => {}} />
  ))
}
