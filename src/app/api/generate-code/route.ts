import { NextRequest, NextResponse } from 'next/server';
import { createOpenAIClient, createStreamResponse } from '@/lib/ai-client';

/**
 * 代码生成 - 第2步：根据文件清单分批生成代码
 *
 * 接收文件清单（path + description），生成对应的代码内容
 * 每次只生成少量文件，避免token截断
 *
 * 请求参数：
 * - files: 文件清单数组 [{ path, description }]
 * - readme: README文档内容
 * - title: 项目名称
 * - batchIndex: 当前批次索引（从0开始）
 * - totalBatches: 总批次数
 * - projectType: 项目类型信息（可选）
 */

interface FileStructure {
  path: string;
  description: string;
}

interface ProjectTypeInput {
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

/**
 * 根据项目类型和文件路径生成特定的代码约束
 */
function getCodeConstraints(files: FileStructure[], projectType: ProjectTypeInput | null): string {
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

export async function POST(request: NextRequest) {
  try {
    const { files, readme, title, batchIndex, totalBatches, projectType } = await request.json() as {
      files?: FileStructure[];
      readme?: string;
      title?: string;
      batchIndex?: number;
      totalBatches?: number;
      projectType?: ProjectTypeInput;
    };

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: '缺少文件清单' }, { status: 400 });
    }

    if (!readme || typeof readme !== 'string' || readme.trim().length === 0) {
      return NextResponse.json({ error: '缺少README文档内容' }, { status: 400 });
    }

    const client = createOpenAIClient();

    // 截取README到合理长度
    const readmeTruncated = readme.length > 6000 ? readme.slice(0, 6000) + '\n...(文档已截断)' : readme;

    // 构建文件清单描述
    const fileList = files.map((f, i) => `${i + 1}. ${f.path} - ${f.description}`).join('\n');

    // 获取代码约束
    const codeConstraints = getCodeConstraints(files, projectType || null);

    // 项目类型描述
    const projectTypeDesc = projectType
      ? `\n## 项目类型信息\n类型：${projectType.label}\n后端：${projectType.backend.tech} (${projectType.backend.language})，端口 ${projectType.backend.port}\n前端：${projectType.frontend.tech} (${projectType.frontend.framework})，端口 ${projectType.frontend.port}\n数据库：${projectType.database}\n结构：${projectType.structureMode}\n`
      : '';

    const messages = [
      {
        role: 'system' as const,
        content: `你是一位顶级全栈开发工程师。你需要根据README.md文档和文件清单，生成指定文件的完整代码。

你的输出必须是一个JSON数组，包含所有指定文件的路径和完整代码内容。

格式如下：
[
  {
    "path": "文件相对路径",
    "content": "文件的完整内容"
  }
]

关键要求：
1. 代码必须完整可运行，不能有省略或占位符（如 "// ... 其他代码"、"/* 省略 */"）
2. 严格遵循README中指定的技术栈和项目类型
3. 代码质量要高，包含必要的注释和错误处理
4. UI相关代码要美观现代
5. 文件之间要保持一致的代码风格和命名规范
6. 类之间的引用关系必须正确
7. 配置文件（package.json、pom.xml、requirements.txt等）必须包含完整的依赖列表，不能省略
8. 入口文件必须完整实现初始化逻辑，不能只有框架
${codeConstraints}

【输出格式要求 - 极其重要】
- 直接输出JSON数组，不要加 \`\`\`json \`\`\` 标记
- 不要在JSON前后添加任何说明文字
- 确保JSON格式完整，数组必须以 ] 结尾
- 每个文件的content必须是完整的代码，不能省略
- 代码中的引号需要正确转义（使用 \\" 表示双引号）
- 代码中的换行使用 \\n 表示`,
      },
      {
        role: 'user' as const,
        content: `请为以下项目生成第 ${batchIndex !== undefined ? batchIndex + 1 : 1}/${totalBatches || 1} 批文件的完整代码。

## 项目名称
${title}
${projectTypeDesc}

## README.md 内容
${readmeTruncated}

## 需要生成的文件清单
${fileList}

请生成上述 ${files.length} 个文件的完整代码，以JSON数组格式输出。
确保每个文件的内容完整，不要省略任何代码。
特别注意：配置文件必须包含完整的依赖列表，入口文件必须包含完整的初始化逻辑。`,
      },
    ];

    return createStreamResponse(client, messages, 'code');
  } catch (error) {
    console.error('Generate code batch error:', error);
    return NextResponse.json({ error: '代码生成失败，请重试' }, { status: 500 });
  }
}
