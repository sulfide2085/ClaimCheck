import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const BL_EXECUTABLE = process.platform === "win32" ? "bl.cmd" : "bl";
const TRANSIENT_ERROR_MARKERS = [
  "ECONNRESET",
  "ETIMEDOUT",
  "fetch failed",
  "Connection reset by peer",
];

function formatArgs(args) {
  return [BL_EXECUTABLE, ...args]
    .map((part) => (/\s/.test(part) ? JSON.stringify(part) : part))
    .join(" ");
}

function isTransientError(output) {
  return TRANSIENT_ERROR_MARKERS.some((marker) => output.includes(marker));
}

function extractJsonBlock(text) {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Model returned empty output.");
  }

  try {
    return JSON.parse(trimmed);
  } catch {}

  const candidates = [];
  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");
  if (objectStart !== -1 && objectEnd > objectStart) {
    candidates.push(trimmed.slice(objectStart, objectEnd + 1));
  }

  const arrayStart = trimmed.indexOf("[");
  const arrayEnd = trimmed.lastIndexOf("]");
  if (arrayStart !== -1 && arrayEnd > arrayStart) {
    candidates.push(trimmed.slice(arrayStart, arrayEnd + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {}
  }

  throw new Error(`Could not parse JSON from model output:\n${trimmed}`);
}

async function runBlCommand(args, options = {}) {
  const {
    cwd,
    retries = 1,
    timeoutMs = 120000,
    quiet = false,
  } = options;

  let attempt = 0;
  let lastError;

  while (attempt <= retries) {
    attempt += 1;

    try {
      const result = await new Promise((resolve, reject) => {
        const child = spawn(BL_EXECUTABLE, args, {
          cwd,
          shell: process.platform === "win32",
          stdio: ["ignore", "pipe", "pipe"],
          env: process.env,
        });

        let stdout = "";
        let stderr = "";
        let timedOut = false;

        const timer = setTimeout(() => {
          timedOut = true;
          child.kill("SIGTERM");
        }, timeoutMs);

        child.stdout.on("data", (chunk) => {
          stdout += chunk.toString();
        });

        child.stderr.on("data", (chunk) => {
          stderr += chunk.toString();
        });

        child.on("error", (error) => {
          clearTimeout(timer);
          reject(error);
        });

        child.on("close", (code) => {
          clearTimeout(timer);

          if (timedOut) {
            reject(
              new Error(
                `Command timed out after ${timeoutMs}ms: ${formatArgs(args)}`,
              ),
            );
            return;
          }

          if (code !== 0) {
            const error = new Error(
              `bl command failed with exit code ${code}: ${formatArgs(args)}\n${stdout}${stderr}`,
            );
            error.stdout = stdout;
            error.stderr = stderr;
            error.exitCode = code;
            reject(error);
            return;
          }

          resolve({ stdout, stderr, code });
        });
      });

      if (!quiet && result.stderr.trim()) {
        console.error(result.stderr.trim());
      }

      return result;
    } catch (error) {
      lastError = error;
      const combined = `${error.stdout ?? ""}\n${error.stderr ?? ""}\n${error.message ?? ""}`;
      if (attempt <= retries && isTransientError(combined)) {
        continue;
      }
      throw error;
    }
  }

  throw lastError;
}

async function withMessagesFile(messages) {
  const dir = await mkdtemp(join(tmpdir(), "claimcheck-"));
  const file = join(dir, "messages.json");
  await writeFile(file, JSON.stringify(messages, null, 2), "utf8");
  return {
    file,
    async cleanup() {
      await rm(dir, { recursive: true, force: true });
    },
  };
}

export async function textJson({
  cwd,
  system,
  messages,
  model = "qwen3.7-max",
  maxTokens = 4096,
  temperature = 0.2,
  retries = 2,
}) {
  const temp = await withMessagesFile(messages);
  try {
    const args = [
      "text",
      "chat",
      "--model",
      model,
      "--messages-file",
      temp.file,
      "--max-tokens",
      String(maxTokens),
      "--temperature",
      String(temperature),
      "--output",
      "text",
      "--non-interactive",
    ];

    if (system) {
      args.push("--system", system);
    }

    const { stdout } = await runBlCommand(args, { cwd, retries });
    return extractJsonBlock(stdout);
  } finally {
    await temp.cleanup();
  }
}

export async function omniJson({
  cwd,
  system,
  message,
  images,
  maxTokens = 2048,
  temperature = 0.1,
  retries = 2,
}) {
  const args = [
    "omni",
    "--message",
    message,
    "--text-only",
    "--max-tokens",
    String(maxTokens),
    "--temperature",
    String(temperature),
    "--output",
    "text",
    "--non-interactive",
  ];

  if (system) {
    args.push("--system", system);
  }

  for (const image of images) {
    args.push("--image", image);
  }

  const { stdout } = await runBlCommand(args, { cwd, retries });
  return extractJsonBlock(stdout);
}

export async function readJson(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}
