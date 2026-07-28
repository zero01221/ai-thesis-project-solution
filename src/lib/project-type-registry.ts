/**
 * 项目类型注册表 - 统一管理项目类型定义和约束
 *
 * 所有项目类型信息、技术栈约束、生成规则在此统一管理，
 * 消除分散在多个文件中的重复定义。
 */

import { ProjectTypeInfo } from '@/types/project';

/**
 * 项目类型约束定义
 * 每个类型包含技术栈约束和生成规则
 */
export const PROJECT_TYPE_CONSTRAINTS = {
  /** Java 全栈项目 */
  'java-fullstack': {
    label: 'Java 全栈项目',
    description: 'Spring Boot + Vue/React 前端 + MySQL 数据库',
    constraints: {
      /** 前端技术栈约束 */
      frontend: {
        tech: 'vue' as const,
        framework: 'vue3' as const,
        buildTool: 'vite' as const,
        port: 3000,
      },
      /** 后端技术栈约束 */
      backend: {
        tech: 'spring-boot' as const,
        language: 'java' as const,
        port: 8080,
      },
      /** 数据库配置 */
      database: 'mysql' as const,
      /** 缓存需求 */
      needsCache: true,
      /** 项目结构模式 */
      structureMode: 'fullstack-single' as const,
      /** 包管理器 */
      packageManager: 'maven' as const,
      /** 关键依赖 */
      keyDependencies: [
        'spring-boot-starter-web',
        'spring-boot-starter-data-jpa',
        'mybatis-plus-boot-starter',
        'mysql-connector-j',
        'lombok',
        'vue',
        'vue-router',
        'pinia',
        'axios',
        'vite',
        '@vitejs/plugin-vue',
      ],
    },
  },

  /** Python 全栈项目 */
  'python-fullstack': {
    label: 'Python 全栈项目',
    description: 'FastAPI + React/Vue 前端 + PostgreSQL 数据库',
    constraints: {
      frontend: {
        tech: 'react' as const,
        framework: 'react18' as const,
        buildTool: 'vite' as const,
        port: 3000,
      },
      backend: {
        tech: 'fastapi' as const,
        language: 'python' as const,
        port: 8000,
      },
      database: 'postgresql' as const,
      needsCache: true,
      structureMode: 'fullstack-single' as const,
      packageManager: 'pip' as const,
      keyDependencies: [
        'fastapi',
        'uvicorn',
        'sqlalchemy',
        'psycopg2-binary',
        'pydantic',
        'react',
        'react-dom',
        'react-router-dom',
        'axios',
        'vite',
        '@vitejs/plugin-react',
      ],
    },
  },

  /** Node.js 全栈项目 */
  'node-fullstack': {
    label: 'Node.js 全栈项目',
    description: 'Express + React/Vue 前端 + MongoDB 数据库',
    constraints: {
      frontend: {
        tech: 'nextjs' as const,
        framework: 'nextjs14' as const,
        buildTool: 'nextjs' as const,
        port: 3000,
      },
      backend: {
        tech: 'express' as const,
        language: 'javascript' as const,
        port: 3001,
      },
      database: 'mongodb' as const,
      needsCache: true,
      structureMode: 'fullstack-single' as const,
      packageManager: 'pnpm' as const,
      keyDependencies: [
        'express',
        'mongoose',
        'cors',
        'dotenv',
        'next',
        'react',
        'react-dom',
        'axios',
        'nextjs',
      ],
    },
  },

  /** Vue 前端项目 */
  'vue-frontend': {
    label: 'Vue 前端项目',
    description: 'Vue 3 + Vite 前端单页应用',
    constraints: {
      frontend: {
        tech: 'vue' as const,
        framework: 'vue3' as const,
        buildTool: 'vite' as const,
        port: 3000,
      },
      backend: {
        tech: 'none' as const,
        language: 'none' as const,
        port: 0,
      },
      database: 'none' as const,
      needsCache: false,
      structureMode: 'frontend-only' as const,
      packageManager: 'pnpm' as const,
      keyDependencies: [
        'vue',
        'vue-router',
        'pinia',
        'axios',
        'vite',
        '@vitejs/plugin-vue',
      ],
    },
  },

  /** React 前端项目 */
  'react-frontend': {
    label: 'React 前端项目',
    description: 'React 18 + Vite 前端单页应用',
    constraints: {
      frontend: {
        tech: 'react' as const,
        framework: 'react18' as const,
        buildTool: 'vite' as const,
        port: 3000,
      },
      backend: {
        tech: 'none' as const,
        language: 'none' as const,
        port: 0,
      },
      database: 'none' as const,
      needsCache: false,
      structureMode: 'frontend-only' as const,
      packageManager: 'npm' as const,
      keyDependencies: [
        'react',
        'react-dom',
        'react-router-dom',
        'axios',
        'vite',
        '@vitejs/plugin-react',
      ],
    },
  },

  /** Next.js 项目 */
  'nextjs': {
    label: 'Next.js 项目',
    description: 'Next.js 14 全栈应用',
    constraints: {
      frontend: {
        tech: 'nextjs' as const,
        framework: 'nextjs14' as const,
        buildTool: 'nextjs' as const,
        port: 3000,
      },
      backend: {
        tech: 'none' as const,
        language: 'none' as const,
        port: 0,
      },
      database: 'none' as const,
      needsCache: false,
      structureMode: 'frontend-only' as const,
      packageManager: 'pnpm' as const,
      keyDependencies: [
        'next',
        'react',
        'react-dom',
        'axios',
        'nextjs',
      ],
    },
  },

  /** HTML 静态项目 */
  'html-static': {
    label: 'HTML 静态项目',
    description: '纯 HTML/CSS/JavaScript 静态网站',
    constraints: {
      frontend: {
        tech: 'html' as const,
        framework: 'none' as const,
        buildTool: 'none' as const,
        port: 3000,
      },
      backend: {
        tech: 'none' as const,
        language: 'none' as const,
        port: 0,
      },
      database: 'none' as const,
      needsCache: false,
      structureMode: 'frontend-only' as const,
      packageManager: 'none' as const,
      keyDependencies: [],
    },
  },

  /** Python Web 项目 */
  'python-web': {
    label: 'Python Web 项目',
    description: 'Django/Flask Web 应用',
    constraints: {
      frontend: {
        tech: 'none' as const,
        framework: 'none' as const,
        buildTool: 'none' as const,
        port: 0,
      },
      backend: {
        tech: 'django' as const,
        language: 'python' as const,
        port: 8000,
      },
      database: 'sqlite' as const,
      needsCache: false,
      structureMode: 'backend-only' as const,
      packageManager: 'pip' as const,
      keyDependencies: [
        'django',
        'gunicorn',
        'psycopg2-binary',
        'django-cors-headers',
      ],
    },
  },

  /** 其他项目类型 */
  'other': {
    label: '其他项目类型',
    description: '未识别的项目类型',
    constraints: {
      frontend: {
        tech: 'none' as const,
        framework: 'none' as const,
        buildTool: 'none' as const,
        port: 0,
      },
      backend: {
        tech: 'none' as const,
        language: 'none' as const,
        port: 0,
      },
      database: 'none' as const,
      needsCache: false,
      structureMode: 'separated' as const,
      packageManager: 'npm' as const,
      keyDependencies: [],
    },
  },
} as const;

/**
 * 根据项目类型获取完整的项目类型信息
 */
export function getProjectType(type: string): ProjectTypeInfo {
  const constraints = PROJECT_TYPE_CONSTRAINTS[type as keyof typeof PROJECT_TYPE_CONSTRAINTS];

  if (!constraints) {
    return {
      type: 'other',
      label: '其他项目类型',
      backend: { tech: 'none', language: 'none', port: 0 },
      frontend: { tech: 'none', framework: 'none', buildTool: 'none', port: 0 },
      needsDatabase: false,
      database: 'none',
      needsCache: false,
      structureMode: 'separated',
      packageManager: 'npm',
      keyDependencies: [],
    };
  }

  return {
    type,
    label: constraints.label,
    backend: constraints.constraints.backend,
    frontend: constraints.constraints.frontend,
    needsDatabase: constraints.constraints.database !== 'none',
    database: constraints.constraints.database,
    needsCache: constraints.constraints.needsCache,
    structureMode: constraints.constraints.structureMode,
    packageManager: constraints.constraints.packageManager,
    keyDependencies: constraints.constraints.keyDependencies,
  };
}

/**
 * 获取所有可用的项目类型
 */
export function getAllProjectTypes(): ProjectTypeInfo[] {
  return Object.entries(PROJECT_TYPE_CONSTRAINTS).map(([type, constraints]) => ({
    type,
    label: constraints.label,
    backend: constraints.constraints.backend,
    frontend: constraints.constraints.frontend,
    needsDatabase: constraints.constraints.database !== 'none',
    database: constraints.constraints.database,
    needsCache: constraints.constraints.needsCache,
    structureMode: constraints.constraints.structureMode,
    packageManager: constraints.constraints.packageManager,
    keyDependencies: constraints.constraints.keyDependencies,
  }));
}

/**
 * 获取代码生成约束
 * 根据文件清单和项目类型生成相应的代码约束
 */
export function getCodeConstraints(files: { path: string; description: string }[], projectType: ProjectTypeInfo | null): string {
  if (!projectType) return '';

  const filePaths = files.map(f => f.path.toLowerCase());
  const constraints: string[] = [];

  // package.json 约束
  if (filePaths.some(p => p.endsWith('package.json'))) {
    const deps = projectType.keyDependencies.length > 0
      ? projectType.keyDependencies.join(', ')
      : '';

    constraints.push(`
【package.json 生成要求 - 极其重要】
- dependencies 必须包含项目运行所需的所有依赖包，不能遗漏
- scripts 必须包含 "dev" 命令（启动开发服务器）
- 如果是 Vue + Vite 项目：dependencies 需包含 vue, vue-router, pinia, axios 等；devDependencies 需包含 vite, @vitejs/plugin-vue, typescript 等
- 如果是 React 项目：dependencies 需包含 react, react-dom, react-router-dom, axios 等
- 如果是 Next.js 项目：dependencies 需包含 next, react, react-dom 等
- ${deps ? `参考依赖列表：${deps}` : ''}
- scripts.dev 必须是正确的启动命令，如 "vite" 或 "next dev" 或 "react-scripts start"
- 不要使用占位符或 "..." 省略依赖`);
  }

  // pom.xml 约束
  if (filePaths.some(p => p.endsWith('pom.xml'))) {
    constraints.push(`
【pom.xml 生成要求】
- 必须包含完整的 Spring Boot parent 和依赖管理
- 必须包含 spring-boot-starter-web, mybatis-plus-boot-starter, mysql-connector-j 等核心依赖
- 必须包含 lombok（如果使用）
- groupId 和 artifactId 必须合理
- 不要省略任何必要的依赖`);
  }

  // 入口文件约束
  if (filePaths.some(p => p.includes('main.ts') || p.includes('main.js') || p.includes('main.jsx') || p.includes('main.tsx'))) {
    if (projectType.frontend.tech === 'vue') {
      constraints.push(`
【Vue 入口文件要求】
- main.ts 必须创建 Vue 应用实例并挂载到 #app
- 必须引入并注册 Router 和 Pinia（如果使用）
- 必须引入全局样式
- 示例结构：
  import { createApp } from 'vue'
  import { createPinia } from 'pinia'
  import App from './App.vue'
  import router from './router'
  const app = createApp(App)
  app.use(createPinia())
  app.use(router)
  app.mount('#app')`);
    } else if (projectType.frontend.tech === 'react') {
      constraints.push(`
【React 入口文件要求】
- main.tsx 必须使用 ReactDOM.createRoot 挂载应用
- 必须引入 BrowserRouter（如果使用 react-router）
- 示例结构：
  import React from 'react'
  import ReactDOM from 'react-dom/client'
  import { BrowserRouter } from 'react-router-dom'
  import App from './App'
  import './index.css'
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  )`);
    }
  }

  // Spring Boot 启动类约束
  if (filePaths.some(p => p.includes('application.java') || p.endsWith('Application.java'))) {
    constraints.push(`
【Spring Boot 启动类要求】
- 必须有 @SpringBootApplication 注解
- 必须有 main 方法，调用 SpringApplication.run()
- 包名必须与 pom.xml 中的 groupId 一致
- 示例：
  @SpringBootApplication
  public class XxxApplication {
      public static void main(String[] args) {
          SpringApplication.run(XxxApplication.class, args);
      }
  }`);
  }

  // application.yml 约束
  if (filePaths.some(p => p.includes('application.yml') || p.includes('application.properties'))) {
    constraints.push(`
【Spring Boot 配置文件要求】
- 必须包含 server.port 配置（端口 ${projectType.backend.port}）
- 必须包含数据库连接配置（spring.datasource.*）
- 数据库地址使用 localhost，数据库名合理命名
- 如果使用 MyBatis-Plus，必须包含 mybatis-plus 配置
- 必须包含 CORS 相关配置或在配置类中处理`);
  }

  // vite.config 约束
  if (filePaths.some(p => p.includes('vite.config'))) {
    constraints.push(`
【Vite 配置要求】
- 必须配置 server.proxy 将 /api 请求代理到后端 http://localhost:${projectType.backend.port}
- 必须配置正确的插件（@vitejs/plugin-vue 或 @vitejs/plugin-react）
- 必须配置 server.host 为 '0.0.0.0' 和 server.port 为 ${projectType.frontend.port}
- 示例：
  export default defineConfig({
    plugins: [vue()],
    server: {
      host: '0.0.0.0',
      port: ${projectType.frontend.port},
      proxy: {
        '/api': {
          target: 'http://localhost:${projectType.backend.port}',
          changeOrigin: true
        }
      }
    }
  })`);
  }

  // requirements.txt 约束
  if (filePaths.some(p => p.endsWith('requirements.txt'))) {
    constraints.push(`
【requirements.txt 要求】
- 必须包含所有 Python 依赖，每行一个包名==版本号
- 必须包含 Web 框架（flask/django/fastapi）
- 必须包含数据库驱动（pymysql/psycopg2等）
- 必须包含 CORS 支持（flask-cors等）
- 不要省略任何依赖`);
  }

  return constraints.join('\n');
}