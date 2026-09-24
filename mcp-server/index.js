#!/usr/bin/env node
// Keep the established entrypoint for existing stdio client configurations.
const path = require("node:path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env"), quiet: true });
require("tsx/cjs");
require("../src/lib/mcp/stdio.ts");
