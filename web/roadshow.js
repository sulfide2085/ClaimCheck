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
  const container = document.querySelector("#claim-glimpse");
  container.innerHTML = "";

  const topClaims = (claims || []).slice(0, 3);
  for (const claim of topClaims) {
    const card = document.createElement("article");
    card.className = "claim-chip";
    card.innerHTML = `
      <strong>${claim.claim || claim.normalizedClaim || "未命名卖点"}</strong>
      <span class="chip-${claim.verdict}">${claim.verdict || "unknown"}</span>
      <p>${claim.operatorAdvice || claim.reasoning || "暂无说明"}</p>
    `;
    container.appendChild(card);
  }
}

async function loadMockResult() {
  const response = await fetch("/api/mock-result");
  if (!response.ok) {
    throw new Error(`请求失败：${response.status}`);
  }

  const payload = await response.json();
  const result = payload.result || payload;

  document.querySelector("#summary-text").textContent =
    result.summary || "暂无总结";
  renderList("#learn-list", result.topLearnings || []);
  renderList("#risk-list", result.topRisks || []);
  renderList("#opportunity-list", result.hiddenOpportunities || []);
  renderClaims(result.claims || []);
}

loadMockResult().catch((error) => {
  document.querySelector("#summary-text").textContent =
    `结果加载失败：${error.message}`;
});
