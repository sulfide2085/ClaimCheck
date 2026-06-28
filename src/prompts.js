export const MODEL_LANGUAGE_SYSTEM =
  "Reply in Chinese. Output valid JSON only. Do not use markdown fences.";

export function buildTextClaimExtractionPrompt(input) {
  return [
    "你是跨境电商竞品卖点抽取助手。",
    "任务：从商品标题、五点描述、详情文案中抽取竞品明确表达的卖点。",
    "要求：",
    "1. 只抽取商品页面明确承诺、明确强调或明确暗示的卖点。",
    "2. 不要把泛泛形容词都当成卖点。",
    "3. 合并重复表达，保留运营常用表述。",
    "4. 输出 JSON，对象格式如下：",
    '{"claims":[{"claim":"卖点名","source":"title|bullet|detail_text","evidence":"原文证据","normalizedClaim":"标准化卖点","confidence":"high|medium|low"}]}',
    "",
    "商品资料：",
    `标题：${input.product.title || ""}`,
    `五点描述：${(input.product.bullets || []).map((item, index) => `${index + 1}. ${item}`).join(" | ")}`,
    `详情文案：${input.product.detailText || ""}`,
  ].join("\n");
}

export function buildImageClaimPrompt() {
  return [
    "你是跨境电商详情图卖点抽取助手。",
    "任务：阅读输入图片，识别其中明确出现的卖点文案、适用场景、尺寸、材质、使用方式等与运营卖点有关的信息。",
    "要求：",
    "1. 重点关注图片中的文字与强烈视觉强调的场景。",
    "2. 只输出对卖点验证有帮助的信息。",
    "3. 如果图片信息不足，返回空数组。",
    "4. 输出 JSON，对象格式如下：",
    '{"claims":[{"claim":"卖点名","source":"image","evidence":"图片中读到的文案或视觉线索","normalizedClaim":"标准化卖点","scene":"可选场景","confidence":"high|medium|low"}]}',
  ].join("\n");
}

export function buildFastAnalysisPrompt(input) {
  return [
    "你是 ClaimCheck Agent，一名跨境电商竞品卖点验证助手。",
    "任务：直接根据商品资料和评论，输出卖点验证结果。",
    "要求：",
    "1. 自己从标题、五点、详情文案里抽取卖点，不要先单独返回中间步骤。",
    "2. 不要编造证据；所有判断都必须能在输入文本中找到依据。",
    "3. 无法确定时，用 low 置信度并说明样本不足。",
    "4. 结论标签只能使用：validated, weak_support, contradicted, hidden_opportunity。",
    "5. 运营建议标签只能使用：learn, cautious, avoid, add_to_listing。",
    "6. 最多保留 6 个最重要的卖点，优先输出最有运营价值的。",
    "",
    "输出 JSON，对象格式如下：",
    '{"summary":"一句话总结","claims":[{"claim":"卖点名","normalizedClaim":"标准化卖点","source":["title","bullet","detail_text"],"verdict":"validated|weak_support|contradicted|hidden_opportunity","confidence":"high|medium|low","reasoning":"判断原因","supportingEvidence":["评论或页面证据"],"contradictingEvidence":["评论或页面证据"],"operatorAdvice":"给运营的建议","adviceTag":"learn|cautious|avoid|add_to_listing"}],"topLearnings":["最值得学习的点"],"topRisks":["风险最大的点"],"hiddenOpportunities":["值得补充的新角度"]}',
    "",
    "商品资料：",
    JSON.stringify(input.product, null, 2),
    "",
    "评论资料：",
    JSON.stringify(input.reviews, null, 2),
  ].join("\n");
}

export function buildFinalAnalysisPrompt(input, textClaims, imageClaims) {
  return [
    "你是 ClaimCheck Agent，一名跨境电商竞品卖点验证助手。",
    "任务：对照竞品页面卖点和真实评论，判断哪些卖点被验证、哪些支撑不足、哪些被反驳，并识别隐藏卖点与运营建议。",
    "请严格根据输入证据判断，不要夸大结论。",
    "结论标签只能使用：validated, weak_support, contradicted, hidden_opportunity。",
    "运营建议标签只能使用：learn, cautious, avoid, add_to_listing。",
    "如果评论样本不足，请降低置信度，并在 reasoning 里说明。",
    "",
    "请输出 JSON，对象格式如下：",
    '{"summary":"一句话总结","claims":[{"claim":"卖点名","normalizedClaim":"标准化卖点","source":["title","bullet","detail_text","image"],"verdict":"validated|weak_support|contradicted|hidden_opportunity","confidence":"high|medium|low","reasoning":"判断原因","supportingEvidence":["评论或页面证据"],"contradictingEvidence":["评论或页面证据"],"operatorAdvice":"给运营的建议","adviceTag":"learn|cautious|avoid|add_to_listing"}],"topLearnings":["最值得学习的点"],"topRisks":["风险最大的点"],"hiddenOpportunities":["值得补充的新角度"]}',
    "",
    "商品资料：",
    JSON.stringify(input.product, null, 2),
    "",
    "评论资料：",
    JSON.stringify(input.reviews, null, 2),
    "",
    "文本卖点抽取结果：",
    JSON.stringify(textClaims, null, 2),
    "",
    "图片卖点抽取结果：",
    JSON.stringify(imageClaims, null, 2),
  ].join("\n");
}
