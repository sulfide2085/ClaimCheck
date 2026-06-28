#!/usr/bin/env node

import { createServer } from "node:http";
import {
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";

import { normalizeInput, runClaimCheck } from "./claimcheck-core.js";
import { readJson } from "./bl-client.js";

const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT || 3210);
const ROOT = process.cwd();
const PUBLIC_DIR = resolve(ROOT, "web");
const SAMPLES_DIR = resolve(ROOT, "samples");
const SAMPLE_INPUT_PATH = resolve(ROOT, "samples/demo-input.json");
const SAMPLE_RESULT_PATH = resolve(ROOT, "samples/demo-expected-output.json");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(body);
}

async function readRequestBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function saveUploadedImages(images) {
  const tempDir = await mkdtemp(join(tmpdir(), "claimcheck-web-"));
  const savedPaths = [];

  for (const [index, image] of images.entries()) {
    const name = image.name || `upload-${index + 1}.png`;
    const safeName = name.replace(/[^\w.-]/g, "_");
    const filePath = join(tempDir, safeName);
    const data = image.data.includes(",")
      ? image.data.split(",").pop()
      : image.data;
    await writeFile(filePath, Buffer.from(data, "base64"));
    savedPaths.push(filePath);
  }

  return {
    tempDir,
    savedPaths,
    async cleanup() {
      await rm(tempDir, { recursive: true, force: true });
    },
  };
}

async function handleAnalyze(request, response) {
  let uploadContext = null;

  try {
    const rawBody = await readRequestBody(request);
    const body = JSON.parse(rawBody);
    const input = {
      meta: body.meta || {},
      product: {
        title: body.product?.title || "",
        bullets: body.product?.bullets || [],
        detailText: body.product?.detailText || "",
        detailImages: body.product?.detailImagePaths || [],
      },
      reviews: {
        positive: body.reviews?.positive || [],
        negative: body.reviews?.negative || [],
      },
    };

    const uploadedImages = body.product?.uploadedImages || [];
    if (uploadedImages.length > 0) {
      uploadContext = await saveUploadedImages(uploadedImages);
      input.product.detailImages = uploadContext.savedPaths;
    }

    const normalized = normalizeInput(input, ROOT);
    const result = await runClaimCheck({
      input: normalized,
      cwd: ROOT,
      skipImages: input.product.detailImages.length === 0,
    });

    sendJson(response, 200, result);
  } catch (error) {
    const message = /ECONNRESET|fetch failed|ETIMEDOUT/i.test(error.message)
      ? `百炼模型请求失败，当前更像网络链路问题：${error.message}。你可以先用“预览 Mock 结果”继续看前端效果。`
      : error.message;
    sendJson(response, 500, {
      error: message,
    });
  } finally {
    if (uploadContext) {
      await uploadContext.cleanup();
    }
  }
}

async function handleStatic(pathname, response) {
  const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
  return serveFile(PUBLIC_DIR, relativePath, response);
}

async function serveFile(baseDir, relativePath, response) {
  const filePath = resolve(baseDir, relativePath);
  if (!filePath.startsWith(baseDir)) {
    sendText(response, 403, "Forbidden");
    return;
  }

  try {
    const fileInfo = await stat(filePath);
    if (!fileInfo.isFile()) {
      sendText(response, 404, "Not Found");
      return;
    }

    const content = await readFile(filePath);
    const contentType = MIME_TYPES[extname(filePath)] || "application/octet-stream";
    response.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
    });
    response.end(content);
  } catch {
    sendText(response, 404, "Not Found");
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || `${HOST}:${PORT}`}`);

  if (request.method === "GET" && url.pathname === "/api/sample") {
    const payload = await readJson(SAMPLE_INPUT_PATH);
    sendJson(response, 200, payload);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/mock-result") {
    const payload = await readJson(SAMPLE_RESULT_PATH);
    sendJson(response, 200, payload);
    return;
  }

  if (request.method === "GET" && url.pathname.startsWith("/samples/")) {
    await serveFile(SAMPLES_DIR, url.pathname.slice("/samples/".length), response);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/analyze") {
    await handleAnalyze(request, response);
    return;
  }

  if (request.method === "GET") {
    await handleStatic(url.pathname, response);
    return;
  }

  sendText(response, 405, "Method Not Allowed");
});

server.listen(PORT, HOST, () => {
  console.log(`ClaimCheck web app running at http://${HOST}:${PORT}`);
});
