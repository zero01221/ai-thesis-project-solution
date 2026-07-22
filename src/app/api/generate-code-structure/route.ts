import { NextRequest, NextResponse } from 'next/server';
import { createOpenAIClient, createStreamResponse } from '@/lib/ai-client';

/**
 * 代码生成 - 第1步：生成文件清单
 *
 * 让AI分析项目结构，输出所有需要生成的文件路径和简要说明
 * 结合项目类型信息，确保文件清单完整且符合技术栈规范
 */

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
 * 根据项目类型生成必须包含的文件清单约束
 */
function getTypeConstraints(projectType: ProjectTypeInput | null): string {
  if (!projectType) {
    return '';
  }

  const constraints: string[] = [];

  // 根据项目类型添加特定的文件约束
  switch (projectType.type) {
    case 'java-fullstack':
      constraints.push(`
【Java全栈项目 - 必须包含的文件】
后端目录（backend/）：
- pom.xml（Maven配置，包含spring-boot-starter-web、mybatis-plus/mysql驱动等依赖）
- src/main/java/com/.../XxxApplication.java（Spring Boot启动类，必须有@SpringBootApplication注解）
- src/main/resources/application.yml（配置文件，含数据库连接、端口${projectType.backend.port}等）
- src/main/java/com/.../controller/（所有Controller类）
- src/main/java/com/.../service/（所有Service接口和实现）
- src/main/java/com/.../mapper/（所有Mapper接口）
- src/main/java/com/.../entity/（所有实体类）
- src/main/java/com/.../config/（配置类，如CORS、MyBatisPlus等）
- src/main/java/com/.../common/（通用类，如Result、PageResult等）
前端目录（frontend/）：
- package.json（包含vue、vue-router、pinia、axios、element-plus等依赖）
- vite.config.ts（Vite配置，含代理配置指向后端${projectType.backend.port}端口）
- tsconfig.json
- index.html（HTML入口模板）
- src/main.ts（Vue挂载入口）
- src/App.vue（根组件）
- src/router/index.ts（路由配置）
- src/stores/index.ts（Pinia状态管理）
- src/api/index.ts（axios封装和API接口）
- src/views/（所有页面组件）
- src/components/（公共组件）
- src/assets/（静态资源）`);
      break;

    case 'python-fullstack':
      constraints.push(`
【Python全栈项目 - 必须包含的文件】
后端目录（backend/）：
- requirements.txt（Python依赖，含flask/django、flask-cors、pymysql等）
- app.py 或 manage.py（应用入口）
- config.py（配置文件）
- models/（数据模型）
- routes/ 或 views/（路由/视图）
- services/（业务逻辑）
- utils/（工具函数）
前端目录（frontend/）：同上Vue/React前端结构`);
      break;

    case 'vue-frontend':
    case 'react-frontend':
      constraints.push(`
【${projectType.frontend.tech === 'vue' ? 'Vue' : 'React'}前端项目 - 必须包含的文件】
- package.json（包含所有前端依赖，scripts中必须有dev/build/preview命令）
- ${projectType.frontend.buildTool === 'vite' ? 'vite.config.ts' : 'webpack.config.js'}（构建配置）
- tsconfig.json（TypeScript配置）
- index.html（HTML入口模板，在根目录或public/下）
- src/main.${projectType.frontend.tech === 'vue' ? 'ts' : 'tsx'}（应用入口，必须挂载根组件）
- src/App.${projectType.frontend.tech === 'vue' ? 'vue' : 'tsx'}（根组件）
- src/router/index.ts（路由配置）
- src/stores/index.ts（状态管理）
- src/views/（所有页面组件）
- src/components/（公共组件）
- src/api/index.ts（API请求封装）
- src/assets/（静态资源）`);
      break;

    case 'nextjs':
      constraints.push(`
【Next.js项目 - 必须包含的文件】
- package.json（包含next、react、react-dom等依赖）
- next.config.js（Next.js配置）
- tsconfig.json
- src/app/layout.tsx（根布局）
- src/app/page.tsx（首页）
- src/app/globals.css（全局样式）
- src/components/（组件目录）
- src/lib/（工具函数）`);
      break;

    case 'html-static':
      constraints.push(`
【纯HTML项目 - 必须包含的文件】
- index.html（主页面，必须包含完整的HTML结构）
- css/style.css（样式文件）
- js/script.js（交互脚本）
- 其他页面HTML文件`);
      break;
  }

  // 数据库相关文件
  if (projectType.needsDatabase) {
    if (projectType.type.includes('java')) {
      constraints.push(`
【数据库相关文件】
- docker/docker-compose.yml（如需要Docker部署）
- docker/mysql/init.sql（MySQL初始化脚本，包含建表语句和初始数据）
- 或 src/main/resources/schema.sql（内嵌初始化脚本）`);
    } else if (projectType.type.includes('python')) {
      constraints.push(`
【数据库相关文件】
- init_db.sql 或 migrations/（数据库初始化脚本）`);
    }
  }

  return constraints.join('\n');
}

export async function POST(request: NextRequest) {
  try {
    const { readme, title, projectType } = await request.json() as {
      readme?: string;
      title?: string;
      projectType?: ProjectTypeInput;
    };

    if (!readme || typeof readme !== 'string' || readme.trim().length === 0) {
      return NextResponse.json({ error: '缺少README文档内容' }, { status: 400 });
    }

    const client = createOpenAIClient();

    // 截取README到合理长度
    const readmeTruncated = readme.length > 8000 ? readme.slice(0, 8000) + '\n...(文档已截断)' : readme;

    // 获取项目类型约束
    const typeConstraints = getTypeConstraints(projectType || null);

    const projectTypeDesc = projectType
      ? `\n## 已识别的项目类型\n${projectType.label}（${projectType.type}）\n技术栈：后端=${projectType.backend.tech}/${projectType.backend.language}，前端=${projectType.frontend.tech}/${projectType.frontend.framework}\n结构模式：${projectType.structureMode}\n包管理器：${projectType.packageManager}\n数据库：${projectType.database}\n`
      : '';

    const messages = [
      {
        role: 'system' as const,
        content: `你是一个文件清单生成器。你的唯一任务是输出一个JSON数组。

【输出格式】
严格输出JSON数组，格式如下：
[{"path":"文件路径","description":"文件说明"},{"path":"文件路径2","description":"文件说明2"}]

【规则】
1. 只输出JSON数组，不要输出任何其他文字
2. 不要使用markdown代码块标记
3. 不要输出解释说明
4. 每个文件必须有path和description字段
5. path必须是相对路径，使用正斜杠/

【必须包含的文件类型】
- 入口文件（如main.ts、App.vue、index.html、Application.java等）
- 配置文件（如package.json、pom.xml、vite.config.ts、tsconfig.json等）
- 路由配置
- 状态管理
- 所有页面组件
- 所有API接口文件

${typeConstraints}`,
      },
      {
        role: 'user' as const,
        content: `项目：${title}
${projectTypeDesc}
README摘要：
${readmeTruncated}

输出JSON数组：`,
      },
    ];

    return createStreamResponse(client, messages, 'codeStructure');
  } catch (error) {
    console.error('Generate code structure error:', error);
    return NextResponse.json({ error: '文件结构生成失败，请重试' }, { status: 500 });
  }
}
