import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';

// ============================================================
// Project type interface (from detect-project-type API)
// ============================================================

interface ProjectTypeInfo {
  type: string;
  label: string;
  backend: { tech: string; language: string; port: number };
  frontend: { tech: string; framework: string; buildTool: string; port: number };
  needsDatabase: boolean;
  database: string;
  needsCache: boolean;
  structureMode: string;
  packageManager: string;
  keyDependencies: string[];
}

// ============================================================
// Fallback: Project type detection from files
// ============================================================

interface ProjectAnalysis {
  type: string;
  hasFrontend: boolean;
  frontendDir: string;
  frontendTech: string;
  hasBackend: boolean;
  backendDir: string;
  backendTech: string;
  hasInfrastructure: boolean;
  infraDir: string;
  services: string[];
  backendPort: number;
  frontendPort: number;
}

function analyzeProject(files: Array<{ path: string; content: string }>): ProjectAnalysis {
  const paths = files.map((f) => f.path.toLowerCase());
  const contents = files.map((f) => f.content.toLowerCase());
  const pathContentMap = new Map(files.map((f) => [f.path.toLowerCase(), f.content.toLowerCase()]));

  let hasFrontend = false;
  let frontendDir = '';
  let frontendTech = '';

  const frontendPatterns = ['frontend/', 'front-end/', 'web/', 'client/'];
  for (const pattern of frontendPatterns) {
    if (paths.some((p) => p.startsWith(pattern))) {
      hasFrontend = true;
      frontendDir = pattern.replace(/\/$/, '');
      break;
    }
  }

  if (!hasFrontend) {
    for (const p of paths) {
      if (p.includes('/package.json') && !p.startsWith('backend/')) {
        const dir = p.split('/').slice(0, -1).join('/');
        if (dir && dir !== '.') {
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

  if (!hasBackend) {
    if (paths.some((p) => p.includes('pom.xml') || p.includes('build.gradle'))) {
      backendTech = 'java';
    } else if (contents.some((c) => c.includes('spring-boot') || c.includes('@springbootapplication'))) {
      backendTech = 'java';
    } else if (paths.some((p) => p.includes('requirements.txt') || p.includes('manage.py'))) {
      backendTech = 'python';
    }
  }

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

  const services: string[] = [];
  const allContent = contents.join('\n');
  if (allContent.includes('mysql') || allContent.includes('jdbc')) services.push('mysql');
  if (allContent.includes('redis')) services.push('redis');
  if (allContent.includes('elasticsearch') || allContent.includes('elastic')) services.push('elasticsearch');
  if (allContent.includes('mongodb') || allContent.includes('mongo')) services.push('mongodb');
  if (allContent.includes('rabbitmq') || allContent.includes('amqp')) services.push('rabbitmq');
  if (allContent.includes('postgresql') || allContent.includes('postgres')) services.push('postgresql');

  let backendPort = 8080;
  for (const [p, c] of pathContentMap) {
    if (p.includes('application.yml') || p.includes('application.properties')) {
      const portMatch = c.match(/port:\s*(\d+)/) || c.match(/server\.port\s*=\s*(\d+)/);
      if (portMatch) backendPort = parseInt(portMatch[1]);
    }
  }

  let frontendPort = 5173;
  if (frontendTech === 'nextjs') frontendPort = 3000;
  if (frontendTech === 'react') frontendPort = 3000;
  for (const [p, c] of pathContentMap) {
    if (p.includes('vite.config') && c.includes('port')) {
      const portMatch = c.match(/port:\s*(\d+)/);
      if (portMatch) frontendPort = parseInt(portMatch[1]);
    }
  }

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
    services,
    backendPort,
    frontendPort,
  };
}

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
// Generate run.sh (cross-platform shell script)
// ============================================================

function generateRunSh(title: string, analysis: ProjectAnalysis): string {
  const projectName = title || 'Graduation Project';

  let sh = `#!/bin/bash
set -e

# ========================================
#   ${projectName}
#   一键配置与运行脚本 (Linux/macOS)
# ========================================

echo ""
echo "========================================"
echo "  ${projectName}"
echo "  一键配置与运行脚本"
echo "========================================"
echo ""

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

LOG_FILE="$ROOT_DIR/.sh_run.log"
echo "[$(date)] 运行.sh 启动" > "$LOG_FILE"

# ==========================================
#  阶段1: 项目类型检测
# ==========================================
echo "[1/4] 检测项目类型..."
echo ""

HAS_BACKEND=0
HAS_FRONTEND=0
BACKEND_PATH="."
FRONTEND_PATH="."
BACKEND_PORT=${analysis.backendPort}
FRONTEND_PORT=${analysis.frontendPort}

`;

  // Read .project.json if exists
  sh += `
if [ -f "$ROOT_DIR/.project.json" ]; then
    echo "  [信息] 检测到 .project.json 项目配置文件"
fi

`;

  // Backend detection
  if (analysis.backendTech === 'java' || analysis.type === 'java') {
    const backendPath = analysis.hasBackend ? analysis.backendDir : '.';
    sh += `
# Java 后端
BACKEND_PATH="${backendPath}"
HAS_BACKEND=1
if [ -f "$ROOT_DIR/$BACKEND_PATH/pom.xml" ]; then
    echo "  [后端] 检测到 Maven 项目 (pom.xml)"
elif [ -f "$ROOT_DIR/$BACKEND_PATH/build.gradle" ]; then
    echo "  [后端] 检测到 Gradle 项目 (build.gradle)"
else
    echo "  [后端] 未检测到 Java 构建文件"
    HAS_BACKEND=0
fi
echo ""
`;
  }

  if (analysis.backendTech === 'python' || analysis.type === 'python') {
    const backendPath = analysis.hasBackend ? analysis.backendDir : '.';
    sh += `
# Python 后端
BACKEND_PATH="${backendPath}"
HAS_BACKEND=1
if [ -f "$ROOT_DIR/$BACKEND_PATH/requirements.txt" ]; then
    echo "  [后端] 检测到 Python 项目 (requirements.txt)"
else
    echo "  [后端] 未检测到 requirements.txt"
    HAS_BACKEND=0
fi
echo ""
`;
  }

  // Frontend detection
  if (analysis.hasFrontend || ['nextjs', 'vue', 'react', 'node'].includes(analysis.type)) {
    const fePath = analysis.hasFrontend ? analysis.frontendDir : '.';
    sh += `
# 前端
FRONTEND_PATH="${fePath}"
HAS_FRONTEND=1
if [ -f "$ROOT_DIR/$FRONTEND_PATH/package.json" ]; then
    echo "  [前端] 检测到 Node.js 项目 (package.json)"
else
    echo "  [前端] 未检测到 package.json"
    HAS_FRONTEND=0
fi
echo ""
`;
  }

  // Environment check
  sh += `
# ==========================================
#  阶段2: 环境检查
# ==========================================
echo "[2/4] 检查运行环境..."
echo ""

`;

  if (analysis.backendTech === 'java' || analysis.type === 'java') {
    sh += `
# Java 环境
if ! command -v java &> /dev/null; then
    echo "  [!] 未检测到 Java，请安装 JDK 17+"
    echo "  下载地址: https://adoptium.net/"
    echo ""
else
    echo "  [Java] 已就绪:"
    java -version 2>&1 | head -1
fi

# Maven 环境
if ! command -v mvn &> /dev/null; then
    if [ -f "$ROOT_DIR/$BACKEND_PATH/mvnw" ]; then
        echo "  [Maven] 使用 Maven Wrapper (mvnw)"
    else
        echo "  [!] 未检测到 Maven，请安装 Apache Maven 3.9+"
        echo "  下载地址: https://maven.apache.org/download.cgi"
    fi
else
    echo "  [Maven] 已就绪:"
    mvn -version 2>&1 | head -1
fi
echo ""
`;
  }

  if (analysis.backendTech === 'python' || analysis.type === 'python') {
    sh += `
# Python 环境
if ! command -v python3 &> /dev/null; then
    echo "  [!] 未检测到 Python3，请安装 Python 3.9+"
    echo "  下载地址: https://www.python.org/downloads/"
    exit 1
else
    echo "  [Python] 已就绪:"
    python3 --version
fi
echo ""
`;
  }

  if (analysis.hasFrontend || ['nextjs', 'vue', 'react', 'node'].includes(analysis.type)) {
    sh += `
# Node.js 环境
if ! command -v node &> /dev/null; then
    echo "  [!] 未检测到 Node.js，请安装 Node.js 18+"
    echo "  下载地址: https://nodejs.org/"
    exit 1
else
    echo "  [Node.js] 已就绪:"
    node --version
fi

# pnpm 检查
if ! command -v pnpm &> /dev/null; then
    echo "  [pnpm] 未安装，正在全局安装..."
    npm install -g pnpm
fi
echo ""
`;
  }

  // Build phase
  sh += `
# ==========================================
#  阶段3: 构建项目
# ==========================================
echo "[3/4] 构建项目..."
echo ""

`;

  if (analysis.backendTech === 'java' || analysis.type === 'java') {
    const backendPath = analysis.hasBackend ? analysis.backendDir : '.';
    sh += `
# 后端构建
if [ "$HAS_BACKEND" = "1" ]; then
    echo "[后端] 编译 Spring Boot 项目..."
    cd "$ROOT_DIR/$BACKEND_PATH"
    if [ -f "mvnw" ]; then
        ./mvnw clean package -DskipTests -q
    else
        mvn clean package -DskipTests -q
    fi
    if [ $? -ne 0 ]; then
        echo "  [错误] 后端编译失败！"
        exit 1
    fi
    echo "  [后端] 编译成功！"
    cd "$ROOT_DIR"
    echo ""
fi
`;
  }

  if (analysis.backendTech === 'python' || analysis.type === 'python') {
    const backendPath = analysis.hasBackend ? analysis.backendDir : '.';
    sh += `
# Python 依赖安装
if [ "$HAS_BACKEND" = "1" ]; then
    echo "[后端] 安装 Python 依赖..."
    cd "$ROOT_DIR/$BACKEND_PATH"
    pip3 install -r requirements.txt -q
    echo "  [后端] 依赖安装完成"
    cd "$ROOT_DIR"
    echo ""
fi
`;
  }

  if (analysis.hasFrontend || ['nextjs', 'vue', 'react', 'node'].includes(analysis.type)) {
    const fePath = analysis.hasFrontend ? analysis.frontendDir : '.';
    sh += `
# 前端依赖安装
if [ "$HAS_FRONTEND" = "1" ]; then
    echo "[前端] 安装前端依赖..."
    cd "$ROOT_DIR/$FRONTEND_PATH"
    if command -v pnpm &> /dev/null; then
        pnpm install
    else
        npm install
    fi
    echo "  [前端] 依赖安装完成"
    cd "$ROOT_DIR"
    echo ""
fi
`;
  }

  // Run phase
  sh += `
# ==========================================
#  阶段4: 启动项目
# ==========================================
echo "[4/4] 启动项目..."
echo ""

`;

  if (analysis.backendTech === 'java' || analysis.type === 'java') {
    const backendPath = analysis.hasBackend ? analysis.backendDir : '.';
    sh += `
# 启动后端
if [ "$HAS_BACKEND" = "1" ]; then
    echo "[后端] 启动 Spring Boot 服务..."
    cd "$ROOT_DIR/$BACKEND_PATH"
    if [ -f "mvnw" ]; then
        ./mvnw spring-boot:run &
    else
        mvn spring-boot:run &
    fi
    BACKEND_PID=$!
    cd "$ROOT_DIR"
    echo "  [后端] 服务已启动 (PID: $BACKEND_PID, 端口: $BACKEND_PORT)"
    echo ""
fi
`;
  }

  if (analysis.backendTech === 'python' || analysis.type === 'python') {
    const backendPath = analysis.hasBackend ? analysis.backendDir : '.';
    sh += `
# 启动后端
if [ "$HAS_BACKEND" = "1" ]; then
    echo "[后端] 启动 Python 服务..."
    cd "$ROOT_DIR/$BACKEND_PATH"
    python3 app.py &
    BACKEND_PID=$!
    cd "$ROOT_DIR"
    echo "  [后端] 服务已启动 (PID: $BACKEND_PID, 端口: $BACKEND_PORT)"
    echo ""
fi
`;
  }

  if (analysis.hasFrontend || ['nextjs', 'vue', 'react', 'node'].includes(analysis.type)) {
    const fePath = analysis.hasFrontend ? analysis.frontendDir : '.';
    const feLabel = analysis.frontendTech === 'vue' ? 'Vue'
      : analysis.frontendTech === 'nextjs' ? 'Next.js'
      : analysis.frontendTech === 'react' ? 'React'
      : 'Node.js';
    sh += `
# 启动前端
if [ "$HAS_FRONTEND" = "1" ]; then
    echo "[前端] 启动 ${feLabel} 开发服务器..."
    cd "$ROOT_DIR/$FRONTEND_PATH"
    if command -v pnpm &> /dev/null; then
        pnpm dev &
    else
        npm run dev &
    fi
    FRONTEND_PID=$!
    cd "$ROOT_DIR"
    echo "  [前端] 服务已启动 (PID: $FRONTEND_PID, 端口: $FRONTEND_PORT)"
    echo ""
fi
`;
  }

  if (analysis.type === 'html') {
    sh += `
# 启动 HTML 项目
echo "正在启动本地服务器..."
if command -v npx &> /dev/null; then
    npx serve -l $FRONTEND_PORT .
else
    echo "请手动在浏览器中打开 index.html"
fi
`;
  }

  // Final summary
  sh += `
echo "========================================"
echo "  启动完成！"
echo "========================================"
echo ""
echo "  访问地址："
if [ "$HAS_BACKEND" = "1" ]; then
    echo "  后端: http://localhost:$BACKEND_PORT"
fi
if [ "$HAS_FRONTEND" = "1" ]; then
    echo "  前端: http://localhost:$FRONTEND_PORT"
fi
echo ""
echo "  按 Ctrl+C 停止所有服务"
echo "  运行日志: .sh_run.log"
echo ""

# 等待用户中断
trap "echo '正在停止服务...'; kill 0; exit 0" SIGINT SIGTERM
wait
`;

  return sh;
}

// ============================================================
// Generate run.bat (Windows batch script)
// ============================================================

function generateRunBat(title: string, analysis: ProjectAnalysis): Buffer {
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
   - Linux/macOS: 运行 bash 运行.sh
   脚本会自动检测项目类型、检查环境、安装依赖、启动服务。

【使用方式】

方式一：一键运行
  Windows: 双击「运行.bat」
  Linux/macOS: 运行 bash 运行.sh

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
    const { files, title, designDoc, readme, projectType } = (await request.json()) as {
      files?: Array<{ path: string; content: string }>;
      title?: string;
      designDoc?: string;
      readme?: string;
      projectType?: ProjectTypeInfo;
    };

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

    // Add 运行.sh (Linux/macOS)
    const runShContent = generateRunSh(title || 'Graduation Project', analysis);
    zip.file(`${projectName}/运行.sh`, runShContent);

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
