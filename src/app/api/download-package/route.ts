import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';

import type { ProjectAnalysis } from '@/types/project';
import { analyzeProject, typeInfoToAnalysis } from '@/lib/project-type-registry';
import { DownloadPackageSchema, validateRequest } from '@/lib/api-validation';

// Convert ProjectTypeInfo to ProjectAnalysis for compatibility
function typeInfoToAnalysis(info: ProjectTypeInfo): ProjectAnalysis {
  const hasBackend = !['vue-frontend', 'react-frontend', 'html-static', 'nextjs'].includes(info.type);
  const hasFrontend = !['python-web'].includes(info.type) && info.frontend.tech !== 'none';
  const isFullstack = hasBackend && hasFrontend;

  let backendDir = '.';
  let frontendDir = '.';
  if (isFullstack) {
    backendDir = 'backend';
    frontendDir = 'frontend';
  } else if (hasBackend) {
    backendDir = '.';
  } else if (hasFrontend) {
    frontendDir = '.';
  }

  const services: string[] = [];
  if (info.database !== 'none') services.push(info.database);
  if (info.needsCache) services.push('redis');

  return {
    type: info.type,
    hasFrontend,
    frontendDir,
    frontendTech: info.frontend.tech,
    hasBackend,
    backendDir,
    backendTech: info.backend.tech === 'spring-boot' ? 'java' : info.backend.tech === 'none' ? '' : info.backend.language,
    hasInfrastructure: services.length > 0,
    infraDir: 'docker',
    services,
    backendPort: info.backend.port,
    frontendPort: info.frontend.port,
  };
}

// ============================================================
// Generate .project.json
// ============================================================

function generateProjectJson(title: string, analysis: ProjectAnalysis, typeInfo: ProjectTypeInfo | null): string {
  const projectJson: Record<string, unknown> = {
    name: title,
    type: analysis.type,
    services: analysis.services,
  };

  if (typeInfo) {
    projectJson.typeLabel = typeInfo.label;
    projectJson.structureMode = typeInfo.structureMode;
  }

  if (analysis.hasBackend || analysis.backendTech) {
    const backendPath = analysis.hasBackend ? `./${analysis.backendDir}` : '.';
    if (analysis.backendTech === 'java') {
      projectJson.backend = {
        path: backendPath,
        tech: 'spring-boot',
        build: 'mvn clean package -DskipTests',
        run: 'mvn spring-boot:run',
        port: analysis.backendPort,
        requires: ['java', 'maven'],
      };
    } else if (analysis.backendTech === 'python') {
      projectJson.backend = {
        path: backendPath,
        tech: 'python',
        build: 'pip install -r requirements.txt',
        run: 'python app.py',
        port: analysis.backendPort,
        requires: ['python'],
      };
    } else {
      projectJson.backend = {
        path: backendPath,
        tech: 'node',
        build: 'pnpm install',
        run: 'pnpm dev',
        port: analysis.backendPort,
        requires: ['node'],
      };
    }
  }

  if (analysis.hasFrontend) {
    projectJson.frontend = {
      path: `./${analysis.frontendDir}`,
      tech: analysis.frontendTech,
      packageManager: 'pnpm',
      build: 'pnpm install',
      run: 'pnpm dev',
      port: analysis.frontendPort,
      requires: ['node'],
    };
  }

  if (analysis.hasInfrastructure) {
    projectJson.infrastructure = {
      path: `./${analysis.infraDir}`,
      services: analysis.services,
    };
  }

  return JSON.stringify(projectJson, null, 2);
}

// ============================================================
// Generate run.bat (Windows only)
// ============================================================

function generateRunBat(
  title: string,
  analysis: ProjectAnalysis,
): Buffer {
  const projectName = title
    ? title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_').substring(0, 50)
    : 'graduation-project';

  let bat = `@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion
title ${title || 'Graduation Project'} - 一键运行

echo.
echo ========================================
echo   ${title || projectName}
echo   一键配置与运行脚本
echo ========================================
echo.

set "ROOT_DIR=%~dp0"
cd /d "%ROOT_DIR%"

set "LOG_FILE=%ROOT_DIR%.bat_run.log"
echo [%date% %time%] 运行.bat 启动 > "%LOG_FILE%"

:: ==========================================
:: 阶段1: 项目类型检测
:: ==========================================
echo [1/4] 检测项目类型...
echo.

set "HAS_BACKEND=0"
set "HAS_FRONTEND=0"
set "BACKEND_PATH=."
set "FRONTEND_PATH=."
set "BACKEND_PORT=${analysis.backendPort}"
set "FRONTEND_PORT=${analysis.frontendPort}"

if exist "%ROOT_DIR%.project.json" (
    echo   [信息] 检测到 .project.json 项目配置文件
)

`;

  // Backend detection
  if (analysis.backendTech === 'java' || analysis.type === 'java') {
    const backendPath = analysis.hasBackend ? analysis.backendDir : '.';
    bat += `
set "BACKEND_PATH=${backendPath}"
set "HAS_BACKEND=1"
if exist "%ROOT_DIR%${backendPath === '.' ? '' : backendPath + '\\'}pom.xml" (
    echo   [后端] 检测到 Maven 项目
) else (
    set "HAS_BACKEND=0"
)
echo.
`;
  }

  if (analysis.backendTech === 'python' || analysis.type === 'python') {
    const backendPath = analysis.hasBackend ? analysis.backendDir : '.';
    bat += `
set "BACKEND_PATH=${backendPath}"
set "HAS_BACKEND=1"
if exist "%ROOT_DIR%${backendPath === '.' ? '' : backendPath + '\\'}requirements.txt" (
    echo   [后端] 检测到 Python 项目
) else (
    set "HAS_BACKEND=0"
)
echo.
`;
  }

  if (analysis.hasFrontend || ['nextjs', 'vue', 'react', 'node'].includes(analysis.type)) {
    const fePath = analysis.hasFrontend ? analysis.frontendDir : '.';
    bat += `
set "FRONTEND_PATH=${fePath}"
set "HAS_FRONTEND=1"
if exist "%ROOT_DIR%${fePath}\\package.json" (
    echo   [前端] 检测到 Node.js 项目
) else (
    set "HAS_FRONTEND=0"
)
echo.
`;
  }

  // Environment check
  bat += `
:: ==========================================
:: 阶段2: 环境检查
:: ==========================================
echo [2/4] 检查运行环境...
echo.

`;

  if (analysis.backendTech === 'java' || analysis.type === 'java') {
    bat += `
java -version >nul 2>&1
if %errorlevel% neq 0 (
    echo   [!] 未检测到 Java，请安装 JDK 17+
    echo   下载地址: https://adoptium.net/
    pause
    exit /b 1
) else (
    echo   [Java] 已就绪
)

mvn -version >nul 2>&1
if %errorlevel% neq 0 (
    if exist "%ROOT_DIR%%BACKEND_PATH%\\mvnw.cmd" (
        echo   [Maven] 使用 Maven Wrapper
    ) else (
        echo   [!] 未检测到 Maven，请安装 Apache Maven 3.9+
        pause
        exit /b 1
    )
) else (
    echo   [Maven] 已就绪
)
echo.
`;
  }

  if (analysis.backendTech === 'python' || analysis.type === 'python') {
    bat += `
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo   [!] 未检测到 Python，请安装 Python 3.9+
    pause
    exit /b 1
) else (
    echo   [Python] 已就绪
)
echo.
`;
  }

  if (analysis.hasFrontend || ['nextjs', 'vue', 'react', 'node'].includes(analysis.type)) {
    bat += `
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo   [!] 未检测到 Node.js，请安装 Node.js 18+
    pause
    exit /b 1
) else (
    echo   [Node.js] 已就绪
)

pnpm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo   [pnpm] 正在安装 pnpm...
    call npm install -g pnpm
)
echo.
`;
  }

  // Build phase
  bat += `
:: ==========================================
:: 阶段3: 构建项目
:: ==========================================
echo [3/4] 构建项目...
echo.

`;

  if (analysis.backendTech === 'java' || analysis.type === 'java') {
    const backendPath = analysis.hasBackend ? analysis.backendDir : '.';
    bat += `
if "%HAS_BACKEND%"=="1" (
    echo [后端] 编译项目...
    cd /d "%ROOT_DIR%${backendPath === '.' ? '' : backendPath}"
    if exist "mvnw.cmd" (
        call mvnw.cmd clean package -DskipTests -q
    ) else (
        call mvn clean package -DskipTests -q
    )
    if !errorlevel! neq 0 (
        echo   [错误] 编译失败！
        pause
        exit /b 1
    )
    echo   [后端] 编译成功！
    cd /d "%ROOT_DIR%"
)
`;
  }

  if (analysis.backendTech === 'python' || analysis.type === 'python') {
    const backendPath = analysis.hasBackend ? analysis.backendDir : '.';
    bat += `
if "%HAS_BACKEND%"=="1" (
    echo [后端] 安装依赖...
    cd /d "%ROOT_DIR%${backendPath === '.' ? '' : backendPath}"
    pip install -r requirements.txt -q
    cd /d "%ROOT_DIR%"
)
`;
  }

  if (analysis.hasFrontend || ['nextjs', 'vue', 'react', 'node'].includes(analysis.type)) {
    const fePath = analysis.hasFrontend ? analysis.frontendDir : '.';
    bat += `
if "%HAS_FRONTEND%"=="1" (
    echo [前端] 安装依赖...
    cd /d "%ROOT_DIR%${fePath}"
    pnpm --version >nul 2>&1
    if !errorlevel! equ 0 (
        call pnpm install
    ) else (
        call npm install
    )
    cd /d "%ROOT_DIR%"
)
`;
  }

  // Run phase
  bat += `
:: ==========================================
:: 阶段4: 启动项目
:: ==========================================
echo [4/4] 启动项目...
echo.

`;

  if (analysis.backendTech === 'java' || analysis.type === 'java') {
    const backendPath = analysis.hasBackend ? analysis.backendDir : '.';
    bat += `
if "%HAS_BACKEND%"=="1" (
    echo [后端] 启动服务...
    if exist "%ROOT_DIR%${backendPath === '.' ? '' : backendPath + '\\'}mvnw.cmd" (
        start "后端服务 (端口 ${analysis.backendPort})" cmd /k "cd /d %ROOT_DIR%${backendPath} && mvnw.cmd spring-boot:run"
    ) else (
        start "后端服务 (端口 ${analysis.backendPort})" cmd /k "cd /d %ROOT_DIR%${backendPath} && mvn spring-boot:run"
    )
)
`;
  }

  if (analysis.backendTech === 'python' || analysis.type === 'python') {
    const backendPath = analysis.hasBackend ? analysis.backendDir : '.';
    bat += `
if "%HAS_BACKEND%"=="1" (
    echo [后端] 启动服务...
    start "后端服务 (端口 ${analysis.backendPort})" cmd /k "cd /d %ROOT_DIR%${backendPath} && python app.py"
)
`;
  }

  if (analysis.hasFrontend || ['nextjs', 'vue', 'react', 'node'].includes(analysis.type)) {
    const fePath = analysis.hasFrontend ? analysis.frontendDir : '.';
    bat += `
if "%HAS_FRONTEND%"=="1" (
    echo [前端] 启动开发服务器...
    pnpm --version >nul 2>&1
    if !errorlevel! equ 0 (
        start "前端 (端口 ${analysis.frontendPort})" cmd /k "cd /d %ROOT_DIR%${fePath} && pnpm dev"
    ) else (
        start "前端 (端口 ${analysis.frontendPort})" cmd /k "cd /d %ROOT_DIR%${fePath} && npm run dev"
    )
)
`;
  }

  if (analysis.type === 'html') {
    bat += `
echo 正在打开 index.html...
start "" "%ROOT_DIR%index.html"
`;
  }

  bat += `
echo.
echo ========================================
echo   启动完成！
echo ========================================
echo.
echo   访问地址：
if "%HAS_BACKEND%"=="1" echo   后端: http://localhost:${analysis.backendPort}
if "%HAS_FRONTEND%"=="1" echo   前端: http://localhost:${analysis.frontendPort}
echo.
echo   关闭对应的命令行窗口即可停止服务
echo.
pause
`;

  const bom = Buffer.from([0xef, 0xbb, 0xbf]);
  const contentBuf = Buffer.from(bat, 'utf-8');
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
  let manualInstructions = '';

  if (analysis.hasBackend && analysis.hasFrontend) {
    const backendLabel = analysis.backendTech === 'java' ? 'Spring Boot 后端' : analysis.backendTech === 'python' ? 'Python 后端' : '后端';
    const frontendLabel = analysis.frontendTech === 'vue' ? 'Vue 前端' : analysis.frontendTech === 'react' ? 'React 前端' : analysis.frontendTech === 'nextjs' ? 'Next.js 前端' : '前端';

    manualInstructions = `方式三：手动开发
  1. 解压项目目录

  【后端 - ${backendLabel}】
  1. 进入 ${analysis.backendDir}/ 目录
  ${analysis.backendTech === 'java' ? `2. 确保已安装 JDK 17+ 和 Maven
  3. 运行 mvn clean package -DskipTests 编译项目
  4. 运行 mvn spring-boot:run 启动后端服务（默认端口 ${analysis.backendPort}）` : analysis.backendTech === 'python' ? `2. 确保已安装 Python 3.9+
  3. 运行 pip install -r requirements.txt 安装依赖
  4. 运行 python app.py 启动后端服务` : `2. 运行 pnpm install 安装依赖
  3. 运行 pnpm dev 启动后端服务`}

  【前端 - ${frontendLabel}】
  1. 进入 ${analysis.frontendDir}/ 目录
  2. 确保已安装 Node.js 18+
  3. 运行 pnpm install 安装前端依赖
  4. 运行 pnpm dev 启动前端开发服务器（默认端口 ${analysis.frontendPort}）

  【基础设施】
  ${analysis.hasInfrastructure ? `1. 确保 MySQL、Redis 等基础服务已启动
  2. 参考 ${analysis.infraDir}/ 目录下的配置文件
  3. 数据库连接信息请查看后端配置文件` : `1. 确保项目所需的数据库等基础服务已启动
  2. 数据库连接信息请查看后端配置文件`}`;
  } else if (analysis.type === 'java') {
    manualInstructions = `方式三：手动开发
  1. 解压项目目录
  2. 确保已安装 JDK 17+ 和 Maven
  3. 运行 mvn clean package -DskipTests 编译
  4. 运行 mvn spring-boot:run 启动服务（默认端口 ${analysis.backendPort}）
  5. 确保数据库已启动并配置正确`;
  } else if (analysis.type === 'python') {
    manualInstructions = `方式三：手动开发
  1. 解压项目目录
  2. 确保已安装 Python 3.9+
  3. 运行 pip install -r requirements.txt 安装依赖
  4. 运行 python app.py 启动服务
  5. 确保数据库等基础服务已启动`;
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
  3. 或使用 npx serve 启动本地服务器`;
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

3. .project.json
   项目配置描述文件，包含项目类型、前后端路径、运行命令、所需服务等信息。

4. 设计说明书.md
   毕业设计论文的设计说明书初稿，约1.8万-2万字。

5. 代码目录
   AI 根据 README.md 文档自动生成的项目源代码。

6. 运行脚本
   - Windows: 双击「运行.bat」
   脚本会自动检测项目类型、检查环境、安装依赖、启动服务。

【使用方式】

方式一：一键运行
  Windows: 双击「运行.bat」

方式二：使用 Claude Code 开发
  1. 解压项目目录
  2. 在终端中进入项目目录
  3. 运行 claude 命令启动 Claude Code
  4. AI 会自动读取 CLAUDE.md 和 README.md

${manualInstructions}

【README.md 摘要】
${readmeContent.slice(0, 500)}${readmeContent.length > 500 ? '\n...（完整内容请查看 README.md）' : ''}

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
mvn clean package -DskipTests
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
mvn clean package -DskipTests
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
    const { files, title, designDoc, readme, projectType } = validateRequest(DownloadPackageSchema, await request.json());

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: '没有可打包的文件' }, { status: 400 });
    }

    const projectName = title
      ? title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_').substring(0, 50)
      : 'graduation-project';

    // Use projectType if provided, otherwise fallback to file analysis
    const analysis: ProjectAnalysis = projectType
      ? typeInfoToAnalysis(projectType)
      : analyzeProject(files);

    const zip = new JSZip();

    // Add code files to zip
    for (const file of files) {
      zip.file(`${projectName}/${file.path}`, file.content);
    }

    // Add README.md
    if (readme) {
      zip.file(`${projectName}/README.md`, readme);
    }

    // Add CLAUDE.md
    zip.file(`${projectName}/CLAUDE.md`, generateClaudeMd(title || 'Graduation Project', analysis));

    // Add .project.json
    zip.file(`${projectName}/.project.json`, generateProjectJson(title || 'Graduation Project', analysis, projectType || null));

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

    // Add 先看我.txt
    const readMeTxt = generateReadMeTxt(
      title || 'Graduation Project',
      analysis,
      treeText,
      readme || '（未生成）',
      designDoc || '（未生成）',
    );
    zip.file(`${projectName}/先看我.txt`, readMeTxt);

    // Add 运行.bat (Windows)
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
