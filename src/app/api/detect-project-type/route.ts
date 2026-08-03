import { NextRequest, NextResponse } from 'next/server';
import { createOpenAIClient } from '@/lib/ai-client';
import { AI_CONFIG } from '@/lib/ai-config';
import { parseJsonObject } from '@/lib/ai-json';
import type { ProjectTypeInfo } from '@/types/project';
import { DetectProjectTypeSchema, validateRequest } from '@/lib/api-validation';

/**
 * 项目类型识别 API
 *
 * 在 README 生成后调用，分析 README 内容并返回结构化的项目类型信息
 * 用于指导后续的文件结构规划和代码生成
 *
 * 请求参数：
 * - readme: README 文档内容
 * - title: 项目名称
 * - requirements: 需求列表（可选，辅助判断）
 */

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { readme, title, requirements } = validateRequest(DetectProjectTypeSchema, data);

    const client = createOpenAIClient();

    // 截取 README 到合理长度
    const readmeTruncated = readme.length > 10000 ? readme.slice(0, 10000) + '\n...(已截断)' : readme;

    const requirementsText = requirements
      ? requirements.map((r, i) => `${i + 1}. ${r.name}: ${r.description}`).join('\n')
      : '（未提供）';

    const messages = [
      {
        role: 'system' as const,
        content: `你是一位资深全栈架构师。你的任务是根据项目的 README.md 文档，精确识别项目的技术类型和架构模式。

你必须输出一个严格的 JSON 对象，不要输出任何其他内容，不要加 \`\`\`json\`\`\` 标记。

JSON 格式如下：
{
  "type": "项目类型标识，必须是以下之一：java-fullstack / python-fullstack / node-fullstack / vue-frontend / react-frontend / nextjs / html-static / python-web / other",
  "label": "人类可读的项目类型描述，如'Spring Boot + Vue3 全栈项目'",
  "backend": {
    "tech": "后端框架：spring-boot / django / flask / fastapi / express / none",
    "language": "后端语言：java / python / javascript / typescript / none",
    "port": 后端端口号（数字，默认8080）
  },
  "frontend": {
    "tech": "前端框架：vue / react / nextjs / html / none",
    "framework": "具体版本：vue3 / vue2 / react18 / nextjs14 / none",
    "buildTool": "构建工具：vite / webpack / nextjs / none",
    "port": 前端端口号（数字，默认5173）
  },
  "needsDatabase": true或false,
  "database": "mysql / postgresql / mongodb / sqlite / none",
  "needsCache": true或false（是否需要Redis等缓存）,
  "structureMode": "项目结构模式：monorepo（前后端同一仓库） / separated（前后端分离目录） / frontend-only / backend-only / fullstack-single（全栈单目录如Next.js）",
  "packageManager": "pnpm / npm / maven / pip",
  "keyDependencies": ["关键依赖列表，用于生成配置文件"]
}

判断规则：
1. 如果 README 提到 Spring Boot / Java / Maven → type 包含 java
2. 如果 README 提到 Django / Flask / FastAPI / Python → type 包含 python
3. 如果 README 提到 Vue / Vue3 / Element Plus / Vite → frontend.tech = vue
4. 如果 README 提到 React / Ant Design → frontend.tech = react
5. 如果 README 提到 Next.js → type = nextjs, structureMode = fullstack-single
6. 如果只有 HTML/CSS/JS → type = html-static
7. 如果同时有后端和前端 → type = xxx-fullstack, structureMode = separated
8. 如果只有前端 → type = xxx-frontend, structureMode = frontend-only

关键：
- type 字段必须严格使用规定的枚举值
- 如果 README 没有明确指定技术栈，根据需求合理推断（毕业设计常见：Spring Boot + Vue3）
- keyDependencies 要列出生成 package.json / pom.xml / requirements.txt 时需要的核心依赖`,
      },
      {
        role: 'user' as const,
        content: `请分析以下项目的 README.md，识别项目类型。

## 项目名称
${title || '未命名项目'}

## 功能需求
${requirementsText}

## README.md 内容
${readmeTruncated}

请输出 JSON 对象。`,
      },
    ];

    const stream = await client.chat.completions.create({
      model: AI_CONFIG.models.codeStructure,
      messages,
      temperature: 0.1,
      max_tokens: 1000,
    });

    const result = stream.choices[0]?.message?.content || '';

    // 解析 JSON（复用统一清理工具）
    const projectType = parseJsonObject<ProjectTypeInfo>(result);
    if (!projectType) {
      throw new Error('无法解析项目类型');
    }

    // 验证和补全默认值
    const validTypes = ['java-fullstack', 'python-fullstack', 'node-fullstack', 'vue-frontend', 'react-frontend', 'nextjs', 'html-static', 'python-web', 'other'];
    if (!validTypes.includes(projectType.type)) {
      projectType.type = 'other';
    }

    return NextResponse.json(projectType);
  } catch (error) {
    console.error('Detect project type error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : '项目类型识别失败，请重试' }, { status: 500 });
  }
}
