import { NextRequest, NextResponse } from 'next/server';
import { createOpenAIClient } from '@/lib/ai-client';
import { AI_CONFIG } from '@/lib/ai-config';

/**
 * 设计说明书 - 分章生成
 *
 * 将8章内容分3批生成，确保每章字数在合理范围内，
 * 避免一次性生成导致前几章过多、后几章缺失的问题。
 */

// 各批次的章节定义
const BATCHES = [
  {
    label: '第1-2章',
    chapters: `### 第1章 绪论（严格控制2200-2500字，不要超过2500字）
- 1.1 研究背景（约600字，阐述选题的现实意义和学术价值，结合行业现状分析）
- 1.2 国内外研究现状（约800字，综述相关领域的研究进展，分3-4个方向讨论）
- 1.3 研究目的与意义（约500字，明确本文的研究目标和实际应用价值）
- 1.4 论文组织结构（约300字，概述各章节内容安排）

### 第2章 相关技术介绍（严格控制2200-2500字，不要超过2500字）
- 2.1 前端技术栈（约600字，详细介绍框架原理、核心特性、选型理由）
- 2.2 后端技术栈（约600字，详细介绍框架原理、核心特性、选型理由）
- 2.3 数据库技术（约400字，介绍数据库类型、特点、适用场景）
- 2.4 开发工具与环境（约400字，介绍开发环境配置、构建工具、版本控制等）
- 2.5 其他关键技术（约300字，如中间件、缓存、部署方案等）`,
  },
  {
    label: '第3-5章',
    chapters: `### 第3章 系统需求分析（严格控制2200-2500字，不要超过2500字）
- 3.1 可行性分析（约600字，技术可行性、经济可行性、操作可行性）
- 3.2 功能需求分析（约700字，详细描述每个功能模块的需求）
- 3.3 非功能需求分析（约400字，性能需求、安全需求、可用性需求等）
- 3.4 用例分析（约600字，核心用例的详细描述，包含前置条件、主流程、异常流程）

### 第4章 系统总体设计（严格控制2200-2500字，不要超过2500字）
- 4.1 系统架构设计（约600字，整体架构说明，分层架构描述，各层职责）
- 4.2 系统功能模块设计（约700字，模块划分、模块间关系、功能模块图）
- 4.3 系统流程设计（约600字，核心业务流程描述，流程图说明）
- 4.4 接口设计（约400字，系统对外接口、内部模块间接口的设计规范）

### 第5章 数据库设计（严格控制2200-2500字，不要超过2500字）
- 5.1 数据库概念设计（约500字，E-R图描述，实体及关系说明）
- 5.2 数据库逻辑设计（约500字，关系模式转换，表结构设计）
- 5.3 数据表详细设计（约900字，每张表的字段名、类型、约束、说明，用表格展示）
- 5.4 数据库优化设计（约400字，索引设计、查询优化策略）`,
  },
  {
    label: '第6-8章',
    chapters: `### 第6章 系统详细设计与实现（严格控制2800-3000字，不要超过3000字）
- 6.1 用户管理模块实现（约600字，页面设计、交互逻辑、关键代码实现说明）
- 6.2 核心业务模块实现（约800字，按功能模块逐个描述界面设计和实现逻辑）
- 6.3 数据访问层实现（约500字，DAO层设计、数据操作封装）
- 6.4 前端页面实现（约600字，组件设计、路由设计、状态管理）
- 6.5 安全机制实现（约400字，认证授权、数据校验、防护措施）

### 第7章 系统测试（严格控制1800-2000字，不要超过2000字）
- 7.1 测试环境（约300字，硬件环境、软件环境、浏览器兼容性）
- 7.2 测试方案（约400字，测试策略、测试方法、测试用例设计）
- 7.3 功能测试（约600字，核心功能测试用例及测试结果，用表格展示）
- 7.4 性能测试（约300字，响应时间、并发能力、资源占用等测试数据）
- 7.5 测试结论（约300字，测试结果总结，存在的问题及改进方向）

### 第8章 总结与展望（严格控制400-500字，不要超过500字）
- 8.1 工作总结
- 8.2 不足与展望

### 参考文献
（列出15-20篇参考文献，格式规范，包含期刊论文、会议论文、技术书籍）

### 致谢
（约200字）`,
  },
];

export async function POST(request: NextRequest) {
  try {
    const { title, requirements, readme } = await request.json();

    if (!title || !requirements || !Array.isArray(requirements) || requirements.length === 0) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const client = createOpenAIClient();

    const requirementsText = requirements
      .map((r: { name: string; description: string }, i: number) => `${i + 1}. ${r.name}: ${r.description}`)
      .join('\n');

    const readmeSummary = readme
      ? `\n\n## 以下是项目README文档的摘要信息（供参考技术栈和系统架构）：\n${(readme as string).slice(0, 3000)}`
      : '';

    // 构建分批生成的messages
    // 每批都是独立的completion请求，但共享system prompt和上下文
    const allMessages = BATCHES.map((batch, index) => {
      const batchLabel = batch.label;
      const isFirst = index === 0;

      const systemContent = `你是一位资深的计算机专业毕业设计指导老师，擅长撰写高质量的毕业设计说明书（论文）。

【关键规则 - 必须严格遵守】
1. 你当前只需要撰写 ${batchLabel} 的内容，不要写其他章节
2. 每个章节的字数必须严格控制在指定范围内，既不能太少也不能超标
3. 如果某章节字数接近上限，必须立即收尾转入下一节，不要继续展开
4. 直接输出Markdown格式的文档内容，不要包含任何额外说明或重复标题
5. 语言学术规范，适当使用表格、列表增强可读性
6. 技术描述要具体，避免空泛的概述`;

      const userContent = isFirst
        ? `请撰写以下毕业设计说明书的 ${batchLabel}。

## 论文题目
${title}

## 功能需求
${requirementsText}
${readmeSummary}

【重要提醒】
- 你当前只需要写 ${batchLabel}，不要写其他章节
- 每个章节的字数必须严格控制在指定范围内
- 如果某章字数接近上限就收尾，确保所有指定章节都能写完

${batch.chapters}`
        : `继续撰写以下毕业设计说明书的 ${batchLabel}。

【重要提醒】
- 你当前只需要写 ${batchLabel}，不要写其他章节
- 每个章节的字数必须严格控制在指定范围内
- 如果某章字数接近上限就收尾，确保所有指定章节都能写完

${batch.chapters}`;

      return { system: systemContent, user: userContent };
    });

    // 创建一个合并流，依次生成3批内容
    const readableStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        for (let i = 0; i < allMessages.length; i++) {
          const { system: systemContent, user: userContent } = allMessages[i];

          try {
            const stream = await client.chat.completions.create({
              model: AI_CONFIG.models.designDoc,
              messages: [
                { role: 'system', content: systemContent },
                { role: 'user', content: userContent },
              ],
              stream: true,
              ...AI_CONFIG.params.designDoc,
            });

            // 批次之间插入分隔标记（前端可用于显示进度）
            if (i > 0) {
              controller.enqueue(encoder.encode('\n\n---\n\n'));
            }

            for await (const chunk of stream) {
              const content = chunk.choices[0]?.delta?.content;
              if (content) {
                controller.enqueue(encoder.encode(content));
              }
            }
          } catch (error) {
            if (error instanceof Error && error.message.includes('ERR_INVALID_STATE')) {
              try { controller.close(); } catch { /* already closed */ }
              return;
            }
            console.error(`Design doc batch ${i + 1} error:`, error);
            try { controller.error(error); } catch { /* already closed */ }
            return;
          }
        }

        controller.close();
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
    console.error('Generate design doc error:', error);
    return NextResponse.json({ error: '设计说明书生成失败，请重试' }, { status: 500 });
  }
}
