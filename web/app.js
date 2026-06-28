const form = document.querySelector("#analysis-form");
const statusText = document.querySelector("#status");
const loadSampleButton = document.querySelector("#load-sample");
const loadMockButton = document.querySelector("#load-mock");
const resultsRoot = document.querySelector("#results");
const template = document.querySelector("#claim-card-template");
const viewState = {
  sampleDetailImages: [],
};

const fields = {
  title: document.querySelector("#title"),
  bullets: document.querySelector("#bullets"),
  detailText: document.querySelector("#detail-text"),
  detailImages: document.querySelector("#detail-images"),
  positiveReviews: document.querySelector("#positive-reviews"),
  negativeReviews: document.querySelector("#negative-reviews"),
};

const verdictLabels = {
  validated: "已验证",
  weak_support: "支撑不足",
  contradicted: "被反驳",
  hidden_opportunity: "隐藏机会",
};

function linesToArray(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function setStatus(message, type = "idle") {
  statusText.textContent = message;
  statusText.dataset.state = type;
}

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`无法读取文件：${file.name}`));
    reader.readAsDataURL(file);
  });
}

async function collectFormPayload() {
  const files = Array.from(fields.detailImages.files || []);
  const uploadedImages = await Promise.all(
    files.map(async (file) => ({
      name: file.name,
      type: file.type,
      data: await fileToDataUrl(file),
    })),
  );

  return {
    meta: {
      source: "web-ui",
    },
    product: {
      title: fields.title.value.trim(),
      bullets: linesToArray(fields.bullets.value),
      detailText: fields.detailText.value.trim(),
      uploadedImages,
      detailImagePaths: uploadedImages.length === 0 ? viewState.sampleDetailImages : [],
    },
    reviews: {
      positive: linesToArray(fields.positiveReviews.value),
      negative: linesToArray(fields.negativeReviews.value),
    },
  };
}

function fillForm(sample) {
  fields.title.value = sample.product?.title || "";
  fields.bullets.value = (sample.product?.bullets || []).join("\n");
  fields.detailText.value = sample.product?.detailText || "";
  fields.positiveReviews.value = (sample.reviews?.positive || []).join("\n");
  fields.negativeReviews.value = (sample.reviews?.negative || []).join("\n");
  fields.detailImages.value = "";
  viewState.sampleDetailImages = sample.product?.detailImages || [];
}

function renderList(title, items) {
  const section = document.createElement("section");
  section.className = "mini-panel";

  const heading = document.createElement("h3");
  heading.textContent = title;
  section.appendChild(heading);

  const list = document.createElement("ul");
  for (const item of items) {
    const li = document.createElement("li");
    li.textContent = item;
    list.appendChild(li);
  }

  if (items.length === 0) {
    const li = document.createElement("li");
    li.textContent = "暂无";
    list.appendChild(li);
  }

  section.appendChild(list);
  return section;
}

function renderClaimCard(claim) {
  const fragment = template.content.cloneNode(true);
  const sources = Array.isArray(claim.source)
    ? claim.source
    : claim.source
      ? [claim.source]
      : [];
  fragment.querySelector(".claim-name").textContent = claim.claim || claim.normalizedClaim || "未命名卖点";
  fragment.querySelector(".claim-source").textContent = `来源：${sources.join(" / ") || "未标注"} · 置信度：${claim.confidence || "unknown"}`;

  const badge = fragment.querySelector(".claim-badge");
  badge.textContent = verdictLabels[claim.verdict] || claim.verdict || "未分类";
  badge.classList.add(`badge-${claim.verdict}`);

  fragment.querySelector(".claim-reasoning").textContent = claim.reasoning || "未返回判断说明。";
  fragment.querySelector(".claim-advice").textContent = `运营建议：${claim.operatorAdvice || "暂无"}`;

  const supporting = fragment.querySelector(".supporting");
  const contradicting = fragment.querySelector(".contradicting");

  const supportingEvidence = claim.supportingEvidence?.length
    ? claim.supportingEvidence
    : ["暂无明确支持证据"];
  const contradictingEvidence = claim.contradictingEvidence?.length
    ? claim.contradictingEvidence
    : ["暂无明确反驳证据"];

  for (const item of supportingEvidence) {
    const li = document.createElement("li");
    li.textContent = item;
    supporting.appendChild(li);
  }

  for (const item of contradictingEvidence) {
    const li = document.createElement("li");
    li.textContent = item;
    contradicting.appendChild(li);
  }

  return fragment;
}

function renderResult(payload) {
  const result = payload.result || payload;
  resultsRoot.className = "results-shell";
  resultsRoot.innerHTML = "";

  const summaryBlock = document.createElement("div");
  summaryBlock.className = "summary-block";

  const summaryBanner = document.createElement("section");
  summaryBanner.className = "summary-banner";
  summaryBanner.innerHTML = `
    <h3>总判断</h3>
    <p>${result.summary || "暂无总结。"}</p>
  `;
  summaryBlock.appendChild(summaryBanner);

  const listRow = document.createElement("div");
  listRow.className = "list-row";
  listRow.appendChild(renderList("值得学习", result.topLearnings || []));
  listRow.appendChild(renderList("风险最大", result.topRisks || []));
  listRow.appendChild(renderList("隐藏机会", result.hiddenOpportunities || []));
  summaryBlock.appendChild(listRow);

  if (payload.warnings?.length) {
    const warningBox = document.createElement("section");
    warningBox.className = "mini-panel";
    const title = document.createElement("h3");
    title.textContent = "运行提醒";
    warningBox.appendChild(title);
    const list = document.createElement("ul");
    list.className = "warning-list";
    for (const warning of payload.warnings) {
      const li = document.createElement("li");
      li.textContent = warning;
      list.appendChild(li);
    }
    warningBox.appendChild(list);
    summaryBlock.appendChild(warningBox);
  }

  const claimsGrid = document.createElement("div");
  claimsGrid.className = "claims-grid";
  for (const claim of result.claims || []) {
    claimsGrid.appendChild(renderClaimCard(claim));
  }

  const rawJson = document.createElement("section");
  rawJson.className = "raw-json";
  rawJson.innerHTML = `
    <details>
      <summary>查看原始 JSON</summary>
      <pre>${escapeHtml(JSON.stringify(payload, null, 2))}</pre>
    </details>
  `;

  resultsRoot.appendChild(summaryBlock);
  resultsRoot.appendChild(claimsGrid);
  resultsRoot.appendChild(rawJson);
}

function renderError(message) {
  resultsRoot.className = "results-shell";
  resultsRoot.innerHTML = `
    <div class="summary-banner">
      <h3>分析失败</h3>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function setBusy(isBusy) {
  form.querySelector("button[type='submit']").disabled = isBusy;
  loadSampleButton.disabled = isBusy;
  loadMockButton.disabled = isBusy;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`请求失败：${response.status}`);
  }
  return response.json();
}

async function postJson(url, payload, timeoutMs = 120000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "分析失败");
    }

    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("分析请求超时了。当前网络或模型链路可能不稳定，可以先用“预览 Mock 结果”继续调页面。");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

loadSampleButton.addEventListener("click", async () => {
  setBusy(true);
  setStatus("正在加载样例...");
  try {
    const sample = await fetchJson("/api/sample");
    fillForm(sample);
    setStatus("样例已载入，可以直接运行分析。", "success");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    setBusy(false);
  }
});

loadMockButton.addEventListener("click", async () => {
  setBusy(true);
  setStatus("正在载入 Mock 结果...");
  try {
    const payload = await fetchJson("/api/mock-result");
    renderResult(payload);
    setStatus("Mock 结果已展示。", "success");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    setBusy(false);
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setBusy(true);
  setStatus("正在调用 ClaimCheck Agent，请稍等...", "loading");

  try {
    const payload = await collectFormPayload();
    const data = await postJson("/api/analyze", payload);
    renderResult(data);
    setStatus("分析完成。", "success");
  } catch (error) {
    renderError(error.message);
    setStatus(error.message, "error");
  } finally {
    setBusy(false);
  }
});
