import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';

// ============================================================
// Project type detection
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
  /** Detected services (mysql, redis, elasticsearch, etc.) */
  services: string[];
  /** Backend port from config */
  backendPort: number;
  /** Frontend port from config */
  frontendPort: number;
}

function analyzeProject(files: Array<{ path: string; content: string }>): ProjectAnalysis {
  const paths = files.map((f) => f.path.toLowerCase());
  const contents = files.map((f) => f.content.toLowerCase());
  const pathContentMap = new Map(files.map((f) => [f.path.toLowerCase(), f.content.toLowerCase()]));

  // Detect frontend directory
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

  // Detect services from config files
  const services: string[] = [];
  const allContent = contents.join('\n');
  if (allContent.includes('mysql') || allContent.includes('jdbc')) services.push('mysql');
  if (allContent.includes('redis')) services.push('redis');
  if (allContent.includes('elasticsearch') || allContent.includes('elastic')) services.push('elasticsearch');
  if (allContent.includes('mongodb') || allContent.includes('mongo')) services.push('mongodb');
  if (allContent.includes('rabbitmq') || allContent.includes('amqp')) services.push('rabbitmq');
  if (allContent.includes('postgresql') || allContent.includes('postgres')) services.push('postgresql');

  // Detect backend port
  let backendPort = 8080;
  for (const [p, c] of pathContentMap) {
    if (p.includes('application.yml') || p.includes('application.properties')) {
      const portMatch = c.match(/port:\s*(\d+)/) || c.match(/server\.port\s*=\s*(\d+)/);
      if (portMatch) backendPort = parseInt(portMatch[1]);
    }
  }

  // Detect frontend port
  let frontendPort = 5173;
  if (frontendTech === 'nextjs') frontendPort = 3000;
  if (frontendTech === 'react') frontendPort = 3000;
  for (const [p, c] of pathContentMap) {
    if (p.includes('vite.config') && c.includes('port')) {
      const portMatch = c.match(/port:\s*(\d+)/);
      if (portMatch) frontendPort = parseInt(portMatch[1]);
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
    services,
    backendPort,
    frontendPort,
  };
}

// ============================================================
// Generate .project.json
// ============================================================

function generateProjectJson(title: string, analysis: ProjectAnalysis): string {
  const projectJson: Record<string, unknown> = {
    name: title,
    type: analysis.type,
    services: analysis.services,
  };

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
// Generate run.bat (detection-driven + .project.json)
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

:: 写日志
set "LOG_FILE=%ROOT_DIR%.bat_run.log"
echo [%date% %time%] 运行.bat 启动 > "%LOG_FILE%"

:: ==========================================
:: 读取 .project.json 中的项目配置
:: ==========================================
set "HAS_BACKEND=0"
set "HAS_FRONTEND=0"
set "BACKEND_PATH=."
set "FRONTEND_PATH=."
set "BACKEND_PORT=8080"
set "FRONTEND_PORT=5173"

if exist "%ROOT_DIR%.project.json" (
    echo [信息] 检测到 .project.json 项目配置文件
    echo [%date% %time%] 找到 .project.json >> "%LOG_FILE%"
)

`;

  // === Detection phase ===
  bat += `
:: ==========================================
::  阶段1: 项目类型自动检测
:: ==========================================
echo [1/4] 检测项目类型...
echo.

`;

  // Java detection
  if (analysis.backendTech === 'java' || analysis.type === 'java') {
    const backendPath = analysis.hasBackend ? analysis.backendDir : '.';
    bat += `
:: 检测Java后端项目
set "BACKEND_PATH=${backendPath}"
set "HAS_BACKEND=1"

if exist "%ROOT_DIR%${backendPath === '.' ? '' : backendPath + '\\'}pom.xml" (
    echo   [后端] 检测到 Maven 项目 ^(pom.xml^)
    set "BACKEND_TECH=java"
) else if exist "%ROOT_DIR%${backendPath === '.' ? '' : backendPath + '\\'}build.gradle" (
    echo   [后端] 检测到 Gradle 项目 ^(build.gradle^)
    set "BACKEND_TECH=java-gradle"
) else (
    echo   [后端] 未检测到 Java 构建文件
    set "HAS_BACKEND=0"
)
echo.

`;
  }

  // Python detection
  if (analysis.backendTech === 'python' || analysis.type === 'python') {
    const backendPath = analysis.hasBackend ? analysis.backendDir : '.';
    bat += `
:: 检测Python后端项目
set "BACKEND_PATH=${backendPath}"
set "HAS_BACKEND=1"

if exist "%ROOT_DIR%${backendPath === '.' ? '' : backendPath + '\\'}requirements.txt" (
    echo   [后端] 检测到 Python 项目 ^(requirements.txt^)
    set "BACKEND_TECH=python"
) else (
    echo   [后端] 未检测到 requirements.txt
    set "HAS_BACKEND=0"
)
echo.

`;
  }

  // Frontend detection
  if (analysis.hasFrontend) {
    bat += `
:: 检测前端项目
set "FRONTEND_PATH=${analysis.frontendDir}"
set "HAS_FRONTEND=1"

if exist "%ROOT_DIR%${analysis.frontendDir}\\vite.config.ts" (
    echo   [前端] 检测到 Vite 项目
    set "FRONTEND_TECH=vite"
) else if exist "%ROOT_DIR%${analysis.frontendDir}\\vite.config.js" (
    echo   [前端] 检测到 Vite 项目
    set "FRONTEND_TECH=vite"
) else if exist "%ROOT_DIR%${analysis.frontendDir}\\next.config.js" (
    echo   [前端] 检测到 Next.js 项目
    set "FRONTEND_TECH=nextjs"
) else if exist "%ROOT_DIR%${analysis.frontendDir}\\vue.config.js" (
    echo   [前端] 检测到 Vue CLI 项目
    set "FRONTEND_TECH=vue"
) else (
    echo   [前端] 检测到前端项目
    set "FRONTEND_TECH=node"
)
echo.

`;
  }

  // Pure Node.js detection (no separated frontend/backend)
  if (!analysis.hasBackend && !analysis.hasFrontend && ['nextjs', 'vue', 'react', 'node'].includes(analysis.type)) {
    bat += `
:: 检测纯Node.js项目
if exist "%ROOT_DIR%package.json" (
    echo   [项目] 检测到 Node.js 项目 ^(package.json^)
    set "HAS_FRONTEND=1"
    set "FRONTEND_PATH=."
    set "FRONTEND_TECH=node"
)
echo.

`;
  }

  // HTML detection
  if (analysis.type === 'html') {
    bat += `
:: 检测纯HTML项目
if exist "%ROOT_DIR%index.html" (
    echo   [项目] 检测到纯 HTML 项目
    set "PROJECT_TYPE=html"
)
echo.

`;
  }

  // === Environment phase ===
  bat += `
:: ==========================================
::  阶段2: 环境检查与安装
:: ==========================================
echo [2/4] 检查运行环境...
echo.

`;

  // Java environment
  if (analysis.backendTech === 'java' || analysis.type === 'java') {
    bat += `
:: ----- Java 环境 -----
echo [Java] 检查 JDK...
java -version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo   [!] 未检测到 Java 运行环境
    echo.
    echo   请选择安装方式：
    echo     1. 自动下载安装 Adoptium JDK 17 ^(推荐^)
    echo     2. 手动安装 ^(访问 https://adoptium.net/zh-CN/^)
    echo     3. 跳过，稍后手动安装
    echo.
    set /p "JAVA_CHOICE=请输入选择 [1/2/3]: "

    if "!JAVA_CHOICE!"=="1" (
        echo.
        echo   [Java] 正在下载 Adoptium JDK 17...
        powershell -Command "Invoke-WebRequest -Uri 'https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse?project=jdk' -OutFile '%ROOT_DIR%jdk-installer.msi'"
        if exist "%ROOT_DIR%jdk-installer.msi" (
            echo   [Java] 正在安装 JDK 17...
            msiexec /i "%ROOT_DIR%jdk-installer.msi" ADDLOCAL=FeatureMain,FeatureEnvironment,FeatureJarFileRunWith,FeatureJavaHome /quiet /norestart
            del "%ROOT_DIR%jdk-installer.msi"
            echo   [Java] JDK 17 安装完成！
            echo.
            echo   [重要] 请关闭当前窗口，重新打开命令行后再运行此脚本
            echo   （新命令行需要重新加载环境变量）
            echo.
            pause
            exit /b 0
        ) else (
            echo   [Java] 下载失败，请手动安装
        )
    )
    if "!JAVA_CHOICE!"=="2" (
        echo.
        echo   请在浏览器中访问 https://adoptium.net/zh-CN/ 下载安装
        echo   安装后重新运行此脚本
        echo.
    )
    if "!JAVA_CHOICE!"=="3" (
        echo   已跳过 Java 安装，如后端启动失败请手动安装
    )
    echo.
) else (
    echo   [Java] 已就绪:
    java -version 2>&1 | findstr /i "version"
    echo.
)

:: ----- Maven 环境 -----
echo [Maven] 检查 Maven...
mvn -version >nul 2>&1
if %errorlevel% neq 0 (
    echo   [Maven] 未检测到 Maven，尝试使用 Maven Wrapper...
    if exist "%ROOT_DIR%%BACKEND_PATH%\\mvnw.cmd" (
        echo   [Maven] 找到 Maven Wrapper ^(mvnw.cmd^)，将使用它替代系统 Maven
    ) else (
        echo.
        echo   [!] 未检测到 Maven，也没有 Maven Wrapper
        echo.
        echo   请选择安装方式：
        echo     1. 自动下载安装 Apache Maven 3.9.x
        echo     2. 手动安装 ^(访问 https://maven.apache.org/download.cgi^)
        echo     3. 跳过
        echo.
        set /p "MAVEN_CHOICE=请输入选择 [1/2/3]: "

        if "!MAVEN_CHOICE!"=="1" (
            echo   [Maven] 正在下载...
            powershell -Command "Invoke-WebRequest -Uri 'https://dlcdn.apache.org/maven/maven-3/3.9.6/binaries/apache-maven-3.9.6-bin.zip' -OutFile '%ROOT_DIR%maven.zip'"
            if exist "%ROOT_DIR%maven.zip" (
                echo   [Maven] 正在解压...
                powershell -Command "Expand-Archive -Path '%ROOT_DIR%maven.zip' -DestinationPath '%ROOT_DIR%.tools' -Force"
                del "%ROOT_DIR%maven.zip"
                for /d %%i in ("%ROOT_DIR%.tools\\apache-maven-*") do set "MAVEN_HOME=%%i"
                if defined MAVEN_HOME (
                    set "PATH=!MAVEN_HOME!\\bin;!PATH!"
                    echo   [Maven] 安装完成: !MAVEN_HOME!
                )
            ) else (
                echo   [Maven] 下载失败，请手动安装
            )
        )
    )
    echo.
) else (
    echo   [Maven] 已就绪:
    mvn -version 2>&1 | findstr /i "Apache Maven"
    echo.
)

`;
  }

  // Python environment
  if (analysis.backendTech === 'python' || analysis.type === 'python') {
    bat += `
:: ----- Python 环境 -----
echo [Python] 检查 Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo   [!] 未检测到 Python
    echo   请安装 Python 3.9+: https://www.python.org/downloads/
    echo   安装时勾选 "Add Python to PATH"
    pause
    exit /b 1
)
echo   [Python] 已就绪:
python --version
echo.

`;
  }

  // Node.js environment (needed for frontend or pure Node.js projects)
  if (analysis.hasFrontend || ['nextjs', 'vue', 'react', 'node'].includes(analysis.type)) {
    bat += `
:: ----- Node.js 环境 -----
echo [Node.js] 检查 Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo   [!] 未检测到 Node.js
    echo.
    echo   请选择安装方式：
    echo     1. 自动下载安装 Node.js 20 LTS ^(推荐^)
    echo     2. 手动安装 ^(访问 https://nodejs.org/zh-cn/^)
    echo     3. 跳过
    echo.
    set /p "NODE_CHOICE=请输入选择 [1/2/3]: "

    if "!NODE_CHOICE!"=="1" (
        echo   [Node.js] 正在下载 Node.js 20 LTS...
        powershell -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi' -OutFile '%ROOT_DIR%node-installer.msi'"
        if exist "%ROOT_DIR%node-installer.msi" (
            echo   [Node.js] 正在安装...
            msiexec /i "%ROOT_DIR%node-installer.msi" /quiet /norestart
            del "%ROOT_DIR%node-installer.msi"
            echo   [Node.js] 安装完成！
            echo   请关闭当前窗口，重新打开命令行后再运行此脚本
            pause
            exit /b 0
        ) else (
            echo   [Node.js] 下载失败，请手动安装
        )
    )
    echo.
) else (
    echo   [Node.js] 已就绪:
    node --version
    echo.
)

:: ----- pnpm 检查 -----
pnpm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo   [pnpm] 未安装，正在全局安装 pnpm...
    npm install -g pnpm
    if !errorlevel! neq 0 (
        echo   [pnpm] 安装失败，将使用 npm 替代
    )
    echo.
)

`;
  }

  // === Docker/Services check ===
  if (analysis.services.length > 0) {
    bat += `
:: ==========================================
::  基础设施服务检查
:: ==========================================
echo [服务] 检查基础设施服务...
echo.

`;
    if (analysis.services.includes('mysql')) {
      bat += `:: MySQL 检查
echo   [MySQL] 检查端口 ${analysis.backendPort === 8080 ? '3306' : '3306'}...
powershell -Command "try { $tcp = New-Object System.Net.Sockets.TcpClient; $tcp.Connect('localhost', 3306); $tcp.Close(); exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel% neq 0 (
    echo   [MySQL] 端口 3306 未监听，MySQL 可能未启动
    if exist "%ROOT_DIR%${analysis.infraDir || 'docker'}\\docker-compose.yml" (
        echo   [MySQL] 尝试通过 Docker Compose 启动...
        cd /d "%ROOT_DIR%${analysis.infraDir || 'docker'}"
        docker-compose up -d mysql 2>nul
        if !errorlevel! equ 0 (
            echo   [MySQL] Docker 容器已启动，等待初始化...
            timeout /t 15 /nobreak >nul
        ) else (
            echo   [MySQL] Docker 启动失败，请手动启动 MySQL
        )
        cd /d "%ROOT_DIR%"
    ) else (
        echo   [MySQL] 请手动启动 MySQL 服务
    )
) else (
    echo   [MySQL] 已就绪 ^(端口 3306^)
)
echo.

`;
    }
    if (analysis.services.includes('redis')) {
      bat += `:: Redis 检查
echo   [Redis] 检查端口 6379...
powershell -Command "try { $tcp = New-Object System.Net.Sockets.TcpClient; $tcp.Connect('localhost', 6379); $tcp.Close(); exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel% neq 0 (
    echo   [Redis] 端口 6379 未监听，Redis 可能未启动
    if exist "%ROOT_DIR%${analysis.infraDir || 'docker'}\\docker-compose.yml" (
        echo   [Redis] 尝试通过 Docker Compose 启动...
        cd /d "%ROOT_DIR%${analysis.infraDir || 'docker'}"
        docker-compose up -d redis 2>nul
        cd /d "%ROOT_DIR%"
    ) else (
        echo   [Redis] 请手动启动 Redis 服务
    )
) else (
    echo   [Redis] 已就绪 ^(端口 6379^)
)
echo.

`;
    }
  }

  // === Build phase ===
  bat += `
:: ==========================================
::  阶段3: 构建项目
:: ==========================================
echo [3/4] 构建项目...
echo.

`;

  // Java build
  if (analysis.backendTech === 'java' || analysis.type === 'java') {
    const backendPath = analysis.hasBackend ? analysis.backendDir : '.';
    bat += `
:: ----- 后端构建 -----
if "%HAS_BACKEND%"=="1" (
    echo [后端] 编译 Spring Boot 项目...
    cd /d "%ROOT_DIR%${backendPath === '.' ? '' : backendPath}"

    if exist "mvnw.cmd" (
        echo   使用 Maven Wrapper 编译...
        call mvnw.cmd clean package -DskipTests -q
    ) else (
        echo   使用系统 Maven 编译...
        call mvn clean package -DskipTests -q
    )

    if !errorlevel! neq 0 (
        echo.
        echo   [错误] 后端编译失败！
        echo   可能的原因：
        echo     1. 依赖下载失败（网络问题）- 重试或配置国内镜像
        echo     2. 代码编译错误 - 检查 pom.xml 和代码
        echo.
        echo   提示：可在 ${backendPath} 目录手动运行 mvn clean package 查看详细错误
        echo.
        cd /d "%ROOT_DIR%"
        echo [%date% %time%] 后端编译失败 >> "%LOG_FILE%"
        pause
        exit /b 1
    )
    echo   [后端] 编译成功！
    cd /d "%ROOT_DIR%"
    echo.
)

`;
  }

  // Python build
  if (analysis.backendTech === 'python' || analysis.type === 'python') {
    const backendPath = analysis.hasBackend ? analysis.backendDir : '.';
    bat += `
:: ----- Python 依赖安装 -----
if "%HAS_BACKEND%"=="1" (
    echo [后端] 安装 Python 依赖...
    cd /d "%ROOT_DIR%${backendPath === '.' ? '' : backendPath}"
    pip install -r requirements.txt -q
    if !errorlevel! neq 0 (
        echo   [警告] 部分依赖安装可能有问题，继续尝试启动...
    )
    echo   [后端] 依赖安装完成
    cd /d "%ROOT_DIR%"
    echo.
)

`;
  }

  // Frontend build (install deps)
  if (analysis.hasFrontend || ['nextjs', 'vue', 'react', 'node'].includes(analysis.type)) {
    const fePath = analysis.hasFrontend ? analysis.frontendDir : '.';
    bat += `
:: ----- 前端依赖安装 -----
if "%HAS_FRONTEND%"=="1" (
    echo [前端] 安装前端依赖...
    cd /d "%ROOT_DIR%${fePath}"

    pnpm --version >nul 2>&1
    if !errorlevel! equ 0 (
        echo   使用 pnpm 安装...
        call pnpm install
    ) else (
        echo   使用 npm 安装...
        call npm install
    )

    if !errorlevel! neq 0 (
        echo   [警告] 前端依赖安装可能有问题
        echo   提示：可尝试删除 node_modules 后重新安装
    )
    echo   [前端] 依赖安装完成
    cd /d "%ROOT_DIR%"
    echo.
)

`;
  }

  // === Run phase ===
  bat += `
:: ==========================================
::  阶段4: 启动项目
:: ==========================================
echo [4/4] 启动项目...
echo.

`;

  // Java run
  if (analysis.backendTech === 'java' || analysis.type === 'java') {
    const backendPath = analysis.hasBackend ? analysis.backendDir : '.';
    bat += `
:: ----- 启动后端 -----
if "%HAS_BACKEND%"=="1" (
    echo [后端] 启动 Spring Boot 服务...

    if exist "%ROOT_DIR%${backendPath === '.' ? '' : backendPath + '\\'}mvnw.cmd" (
        start "后端服务 - Spring Boot (端口 ${analysis.backendPort})" cmd /k "cd /d %ROOT_DIR%${backendPath === '.' ? '' : backendPath} && mvnw.cmd spring-boot:run"
    ) else (
        start "后端服务 - Spring Boot (端口 ${analysis.backendPort})" cmd /k "cd /d %ROOT_DIR%${backendPath === '.' ? '' : backendPath} && mvn spring-boot:run"
    )

    echo   [后端] 服务已在新窗口启动 ^(端口 ${analysis.backendPort}^)
    echo.
)

`;
  }

  // Python run
  if (analysis.backendTech === 'python' || analysis.type === 'python') {
    const backendPath = analysis.hasBackend ? analysis.backendDir : '.';
    bat += `
:: ----- 启动后端 -----
if "%HAS_BACKEND%"=="1" (
    echo [后端] 启动 Python 服务...
    start "后端服务 - Python (端口 ${analysis.backendPort})" cmd /k "cd /d %ROOT_DIR%${backendPath === '.' ? '' : backendPath} && python app.py"
    echo   [后端] 服务已在新窗口启动
    echo.
)

`;
  }

  // Frontend run
  if (analysis.hasFrontend || ['nextjs', 'vue', 'react', 'node'].includes(analysis.type)) {
    const fePath = analysis.hasFrontend ? analysis.frontendDir : '.';
    const feLabel = analysis.frontendTech === 'vue' ? 'Vue'
      : analysis.frontendTech === 'nextjs' ? 'Next.js'
      : analysis.frontendTech === 'react' ? 'React'
      : 'Node.js';
    bat += `
:: ----- 启动前端 -----
if "%HAS_FRONTEND%"=="1" (
    echo [前端] 启动 ${feLabel} 开发服务器...

    pnpm --version >nul 2>&1
    if !errorlevel! equ 0 (
        start "前端 - ${feLabel} (端口 ${analysis.frontendPort})" cmd /k "cd /d %ROOT_DIR%${fePath} && pnpm dev"
    ) else (
        start "前端 - ${feLabel} (端口 ${analysis.frontendPort})" cmd /k "cd /d %ROOT_DIR%${fePath} && npm run dev"
    )

    echo   [前端] 开发服务器已在新窗口启动 ^(端口 ${analysis.frontendPort}^)
    echo.
)

`;
  }

  // HTML run
  if (analysis.type === 'html') {
    bat += `
:: ----- 启动HTML项目 -----
if "%PROJECT_TYPE%"=="html" (
    echo 正在打开 index.html...
    start "" "%ROOT_DIR%index.html"
    echo   已在浏览器中打开
    echo.
)

`;
  }

  // Final summary
  bat += `
echo ========================================
echo   启动完成！
echo ========================================
echo.
echo   访问地址：
if "%HAS_BACKEND%"=="1" (
    echo   后端: http://localhost:${analysis.backendPort}
)
if "%HAS_FRONTEND%"=="1" (
    echo   前端: http://localhost:${analysis.frontendPort}
)
echo.
echo   关闭对应的命令行窗口即可停止服务
echo   运行日志: .bat_run.log
echo.

echo [%date% %time%] 启动完成 >> "%LOG_FILE%"
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
  3. 数据库连接信息请查看后端配置文件（如 application.yml）` : `1. 确保项目所需的数据库等基础服务已启动
  2. 数据库连接信息请查看后端配置文件`}`;
  } else if (analysis.type === 'java') {
    manualInstructions = `方式三：手动开发
  1. 解压项目目录
  2. 确保已安装 JDK 17+ 和 Maven
  3. 进入项目目录，运行 mvn clean package -DskipTests 编译
  4. 运行 mvn spring-boot:run 启动服务（默认端口 ${analysis.backendPort}）
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

3. .project.json
   项目配置描述文件，包含项目类型、前后端路径、运行命令、所需服务等信息。
   运行.bat 会读取此文件来适配不同项目类型，你也可以手动修改。

4. 设计说明书.md
   毕业设计论文的设计说明书初稿，约1.8万-2万字。
   包含项目概述、需求分析、系统设计、数据库设计、详细设计、系统测试等完整章节。
   可作为毕业论文的参考基础，请根据实际情况修改完善。

5. 代码目录
   AI 根据 README.md 文档自动生成的项目源代码。

6. 运行.bat
   Windows 一键运行脚本，支持：
   - 自动检测项目类型（Spring Boot / Vue / React / Python / HTML 等）
   - 自动检查并安装运行环境（JDK / Node.js / Maven / Python）
   - 自动检测基础服务（MySQL / Redis）并通过 Docker 启动
   - 前后端分离项目自动在新窗口分别启动
   - 运行日志写入 .bat_run.log

【使用方式】

方式一：一键运行（Windows 推荐）
  1. 解压项目目录
  2. 双击「运行.bat」
  3. 脚本会自动检测项目类型、检查环境、安装依赖、启动服务

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

    // Add .project.json (project metadata for 运行.bat)
    zip.file(`${projectName}/.project.json`, generateProjectJson(title || 'Graduation Project', analysis));

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

    // Add 运行.bat (detection-driven architecture)
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
