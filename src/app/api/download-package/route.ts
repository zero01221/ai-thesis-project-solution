import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';

export async function POST(request: NextRequest) {
  try {
    const { files, title } = (await request.json()) as {
      files?: Array<{ path: string; content: string }>;
      title?: string;
    };

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: '没有可打包的文件' }, { status: 400 });
    }

    const projectName = title
      ? title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_').substring(0, 50)
      : 'graduation-project';

    const zip = new JSZip();

    // Add files to zip
    for (const file of files) {
      zip.file(`${projectName}/${file.path}`, file.content);
    }

    // Also add a CLAUDE.md file for Claude Code permissions
    const claudeMd = `# ${title || 'Graduation Project'}

## Claude Code 权限配置

本项目已授予 Claude Code 以下权限：

- 文件读写权限：允许读写项目中的所有文件
- 命令执行权限：允许执行 npm/pnpm 命令、构建命令等
- 网络访问权限：允许安装依赖包

## 项目说明

请根据 README.md 中的详细描述完成项目的代码开发和调试。

## 快速开始

\`\`\`bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建生产版本
pnpm build
\`\`\`
`;
    zip.file(`${projectName}/CLAUDE.md`, claudeMd);

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

    return new Response(zipBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(projectName)}.zip`,
        'Content-Length': zipBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Download package error:', error);
    return NextResponse.json({ error: '打包下载失败，请重试' }, { status: 500 });
  }
}
