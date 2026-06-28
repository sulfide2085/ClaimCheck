import { stat } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";

import { omniJson, textJson } from "./bl-client.js";
import {
  buildFastAnalysisPrompt,
  buildFinalAnalysisPrompt,
  buildImageClaimPrompt,
  buildTextClaimExtractionPrompt,
  MODEL_LANGUAGE_SYSTEM,
} from "./prompts.js";

export function normalizeInput(input, baseDir = process.cwd()) {
  const product = input.product || {};
  const reviews = input.reviews || {};
  const detailImages = (product.detailImages || []).map((imagePath) =>
    isAbsolute(imagePath) ? imagePath : resolve(baseDir, imagePath),
  );

  return {
    product: {
      title: product.title || "",
      bullets: product.bullets || [],
      detailText: product.detailText || "",
      detailImages,
    },
    reviews: {
      positive: reviews.positive || [],
      negative: reviews.negative || [],
    },
    meta: input.meta || {},
  };
}

async function ensureFileExists(filePath) {
  await stat(filePath);
}

export async function extractTextClaims(input, cwd) {
  const result = await textJson({
    cwd,
    system: MODEL_LANGUAGE_SYSTEM,
    model: "qwen-plus",
    messages: [{ role: "user", content: buildTextClaimExtractionPrompt(input) }],
    maxTokens: 1200,
    temperature: 0.1,
  });

  return {
    claims: result.claims || [],
  };
}

export async function extractImageClaims(input, cwd, skipImages) {
  if (skipImages || input.product.detailImages.length === 0) {
    return { claims: [], skipped: true, warning: null };
  }

  for (const image of input.product.detailImages) {
    await ensureFileExists(image);
  }

  const result = await omniJson({
    cwd,
    system: MODEL_LANGUAGE_SYSTEM,
    message: buildImageClaimPrompt(),
    images: input.product.detailImages,
  });

  return {
    claims: result.claims || [],
    skipped: false,
    warning: null,
  };
}

export async function runFinalAnalysis(input, textClaims, imageClaims, cwd) {
  return textJson({
    cwd,
    system: MODEL_LANGUAGE_SYSTEM,
    model: "qwen-plus",
    messages: [
      {
        role: "user",
        content: buildFinalAnalysisPrompt(input, textClaims, imageClaims),
      },
    ],
    maxTokens: 1800,
    temperature: 0.2,
  });
}

export async function runFastTextOnlyAnalysis(input, cwd) {
  const messages = [
    {
      role: "user",
      content: buildFastAnalysisPrompt(input),
    },
  ];

  try {
    return await textJson({
      cwd,
      system: MODEL_LANGUAGE_SYSTEM,
      model: "qwen-turbo",
      messages,
      maxTokens: 1200,
      temperature: 0.1,
    });
  } catch (error) {
    return textJson({
      cwd,
      system: MODEL_LANGUAGE_SYSTEM,
      model: "qwen-plus",
      messages,
      maxTokens: 1200,
      temperature: 0.1,
    });
  }
}

export async function runClaimCheck({
  input,
  cwd = process.cwd(),
  skipImages = false,
}) {
  if (skipImages || input.product.detailImages.length === 0) {
    const result = await runFastTextOnlyAnalysis(input, cwd);
    return {
      generatedAt: new Date().toISOString(),
      input,
      intermediate: {
        textClaims: { claims: [], skipped: true },
        imageClaims: { claims: [], skipped: true, warning: null },
      },
      warnings: [],
      result,
    };
  }

  const warnings = [];
  const textClaims = await extractTextClaims(input, cwd);

  let imageClaims;
  try {
    imageClaims = await extractImageClaims(input, cwd, skipImages);
  } catch (error) {
    const warning = `Image claim extraction skipped due to error: ${error.message}`;
    warnings.push(warning);
    imageClaims = {
      claims: [],
      skipped: true,
      warning,
    };
  }

  const finalResult = await runFinalAnalysis(
    input,
    textClaims.claims,
    imageClaims.claims,
    cwd,
  );

  return {
    generatedAt: new Date().toISOString(),
    input,
    intermediate: {
      textClaims,
      imageClaims,
    },
    warnings,
    result: finalResult,
  };
}
