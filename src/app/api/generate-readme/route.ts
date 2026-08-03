import { NextRequest, NextResponse } from 'next/server';
import { createOpenAIClient } from '@/lib/ai-client';
import { createStreamResponse } from '@/lib/stream-utils';
import { GenerateReadmeSchema, validateRequest } from '@/lib/api-validation';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    // 前端以 URL query 传批次（?batch=1/2/3），body 中无该字段，需从 query 读取
    const urlBatch = Number(new URL(request.url).searchParams.get('batch'));
    const { title, requirements, batch = urlBatch || 1 } = validateRequest(GenerateReadmeSchema, data);

    const client = createOpenAIClient();

    const requirementsText = requirements
      .map((r: { name: string; description: string }, i: number) => `${i + 1}. ${r.name}: ${r.description}`)
      .join('\n');

    // 分3批生成README，避免单次输出过长被截断
    const batchPrompts: Record<number, { system: string; user: string }> = {
      1: {
        system: `你是一位专业的技术文档编写者。请根据项目需求生成README文档的第1部分。
直接输出Markdown内容，不要包含任何说明文字或代码块标记。`,
        user: `项目名称：${title}

功能需求：
${requirementsText}

请生成README文档的第1部分，包含以下章节：

# 1. 项目概述
简要介绍项目背景、目标、核心价值（200字左右）

# 2. 技术栈
列出前后端技术栈及版本号，格式简洁：
- 前端：Vue 3.x + Vite 5.x + TypeScript + Element Plus
- 后端：Spring Boot 3.x + MyBatis-Plus
- 数据库：MySQL 8.0
（根据实际需求调整）

# 3. 项目结构
用树形图展示目录结构，每个目录/文件一行说明：
\`\`\`
项目名/
├── backend/          # 后端代码
│   ├── src/
│   └── pom.xml
├── frontend/         # 前端代码
│   ├── src/
│   └── package.json
└── README.md
\`\`\`

请确保内容简洁专业。`,
      },
      2: {
        system: `你是一位专业的技术文档编写者。请根据项目需求生成README文档的第2部分。
直接输出Markdown内容，不要包含任何说明文字或代码块标记。`,
        user: `项目名称：${title}

功能需求：
${requirementsText}

请生成README文档的第2部分，包含以下章节：

# 4. 功能模块
详细描述每个功能模块（每个模块100字左右）：
- 模块名称
- 功能描述
- 涉及的页面和组件
- 数据流向

# 5. 数据库设计
列出所有数据表，每张表包含：
- 表名和用途
- 主要字段（字段名、类型、说明）
- 表关系

# 6. API接口设计
列出主要API接口，格式：
| 方法 | 路径 | 说明 | 请求参数 | 响应 |
|------|------|------|----------|------|
| GET | /api/xxx | 说明 | 参数 | 响应结构 |

请确保内容详细且结构清晰。`,
      },
      3: {
        system: `你是一位专业的技术文档编写者。请根据项目需求生成README文档的第3部分。
直接输出Markdown内容，不要包含任何说明文字或代码块标记。`,
        user: `项目名称：${title}

功能需求：
${requirementsText}

请生成README文档的第3部分，包含以下章节：

# 7. 页面设计
描述主要页面的布局和组件：
- 页面名称
- 布局结构
- 主要组件
- 交互说明

# 8. 开发规范
简要说明：
- 代码风格规范
- 命名规范
- Git提交规范

# 9. 部署方案
简要说明：
- 构建命令
- 部署步骤
- 环境要求

请确保内容简洁实用。`,
      },
    };

    const batchConfig = batchPrompts[batch as keyof typeof batchPrompts];
    if (!batchConfig) {
      return NextResponse.json({ error: '无效的批次号' }, { status: 400 });
    }

    const messages = [
      {
        role: 'system' as const,
        content: batchConfig.system,
      },
      {
        role: 'user' as const,
        content: batchConfig.user,
      },
    ];

    return createStreamResponse(client, { scenario: 'readme', messages });
  } catch (error) {
    console.error('Generate readme error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'README生成失败，请重试' }, { status: 500 });
  }
}
