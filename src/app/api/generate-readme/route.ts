import { NextRequest, NextResponse } from 'next/server';
import { createOpenAIClient, createStreamResponse } from '@/lib/ai-client';

export async function POST(request: NextRequest) {
  try {
    const { title, requirements } = await request.json();

    if (!title || !requirements || !Array.isArray(requirements) || requirements.length === 0) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const client = createOpenAIClient();

    const requirementsText = requirements
      .map((r: { name: string; description: string }, i: number) => `${i + 1}. ${r.name}: ${r.description}`)
      .join('\n');

    const messages = [
      {
        role: 'system' as const,
        content: `你是一位专业的技术文档编写者和全栈架构师。你需要根据毕业设计项目的需求，生成一份完整详细的README.md文档，这份文档将用于指导AI编程助手完成整个项目的代码开发。

文档必须非常详细和具体，包含所有必要的技术细节，使得AI能够仅根据这份文档就完成项目的全部代码编写。

请直接输出Markdown格式的文档内容，不要包含任何额外的说明文字。`,
      },
      {
        role: 'user' as const,
        content: `请根据以下毕业设计项目信息，生成一份完整详细的README.md文档。

## 项目名称
${title}

## 功能需求
${requirementsText}

## 要求
README.md必须包含以下章节，每个章节都要非常详细：

1. **项目概述** - 项目背景、目标、核心价值、主要功能概述
2. **技术栈** - 详细的前后端技术栈选择及版本号，包括框架、库、工具等
3. **项目结构** - 完整的目录结构树及每个目录/文件的说明
4. **功能模块** - 每个功能模块的详细描述，包括：
   - 模块职责
   - 涉及的页面/组件
   - 数据流向
   - 交互逻辑
5. **数据库设计** - 所有数据表的详细设计，包括：
   - 表名、字段名、字段类型、约束条件
   - 表之间的关系（外键、关联）
   - 索引设计
6. **API接口设计** - RESTful接口完整列表，包括：
   - 请求方法、路径、描述
   - 请求参数及类型
   - 响应数据结构
   - 状态码说明
7. **页面设计** - 主要页面及组件设计，包括：
   - 页面布局描述
   - 组件层级关系
   - 交互状态说明
8. **开发规范** - 代码风格、命名规范、Git规范
9. **部署方案** - 构建、部署流程和环境配置

请确保文档内容足够详细，AI编程助手可以据此独立完成全部代码开发。`,
      },
    ];

    return createStreamResponse(client, messages, 'readme');
  } catch (error) {
    console.error('Generate readme error:', error);
    return NextResponse.json({ error: 'README生成失败，请重试' }, { status: 500 });
  }
}
