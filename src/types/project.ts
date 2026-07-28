/**
 * 项目共享类型定义（单一来源）
 *
 * 所有路由与组件统一从此导入，避免 interface 在多处重复定义导致漂移。
 */

/** 功能需求项 */
export interface Requirement {
  id: number;
  name: string;
  description: string;
}

/** 生成的代码文件 */
export interface CodeFile {
  path: string;
  content: string;
}

/** 代码文件清单项（结构规划阶段） */
export interface CodeStructureItem {
  path: string;
  description: string;
}

/** 文件结构（用于代码生成） */
export interface FileStructure {
  path: string;
  description: string;
}

/**
 * 项目类型信息（由 detect-project-type 识别，用于指导文件结构规划与代码生成）。
 * 字段使用字面量联合，作为全项目关于"项目类型"的唯一类型定义。
 */
export interface ProjectTypeInfo {
  /** 项目类型标识 */
  type:
    | 'java-fullstack'
    | 'python-fullstack'
    | 'node-fullstack'
    | 'vue-frontend'
    | 'react-frontend'
    | 'nextjs'
    | 'html-static'
    | 'python-web'
    | 'other';
  /** 人类可读的项目类型描述 */
  label: string;
  /** 后端技术栈 */
  backend: {
    tech: 'spring-boot' | 'django' | 'flask' | 'fastapi' | 'express' | 'none';
    language: 'java' | 'python' | 'javascript' | 'typescript' | 'none';
    port: number;
  };
  /** 前端技术栈 */
  frontend: {
    tech: 'vue' | 'react' | 'nextjs' | 'html' | 'none';
    framework: 'vue3' | 'vue2' | 'react18' | 'nextjs14' | 'none';
    buildTool: 'vite' | 'webpack' | 'nextjs' | 'none';
    port: number;
  };
  /** 是否需要数据库 */
  needsDatabase: boolean;
  /** 数据库类型 */
  database: 'mysql' | 'postgresql' | 'mongodb' | 'sqlite' | 'none';
  /** 是否需要 Redis 等缓存 */
  needsCache: boolean;
  /** 项目结构模式 */
  structureMode:
    | 'monorepo'
    | 'separated'
    | 'frontend-only'
    | 'backend-only'
    | 'fullstack-single';
  /** 推荐的包管理器 */
  packageManager: 'pnpm' | 'npm' | 'maven' | 'pip';
  /** 关键依赖列表（用于生成 package.json / pom.xml / requirements.txt） */
  keyDependencies: string[];
}

/**
 * download-package 中基于文件启发式分析得出的项目结构信息。
 * 与 ProjectTypeInfo（LLM 识别）互补，作为打包阶段的回退分析结果。
 */
export interface ProjectAnalysis {
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

/**
 * 项目类型守卫函数
 */
export const isProjectTypeInfo = (obj: unknown): obj is ProjectTypeInfo => {
  if (typeof obj !== 'object' || obj === null) return false;

  const project = obj as ProjectTypeInfo;
  return (
    typeof project.type === 'string' &&
    typeof project.label === 'string' &&
    typeof project.backend === 'object' &&
    typeof project.frontend === 'object' &&
    typeof project.needsDatabase === 'boolean' &&
    typeof project.database === 'string' &&
    typeof project.needsCache === 'boolean' &&
    typeof project.structureMode === 'string' &&
    typeof project.packageManager === 'string' &&
    Array.isArray(project.keyDependencies)
  );
};

/**
 * 项目类型验证函数
 */
export const validateProjectTypeInfo = (project: ProjectTypeInfo): void => {
  const validTypes = [
    'java-fullstack', 'python-fullstack', 'node-fullstack', 'vue-frontend',
    'react-frontend', 'nextjs', 'html-static', 'python-web', 'other'
  ];

  if (!validTypes.includes(project.type)) {
    throw new Error(`Invalid project type: ${project.type}`);
  }

  const validBackendTechs = ['spring-boot', 'django', 'flask', 'fastapi', 'express', 'none'];
  if (!validBackendTechs.includes(project.backend.tech)) {
    throw new Error(`Invalid backend tech: ${project.backend.tech}`);
  }

  const validFrontendTechs = ['vue', 'react', 'nextjs', 'html', 'none'];
  if (!validFrontendTechs.includes(project.frontend.tech)) {
    throw new Error(`Invalid frontend tech: ${project.frontend.tech}`);
  }

  const validDatabases = ['mysql', 'postgresql', 'mongodb', 'sqlite', 'none'];
  if (!validDatabases.includes(project.database)) {
    throw new Error(`Invalid database: ${project.database}`);
  }

  const validStructureModes = ['monorepo', 'separated', 'frontend-only', 'backend-only', 'fullstack-single'];
  if (!validStructureModes.includes(project.structureMode)) {
    throw new Error(`Invalid structure mode: ${project.structureMode}`);
  }

  const validPackageManagers = ['pnpm', 'npm', 'maven', 'pip'];
  if (!validPackageManagers.includes(project.packageManager)) {
    throw new Error(`Invalid package manager: ${project.packageManager}`);
  }
};

/**
 * 需求项验证函数
 */
export const validateRequirement = (requirement: Requirement): void => {
  if (typeof requirement.id !== 'number') {
    throw new Error('Requirement id must be a number');
  }
  if (typeof requirement.name !== 'string' || requirement.name.trim().length === 0) {
    throw new Error('Requirement name must be a non-empty string');
  }
  if (typeof requirement.description !== 'string' || requirement.description.trim().length === 0) {
    throw new Error('Requirement description must be a non-empty string');
  }
};

/**
 * 文件结构验证函数
 */
export const validateFileStructure = (file: FileStructure): void => {
  if (typeof file.path !== 'string' || file.path.trim().length === 0) {
    throw new Error('File path must be a non-empty string');
  }
  if (typeof file.description !== 'string' || file.description.trim().length === 0) {
    throw new Error('File description must be a non-empty string');
  }
};
