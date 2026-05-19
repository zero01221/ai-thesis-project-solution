import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';

// ============================================================
// Project type detection
// ============================================================

interface ProjectAnalysis {
  /** Main project type */
  type: string;
  /** Whether project has a separate frontend directory */
  hasFrontend: boolean;
  /** Frontend directory path (relative) */
  frontendDir: string;
  /** Whether project has a separate backend directory */
  hasBackend: boolean;
  /** Backend directory path (relative) */
  backendDir: string;
  /** Backend technology */
  backendTech: string;
  /** Frontend technology */
  frontendTech: string;
  /** Whether project has infrastructure directory */
  hasInfrastructure: boolean;
  /** Infrastructure directory path */
  infraDir: string;
}

function analyzeProject(files: Array<{ path: string; content: string }>): ProjectAnalysis {
  const paths = files.map((f) => f.path.toLowerCase());
  const contents = files.map((f) => f.content.toLowerCase());

  // Detect frontend directory
  let hasFrontend = false;
  let frontendDir = '';
  let frontendTech = '';

  // Check for frontend/ directory patterns
  const frontendPatterns = ['frontend/', 'front-end/', 'web/', 'client/'];
  for (const pattern of frontendPatterns) {
    if (paths.some((p) => p.startsWith(pattern))) {
      hasFrontend = true;
      frontendDir = pattern.replace(/\/$/, '');
      break;
    }
  }

  // If no standard frontend directory, check if there's a Vue/React project inside any subdirectory
  if (!hasFrontend) {
    for (const p of paths) {
      if (p.includes('/package.json') && !p.startsWith('backend/')) {
        const dir = p.split('/').slice(0, -1).join('/');
        if (dir && dir !== '.') {
          // Check if this directory has Vue/React indicators
          const dirFiles = paths.filter((fp) => fp.startsWith(dir + '/'));
          if (dirFiles.some((fp) => fp.includes('vite.config') || fp.includes('vue') || fp.includes('react'))) {
            hasFrontend = true;
            frontendDir = dir;
            break;
          }
        }
      }
    }
  }

  // Detect frontend technology
  if (hasFrontend) {
    const frontendPaths = paths.filter((p) => p.startsWith(frontendDir.toLowerCase() + '/'));
    const frontendContents = files
      .filter((f) => f.path.toLowerCase().startsWith(frontendDir.toLowerCase() + '/'))
      .map((f) => f.content.toLowerCase());

    if (frontendPaths.some((p) => p.includes('vite.config') && frontendContents.some((c) => c.includes('vue')))) {
      frontendTech = 'vue';
    } else if (frontendPaths.some((p) => p.includes('next.config'))) {
      frontendTech = 'nextjs';
    } else if (frontendContents.some((c) => c.includes('react'))) {
      frontendTech = 'react';
    } else {
      frontendTech = 'node';
    }
  }

  // Detect backend directory
  let hasBackend = false;
  let backendDir = '';
  let backendTech = '';

  const backendPatterns = ['backend/', 'back-end/', 'server/', 'api/'];
  for (const pattern of backendPatterns) {
    if (paths.some((p) => p.startsWith(pattern))) {
      hasBackend = true;
      backendDir = pattern.replace(/\/$/, '');
      break;
    }
  }

  // Detect backend technology
  if (hasBackend) {
    const backendPaths = paths.filter((p) => p.startsWith(backendDir.toLowerCase() + '/'));
    const backendContents = files
      .filter((f) => f.path.toLowerCase().startsWith(backendDir.toLowerCase() + '/'))
      .map((f) => f.content.toLowerCase());

    if (backendPaths.some((p) => p.includes('pom.xml') || p.includes('build.gradle'))) {
      backendTech = 'java';
    } else if (backendContents.some((c) => c.includes('spring-boot') || c.includes('@springbootapplication'))) {
      backendTech = 'java';
    } else if (backendPaths.some((p) => p.includes('requirements.txt') || p.includes('manage.py'))) {
      backendTech = 'python';
    } else if (backendContents.some((c) => c.includes('flask') || c.includes('django'))) {
      backendTech = 'python';
    } else {
      backendTech = 'node';
    }
  }

  // If no backend directory, detect from root
  if (!hasBackend) {
    if (paths.some((p) => p.includes('pom.xml') || p.includes('build.gradle'))) {
      backendTech = 'java';
    } else if (contents.some((c) => c.includes('spring-boot') || c.includes('@springbootapplication'))) {
      backendTech = 'java';
    } else if (paths.some((p) => p.includes('requirements.txt') || p.includes('manage.py'))) {
      backendTech = 'python';
    }
  }

  // Detect infrastructure directory
  let hasInfrastructure = false;
  let infraDir = '';
  const infraPatterns = ['infrastructure/', 'docker/', 'deploy/', 'docker-compose'];
  for (const pattern of infraPatterns) {
    if (paths.some((p) => p.toLowerCase().startsWith(pattern.toLowerCase()))) {
      hasInfrastructure = true;
      infraDir = pattern.replace(/\/$/, '');
      break;
    }
  }

  // Determine main type
  let type = 'node';
  if (hasBackend && hasFrontend) {
    type = `fullstack-${backendTech}-${frontendTech}`;
  } else if (hasBackend && backendTech === 'java') {
    type = 'java';
  } else if (hasBackend && backendTech === 'python') {
    type = 'python';
  } else if (hasFrontend && frontendTech === 'vue') {
    type = 'vue';
  } else if (hasFrontend && frontendTech === 'nextjs') {
    type = 'nextjs';
  } else if (hasFrontend && frontendTech === 'react') {
    type = 'react';
  } else if (paths.some((p) => p.includes('pom.xml'))) {
    type = 'java';
  } else if (paths.some((p) => p.includes('requirements.txt'))) {
    type = 'python';
  } else if (paths.some((p) => p.includes('next.config'))) {
    type = 'nextjs';
  } else if (paths.some((p) => p.endsWith('.html') && !paths.some((p2) => p2.includes('package.json')))) {
    type = 'html';
  }

  return {
    type,
    hasFrontend,
    frontendDir,
    hasBackend,
    backendDir,
    backendTech,
    frontendTech,
    hasInfrastructure,
    infraDir,
  };
}

// ============================================================
// Generate run.bat
// ============================================================

function generateRunBat(title: string, analysis: ProjectAnalysis): Buffer {
  const projectName = title
    ? title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_').substring(0, 50)
    : 'graduation-project';

  let batContent = `@echo off
chcp 65001 >nul 2>&1
title ${title || 'Graduation Project'} - 一键运行

echo ========================================
echo   ${title || 'Graduation Project'}
echo   一键配置与运行脚本
echo ========================================
echo.

`;

  // === Java Backend section ===
  if (analysis.backendTech === 'java' || analysis.type === 'java') {
    const backendPath = analysis.hasBackend ? analysis.backendDir : '.';
    batContent += `
:: ==========================================
::  后端部分 (Java / Spring Boot)
:: ==========================================

echo [后端] 检查 Java 环境...
java -version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [错误] 未检测到 Java 运行环境！
    echo.
    echo 请安装 JDK 17 或更高版本：
    echo   https://adoptium.net/zh-CN/
    echo   https://www.oracle.com/java/technologies/downloads/
    echo.
    echo 安装完成后重新运行此脚本。
    pause
    exit /b 1
)
echo Java 已就绪:
java -version 2>&1 | findstr /i "version"
echo.

echo [后端] 检查 Maven 环境...
mvn -version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [错误] 未检测到 Maven！
    echo.
    echo 请安装 Apache Maven：
    echo   https://maven.apache.org/download.cgi
    echo.
    echo 或者使用项目自带的 Maven Wrapper (mvnw)。
    echo 安装完成后重新运行此脚本。
    pause
    exit /b 1
)
echo Maven 已就绪:
mvn -version 2>&1 | findstr /i "Apache Maven"
echo.

echo [后端] 编译并启动 Spring Boot 项目...
cd /d "%~dp0${backendPath === '.' ? '' : backendPath}"

:: 先尝试 Maven Wrapper
if exist "mvnw.cmd" (
    echo 使用 Maven Wrapper 编译...
    call mvnw.cmd clean package -DskipDependencies -q
    if %errorlevel% equ 0 (
        echo 编译成功！启动后端服务...
        start "后端服务 - Spring Boot" cmd /k "mvnw.cmd spring-boot:run"
        echo 后端服务已在新窗口启动（默认端口 8080）
    ) else (
        echo Maven Wrapper 编译失败，尝试系统 Maven...
        call mvn clean package -DskipDependencies -q
        if %errorlevel% equ 0 (
            start "后端服务 - Spring Boot" cmd /k "mvn spring-boot:run"
            echo 后端服务已在新窗口启动（默认端口 8080）
        ) else (
            echo [错误] 后端编译失败，请检查代码和依赖。
        )
    )
) else (
    call mvn clean package -DskipDependencies -q
    if %errorlevel% equ 0 (
        echo 编译成功！启动后端服务...
        start "后端服务 - Spring Boot" cmd /k "mvn spring-boot:run"
        echo 后端服务已在新窗口启动（默认端口 8080）
    ) else (
        echo [错误] 后端编译失败，请检查代码和依赖。
    )
)
cd /d "%~dp0"
echo.

`;
  }

  // === Python Backend section ===
  if (analysis.backendTech === 'python' || analysis.type === 'python') {
    const backendPath = analysis.hasBackend ? analysis.backendDir : '.';
    batContent += `
:: ==========================================
::  后端部分 (Python)
:: ==========================================

echo [后端] 检查 Python 环境...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [错误] 未检测到 Python！
    echo.
    echo 请安装 Python 3.9+：
    echo   https://www.python.org/downloads/
    echo.
    pause
    exit /b 1
)
echo Python 已就绪:
python --version
echo.

echo [后端] 安装 Python 依赖...
cd /d "%~dp0${backendPath === '.' ? '' : backendPath}"
pip install -r requirements.txt -q
if %errorlevel% neq 0 (
    echo [警告] 依赖安装可能有问题，继续尝试启动...
)
echo.

echo [后端] 启动 Python 服务...
start "后端服务 - Python" cmd /k "python app.py"
echo 后端服务已在新窗口启动
cd /d "%~dp0"
echo.

`;
  }

  // === Frontend section ===
  if (analysis.hasFrontend) {
    const frontendPath = analysis.frontendDir;
    batContent += `
:: ==========================================
::  前端部分 (${analysis.frontendTech === 'vue' ? 'Vue' : analysis.frontendTech === 'nextjs' ? 'Next.js' : analysis.frontendTech === 'react' ? 'React' : 'Node.js'})
:: ==========================================

echo [前端] 检查 Node.js 环境...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [错误] 未检测到 Node.js！
    echo.
    echo 请安装 Node.js 18+：
    echo   https://nodejs.org/zh-cn/download/
    echo.
    pause
    exit /b 1
)
echo Node.js 已就绪:
node --version
echo.

echo [前端] 检查包管理器...
pnpm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo pnpm 未安装，使用 npm...
    set "FE_PKG=npm"
) else (
    echo pnpm 已就绪
    set "FE_PKG=pnpm"
)
echo.

echo [前端] 安装前端依赖...
cd /d "%~dp0${frontendPath}"
if "%FE_PKG%"=="pnpm" (
    pnpm install
) else (
    npm install
)
if %errorlevel% neq 0 (
    echo [错误] 前端依赖安装失败，请检查网络连接。
    pause
    exit /b 1
)
echo.

echo [前端] 启动前端开发服务器...
start "前端开发服务器" cmd /k "cd /d "%~dp0${frontendPath}" && if "%FE_PKG%"=="pnpm" (pnpm dev) else (npm run dev)"
echo 前端开发服务器已在新窗口启动
cd /d "%~dp0"
echo.

`;
  }

  // === Pure Node.js project (no separated frontend/backend) ===
  if (!analysis.hasBackend && !analysis.hasFrontend && ['nextjs', 'vue', 'react', 'node'].includes(analysis.type)) {
    batContent += `
:: ==========================================
::  Node.js 项目
:: ==========================================

echo [1/3] 检查 Node.js 环境...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [错误] 未检测到 Node.js！
    echo.
    echo 请安装 Node.js 18+：
    echo   https://nodejs.org/zh-cn/download/
    echo.
    pause
    exit /b 1
)
echo Node.js 已就绪:
node --version
echo.

echo [2/3] 安装项目依赖...
cd /d "%~dp0"
pnpm --version >nul 2>&1
if %errorlevel% neq 0 (
    npm install
    if %errorlevel% neq 0 (
        echo [错误] 依赖安装失败。
        pause
        exit /b 1
    )
    echo 依赖安装完成。
    echo.
    echo [3/3] 启动项目...
    npm run dev
) else (
    pnpm install
    if %errorlevel% neq 0 (
        echo [错误] 依赖安装失败。
        pause
        exit /b 1
    )
    echo 依赖安装完成。
    echo.
    echo [3/3] 启动项目...
    pnpm dev
)

`;
  }

  // === Pure HTML project ===
  if (analysis.type === 'html') {
    batContent += `
:: ==========================================
::  纯 HTML 项目
:: ==========================================

echo 项目为纯 HTML 项目，正在打开 index.html...
cd /d "%~dp0"
if exist "index.html" (
    start index.html
    echo 已在浏览器中打开 index.html
) else (
    echo [错误] 未找到 index.html 文件。
)

`;
  }

  // === Infrastructure section ===
  if (analysis.hasInfrastructure) {
    batContent += `
:: ==========================================
::  基础设施提示
:: ==========================================

echo [提示] 项目包含基础设施配置目录 (${analysis.infraDir}/)
echo   如果需要数据库等服务，请确保：
echo   - MySQL 已启动（默认端口 3306）
echo   - Redis 已启动（默认端口 6379）
echo   - 其他服务请参考 README.md 中的说明
echo.

`;
  }

  batContent += `
echo ========================================
echo   启动完成！
echo ========================================
echo.
echo 如果浏览器没有自动打开，请手动访问对应地址。
echo 按 Ctrl+C 可停止服务。
echo.
pause
`;

  const bom = Buffer.from([0xef, 0xbb, 0xbf]);
  const contentBuf = Buffer.from(batContent, 'utf-8');
  return Buffer.concat([bom, contentBuf]);
}

// ============================================================
// Generate 先看我.txt
// ============================================================

function generateReadMeTxt(
  title: string,
  analysis: ProjectAnalysis,
  fileTree: string,
  readmeContent: string,
  designDocContent: string,
): string {
  // Generate project-type-specific manual development instructions
  let manualInstructions = '';

  if (analysis.hasBackend && analysis.hasFrontend) {
    // Fullstack project
    const backendLabel = analysis.backendTech === 'java' ? 'Spring Boot 后端' : analysis.backendTech === 'python' ? 'Python 后端' : '后端';
    const frontendLabel = analysis.frontendTech === 'vue' ? 'Vue 前端' : analysis.frontendTech === 'react' ? 'React 前端' : analysis.frontendTech === 'nextjs' ? 'Next.js 前端' : '前端';

    manualInstructions = `方式三：手动开发
  1. 解压项目目录

  【后端 - ${backendLabel}】
  1. 进入 ${analysis.backendDir}/ 目录
  ${analysis.backendTech === 'java' ? `2. 确保已安装 JDK 17+ 和 Maven
  3. 运行 mvn clean package -DskipDependencies 编译项目
  4. 运行 mvn spring-boot:run 启动后端服务（默认端口 8080）` : analysis.backendTech === 'python' ? `2. 确保已安装 Python 3.9+
  3. 运行 pip install -r requirements.txt 安装依赖
  4. 运行 python app.py 启动后端服务` : `2. 运行 pnpm install 安装依赖
  3. 运行 pnpm dev 启动后端服务`}

  【前端 - ${frontendLabel}】
  1. 进入 ${analysis.frontendDir}/ 目录
  2. 确保已安装 Node.js 18+
  3. 运行 pnpm install 安装前端依赖
  4. 运行 pnpm dev 启动前端开发服务器（默认端口 5173 或 3000）

  【基础设施】
  ${analysis.hasInfrastructure ? `1. 确保 MySQL、Redis 等基础服务已启动
  2. 参考 ${analysis.infraDir}/ 目录下的配置文件
  3. 数据库连接信息请查看后端配置文件（如 application.yml）` : `1. 确保项目所需的数据库等基础服务已启动
  2. 数据库连接信息请查看后端配置文件`}`;
  } else if (analysis.type === 'java') {
    manualInstructions = `方式三：手动开发
  1. 解压项目目录
  2. 确保已安装 JDK 17+ 和 Maven
  3. 进入项目目录，运行 mvn clean package -DskipDependencies 编译
  4. 运行 mvn spring-boot:run 启动服务（默认端口 8080）
  5. 确保数据库（MySQL等）已启动并配置正确
  6. 参考 README.md 中的功能说明进行开发`;
  } else if (analysis.type === 'python') {
    manualInstructions = `方式三：手动开发
  1. 解压项目目录
  2. 确保已安装 Python 3.9+
  3. 运行 pip install -r requirements.txt 安装依赖
  4. 运行 python app.py 启动服务
  5. 确保数据库等基础服务已启动
  6. 参考 README.md 中的功能说明进行开发`;
  } else if (['nextjs', 'vue', 'react', 'node'].includes(analysis.type)) {
    manualInstructions = `方式三：手动开发
  1. 解压项目目录
  2. 确保已安装 Node.js 18+
  3. 运行 pnpm install 安装依赖
  4. 运行 pnpm dev 启动开发服务器
  5. 参考 README.md 中的功能说明进行开发`;
  } else if (analysis.type === 'html') {
    manualInstructions = `方式三：手动开发
  1. 解压项目目录
  2. 直接在浏览器中打开 index.html
  3. 或使用 npx serve 启动本地服务器
  4. 参考 README.md 中的功能说明进行开发`;
  } else {
    manualInstructions = `方式三：手动开发
  1. 解压项目目录
  2. 根据项目技术栈安装对应依赖
  3. 参考 README.md 中的功能说明启动项目`;
  }

  return `====================================
  ${title || 'Graduation Project'} - 项目说明
====================================

亲爱的用户，你好！

本压缩包由「毕业设计 AI 助手」自动生成，包含以下内容：

【项目结构】
${fileTree}
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

4. 代码目录
   AI 根据 README.md 文档自动生成的项目源代码。

5. 运行.bat
   Windows 一键运行脚本，双击即可自动配置环境并启动项目。

【使用方式】

方式一：一键运行（Windows）
  1. 解压项目目录
  2. 双击「运行.bat」
  3. 脚本会自动检测并安装所需环境，然后启动项目

方式二：使用 Claude Code 开发
  1. 解压项目目录
  2. 在终端中进入项目目录
  3. 运行 claude 命令启动 Claude Code
  4. AI 会自动读取 CLAUDE.md 和 README.md，获得完整的项目上下文

${manualInstructions}

【README.md 摘要】
${readmeContent.slice(0, 500)}${readmeContent.length > 500 ? '\n...（完整内容请查看 README.md）' : ''}

【设计说明书.md 摘要】
${designDocContent.slice(0, 500)}${designDocContent.length > 500 ? '\n...（完整内容请查看 设计说明书.md）' : ''}

====================================

设计说明书仅供参考
`;
}

// ============================================================
// Generate CLAUDE.md
// ============================================================

function generateClaudeMd(title: string, analysis: ProjectAnalysis): string {
  let quickStart = '';

  if (analysis.hasBackend && analysis.hasFrontend) {
    const backendBlock = analysis.backendTech === 'java'
      ? `# 后端 (Spring Boot)
cd ${analysis.backendDir}
mvn clean package -DskipDependencies
mvn spring-boot:run`
      : analysis.backendTech === 'python'
        ? `# 后端 (Python)
cd ${analysis.backendDir}
pip install -r requirements.txt
python app.py`
        : `# 后端
cd ${analysis.backendDir}
pnpm install
pnpm dev`;

    const frontendBlock = `# 前端
cd ${analysis.frontendDir}
pnpm install
pnpm dev`;

    quickStart = `${backendBlock}

${frontendBlock}`;
  } else if (analysis.type === 'java') {
    quickStart = `# 编译并运行
mvn clean package -DskipDependencies
mvn spring-boot:run`;
  } else if (analysis.type === 'python') {
    quickStart = `# 安装依赖并运行
pip install -r requirements.txt
python app.py`;
  } else if (analysis.type === 'html') {
    quickStart = `# 直接在浏览器中打开
start index.html
# 或启动本地服务器
npx serve -l 3000`;
  } else {
    quickStart = `# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建生产版本
pnpm build`;
  }

  return `# ${title || 'Graduation Project'}

## Claude Code 权限配置

本项目已授予 Claude Code 以下权限：

- 文件读写权限：允许读写项目中的所有文件
- 命令执行权限：允许执行构建命令、包管理命令等
- 网络访问权限：允许安装依赖包

## 项目说明

请根据 README.md 中的详细描述完成项目的代码开发和调试。

## 快速开始

\`\`\`bash
${quickStart}
\`\`\`
`;
}

// ============================================================
// Main handler
// ============================================================

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

    const analysis = analyzeProject(files);

    const zip = new JSZip();

    // Add code files to zip
    for (const file of files) {
      zip.file(`${projectName}/${file.path}`, file.content);
    }

    // Add README.md
    if (readme) {
      zip.file(`${projectName}/README.md`, readme);
    }

    // Add CLAUDE.md (project-type-aware)
    zip.file(`${projectName}/CLAUDE.md`, generateClaudeMd(title || 'Graduation Project', analysis));

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

    // Add 先看我.txt (project-type-aware)
    const readMeTxt = generateReadMeTxt(
      title || 'Graduation Project',
      analysis,
      treeText,
      readme || '（未生成）',
      designDoc || '（未生成）',
    );
    zip.file(`${projectName}/先看我.txt`, readMeTxt);

    // Add 运行.bat (project-type-aware)
    const runBatBuffer = generateRunBat(title || 'Graduation Project', analysis);
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
