# 毕业设计 AI 助手

> 从论文题目到完整项目代码，一站式 AI 驱动的毕业设计辅助工具

## 功能介绍

### 5 步向导式工作流

| 步骤 | 功能 | 说明 |
|:---:|:---:|:---|
| 1 | **需求输入** | 智能生成：输入论文题目，AI 自动生成 8-12 条详细功能需求；手动输入：描述需求，AI 分析并结构化完善 |
| 2 | **需求确认** | 可视化需求列表，支持编辑、删除、新增需求，审核后确认 |
| 3 | **生成 README** | AI 根据需求生成完整详细的 README.md 技术文档，用于指导后续 AI 编程 |
| 4 | **设计说明书** | AI 撰写 1.8-2 万字设计说明书初稿（8 章完整结构），可作为毕业论文参考 |
| 5 | **代码生成与下载** | AI 根据 README 生成完整可运行的项目代码，一键打包 ZIP 下载 |

### 下载的 ZIP 包含

- 完整项目源代码（可直接运行）
- `README.md` - 技术文档
- `设计说明书.md` - 毕业设计论文初稿
- `CLAUDE.md` - Claude Code 权限配置
- `运行.bat` - Windows 一键运行脚本（自动安装环境并启动）
- `先看我.txt` - 项目说明文件

### 核心特性

- **流式输出**：AI 生成内容实时展示，打字机式体验
- **Markdown 实时渲染**：README 和设计说明书支持实时渲染预览
- **一键复制**：所有生成内容支持一键复制到剪贴板
- **文件树预览**：代码生成后可预览文件结构和代码内容

---

## 技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (Radix UI)
- **Styling**: Tailwind CSS 4 + Typography
- **AI SDK**: OpenAI SDK（兼容百炼/DeepSeek/Kimi 等）
- **ZIP 打包**: JSZip
- **Markdown 渲染**: react-markdown + remark-gfm

---

## 快速开始

### 环境要求

- Node.js 18+
- pnpm（推荐）或 npm

### 安装与运行

```bash
# 1. 克隆项目
git clone https://github.com/你的用户名/graduation-ai-assistant.git
cd graduation-ai-assistant

# 2. 安装依赖
pnpm install

# 3. 启动开发服务器
pnpm dev

# 4. 浏览器访问
# http://localhost:3000
```

### 构建与部署

```bash
# 构建生产版本
pnpm build

# 启动生产服务器
pnpm start
```

---

## AI 配置修改

AI 模型配置已分离到 `src/lib/ai-config.ts`，修改此文件即可切换模型，**无需修改任何业务代码**。

### 配置文件结构

```typescript
// src/lib/ai-config.ts

export const AI_CONFIG = {
  /** API 基础地址 */
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',

  /** API 密钥 */
  apiKey: 'sk-xxxxxxxx',

  /** 默认模型 */
  model: 'qwen-plus',

  /** 各场景可单独指定不同模型 */
  models: {
    requirements: 'qwen-plus',       // 需求生成
    analyzeRequirements: 'qwen-plus', // 需求分析
    readme: 'qwen-plus',             // README 生成
    designDoc: 'qwen-plus',          // 设计说明书（建议长上下文模型）
    code: 'qwen-plus',               // 代码生成
  },

  /** 各场景参数 */
  params: {
    requirements: { temperature: 0.7, max_tokens: 4096 },
    // ...
  },
};
```

### 切换到其他模型

本项目使用 OpenAI 兼容接口，支持所有兼容 OpenAI API 格式的大模型。

#### 阿里云百炼（默认）

```typescript
baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
apiKey: 'sk-你的API密钥',
model: 'qwen-plus',   // 可选: qwen-turbo, qwen-max, qwen-long
```

> 获取 API Key：登录 [阿里云百炼平台](https://bailian.console.aliyun.com/) → API-KEY 管理 → 创建

#### DeepSeek

```typescript
baseURL: 'https://api.deepseek.com',
apiKey: 'sk-你的API密钥',
model: 'deepseek-chat',   // 或 deepseek-coder
```

#### Kimi（月之暗面）

```typescript
baseURL: 'https://api.moonshot.cn/v1',
apiKey: 'sk-你的API密钥',
model: 'moonshot-v1-128k',
```

#### OpenAI

```typescript
baseURL: 'https://api.openai.com/v1',
apiKey: 'sk-你的API密钥',
model: 'gpt-4o',
```

#### 豆包（火山引擎）

```typescript
baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
apiKey: '你的API密钥',
model: '你的接入点ID',
```

#### 通义千问其他模型

| 模型名 | 说明 | 适用场景 |
|:---:|:---|:---|
| `qwen-turbo` | 速度快，成本低 | 需求生成、需求分析 |
| `qwen-plus` | 性能均衡（推荐） | 所有场景 |
| `qwen-max` | 效果最好，成本高 | 设计说明书、代码生成 |
| `qwen-long` | 超长上下文 | 设计说明书（2万字） |

### 敏感信息保护（重要）

**不要将 API Key 硬编码在代码中提交到 GitHub！** 推荐使用环境变量：

1. 修改 `src/lib/ai-config.ts`：

```typescript
export const AI_CONFIG = {
  baseURL: process.env.AI_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  apiKey: process.env.AI_API_KEY || '',
  // ...
};
```

2. 创建 `.env.local` 文件（已加入 .gitignore）：

```env
AI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
AI_API_KEY=sk-你的API密钥
```

---

## 项目结构

```
├── public/                          # 静态资源
├── src/
│   ├── app/
│   │   ├── layout.tsx               # 根布局
│   │   ├── page.tsx                 # 首页
│   │   ├── globals.css              # 全局样式
│   │   └── api/
│   │       ├── generate-requirements/  # [POST] 根据题目生成需求
│   │       ├── analyze-requirements/   # [POST] 分析手动需求
│   │       ├── generate-readme/        # [POST] 生成README
│   │       ├── generate-design-doc/    # [POST] 生成设计说明书
│   │       ├── generate-code/          # [POST] 生成代码
│   │       └── download-package/       # [POST] 打包ZIP下载
│   ├── components/
│   │   ├── graduation-wizard.tsx    # 核心：5步向导组件
│   │   └── ui/                      # shadcn/ui 组件库
│   └── lib/
│       ├── ai-config.ts            # AI 模型配置（修改此文件切换模型）
│       ├── ai-client.ts            # AI 客户端封装
│       └── utils.ts                # 工具函数
├── .env.local                       # 环境变量（不提交到 Git）
├── package.json
├── tsconfig.json
└── next.config.ts
```

---

## API 接口

所有接口使用 SSE 流式输出（`text/event-stream`），前端通过 `fetch` + `body.getReader()` 实时读取。

| 接口 | 方法 | 功能 | 请求体 |
|:---|:---:|:---|:---|
| `/api/generate-requirements` | POST | 根据论文题目生成需求 JSON | `{ title }` |
| `/api/analyze-requirements` | POST | 分析手动需求返回结构化 JSON | `{ requirements }` |
| `/api/generate-readme` | POST | 生成 README.md Markdown | `{ title, requirements[] }` |
| `/api/generate-design-doc` | POST | 生成 1.8-2 万字设计说明书 | `{ title, requirements[], readme? }` |
| `/api/generate-code` | POST | 生成代码文件 JSON 数组 | `{ readme, title }` |
| `/api/download-package` | POST | 返回 ZIP 文件 | `{ files[], title, designDoc?, readme? }` |

---

## 部署到本地

### 方式一：开发模式

```bash
git clone https://github.com/你的用户名/graduation-ai-assistant.git
cd graduation-ai-assistant
pnpm install
pnpm dev
# 访问 http://localhost:3000
```

### 方式二：生产模式

```bash
pnpm build
pnpm start
# 访问 http://localhost:3000
```

### 方式三：Docker 部署

```dockerfile
FROM node:24-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
EXPOSE 3000
CMD ["pnpm", "start"]
```

```bash
docker build -t graduation-ai .
docker run -p 3000:3000 -e AI_API_KEY=sk-xxx graduation-ai
```

---

## 常见问题

### Q: AI 生成失败怎么办？

- 检查 API Key 是否正确（`src/lib/ai-config.ts` 或 `.env.local`）
- 检查网络是否能访问 API 地址
- 设计说明书生成需要较长时间（1-2 分钟），请耐心等待

### Q: 如何更换 AI 模型？

修改 `src/lib/ai-config.ts` 中的 `baseURL`、`apiKey`、`model` 字段即可，详见上方「AI 配置修改」章节。

### Q: 生成的代码能直接运行吗？

ZIP 包中的代码是 AI 根据需求自动生成的，可能需要根据实际情况微调。ZIP 中包含 `运行.bat`（Windows）可一键配置环境并启动。

### Q: 设计说明书字数够吗？

设计说明书初稿约 1.8-2 万字，包含 8 个完整章节。建议在此基础上根据实际情况修改完善。

---

## License

MIT
