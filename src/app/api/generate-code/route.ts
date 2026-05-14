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
2. 必须包含所有配置文件（package.json, tsconfig.json等）
3. 必须包含入口文件和所有必要的模块
4. 严格遵循README中指定的技术栈
5. 代码质量要高，包含必要的注释和错误处理
6. UI要美观现代，使用流行的CSS框架
7. 每个文件的内容必须完整，不要写"// ... 其他代码"之类的省略`,
      },
      {
        role: 'user' as const,
        content: `请根据以下README.md文档，生成完整的项目代码。

## 项目名称
${title}

## README.md 内容
${readme}

请生成所有项目文件的完整代码，以JSON数组格式输出（不要加\`\`\`json\`\`\`标记）。
确保项目可以直接通过 npm install && npm run dev 启动运行。`,
      },
    ];

    return createStreamResponse(client, messages, 'code');
  } catch (error) {
    console.error('Generate code error:', error);
    return NextResponse.json({ error: '代码生成失败，请重试' }, { status: 500 });
  }
}
