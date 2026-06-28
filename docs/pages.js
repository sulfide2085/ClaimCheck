function renderList(targetId, items) {
  const list = document.querySelector(targetId);
  list.innerHTML = "";

  const values = items?.length ? items : ["暂无"];
  for (const item of values) {
    const li = document.createElement("li");
    li.textContent = item;
    list.appendChild(li);
  }
}

function renderClaims(claims) {
  const grid = document.querySelector("#claim-grid");
  grid.innerHTML = "";

  for (const claim of claims || []) {
    const card = document.createElement("article");
    card.className = "claim-card";
    card.innerHTML = `
      <h4>${claim.claim || claim.normalizedClaim || "未命名卖点"}</h4>
      <span class="claim-badge badge-${claim.verdict}">${claim.verdict || "unknown"}</span>
      <p>${claim.reasoning || "暂无说明"}</p>
      <p><strong>运营建议：</strong>${claim.operatorAdvice || "暂无"}</p>
    `;
    grid.appendChild(card);
  }
}

function fillInput(sample) {
  document.querySelector("#product-title").textContent =
    sample.product?.title || "暂无";
  document.querySelector("#product-detail").textContent =
    sample.product?.detailText || "暂无";
  renderList("#product-bullets", sample.product?.bullets || []);
  renderList("#positive-reviews", sample.reviews?.positive || []);
  renderList("#negative-reviews", sample.reviews?.negative || []);
}

function fillOutput(payload) {
  const result = payload.result || payload;
  document.querySelector("#summary-text").textContent =
    result.summary || "暂无总结";
  renderList("#learn-list", result.topLearnings || []);
  renderList("#risk-list", result.topRisks || []);
  renderList("#opportunity-list", result.hiddenOpportunities || []);
  renderClaims(result.claims || []);
}

async function loadPreset() {
  const [inputResponse, outputResponse] = await Promise.all([
    fetch("./data/demo-input.json"),
    fetch("./data/demo-expected-output.json"),
  ]);

  if (!inputResponse.ok || !outputResponse.ok) {
    throw new Error("预设数据加载失败");
  }

  const inputData = await inputResponse.json();
  const outputData = await outputResponse.json();
  fillInput(inputData);
  fillOutput(outputData);
}

document.querySelector("#load-preset").addEventListener("click", async () => {
  const button = document.querySelector("#load-preset");
  button.disabled = true;
  button.textContent = "加载中...";

  try {
    await loadPreset();
    button.textContent = "已加载预设";
  } catch (error) {
    button.textContent = "加载失败";
    document.querySelector("#summary-text").textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

loadPreset().catch((error) => {
  document.querySelector("#summary-text").textContent = error.message;
});
