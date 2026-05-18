'use client';

import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  GraduationCap,
  Sparkles,
  FileText,
  Code2,
  Download,
  ChevronRight,
  ChevronLeft,
  Loader2,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Edit3,
  Copy,
  Check,
  Github,
  BrainCircuit,
  FolderTree,
  BookOpen,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Requirement {
  id: number;
  name: string;
  description: string;
}

interface CodeFile {
  path: string;
  content: string;
}

interface CodeStructureItem {
  path: string;
  description: string;
}

type Step = 1 | 2 | 3 | 4 | 5;

const STEPS = [
  { number: 1, label: '需求输入', icon: BrainCircuit },
  { number: 2, label: '需求确认', icon: CheckCircle2 },
  { number: 3, label: '生成README', icon: FileText },
  { number: 4, label: '设计说明书', icon: BookOpen },
  { number: 5, label: '代码生成', icon: Code2 },
];

// Streaming fetch helper
async function streamFetch(
  url: string,
  body: Record<string, unknown>,
  onChunk: (text: string) => void,
): Promise<string> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: '请求失败' }));
    throw new Error(errorData.error || '请求失败');
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('无法读取响应流');

  const decoder = new TextDecoder();
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    fullText += chunk;
    onChunk(fullText);
  }

  return fullText;
}

// Parse JSON from AI response (handles markdown code blocks)
function parseRequirements(text: string): Requirement[] {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  cleaned = cleaned.trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed.map((item: Record<string, unknown>, index: number) => ({
        id: (item.id as number) || index + 1,
        name: (item.name as string) || `需求 ${index + 1}`,
        description: (item.description as string) || '',
      }));
    }
  } catch {
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed)) {
          return parsed.map((item: Record<string, unknown>, index: number) => ({
            id: (item.id as number) || index + 1,
            name: (item.name as string) || `需求 ${index + 1}`,
            description: (item.description as string) || '',
          }));
        }
      } catch {
        // Fall through
      }
    }
  }

  return [];
}

// Parse code file structure (path + description) from AI response
function parseCodeStructure(text: string): CodeStructureItem[] {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  cleaned = cleaned.trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item: Record<string, unknown>) => item.path)
        .map((item: Record<string, unknown>) => ({
          path: item.path as string,
          description: (item.description as string) || '',
        }));
    }
  } catch {
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed)) {
          return parsed
            .filter((item: Record<string, unknown>) => item.path)
            .map((item: Record<string, unknown>) => ({
              path: item.path as string,
              description: (item.description as string) || '',
            }));
        }
      } catch {
        // Fall through
      }
    }
  }

  return [];
}

// Parse code files from AI response (with truncation recovery)
function parseCodeFiles(text: string): CodeFile[] {
  let cleaned = text.trim();
  // Remove markdown code block markers
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  cleaned = cleaned.trim();

  // Strategy 1: Try direct JSON parse
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item: Record<string, unknown>) => item.path && item.content)
        .map((item: Record<string, unknown>) => ({
          path: item.path as string,
          content: item.content as string,
        }));
    }
  } catch {
    // Strategy 2: Try to extract JSON array from text
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed)) {
          return parsed
            .filter((item: Record<string, unknown>) => item.path && item.content)
            .map((item: Record<string, unknown>) => ({
              path: item.path as string,
              content: item.content as string,
            }));
        }
      } catch {
        // Strategy 3: Truncation recovery - try to fix incomplete JSON
        const files = recoverTruncatedJSON(cleaned);
        if (files.length > 0) return files;
      }
    } else {
      // No closing bracket - definitely truncated
      const files = recoverTruncatedJSON(cleaned);
      if (files.length > 0) return files;
    }
  }

  return [];
}

// Recover files from truncated JSON array
function recoverTruncatedJSON(text: string): CodeFile[] {
  const files: CodeFile[] = [];
  const objectRegex = /\{\s*"path"\s*:\s*"([^"]*(?:\\.[^"]*)*)"\s*,\s*"content"\s*:\s*"((?:[^"\\]|\\.)*)"/g;

  let match;
  while ((match = objectRegex.exec(text)) !== null) {
    const path = match[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    let content = match[2].replace(/\\"/g, '"').replace(/\\\\/g, '\\').replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\r/g, '\r');
    files.push({ path, content });
  }

  return files;
}

export default function GraduationWizard() {
  const [step, setStep] = useState<Step>(1);
  const [inputMode, setInputMode] = useState<'auto' | 'manual'>('auto');
  const [title, setTitle] = useState('');
  const [manualRequirements, setManualRequirements] = useState('');
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [readmeContent, setReadmeContent] = useState('');
  const [designDocContent, setDesignDocContent] = useState('');
  const [codeFiles, setCodeFiles] = useState<CodeFile[]>([]);
  const [codeStructure, setCodeStructure] = useState<CodeStructureItem[]>([]);
  const [codeBatchInfo, setCodeBatchInfo] = useState({ current: 0, total: 0 });
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [editingReq, setEditingReq] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedDesign, setCopiedDesign] = useState(false);
  const readmeScrollRef = useRef<HTMLDivElement>(null);
  const designDocScrollRef = useRef<HTMLDivElement>(null);

  // Step 1: Generate or analyze requirements
  const handleGenerateRequirements = useCallback(async () => {
    if (inputMode === 'auto' && !title.trim()) return;
    if (inputMode === 'manual' && !manualRequirements.trim()) return;

    setIsGenerating(true);
    setStreamText('');

    try {
      const url =
        inputMode === 'auto' ? '/api/generate-requirements' : '/api/analyze-requirements';
      const body =
        inputMode === 'auto'
          ? { title: title.trim() }
          : { requirements: manualRequirements.trim() };

      const fullText = await streamFetch(url, body, (text) => {
        setStreamText(text);
      });

      const parsed = parseRequirements(fullText);
      if (parsed.length === 0) {
        throw new Error('AI返回的需求格式无法解析，请重试');
      }

      setRequirements(parsed);
      setStep(2);
    } catch (err) {
      const message = err instanceof Error ? err.message : '需求生成失败';
      alert(message);
    } finally {
      setIsGenerating(false);
      setStreamText('');
    }
  }, [inputMode, title, manualRequirements]);

  // Step 3: Generate README
  const handleGenerateReadme = useCallback(async () => {
    if (requirements.length === 0) return;

    setIsGenerating(true);
    setStreamText('');

    try {
      const fullText = await streamFetch(
        '/api/generate-readme',
        { title: title.trim() || '毕业设计项目', requirements },
        (text) => {
          setStreamText(text);
          setTimeout(() => {
            readmeScrollRef.current?.scrollTo({
              top: readmeScrollRef.current.scrollHeight,
              behavior: 'smooth',
            });
          }, 100);
        },
      );

      setReadmeContent(fullText);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'README生成失败';
      alert(message);
    } finally {
      setIsGenerating(false);
      setStreamText('');
    }
  }, [requirements, title]);

  // Step 4: Generate Design Doc (分批生成)
  const [designDocBatch, setDesignDocBatch] = useState(0);
  const handleGenerateDesignDoc = useCallback(async () => {
    if (requirements.length === 0) return;

    setIsGenerating(true);
    setDesignDocBatch(1);
    setStreamText('');

    try {
      const fullText = await streamFetch(
        '/api/generate-design-doc',
        {
          title: title.trim() || '毕业设计项目',
          requirements,
          readme: readmeContent,
        },
        (text) => {
          setStreamText(text);
          // Track batch progress by counting --- separators
          const batchCount = (text.match(/\n---\n/g) || []).length + 1;
          setDesignDocBatch(batchCount);
          setTimeout(() => {
            designDocScrollRef.current?.scrollTo({
              top: designDocScrollRef.current.scrollHeight,
              behavior: 'smooth',
            });
          }, 100);
        },
      );

      setDesignDocContent(fullText);
    } catch (err) {
      const message = err instanceof Error ? err.message : '设计说明书生成失败';
      alert(message);
    } finally {
      setIsGenerating(false);
      setStreamText('');
    }
  }, [requirements, title, readmeContent]);

  // Step 5: Generate code (two-phase: structure → batch content)
  const BATCH_SIZE = 4; // files per batch
  const handleGenerateCode = useCallback(async () => {
    if (!readmeContent.trim()) return;

    setIsGenerating(true);
    setStreamText('');
    setCodeFiles([]);
    setCodeStructure([]);
    setCodeBatchInfo({ current: 0, total: 0 });

    try {
      // ===== Phase 1: Generate file structure (path + description) =====
      setStreamText('正在分析项目结构，规划文件清单...');
      const structureText = await streamFetch(
        '/api/generate-code-structure',
        { readme: readmeContent, title: title.trim() || 'graduation-project' },
        (text) => {
          setStreamText(text);
        },
      );

      const structure = parseCodeStructure(structureText);
      if (structure.length === 0) {
        throw new Error('AI无法解析项目文件结构，请重试');
      }

      setCodeStructure(structure);

      // ===== Phase 2: Generate code in batches =====
      const totalBatches = Math.ceil(structure.length / BATCH_SIZE);
      setCodeBatchInfo({ current: 0, total: totalBatches });

      const allFiles: CodeFile[] = [];

      for (let i = 0; i < totalBatches; i++) {
        const batchFiles = structure.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
        setCodeBatchInfo({ current: i + 1, total: totalBatches });
        setStreamText(`正在生成第 ${i + 1}/${totalBatches} 批文件（${batchFiles.map(f => f.path.split('/').pop()).join(', ')}）...`);

        const batchText = await streamFetch(
          '/api/generate-code',
          {
            files: batchFiles,
            readme: readmeContent,
            title: title.trim() || 'graduation-project',
            batchIndex: i,
            totalBatches,
          },
          (text) => {
            setStreamText(text);
          },
        );

        const parsed = parseCodeFiles(batchText);
        if (parsed.length === 0) {
          console.warn(`Batch ${i + 1} failed to parse, skipping ${batchFiles.length} files`);
        } else {
          allFiles.push(...parsed);
          // Update files progressively so user sees results
          setCodeFiles([...allFiles]);
        }
      }

      if (allFiles.length === 0) {
        throw new Error('代码生成失败，所有批次均无法解析。请重试。');
      }

      // Check if some files are missing
      const missingFiles = structure.filter(
        (s) => !allFiles.some((f) => f.path === s.path),
      );
      if (missingFiles.length > 0) {
        alert(`生成完成！共 ${structure.length} 个文件中成功生成了 ${allFiles.length} 个。\n\n缺失文件：${missingFiles.map(f => f.path).join(', ')}\n\n建议点击重新生成尝试补充。`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '代码生成失败';
      alert(message);
    } finally {
      setIsGenerating(false);
      setStreamText('');
    }
  }, [readmeContent, title]);

  // Download package
  const handleDownload = useCallback(async () => {
    if (codeFiles.length === 0) return;

    try {
      const response = await fetch('/api/download-package', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: codeFiles,
          title: title.trim() || 'graduation-project',
          designDoc: designDocContent,
          readme: readmeContent,
        }),
      });

      if (!response.ok) {
        throw new Error('下载失败');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(title.trim() || 'graduation-project').replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : '下载失败';
      alert(message);
    }
  }, [codeFiles, title, designDocContent, readmeContent]);

  // Requirement editing
  const startEditing = (req: Requirement) => {
    setEditingReq(req.id);
    setEditName(req.name);
    setEditDesc(req.description);
  };

  const saveEditing = (id: number) => {
    setRequirements((prev) =>
      prev.map((r) => (r.id === id ? { ...r, name: editName, description: editDesc } : r)),
    );
    setEditingReq(null);
  };

  const deleteRequirement = (id: number) => {
    setRequirements((prev) => prev.filter((r) => r.id !== id));
  };

  const addRequirement = () => {
    const newId = Math.max(0, ...requirements.map((r) => r.id)) + 1;
    setRequirements((prev) => [
      ...prev,
      { id: newId, name: '新需求', description: '请编辑需求描述' },
    ]);
  };

  // Copy README
  const copyReadme = async () => {
    await navigator.clipboard.writeText(readmeContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Copy Design Doc
  const copyDesignDoc = async () => {
    await navigator.clipboard.writeText(designDocContent);
    setCopiedDesign(true);
    setTimeout(() => setCopiedDesign(false), 2000);
  };

  // Get file tree from code files
  const getFileTree = () => {
    const tree: Record<string, string[]> = {};
    codeFiles.forEach((file) => {
      const parts = file.path.split('/');
      const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '.';
      if (!tree[dir]) tree[dir] = [];
      tree[dir].push(parts[parts.length - 1]);
    });
    return tree;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-xl dark:bg-slate-900/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg shadow-violet-500/25">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">毕业设计 AI 助手</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">从需求到代码，一站式完成</p>
            </div>
          </div>
          <Badge variant="secondary" className="gap-1.5 px-3 py-1 text-xs">
            <Github className="h-3 w-3" />
            <a
              href="https://github.com/zero01221"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              zero01221
            </a>
          </Badge>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* Step Indicator */}
        <div className="mb-10">
          <div className="flex items-center justify-between">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isActive = step === s.number;
              const isCompleted = step > s.number;
              return (
                <div key={s.number} className="flex flex-1 items-center">
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                        isActive
                          ? 'border-violet-600 bg-violet-600 text-white shadow-lg shadow-violet-500/30'
                          : isCompleted
                            ? 'border-emerald-500 bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                            : 'border-slate-300 bg-white text-slate-400 dark:border-slate-600 dark:bg-slate-800'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <Icon className="h-5 w-5" />
                      )}
                    </div>
                    <span
                      className={`text-xs font-medium ${
                        isActive
                          ? 'text-violet-600 dark:text-violet-400'
                          : isCompleted
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div
                      className={`mx-2 h-0.5 flex-1 rounded-full transition-all duration-300 ${
                        step > s.number
                          ? 'bg-emerald-500'
                          : 'bg-slate-200 dark:bg-slate-700'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step 1: Requirements Input */}
        {step === 1 && (
          <Card className="border-0 shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50">
            <CardContent className="pt-8">
              {/* Mode toggle - segmented control style */}
              <div className="mb-6 flex justify-center">
                <div className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => setInputMode('auto')}
                    className={`flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold transition-all duration-200 ${
                      inputMode === 'auto'
                        ? 'bg-white text-violet-700 shadow-md dark:bg-slate-700 dark:text-violet-400'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                    }`}
                  >
                    <Sparkles className="h-4 w-4" />
                    智能生成
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode('manual')}
                    className={`flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold transition-all duration-200 ${
                      inputMode === 'manual'
                        ? 'bg-white text-amber-700 shadow-md dark:bg-slate-700 dark:text-amber-400'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                    }`}
                  >
                    <Edit3 className="h-4 w-4" />
                    手动输入
                  </button>
                </div>
              </div>

              {/* Mode description */}
              <div className="mb-4 text-center">
                {inputMode === 'auto' ? (
                  <p className="text-sm text-violet-600 dark:text-violet-400">
                    输入毕业论文题目，AI 自动分析并生成 8-12 条详细功能需求
                  </p>
                ) : (
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    描述你的项目需求，AI 会结构化整理并补充完善缺失的需求
                  </p>
                )}
              </div>

              {/* Large input area */}
              <div className="min-h-[320px]">
                {inputMode === 'auto' ? (
                  <div className="flex h-full flex-col">
                    <label className="mb-3 block text-base font-semibold text-slate-700 dark:text-slate-300">
                      输入毕业论文题目
                    </label>
                    <Input
                      placeholder="例如：基于Spring Boot的在线考试系统设计与实现"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="h-14 bg-gradient-to-br from-violet-50/50 to-indigo-50/50 text-lg dark:from-violet-950/20 dark:to-indigo-950/20"
                      autoFocus
                    />
                    <div className="mt-4 flex-1 rounded-xl border-2 border-dashed border-slate-200 p-6 dark:border-slate-700">
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <BrainCircuit className="mb-3 h-12 w-12 text-violet-300 dark:text-violet-600" />
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          AI 将根据论文题目自动分析并生成 8-12 条详细的功能需求
                        </p>
                        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                          包括用户管理、数据交互、界面展示等完整功能需求
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full flex-col">
                    <label className="mb-3 block text-base font-semibold text-slate-700 dark:text-slate-300">
                      描述你的项目需求
                    </label>
                    <Textarea
                      placeholder={"请描述你的毕业设计需求，例如：\n1. 需要一个在线考试系统\n2. 支持多种题型（选择、填空、简答）\n3. 教师可以创建和管理试卷\n4. 学生可以在线答题和查看成绩\n5. 系统需要自动阅卷功能\n6. 支持考试数据统计分析"}
                      value={manualRequirements}
                      onChange={(e) => setManualRequirements(e.target.value)}
                      className="min-h-[280px] flex-1 bg-gradient-to-br from-amber-50/50 to-orange-50/50 text-base dark:from-amber-950/20 dark:to-orange-950/20"
                      autoFocus
                    />
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      描述越详细，AI 分析结果越准确。支持条目式或段落式描述，AI 会自动补充完善缺失的需求。
                    </p>
                  </div>
                )}
              </div>

              {/* Streaming indicator */}
              {isGenerating && (
                <div className="mt-6 space-y-3">
                  <div className="flex items-center gap-2 text-sm text-violet-600 dark:text-violet-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    AI 正在分析{inputMode === 'auto' ? '论文题目' : '需求'}...
                  </div>
                  {streamText && (
                    <div className="max-h-[200px] overflow-hidden rounded-lg bg-slate-50 p-4 dark:bg-slate-800/50">
                      <pre className="text-xs text-slate-500 dark:text-slate-400 whitespace-pre-wrap break-all">
                        {streamText.slice(-500)}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-6 flex justify-end">
                <Button
                  onClick={handleGenerateRequirements}
                  disabled={
                    isGenerating ||
                    (inputMode === 'auto' && !title.trim()) ||
                    (inputMode === 'manual' && !manualRequirements.trim())
                  }
                  size="lg"
                  className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 px-8 shadow-lg shadow-violet-500/25 hover:from-violet-700 hover:to-indigo-700"
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {isGenerating ? '分析中...' : '开始分析'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Requirements Review */}
        {step === 2 && (
          <Card className="border-0 shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    需求确认与编辑
                  </CardTitle>
                  <CardDescription>
                    审核 AI 生成的需求，可以编辑、删除或添加新需求
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-sm">
                  {requirements.length} 条需求
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {requirements.map((req, index) => (
                  <div
                    key={req.id}
                    className="group rounded-xl border bg-white p-4 transition-all hover:shadow-md dark:bg-slate-800/50"
                  >
                    {editingReq === req.id ? (
                      <div className="space-y-3">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="font-medium"
                        />
                        <Textarea
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          className="min-h-[80px] text-sm"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => saveEditing(req.id)}>
                            保存
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingReq(null)}>
                            取消
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-600 dark:bg-violet-900/50 dark:text-violet-400">
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <h4 className="font-semibold text-slate-900 dark:text-white">
                                {req.name}
                              </h4>
                              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                                {req.description}
                              </p>
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => startEditing(req)}
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-red-500 hover:text-red-600"
                              onClick={() => deleteRequirement(req.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                className="mt-4 w-full gap-2 border-dashed"
                onClick={addRequirement}
              >
                <Plus className="h-4 w-4" />
                添加新需求
              </Button>

              <Separator className="my-6" />

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)} className="gap-2">
                  <ChevronLeft className="h-4 w-4" />
                  上一步
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  disabled={requirements.length === 0}
                  className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 px-8 shadow-lg shadow-violet-500/25 hover:from-violet-700 hover:to-indigo-700"
                >
                  确认需求，生成README
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: README Generation */}
        {step === 3 && (
          <Card className="border-0 shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <FileText className="h-5 w-5 text-blue-600" />
                    README 文档生成
                  </CardTitle>
                  <CardDescription>
                    基于需求自动生成完整的 README.md，用于指导 AI 完成代码开发
                  </CardDescription>
                </div>
                {readmeContent && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={copyReadme}
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? '已复制' : '复制README'}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!readmeContent && !isGenerating && (
                <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-16 dark:border-slate-700">
                  <FileText className="mb-4 h-12 w-12 text-slate-300 dark:text-slate-600" />
                  <p className="mb-4 text-sm text-slate-500">
                    点击下方按钮，AI将根据需求生成完整的README文档
                  </p>
                  <Button
                    onClick={handleGenerateReadme}
                    className="gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 px-8 shadow-lg shadow-blue-500/25 hover:from-blue-700 hover:to-cyan-700"
                  >
                    <Sparkles className="h-4 w-4" />
                    生成 README.md
                  </Button>
                </div>
              )}

              {isGenerating && (
                <div className="mb-4 flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  AI 正在生成 README 文档...
                </div>
              )}

              {(readmeContent || isGenerating) && (
                <div ref={readmeScrollRef} className="max-h-[600px] overflow-auto rounded-xl border bg-white p-6 dark:bg-slate-800/50">
                  <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-a:text-violet-600 prose-code:text-violet-600">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {readmeContent || streamText || '正在生成...'}
                    </ReactMarkdown>
                  </div>
                </div>
              )}

              <Separator className="my-6" />

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(2)} className="gap-2">
                  <ChevronLeft className="h-4 w-4" />
                  上一步
                </Button>
                <Button
                  onClick={() => setStep(4)}
                  disabled={!readmeContent}
                  className="gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 px-8 shadow-lg shadow-blue-500/25 hover:from-blue-700 hover:to-cyan-700"
                >
                  确认README，生成设计说明书
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Design Doc Generation */}
        {step === 4 && (
          <Card className="border-0 shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <BookOpen className="h-5 w-5 text-amber-600" />
                    设计说明书生成
                  </CardTitle>
                  <CardDescription>
                    基于需求和系统设计，AI 自动撰写 1.8-2 万字的设计说明书初稿，可作为毕业论文参考
                  </CardDescription>
                </div>
                {designDocContent && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={copyDesignDoc}
                  >
                    {copiedDesign ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedDesign ? '已复制' : '复制说明书'}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!designDocContent && !isGenerating && (
                <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-16 dark:border-slate-700">
                  <BookOpen className="mb-4 h-12 w-12 text-slate-300 dark:text-slate-600" />
                  <p className="mb-2 text-sm text-slate-500">
                    点击下方按钮，AI将撰写完整的设计说明书初稿
                  </p>
                  <p className="mb-4 text-xs text-slate-400">
                    包含绪论、技术介绍、需求分析、系统设计、数据库设计、详细实现、测试等完整章节
                  </p>
                  <Button
                    onClick={handleGenerateDesignDoc}
                    className="gap-2 bg-gradient-to-r from-amber-600 to-orange-600 px-8 shadow-lg shadow-amber-500/25 hover:from-amber-700 hover:to-orange-700"
                  >
                    <Sparkles className="h-4 w-4" />
                    生成设计说明书
                  </Button>
                </div>
              )}

              {isGenerating && (
                <div className="mb-4 flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  AI 正在分批撰写设计说明书（第{designDocBatch}/3批，约1.8-2万字），请耐心等待...
                </div>
              )}

              {(designDocContent || isGenerating) && (
                <div ref={designDocScrollRef} className="max-h-[600px] overflow-auto rounded-xl border bg-white p-6 dark:bg-slate-800/50">
                  <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-a:text-violet-600 prose-code:text-violet-600">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {designDocContent || streamText || '正在生成...'}
                    </ReactMarkdown>
                  </div>
                </div>
              )}

              <Separator className="my-6" />

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(3)} className="gap-2">
                  <ChevronLeft className="h-4 w-4" />
                  返回修改README
                </Button>
                <Button
                  onClick={() => setStep(5)}
                  className="gap-2 bg-gradient-to-r from-amber-600 to-orange-600 px-8 shadow-lg shadow-amber-500/25 hover:from-amber-700 hover:to-orange-700"
                >
                  确认说明书，生成代码
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 5: Code Generation & Download */}
        {step === 5 && (
          <div className="grid gap-6 lg:grid-cols-5">
            {/* Left: File tree + Generate */}
            <div className="lg:col-span-2">
              <Card className="border-0 shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Code2 className="h-5 w-5 text-emerald-600" />
                    代码生成
                  </CardTitle>
                  <CardDescription>
                    AI 根据 README 文档自动生成完整可运行的项目代码
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!codeFiles.length && !isGenerating && (
                    <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-12 dark:border-slate-700">
                      <Code2 className="mb-4 h-10 w-10 text-slate-300 dark:text-slate-600" />
                      <p className="mb-4 text-sm text-slate-500">
                        点击生成，AI将分批编写完整项目代码
                      </p>
                      <p className="mb-4 text-xs text-slate-400">
                        先规划文件结构，再分批生成代码，确保文件完整不被截断
                      </p>
                      <Button
                        onClick={handleGenerateCode}
                        className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 px-8 shadow-lg shadow-emerald-500/25 hover:from-emerald-700 hover:to-teal-700"
                      >
                        <Sparkles className="h-4 w-4" />
                        开始生成代码
                      </Button>
                    </div>
                  )}

                  {isGenerating && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {codeBatchInfo.total > 0
                          ? `正在生成代码（第 ${codeBatchInfo.current}/${codeBatchInfo.total} 批）...`
                          : '正在分析项目结构...'}
                      </div>
                      {codeStructure.length > 0 && (
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          共 {codeStructure.length} 个文件，分 {codeBatchInfo.total} 批生成
                        </div>
                      )}
                      {streamText && (
                        <div className="max-h-[200px] overflow-hidden rounded-lg bg-slate-50 p-4 dark:bg-slate-800/50">
                          <pre className="text-xs text-slate-500 dark:text-slate-400 whitespace-pre-wrap break-all">
                            {streamText.slice(-500)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}

                  {codeFiles.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-4 w-4" />
                        已生成 {codeFiles.length}{codeStructure.length > 0 ? ` / ${codeStructure.length}` : ''} 个文件
                      </div>
                      <div className="rounded-xl border bg-slate-50 p-4 dark:bg-slate-800/50">
                        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-500">
                          <FolderTree className="h-3.5 w-3.5" />
                          项目文件结构
                        </div>
                        <div className="space-y-1 text-sm">
                          {Object.entries(getFileTree()).map(([dir, files]) => (
                            <div key={dir}>
                              <div className="font-medium text-slate-700 dark:text-slate-300">
                                📁 {dir}/
                              </div>
                              {files.map((file) => (
                                <div
                                  key={`${dir}/${file}`}
                                  className="ml-4 text-slate-500 dark:text-slate-400"
                                >
                                  📄 {file}
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>

                      <Separator />

                      <Button
                        onClick={handleDownload}
                        className="w-full gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 shadow-lg shadow-emerald-500/25 hover:from-emerald-700 hover:to-teal-700"
                        size="lg"
                      >
                        <Download className="h-4 w-4" />
                        下载项目压缩包 (.zip)
                      </Button>

                      <p className="text-center text-xs text-slate-400">
                        压缩包包含 CLAUDE.md 权限配置、设计说明书和「先看我.txt」说明文件
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right: Code preview */}
            <div className="lg:col-span-3">
              <Card className="border-0 shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">代码预览</CardTitle>
                </CardHeader>
                <CardContent>
                  {codeFiles.length > 0 ? (
                    <ScrollArea className="h-[600px]">
                      <div className="space-y-4">
                        {codeFiles.map((file, i) => (
                          <div key={i} className="rounded-lg border bg-white dark:bg-slate-800/50">
                            <div className="flex items-center justify-between border-b px-4 py-2">
                              <code className="text-xs font-medium text-violet-600 dark:text-violet-400">
                                {file.path}
                              </code>
                              <Badge variant="secondary" className="text-xs">
                                {file.content.split('\n').length} 行
                              </Badge>
                            </div>
                            <pre className="max-h-[300px] overflow-auto p-4 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                              <code>{file.content}</code>
                            </pre>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="flex h-[400px] items-center justify-center rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                      <div className="text-center">
                        <Code2 className="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
                        <p className="text-sm text-slate-400">生成代码后将在此处预览</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Bottom navigation */}
            <div className="lg:col-span-5">
              <div className="flex justify-start">
                <Button variant="outline" onClick={() => setStep(4)} className="gap-2">
                  <ChevronLeft className="h-4 w-4" />
                  返回设计说明书
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
