# 毕业设计 AI 助手 — 重构跟踪文档

> 本文件记录重构计划任务、完成情况与已知缺陷，随重构进度持续更新。
> 状态图例：⬜待办 / 🟦进行中 / ✅完成 / ⚠️有缺陷

## 一、计划任务表

| WP  | 任务                              | 状态 | 备注                                              |
| :-- | :-------------------------------- | :--: | :------------------------------------------------ |
| WP1 | 配置环境变量化 + 模型修正         |  ✅  | ai-config.ts 读 env、.env.local/.env.example      |
| WP2 | 抽取共享类型 src/types/project.ts |  ✅  | 消除 5+ 文件重复 interface                        |
| WP3 | 项目类型注册表统一                |  ✅  | 消除两套 constraints 真相源                       |
| WP4 | 流式工具重构                      |  ✅  | streamCompletion 原语 + 单轮/多轮 + 哨兵错误      |
| WP5 | zod 入参校验                      |  ✅  | 启用已装 zod，8 路由 safeParse                    |
| WP6 | 向导组件拆分                      |  ✅  | 1354 行 → 薄容器 + step 子组件 + hooks            |
| WP7 | 清理死依赖 + 修 README            |  ✅  | grep 确认后删 drizzle/pg/supabase/s3/recharts/rhf |
| WP8 | 维护本跟踪文档                    |  🟦  | 持续更新                                          |
| WP9 | 端到端验证                        |  🟦  | ts-check ✅ build ✅，剩 lint→dev→5 步实测         |

## 二、完成情况

（每完成一个 WP 在此记录产出与验证结果）

### 2026-08-03 修复构建失败（原"待解决问题 1"）

**根因**：重构时路由文件的 import 改为从 `@/lib/project-type-registry` / `@/lib/ai-client` 导入，但目标模块从未导出这些符号，路由文件又残留同名本地定义 → 同一作用域重复声明（Turbopack 语法级错误）；另有 `analyzeProject` 彻底丢失（只有引用无定义）。

**修复内容**：
1. `ai-client.ts`：删除从 stream-utils 重复导入的 `createOpenAIClient`；`generateCacheKey/getCacheItem` 去 private 供模块级函数调用；参数类型、`Response` 构造、`aiRequestWithRetry<Response>` 泛型修正
2. `download-package/route.ts`：删除悬空 import，补 `ProjectTypeInfo` 类型导入，**恢复 `analyzeProject`**（基于 git 2b40edb 旧实现，适配新版 `ProjectAnalysis` 的 services/端口字段），projectType 断言
3. `generate-code-structure/route.ts`：删除悬空 import（`getTypeConstraints`/`ProjectTypeInput`），改用 `ProjectTypeInfo` + 断言
4. `generate-code/route.ts`：删除悬空类型导入，补 `getCodeConstraints` 导入，projectType 断言
5. 5 个路由：`createStreamResponse` 改从 `@/lib/stream-utils` 导入，调用从旧三参数改为新签名 `(client, { scenario, messages })`
6. 其他：`api-validation.ts` zod v4 `errors`→`issues`；`ai-config.ts` validate 去 private；`stream-utils.ts` 修复 `timeoutId` 作用域 bug（真实运行时 bug）；`project-type-registry.ts` 字面量/readonly 类型修正；`detect-project-type` 补 `parseJsonObject` 导入；`GenerateReadmeSchema` 补 `batch` 字段

**验证**：`tsc -p tsconfig.json` 0 错误；`npm run build` 成功（Turbopack 18.4s + tsup）

### 2026-08-03 修复"需求输入解析失败"（需求生成流式回归）

**症状**：步骤 1 输入题目点分析 → 报"AI返回的需求格式无法解析，请重试"。

**根因（两个叠加）**：
1. WP4 流式重构改变了后端语义：`streamCompletion` 每次 yield **累积全文**，而前端 `streamFetch` 仍是旧协议的 `fullText += chunk` 追加拼接 → 文本重复叠加、JSON 损坏
2. 需求场景 `max_tokens: 4096` 不足以输出 8-12 条详细需求（实测截断在 id 8），JSON 不完整且 `parseRequirements` 无截断恢复

**修复**：
1. `graduation-wizard.tsx` `streamFetch`：`fullText += chunk` → `fullText = chunk`（匹配后端累积语义）
2. `ai-config.ts`：requirements / analyzeRequirements 的 max_tokens 4096 → 8192
3. `graduation-wizard.tsx` `parseRequirements`：新增 Strategy 3 截断恢复（对象级正则提取已完整生成的需求条目）

**验证**：tsx 实测 `/api/generate-requirements` 流式调用，289→235 chunk，JSON 完整解析出 9 条需求；截断恢复单测通过（未闭合条目正确跳过）。

### 2026-08-03 修复"README 文件为空"（3 个叠加根因）

**症状**：步骤 3 生成的 README 内容缺失/空白，下载包内 README.md 为空。

**根因**：
1. **batch 参数未生效**：前端 `/api/generate-readme?batch=1/2/3` 将批次号放在 URL query，后端只从 JSON body 解构 → 三次请求全部生成 batch1，README 缺 2/3 章节
2. **30s 流式超时误杀长文**：`streamCompletion` 默认 timeout=30000ms，README 单批实测需 58s+，batch2/3 被 abort → 0 字节响应 → 前端拼出空白内容
3. **环境陷阱**：残留 dev 实例（`.next/dev/lock` 冲突）会返回空流，极易误判

**修复**：
1. `generate-readme/route.ts`：后端读取 URL query 的 batch 参数（`new URL(request.url).searchParams.get('batch')`）
2. `stream-utils.ts`：timeout 默认 30000 → 180000ms（长文生成实测需 60s+）

**验证**：实测 batch1/2/3 各自返回对应章节内容；tsc 0 错误。

**排查经验**：dev 服务器残留实例会导致 `.next/dev/lock` 冲突、返回空流——排查流式问题时先清理全部 node 进程再启动（`taskkill //F //PID <pid>` + 删 `.next/dev/lock`）。

### 2026-08-03 用户报告"README 大量重复内容"（非代码 bug，环境旧代码）

**症状**：用户提供的 readme.txt（1MB，14139 行）中"功能模块"出现 45 次、"页面设计"146 次，呈"累积拼接"特征（`| PUT | /api/orders/{id# 4. 功能模块`）。

**定性**：该文件是**修复前旧版前端**（`fullText += chunk`）的产物——重复段是流内累积文本逐块拼接。修复后的代码已用脚本模拟完整前端流程验证：三个 batch 拼接后每个章节标题仅 1 次、总长 5186 字符、无重复。

**处理**：清理全部残留 node 进程（tsx watch 僵壳）+ `.next/dev/lock`。用户侧需：重启 dev + **浏览器强制刷新（Ctrl+F5）清 JS 缓存**。已验证的测试代码可复现：模拟 streamFetch（替换语义）→ 拼接 → 检查章节计数。

### 2026-08-03 修复"设计说明书只显示一行 / 批次卡住"

**症状**：设计说明书生成时 UI 每次只显示最新一行（覆盖前文），最终只剩一句话；第 1 批生成后卡住，重试后重新生成第 1 批。

**根因**：
1. `generate-design-doc/route.ts` 是手写 ReadableStream，每批内部 enqueue **增量**内容（旧协议），与前端 streamFetch 的**替换语义**（累积协议）不匹配 → 每块增量替换全文 → 只剩最后一行
2. 手写流**无超时控制** → 批次 AI 调用挂起时前端无限等待 → 用户重试 → 重新生成第 1 批

**修复**：
1. `generate-design-doc/route.ts`：改用 `streamCompletion` 逐批生成（获得 180s 超时/重试/`AI_ERROR_MARKER` 哨兵），并维护 `totalText` 跨批总累积——每块 enqueue 全部已生成内容（批间保留 `\n\n---\n\n` 分隔符，前端进度计数依赖）
2. `stream-utils.ts`：streamCompletion 超时重试时重置 `accumulatedContent = ''`，避免重试后新旧内容拼接错乱

**验证**：实测 3 批完整生成（509s / 2234 chunks / 16491 字符），第1章→致谢全章节各 1 次、2 处分隔符、无重复、无 AI_ERROR；tsc 0 错误。

**协议约定（重要）**：所有 API 流式输出必须为"累积全文"语义（每块包含全部已生成内容），与前端 `streamFetch`（`fullText = chunk` 替换）匹配。新增流式路由时遵守。

### 2026-08-03 修复"设计说明书内容重复/错乱"（超时重试切片 bug）

**症状**：设计说明书生成内容出现多次重复/错乱。

**根因**：design-doc 的批次增量合并用 `chunk.content.slice(batchText.length)` 取增量——当 `streamCompletion` **超时重试**（180s 超时 vs 实测批次 ~170s，余量仅 10s，AI 波动极易触发）时 content 从空重新累积，长度回退 → slice 取错 → **旧内容未回退 + 新内容残缺切片**混合成重复错乱内容。

**修复**（`generate-design-doc/route.ts`）：
1. 批次记录 `batchStart`（该批在 totalText 的起点），当 `chunk.content.length < batchText.length`（检测到重试重置）时**回退本批内容重新累积**
2. design-doc 场景 timeout 180s → **300s**（实测单批 ~170s，留足余量降低重试概率）

**验证**：模拟重试序列——修复前输出"旧内容+新内容残片"错乱，修复后正确回退重来；tsc 0 错误。

### 2026-08-03 修复"设计说明书章节标题重复 3 遍"（AI 重述完整大纲）

**症状**：用户提供标题结构——完整章节序列（第1章→致谢）重复 3 遍，每遍 = 1 个批次。

**根因**：批次 2/3 是**独立 completion 请求，无前文上下文**。prompt 仅写"继续撰写第3-5章"，AI 无前文可续，倾向重述完整文档大纲/目录（含本批外的章节标题）。AI 输出不稳定（上次实测各标题 1 次，本次 3 次）。

**修复**（`generate-design-doc/route.ts` prompt 强化）：
1. system 规则 7：严禁输出目录/大纲/章节标题列表，严禁输出本批范围之外章节标题，直接从本批第一个章节正文开始
2. 批次 2/3 user 注入上下文：`（前一批已完成 X）`，明确"严禁重述已完成章节标题，直接从本批第一个章节（如第3章）正文开始撰写"

**验证**：完整实测（587s / 20344 字符）——第1章→致谢各标题**均只出现 1 次**，2 处 `---` 分隔符，无 AI_ERROR；tsc 0 错误。注意 AI 行为有随机性，此修复为 prompt 层面大幅降低复发概率，非 100% 保证。

## 三、已知缺陷

（重构期间发现的回归与遗留问题记于此，含修复状态）

## 待解决问题

1. ✅ 已解决（2026-08-03）：npm build 构建失败 —— 重构遗留的悬空 import 与本地同名定义冲突（见"完成情况"）。
2. ⚠️ 环境：构建需要 Node ≥ 22.13（pnpm 11 要求），当前全局默认 Node 为 v16.20.2。构建前需 `nvm use 26.0.0`（或 24.18.0）；nvm 已装 26.0.0 / 24.18.0 / 16.20.2。
