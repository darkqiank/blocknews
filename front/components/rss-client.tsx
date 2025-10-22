'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { Separator } from '@/components/ui/separator';
import { ExternalLink, Rss, Copy, Check } from 'lucide-react';

interface SourceData {
  source: string;
  label: string;
  rssUrl: string;
}

interface RSSSourcesResponse {
  sources: 
  SourceData[];
  latestRssUrl: string;
}

export default function RssPageClient() {
  const [rssData, setRssData] = useState<RSSSourcesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchRSSData();
  }, []);

  const fetchRSSData = async () => {
    try {
      const response = await fetch('/api/rss/sources');
      if (!response.ok) {
        throw new Error('Failed to fetch RSS sources');
      }
      const data = await response.json();
      setRssData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (url: string) => {
    try {
      const fullUrl = `${window.location.origin}${url}`;
      await navigator.clipboard.writeText(fullUrl);
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  const openRSSFeed = (url: string) => {
    const fullUrl = `${window.location.origin}${url}`;
    window.open(fullUrl, '_blank');
  };

  if (loading) {
    return <LoadingSpinner fullPage message="加载RSS源信息..." />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background pt-20 py-8 font-mono">
        <div className="max-w-4xl mx-auto px-4">
          <Card className="border-foreground bg-background">
            <CardContent className="pt-6">
              <div className="text-center text-red-600">
                <p className="font-medium">加载失败</p>
                <p className="text-sm mt-1">{error}</p>
                <button
                  onClick={fetchRSSData}
                  className="mt-4 px-4 py-2 border border-foreground hover:bg-foreground hover:text-background transition-all uppercase text-xs font-bold"
                >
                  重试
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-24 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center justify-center gap-2">
            <Rss className="w-8 h-8 text-primary" />
            RSS 订阅中心
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            订阅我们的RSS源，实时获取最新的新闻资讯。支持按来源分类和全部文章订阅。
          </p>
        </div>

        {/* Latest Articles RSS */}
        <Card className="mb-8 bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Rss className="w-5 h-5 text-primary" />
              最新文章 RSS
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              获取所有来源的最新30篇文章
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between bg-card p-4 border border-border">
              <div className="flex-1">
                <p className="font-medium text-foreground">全部最新文章</p>
                <p className="text-sm text-muted-foreground font-mono break-all">
                  {typeof window !== 'undefined' ? window.location.origin : ''}{rssData?.latestRssUrl}
                </p>
              </div>
              <div className="flex gap-2 ml-4">
                <button
                  onClick={() => copyToClipboard(rssData?.latestRssUrl || '')}
                  className="p-2 border border-transparent hover:border-foreground transition-all"
                  title="复制RSS链接"
                >
                  {copiedUrl === rssData?.latestRssUrl ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => openRSSFeed(rssData?.latestRssUrl || '')}
                  className="p-2 border border-transparent hover:border-foreground transition-all"
                  title="打开RSS源"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Source-specific RSS */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Rss className="w-5 h-5" />
              按来源分类的RSS
            </CardTitle>
            <CardDescription>
              根据新闻来源订阅特定的RSS源，每个来源提供最新30篇文章
            </CardDescription>
          </CardHeader>
          <CardContent>
            {rssData?.sources.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Rss className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>暂无可用的RSS源</p>
                <p className="text-sm mt-1">请先运行爬虫程序收集文章</p>
              </div>
            ) : (
              <div className="space-y-4">
                {rssData?.sources.map((source, index) => (
                  <div key={source.source}>
                    <div className="flex items-center justify-between p-4 border border-border hover:border-foreground transition-all">
                      <div className="flex-1">
                        <h3 className="font-medium text-foreground">{source.label}</h3>
                        <p className="text-xs text-muted-foreground font-mono break-all mt-1">
                          {typeof window !== 'undefined' ? window.location.origin : ''}{source.rssUrl}
                        </p>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => copyToClipboard(source.rssUrl)}
                          className="p-2 border border-transparent hover:border-foreground transition-all"
                          title="复制RSS链接"
                        >
                          {copiedUrl === source.rssUrl ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => openRSSFeed(source.rssUrl)}
                          className="p-2 border border-transparent hover:border-foreground transition-all"
                          title="打开RSS源"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {index < (rssData?.sources.length || 0) - 1 && (
                      <Separator className="my-2" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Usage Instructions */}
        <Card className="mt-8 bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">如何使用RSS订阅</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            <div className="space-y-3 text-sm">
              <div>
                <h4 className="font-medium">1. 复制RSS链接</h4>
                <p>点击复制按钮获取RSS源的完整URL</p>
              </div>
              <div>
                <h4 className="font-medium">2. 添加到RSS阅读器</h4>
                <p>将链接添加到您喜欢的RSS阅读器中，如Feedly、Inoreader、NetNewsWire等</p>
              </div>
              <div>
                <h4 className="font-medium">3. 实时更新</h4>
                <p>RSS源每小时更新一次，确保您获得最新的新闻资讯</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="mt-8 text-center">
          <button
            onClick={() => window.location.href = '/'}
            className="inline-flex items-center gap-2 px-6 py-3 border border-foreground hover:bg-foreground hover:text-background transition-all uppercase text-xs font-bold"
          >
            返回首页
          </button>
        </div>
      </div>
    </div>
  );
}
