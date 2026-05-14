import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';

export async function POST(request: NextRequest) {
  try {
    const { files, title, designDoc, readme } = (await request.json()) as {
      files?: Array<{ path: string; content: string }>;
      title?: string;
      designDoc?: string;
      readme?: string;
    };

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: '没有可打包的文件' }, { status: 400 });
    }

    const projectName = title
      ? title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_').substring(0, 50)
      : 'graduation-project';

    const zip = new JSZip();

    // Add code files to zip
    for (const file of files) {
      zip.file(`${projectName}/${file.path}`, file.content);
    }

    // Add README.md
    if (readme) {
      zip.file(`${projectName}/README.md`, readme);
    }

    // Add CLAUDE.md for Claude Code permissions
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

    // Add 设计说明书
    if (designDoc) {
      zip.file(`${projectName}/设计说明书.md`, designDoc);
    }

    // ---- 生成配套 package.json（供 运行.bat 使用）----
    // 从AI生成的代码中提取package.json，如果没有则生成一个基础的
    const existingPkg = files.find((f) => f.path === 'package.json');
    let packageJsonContent = '';

    if (existingPkg) {
      // 用AI生成的package.json，但确保有scripts
      try {
        const pkg = JSON.parse(existingPkg.content);
        if (!pkg.scripts) pkg.scripts = {};
        if (!pkg.scripts.dev) pkg.scripts.dev = 'next dev';
        if (!pkg.scripts.build) pkg.scripts.build = 'next build';
        if (!pkg.scripts.start) pkg.scripts.start = 'next start';
        packageJsonContent = JSON.stringify(pkg, null, 2);
      } catch {
        packageJsonContent = existingPkg.content;
      }
    } else {
      packageJsonContent = JSON.stringify({
        name: projectName.toLowerCase().replace(/_/g, '-'),
        version: '1.0.0',
        description: title || 'Graduation Project',
        scripts: {
          dev: 'next dev',
          build: 'next build',
          start: 'next start',
        },
        dependencies: {
          next: '^14.2.0',
          react: '^18.3.0',
          'react-dom': '^18.3.0',
        },
      }, null, 2);
      // 同时补到代码文件列表中
      zip.file(`${projectName}/package.json`, packageJsonContent);
    }

    // ---- 生成 运行.bat ----
    const batContent = `@echo off
chcp 65001 >nul 2>&1
title ${title || 'Graduation Project'} - 一键运行

echo.
echo ========================================
echo   ${title || 'Graduation Project'}
echo   一键配置环境并运行
echo ========================================
echo.

:: 检查 Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，正在尝试安装...
    echo.
    echo 请前往 https://nodejs.org/ 下载并安装 Node.js 18+ 版本
    echo 安装完成后重新运行此脚本
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo [OK] Node.js 版本: %NODE_VER%

:: 检查 pnpm
where pnpm >nul 2>&1
if %errorlevel% neq 0 (
    echo [提示] 未检测到 pnpm，正在安装...
    npm install -g pnpm
    if %errorlevel% neq 0 (
        echo [错误] pnpm 安装失败，请手动执行: npm install -g pnpm
        pause
        exit /b 1
    )
)

for /f "tokens=*" %%i in ('pnpm -v') do set PNPM_VER=%%i
echo [OK] pnpm 版本: %PNPM_VER%

echo.
echo ----------------------------------------
echo   步骤 1/3: 安装项目依赖
echo ----------------------------------------
echo.

pnpm install
if %errorlevel% neq 0 (
    echo [错误] 依赖安装失败，请检查网络连接后重试
    pause
    exit /b 1
)

echo.
echo [OK] 依赖安装完成！

echo.
echo ----------------------------------------
echo   步骤 2/3: 构建项目
echo ----------------------------------------
echo.

pnpm build
if %errorlevel% neq 0 (
    echo [警告] 构建失败，尝试直接启动开发模式...
    echo.
    echo ----------------------------------------
    echo   启动开发模式
    echo ----------------------------------------
    echo.
    pnpm dev
    goto :end
)

echo.
echo [OK] 项目构建完成！

echo.
echo ----------------------------------------
echo   步骤 3/3: 启动服务
echo ----------------------------------------
echo.

echo 正在启动服务...
echo 启动后请在浏览器中访问: http://localhost:3000
echo 按 Ctrl+C 可停止服务
echo.

pnpm start

:end
pause
`;
    zip.file(`${projectName}/运行.bat`, batContent);

    // ---- 生成 先看我.txt ----
    const fileTree: Record<string, string[]> = {};
    files.forEach((file) => {
      const parts = file.path.split('/');
      const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '.';
      if (!fileTree[dir]) fileTree[dir] = [];
      fileTree[dir].push(parts[parts.length - 1]);
    });

    let treeText = '';
    Object.entries(fileTree).forEach(([dir, dirFiles]) => {
      treeText += `${dir}/\n`;
      dirFiles.forEach((f) => {
        treeText += `  - ${f}\n`;
      });
    });

    const readmeMdContent = readme || '（未生成）';
    const designDocContent = designDoc || '（未生成）';

    const readMeTxt = `====================================
  ${title || 'Graduation Project'} - 项目说明
====================================

亲爱的用户，你好！

本压缩包由「毕业设计 AI 助手」自动生成，包含以下内容：

【项目结构】
${treeText}
【文件说明】

1. README.md
   项目的完整技术文档，包含技术栈、功能模块、数据库设计、API接口等详细说明。
   AI编程助手（如 Claude Code）可根据此文档完成项目的全部代码开发。

2. CLAUDE.md
   Claude Code 权限配置文件，授予 AI 读写文件、执行命令等必要权限。
   使用 Claude Code 打开项目目录时会自动读取此文件。

3. 设计说明书.md
   毕业设计论文的设计说明书初稿，约1.8万-2万字。
   包含项目概述、需求分析、系统设计、数据库设计、详细设计、系统测试等完整章节。
   可作为毕业论文的参考基础，请根据实际情况修改完善。

4. src/ 等代码目录
   AI 根据 README.md 文档自动生成的项目源代码，可直接运行。

5. 运行.bat
   Windows 一键运行脚本，双击即可自动配置环境并启动项目。
   脚本会自动检测并安装 Node.js 和 pnpm（如未安装），
   然后安装依赖、构建项目、启动服务。

【使用方式】

方式一：一键运行（Windows 推荐）
  1. 解压项目目录
  2. 双击「运行.bat」文件
  3. 等待自动配置环境、安装依赖、构建项目
  4. 浏览器访问 http://localhost:3000

方式二：使用 Claude Code 开发
  1. 解压项目目录
  2. 在终端中进入项目目录
  3. 运行 claude 命令启动 Claude Code
  4. AI 会自动读取 CLAUDE.md 和 README.md，获得完整的项目上下文
  5. 向 AI 下达开发指令即可

方式三：手动开发
  1. 解压项目目录
  2. 运行 pnpm install 安装依赖
  3. 运行 pnpm dev 启动开发服务器
  4. 参考 README.md 中的功能说明进行开发

【README.md 摘要】
${readmeMdContent.slice(0, 500)}${readmeMdContent.length > 500 ? '\n...（完整内容请查看 README.md）' : ''}

【设计说明书.md 摘要】
${designDocContent.slice(0, 500)}${designDocContent.length > 500 ? '\n...（完整内容请查看 设计说明书.md）' : ''}

====================================

设计说明书仅供参考
`;
    zip.file(`${projectName}/先看我.txt`, readMeTxt);

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
