import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

export async function POST(request: NextRequest) {
  try {
    const { title } = await request.json();

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ error: '请输入论文题目' }, { status: 400 });
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    const messages = [
      {
        role: 'system' as const,
        content: `你是一位资深的毕业设计指导老师，擅长根据论文题目分析并生成详细的项目功能需求。
你的输出必须是纯JSON数组格式，不要包含任何markdown代码块标记或其他文字说明。
每个需求包含 id、name、description 三个字段。
生成8-12条功能需求，每条需求的description应详细说明功能点、交互流程、数据流向等。`,
      },
      {
        role: 'user' as const,
        content: `请根据以下毕业论文题目，生成详细的项目功能需求列表。

论文题目：${title.trim()}

请以如下JSON数组格式输出（不要加\`\`\`json\`\`\`标记）：
[
  {
    "id": 1,
    "name": "需求名称",
    "description": "详细的功能描述，包括交互流程、数据处理逻辑、界面元素等"
  }
]

要求：
1. 需求应覆盖完整的项目功能，包括前端交互、后端逻辑、数据管理
2. 每条需求描述不少于50字
3. 需求之间不应有重叠
4. 按重要性和实现顺序排列
5. 包含用户管理、数据展示等基础功能需求`,
      },
    ];

    const stream = client.stream(messages, {
      model: 'doubao-seed-2-0-pro-260215',
      temperature: 0.7,
    });

    const readableStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const chunk of stream) {
            if (chunk.content) {
              const text = chunk.content.toString();
              controller.enqueue(encoder.encode(text));
            }
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Generate requirements error:', error);
    return NextResponse.json({ error: '需求生成失败，请重试' }, { status: 500 });
  }
}
