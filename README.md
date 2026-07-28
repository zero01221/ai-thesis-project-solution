# 毕业设计 AI 助手

> 从论文题目到完整项目代码，一站式 AI 驱动的毕业设计辅助工具

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16.0-black.svg)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-red.svg)](https://reactjs.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.0-blue.svg)](https://tailwindcss.com/)

## 🌟 功能介绍

### 5 步向导式工作流

| 步骤 |        功能        | 说明                                                                                             |
| :--: | :----------------: | :----------------------------------------------------------------------------------------------- |
|  1   |    **需求输入**    | 智能生成：输入论文题目，AI 自动生成 8-12 条详细功能需求；手动输入：描述需求，AI 分析并结构化完善 |
|  2   |    **需求确认**    | 可视化需求列表，支持编辑、删除、新增需求，审核后确认                                             |
|  3   |  **生成 README**   | AI 根据需求生成完整详细的 README.md 技术文档，用于指导后续 AI 编程                               |
|  4   |   **设计说明书**   | AI 撰写 1.8-2 万字设计说明书初稿（仅供参考，无任何专业性）                                       |
|  5   | **代码生成与下载** | AI 根据 README 生成完整可运行的项目代码，一键打包 ZIP 下载                                       |

### 下载的 ZIP 包含

- ✅ 完整项目源代码（可直接运行）
- ✅ `README.md` - 技术文档
- ✅ `设计说明书.md` - 毕业设计论文初稿
- ✅ `CLAUDE.md` - Claude Code 权限配置
- ✅ `运行.bat` - Windows 一键运行脚本（自动安装环境并启动）
- ✅ `先看我.txt` - 项目说明文件
- ✅ `.project.json` - 项目配置文件

### 🚀 核心特性

- 🎯 **流式输出**：AI 生成内容实时展示，打字机式体验
- 📝 **Markdown 实时渲染**：README 和设计说明书支持实时渲染预览
- 📋 **一键复制**：所有生成内容支持一键复制到剪贴板
- 📁 **文件树预览**：代码生成后可预览文件结构和代码内容
- 🔒 **类型安全**：完整的 TypeScript 类型定义和运行时校验
- 🔄 **配置热重载**：AI 配置支持动态更新，无需重启
- 📊 **性能监控**：内置性能指标和API调用统计
- 💾 **请求缓存**：自动缓存AI请求，提升响应速度

---

## 🛠 技术栈

### 前端技术栈
- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (Radix UI)
- **Styling**: Tailwind CSS 4 + Typography

### 后端技术栈
- **API**: Next.js API Routes
- **Validation**: Zod - 类型安全的参数校验
- **Stream**: Server-Sent Events (SSE)
- **AI SDK**: OpenAI SDK（兼容百炼/DeepSeek/Kimi 等）

### 核心库
- **AI Client**: 自定义 AI 客户端管理器（含缓存和重试）
- **Stream Utils**: 增强型流式响应处理器（支持进度跟踪）
- **Project Registry**: 项目类型约束管理
- **API Validation**: 完整的 API 参数校验中间件

---

## 🚀 快速开始

### 环境要求

- **Node.js 18+**（推荐使用 LTS 版本）
- **pnpm**（推荐）或 npm
- **终端**（命令行工具）
- **环境变量**：AI API 密钥

### 安装与运行

#### 开发模式（推荐用于开发调试）

```bash
# 1. 克隆项目
git clone https://github.com/你的用户名/graduation-ai-assistant.git
cd graduation-ai-assistant

# 2. 安装依赖
pnpm install

# 3. 配置环境变量
cp .env.example .env.local
# 编辑 .env.local，设置 DASHSCOPE_API_KEY

# 4. 启动开发服务器
pnpm run dev

# 5. 浏览器访问
# http://localhost:3000
```

#### 生产模式（用于正式环境）

```bash
# 1. 克隆项目
git clone https://github.com/你的用户名/graduation-ai-assistant.git
cd graduation-ai-assistant

# 2. 安装依赖
pnpm install

# 3. 构建项目
pnpm build

# 4. 启动生产服务器
pnpm start

# 5. 浏览器访问
# http://localhost:3000
```

### 启动验证

程序启动后，您应该能看到：
- 🎯 欢迎页面
- 📋 5步向导界面
- 🔧 AI配置正常加载
- 💡 实时流式响应功能

### 环境变量配置

```bash
# .env.local
DASHSCOPE_API_KEY=sk-你的API密钥
AI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
AI_DEFAULT_MODEL=qwen-plus

# 或者使用其他模型
# DeepSeek
# DASHSCOPE_API_KEY=sk-你的API密钥
# AI_BASE_URL=https://api.deepseek.com
# AI_DEFAULT_MODEL=deepseek-chat
```

### 构建与部署

```bash
# 构建生产版本
pnpm build

# 启动生产服务器
pnpm start

# 代码检查
pnpm lint

# 类型检查
pnpm type-check
```

---

## ⚙️ AI 配置

### 配置管理

AI 模型配置已升级为热重载配置系统，支持动态更新。

```typescript
// src/lib/ai-config.ts

// 全局配置管理器（支持热重载）
export const configManager = new ConfigManager();

// 兼容性配置对象
export const AI_CONFIG = {
  get apiKey(): string { return configManager.getConfig().apiKey; },
  get baseURL(): string { return configManager.getConfig().baseURL; },
  get model(): string { return configManager.getConfig().model; },
  // ...
};
```

### 场景模型配置

```typescript
export const SCENARIO_MODELS = {
  requirements: 'qwen3.7-flash',    // 需求生成
  analyzeRequirements: 'qwen3.7-flash',
  readme: 'qwen3.7-plus',         // README 生成
  designDoc: 'qwen3.7-max',        // 设计说明书
  codeStructure: 'qwen3.7-flash',  // 代码结构
  code: 'kimi-k2.7-code',         // 代码生成
} as const;
```

### 支持的 AI 模型

| 平台 | API URL | 模型 | 说明 |
|------|---------|------|------|
| 阿里云百炼 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | qwen-3.7-* | 通义千问系列 |
| DeepSeek | `https://api.deepseek.com` | deepseek-chat | DeepSeek Chat |
| Kimi | `https://api.moonshot.cn/v1` | moonshot-v1-128k | 月之暗面 |
| OpenAI | `https://api.openai.com/v1` | gpt-4o | OpenAI GPT-4o |
| 豆包 | `https://ark.cn-beijing.volces.com/api/v3` | {接入点ID} | 火山引擎 |

---

## 📁 项目架构

```
src/
├── app/
│   ├── api/                          # API 路由
│   │   ├── generate-requirements/    # 需求生成
│   │   ├── analyze-requirements/     # 需求分析
│   │   ├── generate-readme/         # README 生成
│   │   ├── generate-design-doc/     # 设计说明书
│   │   ├── generate-code/           # 代码生成
│   │   ├── generate-code-structure/ # 代码结构
│   │   ├── detect-project-type/     # 项目类型检测
│   │   └── download-package/        # ZIP 打包
│   ├── components/
│   │   ├── graduation-wizard.tsx    # 5步向导组件
│   │   └── ui/                      # shadcn/ui 组件库
│   └── types/                       # 类型定义
│       └── project.ts              # 项目共享类型
├── lib/                            # 核心库
│   ├── ai-config.ts               # AI 配置管理（热重载）
│   ├── ai-client.ts               # AI 客户端（含缓存）
│   ├── api-validation.ts           # API 校验中间件
│   ├── stream-utils.ts             # 流式响应处理器
│   ├── project-type-registry.ts   # 项目类型约束
│   └── utils.ts                   # 工具函数
└── ...
```

### 核心模块

#### 1. 类型系统 (`src/types/project.ts`)
```typescript
export interface ProjectTypeInfo {
  type: 'java-fullstack' | 'python-fullstack' | 'node-fullstack' | ...;
  label: string;
  backend: { tech; language; port; };
  frontend: { tech; framework; buildTool; port; };
  // ...
}

// 类型守卫
export const isProjectTypeInfo = (obj: unknown): obj is ProjectTypeInfo => {
  // ...
};

// 验证函数
export const validateProjectTypeInfo = (project: ProjectTypeInfo): void => {
  // ...
};
```

#### 2. 配置管理 (`src/lib/ai-config.ts`)
- 热重载配置系统
- 配置变更监听
- 严格配置验证
- 环境变量检测

#### 3. AI 客户端 (`src/lib/ai-client.ts`)
- 请求缓存机制
- 自动重试功能
- 性能监控
- 错误处理

#### 4. 流式工具 (`src/lib/stream-utils.ts`)
- 进度跟踪
- 检查点管理
- 断点续传
- 错误恢复

#### 5. API 校验 (`src/lib/api-validation.ts`)
- Zod 类型校验
- 请求日志记录
- 性能监控中间件
- 错误统计

---

## 🔍 常见启动问题

### 1. 依赖安装失败

```bash
# 清理缓存重新安装
pnpm store prune
rm -rf node_modules
pnpm install
```

### 2. 端口被占用

```bash
# 查看端口占用
netstat -ano | findstr :3000

# 或者修改端口启动
PORT=3001 pnpm run dev
```

### 3. API密钥配置错误

确保 `.env.local` 中的配置正确：

```bash
# 阿里云百炼（默认）
DASHSCOPE_API_KEY=sk-您的API密钥
AI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
AI_DEFAULT_MODEL=qwen-plus

# DeepSeek
# DASHSCOPE_API_KEY=sk-您的API密钥
# AI_BASE_URL=https://api.deepseek.com
# AI_DEFAULT_MODEL=deepseek-chat
```

### 4. 网络问题

如果无法访问AI API：
- 配置代理
- 使用VPN
- 检查防火墙设置

---

## 🔧 其他启动方式

### 使用 VS Code 启动

```bash
# 使用 VS Code 的终端
code .  # 打开项目
# 在 VS Code 中按 Ctrl+` 打开终端
pnpm run dev
```

### 使用 Docker 启动

```bash
# 构建 Docker 镜像
docker build -t graduation-ai .

# 运行容器
docker run -p 3000:3000 \
  -e DASHSCOPE_API_KEY=sk-您的API密钥 \
  graduation-ai
```

### 使用 PM2 部署（生产环境）

```bash
# 安装 PM2
npm install -g pm2

# 创建 ecosystem.config.js 文件
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'graduation-ai',
    script: 'npm',
    args: 'start',
    cwd: '.',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
EOF

# 启动应用
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs graduation-ai
```

### 使用 Windows 批处理脚本

创建 `start.bat` 文件：

```batch
@echo off
echo 正在启动毕业设计AI助手...
echo.

echo 1. 安装依赖...
call pnpm install

if errorlevel 1 (
    echo 依赖安装失败，请检查网络连接
    pause
    exit /b 1
)

echo.
echo 2. 启动开发服务器...
call pnpm run dev

pause
```

---

## 📋 启动后测试

程序启动后，建议进行以下测试：

### 1. 页面访问测试
- 打开浏览器访问 http://localhost:3000
- 确认页面正常显示
- 检查5个步骤是否正常显示

### 2. AI功能测试
- **步骤1**：输入论文题目，测试需求生成
- **步骤2**：查看生成的需求列表
- **步骤3**：测试README生成功能
- **步骤4**：测试设计文档生成
- **步骤5**：测试代码生成和下载

### 3. 开发者工具测试

```bash
# 打开开发者工具（F12）
# 检查 Console 是否有错误信息
# 查看 Network 标签页确认 API 请求正常
```

### 4. 环境检查清单

- ✅ Node.js 版本 >= 18
- ✅ pnpm 已安装
- ✅ 依赖已安装
- ✅ 环境变量已配置
- ✅ 端口 3000 可用
- ✅ AI API 密钥有效
- ✅ 网络连接正常

---

## 🔄 重启程序

### 开发环境重启

```bash
# 停止开发服务器（在终端按 Ctrl+C）

# 重新启动
pnpm run dev
```

### 生产环境重启

```bash
# 使用 PM2
pm2 restart graduation-ai

# 或者手动重启
pnpm stop
pnpm start
```

### 热重载配置

修改 AI 配置后，支持热重载：
```bash
# 修改 src/lib/ai-config.ts
# 配置会自动更新，无需重启程序
```

---

## 💡 小贴士

1. **首次启动较慢**：第一次启动需要安装大量依赖，请耐心等待
2. **API调用可能有延迟**：AI生成需要时间，请耐心等待流式响应
3. **检查控制台错误**：如遇问题，请查看浏览器开发者工具的Console
4. **定期更新依赖**：定期运行 `pnpm update` 保持依赖最新
5. **备份配置文件**：妥善保存 `.env.local` 文件

## 📞 遇到问题？

如果启动过程中遇到问题，请检查：
1. **环境变量配置**：确保 `.env.local` 文件存在且配置正确
2. **依赖版本**：确保使用兼容的 Node.js 版本
3. **网络连接**：确保能访问AI API
4. **查看日志**：查看控制台输出的错误信息

如仍有问题，请提交 [Issue](../../issues) 或联系开发者。

---

## 🔌 API 接口

所有接口使用 SSE 流式输出（`text/event-stream`），支持实时进度更新。

### 接口总览

| 接口 | 方法 | 功能 | 请求体 | 响应类型 |
|------|------|------|--------|----------|
| `/api/generate-requirements` | POST | 生成需求 JSON | `{ title }` | SSE 流式 |
| `/api/analyze-requirements` | POST | 分析需求 | `{ requirements }` | SSE 流式 |
| `/api/generate-readme` | POST | 生成 README | `{ title, requirements[] }` | SSE 流式 |
| `/api/generate-design-doc` | POST | 生成设计文档 | `{ title, requirements[], readme? }` | SSE 流式 |
| `/api/generate-code-structure` | POST | 生成代码结构 | `{ readme, title, projectType? }` | SSE 流式 |
| `/api/generate-code` | POST | 生成代码 | `{ readme, title, files[] }` | SSE 流式 |
| `/api/detect-project-type` | POST | 检测项目类型 | `{ readme, title, requirements[] }` | JSON |
| `/api/download-package` | POST | 打包下载 | `{ files[], title, designDoc?, readme? }` | ZIP |

### API 响应格式

#### 成功响应（流式）
```
data: {"content": "生成内容", "done": false}

data: {"content": "完整内容", "done": true, "progress": {"current": 100, "total": 100, "percentage": 100.0}}

data: [AI_ERROR] 错误信息
```

#### 错误响应
```json
{
  "success": false,
  "error": "错误信息"
}
```

### 参数验证

所有 API 接口使用 Zod 进行严格的参数校验：
```typescript
// 自动参数校验
const { title, requirements } = validateRequest(AnalyzeRequirementsSchema, data);
```

---

## 📊 性能特性

### 1. 请求缓存
- 自动缓存 AI 请求
- 支持 LRU 淘汰策略
- 可配置缓存 TTL

### 2. 自动重试
- 连接超时重试
- API 错误重试
- 智能退避算法

### 3. 进度跟踪
- 实时进度更新
- Token 计数显示
- 时间线跟踪

### 4. 监控统计
- API 调用统计
- 性能指标监控
- 错误日志记录

```typescript
// 获取 API 统计信息
import { getApiStats } from '@/lib/api-validation';

const stats = getApiStats();
console.log({
  totalRequests: stats.totalRequests,
  successRate: `${stats.successRate.toFixed(1)}%`,
  averageDuration: `${stats.averageDuration.toFixed(0)}ms`
});
```

---

## 🛠 开发指南

### 1. 添加新的 AI 场景

1. 在 `ai-config.ts` 中添加新场景模型
2. 在 `api-validation.ts` 中定义校验 Schema
3. 创建新的 API 路由文件
4. 在 `stream-utils.ts` 中添加处理逻辑

### 2. 扩展项目类型

1. 在 `project-type-registry.ts` 中添加新类型
2. 更新 `types/project.ts` 中的类型定义
3. 添加相应的验证函数
4. 更新代码生成约束

### 3. 添加新的校验规则

```typescript
// src/lib/api-validation.ts
export const NewSchema = z.object({
  newField: z.string().min(1, '必填字段'),
});

// API 路由中使用
export async function POST(request: Request) {
  const data = validateRequest(NewSchema, await request.json());
  // ...
}
```

---

## 📦 部署选项

### 本地部署

```bash
# 开发模式
pnpm dev

# 生产模式
pnpm build
pnpm start
```

### Docker 部署

```dockerfile
FROM node:24-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
EXPOSE 3000
ENV DASHSCOPE_API_KEY=sk-xxx
CMD ["pnpm", "start"]
```

### 环境变量

| 变量名 | 必需 | 说明 |
|--------|------|------|
| `DASHSCOPE_API_KEY` | ✓ | AI API 密钥 |
| `AI_BASE_URL` | ✗ | API 基础地址 |
| `AI_DEFAULT_MODEL` | ✗ | 默认模型 |

---

## 🤝 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

### 开发规范

- 使用 TypeScript 严格模式
- 遵循 ESLint 规则
- 编写必要的类型定义
- 添加适当的注释

---

## 📋 更新日志

### v2.0.0 (2024-07-28)
- ✅ 完成架构重构
- ✅ 添加类型安全系统
- ✅ 实现配置热重载
- ✅ 增强AI客户端功能
- ✅ 优化流式响应处理
- ✅ 添加API监控统计
- ✅ 完善错误处理机制

### v1.0.0
- 🎉 初始版本发布
- 📦 实现5步向导流程
- 🔄 流式输出支持
- 📄 文档生成功能
- 💻 代码自动生成

---

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- [Next.js](https://nextjs.org/) - React 框架
- [shadcn/ui](https://ui.shadcn.com/) - UI 组件库
- [Tailwind CSS](https://tailwindcss.com/) - CSS 框架
- [OpenAI](https://openai.com/) - AI API 提供商
- [阿里云百炼](https://bailian.console.aliyun.com/) - AI 服务

---

如有问题或建议，请提交 [Issue](../../issues) 或联系开发者。
