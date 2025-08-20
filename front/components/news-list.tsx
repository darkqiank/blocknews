'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ExternalLink, Calendar, Globe } from 'lucide-react';
import { NewsItem } from '@/app/api/news/route';

// 页面标题组件
const PageHeader = ({ newsCount }: { newsCount?: number }) => (
  <div className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 max-w-4xl">
      <h1 className="text-3xl font-bold tracking-tight flex flex-row items-center gap-2">
        <img src="/logon.svg" alt="BlockNews" className="w-10 h-10" />
        BlockNews
      </h1>
      <p className="text-muted-foreground mt-2">
        实时新闻聚合{typeof newsCount === 'number' ? ` · ${newsCount} 条新闻` : ''}
      </p>
    </div>
  </div>
);

export default function NewsList() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/news');
      if (!response.ok) {
        throw new Error('Failed to fetch news');
      }
      const data = await response.json();
      setNews(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch news');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader />
        
        {/* Loading */}
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="space-y-6">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="space-y-2">
                  <div className="h-6 bg-muted rounded w-3/4"></div>
                  <div className="h-4 bg-muted rounded w-1/2"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-4 bg-muted rounded w-full"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader />

        {/* Error */}
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-destructive font-medium">加载新闻时出错</p>
                <p className="text-sm text-muted-foreground mt-2">{error}</p>
                <button 
                  onClick={fetchNews}
                  className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
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
    <div className="min-h-screen bg-background">
      <PageHeader newsCount={news.length} />

      {/* 分隔线 */}
      <Separator />

      {/* Main Content - 响应式布局 */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-4xl">
        {news.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-muted-foreground">
                <Globe className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>暂无新闻内容</p>
                <button 
                  onClick={fetchNews}
                  className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                >
                  刷新
                </button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {news.map((item, index) => (
              <Card key={index} className="group hover:shadow-md transition-all duration-200 border-l-4 border-l-transparent hover:border-l-primary">
                <CardHeader className="space-y-2 pb-3">
                  {/* 新闻标题 */}
                  <h2 className="text-lg font-medium leading-snug group-hover:text-primary transition-colors">
                    <a 
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-2 hover:underline"
                    >
                      <span className="flex-1">{item.title}</span>
                      <ExternalLink className="h-3.5 w-3.5 mt-0.5 opacity-60 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    </a>
                  </h2>
                  
                  {/* 元数据 */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>{formatDate(item.pubDate)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      <span>{item.source}</span>
                    </div>
                  </div>
                </CardHeader>

                {/* 新闻描述 */}
                {item.description && (
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                      {item.description.length > 150 ? item.description.substring(0, 150) + '...' : item.description}
                    </p>
                  </CardContent>
                )}
              </Card>
            ))}

            {/* 刷新按钮 */}
            <div className="text-center pt-8">
              <button 
                onClick={fetchNews}
                disabled={loading}
                className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '加载中...' : '刷新新闻'}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t mt-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 max-w-4xl">
          <p className="text-center text-sm text-muted-foreground">
            新闻内容来源于各大新闻网站 RSS 源
          </p>
        </div>
      </footer>
    </div>
  );
}
