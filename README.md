# pydbx — Databricks Local Notebooks

A VS Code extension that lets you open Databricks-format `.py` notebook files as notebooks directly in VS Code, without needing a live Databricks connection.

## What it does

Databricks notebooks exported as `.py` files use a special comment-based format to encode cells and markdown. This extension deserializes that format so VS Code can display the file as a proper notebook with separate code and markdown cells.

## Installation

### From a release artifact

1. Download `pydbx-*.vsix` from the [Actions tab](../../actions) (latest `main` build → Artifacts → `pydbx-vsix`)
2. Install it:
   ```bash
   code --install-extension pydbx-0.0.1.vsix
   ```

### From source

```bash
npm install
npm run compile
npx vsce package
code --install-extension pydbx-0.0.1.vsix
```

> Replace `"your-publisher"` in `package.json` with any string before running `vsce package`.

## Usage

1. Open a Databricks-format `.py` file in VS Code
2. Right-click the file in the Explorer → **Open With…** → **Databricks Local Notebooks**

Code cells appear as Python cells; `# MAGIC %md` blocks appear as rendered Markdown cells.

## File format

The extension handles the Databricks notebook source format:

```python
# Databricks notebook source

# COMMAND ----------

import pyspark

# COMMAND ----------

# MAGIC %md
# MAGIC ## My heading
# MAGIC Some **bold** text
```

The `# MAGIC` prefix is handled robustly — `#MAGIC`, extra spaces, and inline content on the `%md` line are all supported.

## Development

```bash
npm install       # install dependencies
npm test          # run tests (Vitest, no extension host required)
npm run compile   # compile TypeScript → out/
```

## Limitations

- **Read-only**: serialization (saving a notebook back to `.py`) is not implemented.
- Opening a `.py` file normally in VS Code is unaffected — this serializer is only invoked via **Open With**.
