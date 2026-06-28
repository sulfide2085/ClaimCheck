#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";

import { readJson } from "./bl-client.js";
import { normalizeInput, runClaimCheck } from "./claimcheck-core.js";

function parseArgs(argv) {
  const args = {
    input: null,
    output: null,
    skipImages: false,
    cwd: process.cwd(),
  };

  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (current === "--input") {
      args.input = argv[i + 1];
      i += 1;
      continue;
    }
    if (current === "--output") {
      args.output = argv[i + 1];
      i += 1;
      continue;
    }
    if (current === "--skip-images") {
      args.skipImages = true;
      continue;
    }
    if (current === "--cwd") {
      args.cwd = argv[i + 1];
      i += 1;
      continue;
    }
    if (current === "--help" || current === "-h") {
      printHelp();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${current}`);
  }

  if (!args.input) {
    throw new Error("Missing required argument: --input <path>");
  }

  if (!args.output) {
    throw new Error("Missing required argument: --output <path>");
  }

  return args;
}

function printHelp() {
  console.log(`ClaimCheck Agent CLI

Usage:
  node src/claimcheck-agent.js --input ./samples/demo-input.json --output ./out/demo-result.json

Options:
  --input <path>       Input JSON file
  --output <path>      Output JSON file
  --skip-images        Skip image claim extraction
  --cwd <path>         Working directory for bl commands
  --help, -h           Show help
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = resolve(args.cwd, args.input);
  const outputPath = resolve(args.cwd, args.output);

  const rawInput = await readJson(inputPath);
  const input = normalizeInput(rawInput, dirname(inputPath));
  const payload = await runClaimCheck({
    input,
    cwd: args.cwd,
    skipImages: args.skipImages,
  });

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(payload, null, 2), "utf8");

  console.log(`ClaimCheck result written to ${outputPath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
