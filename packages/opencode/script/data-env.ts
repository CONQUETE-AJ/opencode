#!/usr/bin/env bun

import { $ } from "bun"
import path from "path"
import { Global } from "../src/global"
import { Filesystem } from "../src/util/filesystem"

const system = Bun.which("python3") ?? Bun.which("python")
if (!system) {
  console.error("Python not found. Install python3 first.")
  process.exit(1)
}

const root = path.join(Global.Path.data, "data-python", ".venv")
const python = process.platform === "win32" ? path.join(root, "Scripts", "python.exe") : path.join(root, "bin", "python")

if (!(await Filesystem.exists(python))) {
  console.log(`Creating virtualenv: ${root}`)
  await $`${system} -m venv ${root}`
}

console.log(`Using python: ${python}`)
await $`${python} -m pip install --upgrade pip`
await $`${python} -m pip install "psycopg[binary]" pymysql`

console.log("")
console.log("Data DB environment is ready.")
console.log("OpenCode will use this isolated Python runtime for /connectDB and /data.")
