import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';

// Detect project type from code files
function detectProjectType(files: Array<{ path: string; content: string }>): string {
  const paths = files.map((f) => f.path.toLowerCase());
  const contents = files.map((f) => f.content.toLowerCase());

  // Spring Boot / Java
  if (paths.some((p) => p.includes('pom.xml') || p.includes('build.gradle'))) return 'java';
  if (contents.some((c) => c.includes('spring-boot') || c.includes('@springbootapplication')))
    return 'java';

  // Python
  if (paths.some((p) => p.includes('requirements.txt') || p.includes('manage.py'))) return 'python';
  if (contents.some((c) => c.includes('flask') || c.includes('django'))) return 'python';

  // Vue
  if (paths.some((p) => p.includes('vite.config') && contents.some((c) => c.includes('vue'))))
    return 'vue';
  if (contents.some((c) => c.includes('@vitejs/plugin-vue'))) return 'vue';

  // Next.js
  if (paths.some((p) => p.includes('next.config'))) return 'nextjs';
  if (contents.some((c) => c.includes('next') && c.includes('react'))) return 'nextjs';

  // React (Vite)
  if (contents.some((c) => c.includes('react') && c.includes('vite'))) return 'react';

  // Mini program
  if (paths.some((p) => p.includes('app.json') && p.includes('project.config.json')))
    return 'miniprogram';

  // Pure HTML
  if (paths.some((p) => p.endsWith('.html')) && !paths.some((p) => p.includes('package.json')))
    return 'html';

  return 'node';
}

// Generate package.json based on project files
function generatePackageJson(
  title: string,
  files: Array<{ path: string; content: string }>,
): string {
  const projectType = detectProjectType(files);
  const safeName = title
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase()
    .substring(0, 50);

  // Check if project already has a package.json
  const existingPkg = files.find((f) => f.path === 'package.json' || f.path.endsWith('/package.json'));
  if (existingPkg) {
    return existingPkg.content;
  }

  // Generate based on project type
  const pkgTemplates: Record<string, object> = {
    nextjs: {
      name: safeName,
      version: '1.0.0',
      private: true,
      scripts: {
        dev: 'next dev',
        build: 'next build',
        start: 'next start',
      },
      dependencies: {
        next: '^14.0.0',
        react: '^18.2.0',
        'react-dom': '^18.2.0',
      },
    },
    vue: {
      name: safeName,
      version: '1.0.0',
      private: true,
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'vite build',
        preview: 'vite preview',
      },
      dependencies: {
        vue: '^3.4.0',
      },
      devDependencies: {
        '@vitejs/plugin-vue': '^5.0.0',
        vite: '^5.0.0',
      },
    },
    react: {
      name: safeName,
      version: '1.0.0',
      private: true,
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'vite build',
        preview: 'vite preview',
      },
      dependencies: {
        react: '^18.2.0',
        'react-dom': '^18.2.0',
      },
      devDependencies: {
        '@vitejs/plugin-react': '^4.2.0',
        vite: '^5.0.0',
      },
    },
    node: {
      name: safeName,
      version: '1.0.0',
      private: true,
      type: 'module',
      scripts: {
        dev: 'node src/index.js',
        start: 'node src/index.js',
      },
      dependencies: {},
    },
  };

  const pkg = pkgTemplates[projectType] || pkgTemplates.node;
  return JSON.stringify(pkg, null, 2);
}

// Generate run.bat with BOM for Windows encoding
function generateRunBat(title: string): Buffer {
  const projectName = title
    ? title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_').substring(0, 50)
    : 'graduation-project';

  const batContent = `@echo off
chcp 65001 >nul 2>&1
title ${title || 'Graduation Project'} - 一键运行

echo ========================================
echo   ${title || 'Graduation Project'}
echo   一键配置与运行脚本
echo ========================================
echo.

:: Check Node.js
echo [1/4] 检查 Node.js 环境...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js 未安装，正在自动安装...
    echo.
    echo 正在下载 Node.js 安装程序...
    curl -L -o "%TEMP%\\node-installer.msi" https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi
    if %errorlevel% neq 0 (
        echo.
        echo [错误] 自动下载失败，请手动安装 Node.js:
        echo        https://nodejs.org/zh-cn/download/
        echo.
        echo 安装后重新运行此脚本即可。
        pause
        exit /b 1
    )
    echo.
    echo 正在安装 Node.js（请按提示完成安装）...
    msiexec /i "%TEMP%\\node-installer.msi" /passive /norestart
    if %errorlevel% neq 0 (
        echo.
        echo [错误] 安装失败，请手动安装 Node.js:
        echo        https://nodejs.org/zh-cn/download/
        pause
        exit /b 1
    )
    echo Node.js 安装完成！
    del "%TEMP%\\node-installer.msi" >nul 2>&1
)

echo Node.js 已就绪:
node --version
echo.

:: Check pnpm
echo [2/4] 检查 pnpm 包管理器...
pnpm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo pnpm 未安装，正在安装...
    npm install -g pnpm
    if %errorlevel% neq 0 (
        echo [错误] pnpm 安装失败，尝试使用 npm...
        set PKG_MANAGER=npm
    ) else (
        set PKG_MANAGER=pnpm
    )
) else (
    set PKG_MANAGER=pnpm
)
echo 包管理器: %PKG_MANAGER%
echo.

:: Install dependencies
echo [3/4] 安装项目依赖...
cd /d "%~dp0"
if exist "package.json" (
    if "%PKG_MANAGER%"=="pnpm" (
        pnpm install
    ) else (
        npm install
    )
    if %errorlevel% neq 0 (
        echo [错误] 依赖安装失败，请检查网络连接。
        pause
        exit /b 1
    )
) else (
    echo [警告] 未找到 package.json，跳过依赖安装。
    echo         如果是 Java 项目，请使用 Maven/Gradle 构建。
    echo         如果是 Python 项目，请使用 pip install -r requirements.txt。
)
echo.

:: Start project
echo [4/4] 启动项目...
echo ========================================
echo   项目启动中...
echo ========================================
echo.

if exist "package.json" (
    :: Node.js project
    %PKG_MANAGER% run dev
) else if exist "pom.xml" (
    :: Maven project
    mvn spring-boot:run
) else if exist "requirements.txt" (
    :: Python project
    pip install -r requirements.txt
    python app.py
) else if exist "index.html" (
    :: Pure HTML project
    echo 项目为纯 HTML 项目，请在浏览器中打开 index.html
    start index.html
) else (
    echo [提示] 未检测到标准项目结构，请参考 README.md 手动启动。
)

pause
`;

  // UTF-8 BOM + content for correct Windows encoding
  const bom = Buffer.from([0xef, 0xbb, 0xbf]);
  const contentBuf = Buffer.from(batContent, 'utf-8');
  return Buffer.concat([bom, contentBuf]);
}

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

    const projectType = detectProjectType(files);

    const zip = new JSZip();

    // Add code files to zip
    for (const file of files) {
      zip.file(`${projectName}/${file.path}`, file.content);
    }

    // Add or generate package.json (only for Node.js projects)
    if (['nextjs', 'vue', 'react', 'node'].includes(projectType)) {
      const pkgContent = generatePackageJson(title || 'graduation-project', files);
      // Only add if not already present
      if (!files.some((f) => f.path === 'package.json')) {
        zip.file(`${projectName}/package.json`, pkgContent);
      }
    }

    // Add README.md
    if (readme) {
      zip.file(`${projectName}/README.md`, readme);
    }

    // Add CLAUDE.md
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

    // Generate file tree text
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

【使用方式】

方式一：一键运行（Windows）
  1. 解压项目目录
  2. 双击「运行.bat」
  3. 脚本会自动检测并安装 Node.js、pnpm，然后启动项目

方式二：使用 Claude Code 开发
  1. 解压项目目录
  2. 在终端中进入项目目录
  3. 运行 claude 命令启动 Claude Code
  4. AI 会自动读取 CLAUDE.md 和 README.md，获得完整的项目上下文

方式三：手动开发
  1. 解压项目目录
  2. 运行 pnpm install 安装依赖（Node.js项目）
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

    // Add 运行.bat with UTF-8 BOM encoding
    const runBatBuffer = generateRunBat(title || 'Graduation Project');
    zip.file(`${projectName}/运行.bat`, runBatBuffer);

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
