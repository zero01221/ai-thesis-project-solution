import { NextRequest, NextResponse } from 'next/server';
import { createOpenAIClient, createStreamResponse } from '@/lib/ai-client';

export async function POST(request: NextRequest) {
  try {
    const { readme, title } = await request.json();

    if (!readme || typeof readme !== 'string' || readme.trim().length === 0) {
      return NextResponse.json({ error: '缺少README文档内容' }, { status: 400 });
    }

    const client = createOpenAIClient();

    const messages = [
      {
        role: 'system' as const,
        content: `你是一位顶级全栈开发工程师。你需要根据README.md文档的描述，生成完整可运行的项目代码。

你的输出必须是一个JSON数组，包含所有项目文件的路径和内容。不要包含任何markdown代码块标记或额外说明。

格式如下：
[
  {
    "path": "文件相对路径（如 src/index.html）",
    "content": "文件的完整内容"
  }
]

关键要求：
1. 代码必须完整可运行，不能有省略或占位符
2. 必须包含所有该技术栈必需的配置文件
3. 必须包含入口文件和所有必要的模块
4. 严格遵循README中指定的技术栈
5. 代码质量要高，包含必要的注释和错误处理
6. UI要美观现代，使用流行的CSS框架
7. 每个文件的内容必须完整，不要写"// ... 其他代码"之类的省略

【重要】根据项目技术栈生成正确的配置文件：
- 如果是 Next.js/React 项目：需要 package.json, next.config.js, tsconfig.json 等
- 如果是 Vue 项目：需要 package.json, vite.config.ts, tsconfig.json 等
- 如果是 Spring Boot/Java 项目：需要 pom.xml, application.yml, Maven目录结构等
- 如果是 Python/Flask/Django 项目：需要 requirements.txt, setup.py, manage.py 等
- 如果是纯 HTML/CSS/JS 项目：需要 index.html, 可能需要简单的 package.json
- 如果是微信小程序：需要 app.json, project.config.json 等

不要给所有项目都生成 Next.js 配置文件！必须根据README中指定的技术栈来决定需要哪些配置文件。

package.json 中的 scripts 和 dependencies 必须与项目类型匹配：
- Next.js 项目: next, react, react-dom, scripts 含 next dev/build/start
- Vue 项目: vue, vite, @vitejs/plugin-vue, scripts 含 vite serve/build
- Spring Boot 项目: 不需要 package.json，用 pom.xml
- Python 项目: 不需要 package.json，用 requirements.txt
- 纯前端项目: 简单的 package.json 或直接用 CDN`,
      },
      {
        role: 'user' as const,
        content: `请根据以下README.md文档，生成完整的项目代码。

## 项目名称
${title}

## README.md 内容
${readme}

请生成所有项目文件的完整代码，以JSON数组格式输出（不要加\`\`\`json\`\`\`标记）。
确保项目可以直接安装依赖并启动运行。配置文件必须与项目技术栈匹配！`,
      },
    ];

    return createStreamResponse(client, messages, 'code');
  } catch (error) {
    console.error('Generate code error:', error);
    return NextResponse.json({ error: '代码生成失败，请重试' }, { status: 500 });
  }
}
