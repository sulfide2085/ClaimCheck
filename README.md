# ClaimCheck Agent

一个基于百炼 CLI `bl` 的本地 Agent 工具，用来验证跨境电商竞品卖点是否被评论支持。

它把三类信息放到一起分析：

- 商品标题、五点描述、详情文案
- 详情图或主图中的卖点信息
- 用户好评和差评

输出结果聚焦四类判断：

- `validated`：被评论验证的卖点
- `weak_support`：评论支撑不足的卖点
- `contradicted`：被评论反驳的卖点
- `hidden_opportunity`：用户提到但页面没强调的隐藏机会

## 运行前提

- 已安装 `Node.js >= 22`
- 已安装并登录 `bailian-cli`
- `bl auth status` 返回已认证

## 快速开始

先生成示例详情图：

```bash
npm run sample:image
```

再运行示例分析：

```bash
npm run claimcheck:demo
```

输出文件会写到：

```bash
./out/claimcheck-demo-result.json
```

如果你只是先接前端或调结果结构，也可以直接参考 [samples/demo-expected-output.json](/D:/pyitme/bailian/samples/demo-expected-output.json)。

## 本地网页前端

启动本地网页：

```bash
npm run web:start
```

然后打开：

```bash
http://127.0.0.1:3210
```

网页支持：

- 手动粘贴标题、五点、详情文案、好评和差评
- 上传详情图或主图
- 一键加载样例数据
- 一键预览 Mock 结果
- 调用本地 ClaimCheck Agent 并展示结构化结论

## 命令行用法

```bash
node src/claimcheck-agent.js --input ./samples/demo-input.json --output ./out/result.json
```

可选参数：

- `--skip-images`：跳过图片卖点抽取
- `--cwd <path>`：指定 `bl` 执行目录

## 输入格式

输入文件为 JSON，结构示例见 [samples/demo-input.json](/D:/pyitme/bailian/samples/demo-input.json)。

核心字段：

```json
{
  "product": {
    "title": "商品标题",
    "bullets": ["五点1", "五点2"],
    "detailText": "详情文案",
    "detailImages": ["./assets/demo-detail-page.png"]
  },
  "reviews": {
    "positive": ["好评1"],
    "negative": ["差评1"]
  }
}
```

## Agent 工作流

1. `bl text chat` 抽取文本卖点
2. `bl omni` 读取详情图卖点
3. `bl text chat` 对齐卖点和评论证据
4. 输出结构化结论和运营建议

## 当前注意事项

- 这个版本是 MVP，重点是把分析链路跑通。
- 图片分析是可选的；没有图片时也能跑。
- 如果网络链路不稳定，`bl` 调用可能出现瞬时失败，代码里已经加了基础重试。
