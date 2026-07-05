'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Search,
  RefreshCw,
  Settings,
  Bell,
  History,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Loader2,
  Trash2,
  Save,
  Plus,
  X,
  Activity,
  Database,
  Globe,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface BiddingItem {
  id: string;
  title: string;
  url: string;
  publishDate: string;
  source: string;
  type: string;
  matchedKeywords: string[];
  description?: string;
  budget?: string;
  deadline?: string;
  region?: string;
  scrapedAt: string;
}

interface SiteConfig {
  id: string;
  name: string;
  baseUrl: string;
  enabled: boolean;
  searchUrl: string;
  parserType: string;
}

interface AppConfig {
  sites: SiteConfig[];
  keywords: {
    include: string[];
    exclude: string[];
  };
  notification: {
    dingtalk: {
      enabled: boolean;
      webhookUrl: string;
      secret: string;
    };
  };
  schedule: {
    cron: string;
    maxItemsPerRun: number;
  };
}

interface ScrapeResult {
  siteName: string;
  success: boolean;
  itemCount: number;
  error?: string;
  duration: number;
}

// ============================================
// Main Dashboard Component
// ============================================

export function BiddingDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<BiddingItem[]>([]);
  const [stats, setStats] = useState({ totalFingerprints: 0, totalRecords: 0, siteCount: 0, includeKeywordCount: 0 });
  const [lastResult, setLastResult] = useState<{
    siteResults: ScrapeResult[];
    totalScraped: number;
    filteredCount: number;
    newItems: BiddingItem[];
    notification?: { success: boolean; error?: string };
    totalDuration: number;
  } | null>(null);

  // Load config on mount
  useEffect(() => {
    fetchConfig();
    fetchHistory();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config');
      const json = await res.json() as { success: boolean; data: AppConfig };
      if (json.success) setConfig(json.data);
    } catch (error) {
      console.error('加载配置失败:', error);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/history?limit=100');
      const json = await res.json() as { success: boolean; data: { items: BiddingItem[]; stats: typeof stats } };
      if (json.success) {
        setHistory(json.data.items);
        setStats(json.data.stats);
      }
    } catch (error) {
      console.error('加载历史失败:', error);
    }
  };

  const handleScrape = useCallback(async (siteIds?: string[]) => {
    setLoading(true);
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteIds, daysBack: 7 }),
      });
      const json = await res.json() as { success: boolean; data: typeof lastResult; error?: string };
      if (json.success) {
        setLastResult(json.data);
        fetchHistory();
      } else {
        console.error('采集失败:', json.error);
      }
    } catch (error) {
      console.error('采集请求失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleTestNotify = async () => {
    try {
      const res = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test' }),
      });
      const json = await res.json() as { success: boolean; error?: string };
      if (json.success) {
        alert('测试消息发送成功!');
      } else {
        alert(`发送失败: ${json.error}`);
      }
    } catch (error) {
      alert('请求失败');
    }
  };

  if (!config) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">招标信息监控</h1>
          <p className="text-muted-foreground">云南省 - 铁塔制造及维修行业</p>
        </div>
        <Button onClick={() => handleScrape()} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              采集中...
            </>
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" />
              立即采集
            </>
          )}
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-1">
            <Activity className="h-3.5 w-3.5" />
            概览
          </TabsTrigger>
          <TabsTrigger value="results" className="flex items-center gap-1">
            <Search className="h-3.5 w-3.5" />
            采集结果
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-1">
            <History className="h-3.5 w-3.5" />
            历史记录
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-1">
            <Settings className="h-3.5 w-3.5" />
            配置管理
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard
              title="监控站点"
              value={stats.siteCount}
              icon={<Globe className="h-4 w-4 text-muted-foreground" />}
            />
            <StatCard
              title="关键词数"
              value={stats.includeKeywordCount}
              icon={<Search className="h-4 w-4 text-muted-foreground" />}
            />
            <StatCard
              title="已采集条目"
              value={stats.totalRecords}
              icon={<Database className="h-4 w-4 text-muted-foreground" />}
            />
            <StatCard
              title="去重指纹"
              value={stats.totalFingerprints}
              icon={<CheckCircle2 className="h-4 w-4 text-muted-foreground" />}
            />
          </div>

          {/* Last Scrape Result */}
          {lastResult && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">最近采集结果</CardTitle>
                <CardDescription>
                  耗时 {(lastResult.totalDuration / 1000).toFixed(1)}s | 共采集{' '}
                  {lastResult.totalScraped} 条 | 新增 {lastResult.filteredCount} 条
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {lastResult.siteResults.map((r, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2">
                        {r.success ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                        <span className="font-medium">{r.siteName}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span>{r.itemCount} 条</span>
                        <span>{(r.duration / 1000).toFixed(1)}s</span>
                        {r.error && <span className="text-red-500">{r.error}</span>}
                      </div>
                    </div>
                  ))}
                </div>

                {lastResult.notification && (
                  <div className="mt-3 flex items-center gap-2 text-sm">
                    {lastResult.notification.success ? (
                      <span className="text-green-600">钉钉通知已发送</span>
                    ) : (
                      <span className="text-red-500">
                        通知失败: {lastResult.notification.error}
                      </span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Recent Items */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">最新招标信息</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {history.slice(0, 20).map((item) => (
                    <BiddingItemCard key={item.id} item={item} />
                  ))}
                  {history.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <Search className="mx-auto h-12 w-12 mb-3 opacity-30" />
                      <p>暂无数据，点击「立即采集」开始采集</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Results Tab */}
        <TabsContent value="results">
          <Card>
            <CardHeader>
              <CardTitle>本次采集结果</CardTitle>
              <CardDescription>
                {lastResult
                  ? `共采集 ${lastResult.totalScraped} 条，过滤后新增 ${lastResult.filteredCount} 条`
                  : '请先执行采集操作'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {lastResult?.newItems && lastResult.newItems.length > 0 ? (
                <ScrollArea className="h-[600px]">
                  <div className="space-y-3">
                    {lastResult.newItems.map((item) => (
                      <BiddingItemCard key={item.id} item={item} />
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <p>暂无采集结果</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>历史记录</CardTitle>
                  <CardDescription>共 {stats.totalRecords} 条已采集记录</CardDescription>
                </div>
                <Button variant="outline" onClick={fetchHistory}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  刷新
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-3">
                  {history.map((item) => (
                    <BiddingItemCard key={item.id} item={item} />
                  ))}
                  {history.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <p>暂无历史记录</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <SettingsPanel config={config} onConfigChange={setConfig} onTestNotify={handleTestNotify} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================
// Sub Components
// ============================================

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function BiddingItemCard({ item }: { item: BiddingItem }) {
  return (
    <div className="p-4 rounded-lg border hover:bg-muted/50 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary hover:underline line-clamp-2"
          >
            {item.title}
          </a>
          <div className="flex items-center gap-2 mt-1.5 text-sm text-muted-foreground flex-wrap">
            <Badge variant="secondary" className="text-xs">
              {item.source}
            </Badge>
            <span>{item.publishDate}</span>
            {item.region && <span>{item.region}</span>}
            {item.type && <Badge variant="outline" className="text-xs">{item.type}</Badge>}
          </div>
          {item.matchedKeywords.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {item.matchedKeywords.slice(0, 5).map((kw) => (
                <Badge key={kw} variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                  {kw}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-muted-foreground hover:text-primary"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}

// ============================================
// Settings Panel
// ============================================

function SettingsPanel({
  config,
  onConfigChange,
  onTestNotify,
}: {
  config: AppConfig;
  onConfigChange: (config: AppConfig) => void;
  onTestNotify: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [includeText, setIncludeText] = useState(config.keywords.include.join('\n'));
  const [excludeText, setExcludeText] = useState(config.keywords.exclude.join('\n'));
  const [dingtalkEnabled, setDingtalkEnabled] = useState(config.notification.dingtalk.enabled);
  const [webhookUrl, setWebhookUrl] = useState(config.notification.dingtalk.webhookUrl);
  const [secret, setSecret] = useState(config.notification.dingtalk.secret);
  const [sites, setSites] = useState(config.sites);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated: AppConfig = {
        ...config,
        sites,
        keywords: {
          include: includeText.split('\n').map((s) => s.trim()).filter(Boolean),
          exclude: excludeText.split('\n').map((s) => s.trim()).filter(Boolean),
        },
        notification: {
          dingtalk: {
            enabled: dingtalkEnabled,
            webhookUrl,
            secret,
          },
        },
      };

      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      const json = await res.json() as { success: boolean; data: AppConfig };
      if (json.success) {
        onConfigChange(json.data);
        alert('配置已保存');
      }
    } catch (error) {
      alert('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const toggleSite = (siteId: string) => {
    setSites((prev) =>
      prev.map((s) => (s.id === siteId ? { ...s, enabled: !s.enabled } : s))
    );
  };

  return (
    <div className="space-y-6">
      {/* Sites */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe className="h-5 w-5" />
            监控站点
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {sites.map((site) => (
              <div
                key={site.id}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div>
                  <div className="font-medium">{site.name}</div>
                  <div className="text-sm text-muted-foreground">{site.baseUrl}</div>
                </div>
                <Switch checked={site.enabled} onCheckedChange={() => toggleSite(site.id)} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Keywords */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="h-5 w-5" />
            关键词配置
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm font-medium">包含关键词 (每行一个)</Label>
            <p className="text-xs text-muted-foreground mb-2">
              标题或描述中至少包含其中一个词才会被保留
            </p>
            <Textarea
              value={includeText}
              onChange={(e) => setIncludeText(e.target.value)}
              rows={8}
              className="font-mono text-sm"
            />
          </div>
          <Separator />
          <div>
            <Label className="text-sm font-medium">排除关键词 (每行一个)</Label>
            <p className="text-xs text-muted-foreground mb-2">
              标题或描述中包含其中任一词则被排除
            </p>
            <Textarea
              value={excludeText}
              onChange={(e) => setExcludeText(e.target.value)}
              rows={4}
              className="font-mono text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* DingTalk Notification */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="h-5 w-5" />
              钉钉通知
            </CardTitle>
            <div className="flex items-center gap-2">
              <Switch checked={dingtalkEnabled} onCheckedChange={setDingtalkEnabled} />
              <span className="text-sm">{dingtalkEnabled ? '已启用' : '未启用'}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Webhook 地址</Label>
            <Input
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://oapi.dingtalk.com/robot/send?access_token=xxx"
              className="mt-1"
            />
          </div>
          <div>
            <Label>加签密钥 (Secret)</Label>
            <Input
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="SEC..."
              className="mt-1"
              type="password"
            />
            <p className="text-xs text-muted-foreground mt-1">
              如果机器人启用了加签验证，请填写密钥
            </p>
          </div>
          <Button variant="outline" onClick={onTestNotify} disabled={!webhookUrl}>
            <Bell className="mr-2 h-4 w-4" />
            发送测试消息
          </Button>
        </CardContent>
      </Card>

      {/* Schedule Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">定时调度说明</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>当前系统运行在 Web 环境中，定时调度需要通过外部方式触发：</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>方式一：</strong>使用外部 Cron 服务（如 crontab、云函数定时触发器），
                定时调用 <code className="bg-muted px-1 rounded">POST /api/scrape</code> 接口
              </li>
              <li>
                <strong>方式二：</strong>在页面上手动点击「立即采集」按钮
              </li>
              <li>
                <strong>方式三：</strong>部署到支持 Cron 的服务器环境，配置定时任务
              </li>
            </ul>
            <p className="mt-2">
              推荐 Cron 表达式：<code className="bg-muted px-1 rounded">{config.schedule.cron}</code>
              <br />
              含义：每天 8:00、14:00、20:00 各执行一次采集
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="min-w-[120px]">
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              保存中...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              保存配置
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
