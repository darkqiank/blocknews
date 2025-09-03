'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ExternalLink, Calendar, Globe, Rss } from 'lucide-react';

// Types
interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  description?: string;
}

interface SourceStats {
  source: string;
  count: number;
  rssUrl: string;
}

// Client-side TTL cache for sources
const SOURCES_CACHE_KEY = 'bn_sources_cache';
const SOURCES_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function loadSourcesCache(): SourceStats[] | null {
  try {
    const raw = localStorage.getItem(SOURCES_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { sources: SourceStats[]; expireAt: number };
    if (Date.now() > parsed.expireAt) return null;
    return parsed.sources;
  } catch {
    return null;
  }
}

function saveSourcesCache(sources: SourceStats[]) {
  try {
    const payload = { sources, expireAt: Date.now() + SOURCES_CACHE_TTL_MS };
    localStorage.setItem(SOURCES_CACHE_KEY, JSON.stringify(payload));
  } catch {}
}

// 页面标题组件
const PageHeader = ({ 
  newsCount, 
  currentSource, 
  onClearSource 
}: { 
  newsCount?: number; 
  currentSource?: string | null; 
  onClearSource?: () => void;
}) => (
  <div className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight flex flex-row items-center gap-2">
            <img src="/logon.svg" alt="BlockNews" className="w-10 h-10" />
            BlockNews
          </h1>
          <p className="text-muted-foreground mt-2">
            实时新闻聚合{typeof newsCount === 'number' ? ` · ${newsCount} 条新闻` : ''}
            {currentSource ? ` · 来源: ${currentSource}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          {currentSource && (
            <button
              onClick={onClearSource}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-primary bg-muted hover:bg-muted/80 rounded-md transition-colors"
            >
              清除来源
            </button>
          )}
          <button
            onClick={() => window.location.href = '/rss'}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-primary bg-muted hover:bg-muted/80 rounded-md transition-colors"
          >
            <Rss className="w-4 h-4" />
            RSS订阅
          </button>
        </div>
      </div>
    </div>
  </div>
);

export default function NewsList() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [sources, setSources] = useState<SourceStats[]>([]);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingSources, setLoadingSources] = useState(true);

  useEffect(() => {
    fetchSources();
  }, []);

  useEffect(() => {
    fetchNews(selectedSource);
  }, [selectedSource]);

  const fetchSources = async () => {
    try {
      setLoadingSources(true);
      // Try cache first
      const cached = loadSourcesCache();
      if (cached) {
        setSources(cached);
        setLoadingSources(false);
      }

      // Always refresh in background
      const response = await fetch('/api/rss/sources');
      if (!response.ok) {
        throw new Error('Failed to fetch sources');
      }
      const data = await response.json();
      
      if (data.sources?.length) {
        setSources(data.sources);
        saveSourcesCache(data.sources);
      }
    } catch (err) {
      console.error('Error fetching sources:', err);
      // Use cached data if available, otherwise show error
      if (!sources.length) {
        setError('Failed to load news sources');
      }
    } finally {
      setLoadingSources(false);
    }
  };

  const fetchNews = async (source: string | null) => {
    try {
      setLoading(true);
      setError(null);

      // Determine which RSS feed to use
      const feedUrl = source 
        ? `/api/rss/source/${encodeURIComponent(source)}`
        : '/api/rss/latest';

      const response = await fetch(feedUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch news');
      }

      // Parse RSS XML
      const text = await response.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, 'text/xml');
      
      // Extract news items from RSS
      const items = xmlDoc.querySelectorAll('item');
      const newsItems: NewsItem[] = Array.from(items).map(item => ({
        title: item.querySelector('title')?.textContent?.replace('<![CDATA[', '').replace(']]>', '') || '',
        link: item.querySelector('link')?.textContent || '',
        pubDate: item.querySelector('pubDate')?.textContent || '',
        source: item.querySelector('source')?.textContent?.replace('<![CDATA[', '').replace(']]>', '') || '',
        description: item.querySelector('description')?.textContent?.replace('<![CDATA[', '').replace(']]>', '') || ''
      }));

      setNews(newsItems);
    } catch (err) {
      console.error('Error fetching news:', err);
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

  const SourceSelector = useMemo(() => (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-4 max-w-4xl">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setSelectedSource(null)}
          className={`px-3 py-1.5 rounded-md text-sm border ${
            selectedSource === null 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-transparent hover:bg-muted'
          }`}
        >
          全部来源
        </button>
        {loadingSources ? (
          <span className="text-sm text-muted-foreground">加载来源...</span>
        ) : sources.length === 0 ? (
          <span className="text-sm text-muted-foreground">暂无来源</span>
        ) : (
          sources.map((s) => (
            <button
              key={s.source}
              onClick={() => setSelectedSource(s.source)}
              className={`px-3 py-1.5 rounded-md text-sm border ${
                selectedSource === s.source 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-transparent hover:bg-muted'
              }`}
              title={`查看 ${s.source} 的新闻 (${s.count} 篇)`}
            >
              {s.source}
              <span className="ml-1 text-xs opacity-60">({s.count})</span>
            </button>
          ))
        )}
      </div>
    </div>
  ), [sources, selectedSource, loadingSources]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader />
        <Separator />
        {SourceSelector}
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
        <Separator />
        {SourceSelector}
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-destructive font-medium">加载新闻时出错</p>
                <p className="text-sm text-muted-foreground mt-2">{error}</p>
                <button 
                  onClick={() => fetchNews(selectedSource)}
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
      <PageHeader 
        newsCount={news.length} 
        currentSource={selectedSource} 
        onClearSource={() => setSelectedSource(null)} 
      />
      <Separator />
      {SourceSelector}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-4xl">
        {news.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-muted-foreground">
                <Globe className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>暂无新闻内容</p>
                <button 
                  onClick={() => fetchNews(selectedSource)}
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
                onClick={() => fetchNews(selectedSource)}
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
            新闻内容来源于自有爬虫系统
          </p>
        </div>
      </footer>
    </div>
  );
}