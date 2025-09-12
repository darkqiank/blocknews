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

interface SourceItem {
  source: string;
  label: string;
  rssUrl: string;
}

// Client-side TTL cache for sources
const SOURCES_CACHE_KEY = 'bn_sources_cache';
const SOURCES_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function loadSourcesCache(): SourceItem[] | null {
  try {
    const raw = localStorage.getItem(SOURCES_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { sources: SourceItem[]; expireAt: number };
    if (Date.now() > parsed.expireAt) return null;
    return parsed.sources;
  } catch {
    return null;
  }
}

function saveSourcesCache(sources: SourceItem[]) {
  try {
    const payload = { sources, expireAt: Date.now() + SOURCES_CACHE_TTL_MS };
    localStorage.setItem(SOURCES_CACHE_KEY, JSON.stringify(payload));
  } catch {}
}

// 侧边栏新闻源筛选组件
const SourceSidebar = ({ 
  sources, 
  selectedSource, 
  onSourceChange, 
  loadingSources,
  newsCount 
}: {
  sources: SourceItem[];
  selectedSource: string | null;
  onSourceChange: (source: string | null) => void;
  loadingSources: boolean;
  newsCount: number;
}) => (
  <div className="w-64 flex-shrink-0">
    <div className="sticky top-20 bg-white rounded-lg shadow-sm p-4">
      {/* 标题区域 */}
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900 mb-1">实时新闻</h1>
        <p className="text-sm text-gray-600">
          {newsCount} 条新闻
          {selectedSource && ` · ${sources.find(s => s.source === selectedSource)?.label || selectedSource}`}
        </p>
      </div>
      
      {/* 新闻源筛选 */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-gray-900 mb-3">新闻来源</h3>
        
        {/* 全部来源按钮 */}
        <button
          onClick={() => onSourceChange(null)}
          className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            selectedSource === null 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
          }`}
        >
          全部来源
        </button>
        
        {/* 来源列表 */}
        <div className="space-y-1">
          {loadingSources ? (
            <div className="text-sm text-gray-500 px-3 py-2">加载来源...</div>
          ) : sources.length === 0 ? (
            <div className="text-sm text-gray-500 px-3 py-2">暂无来源</div>
          ) : (
            sources.map((source) => (
              <button
                key={source.source}
                onClick={() => onSourceChange(source.source)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectedSource === source.source 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                }`}
                title={`查看 ${source.label} 的新闻`}
              >
                {source.label}
              </button>
            ))
          )}
        </div>
        
        {/* 清除筛选按钮 */}
        {selectedSource && (
          <button
            onClick={() => onSourceChange(null)}
            className="w-full mt-3 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            清除筛选
          </button>
        )}
      </div>
    </div>
  </div>
);

export default function NewsList() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingSources, setLoadingSources] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);

  useEffect(() => {
    fetchSources();
  }, []);

  useEffect(() => {
    // Reset list when source changes
    setNews([]);
    setNextCursor(null);
    setHasMore(false);
    fetchNews(selectedSource, undefined, true);
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
        setError('来源加载失败');
      }
    } finally {
      setLoadingSources(false);
    }
  };

  const fetchNews = async (
    source: string | null,
    cursor?: string,
    replace: boolean = false
  ) => {
    try {
      if (replace) setLoading(true);
      else setLoadingMore(true);
      setError(null);
      const limit = 20;
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      if (cursor) params.set('before_id', cursor);

      const feedUrl = source
        ? `/api/rss/source/${encodeURIComponent(source)}?${params.toString()}`
        : `/api/rss/latest?${params.toString()}`;

      const response = await fetch(feedUrl);
      if (!response.ok) {
        throw new Error('新闻加载失败');
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

      setNews(prev => (replace ? newsItems : [...prev, ...newsItems]));
      // Compute next cursor from the last item's bn:id
      const lastItem = items[items.length - 1] as Element | undefined;
      const lastIdText = lastItem?.querySelector('bn\\:id')?.textContent || lastItem?.querySelector('id')?.textContent || '';
      const next = lastIdText && /^[0-9]+$/.test(lastIdText) ? lastIdText : null;
      setNextCursor(next);
      setHasMore(newsItems.length === limit);
    } catch (err) {
      console.error('Error fetching news:', err);
      setError(err instanceof Error ? err.message : '新闻加载失败');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = () => {
    if (!hasMore || loadingMore) return;
    fetchNews(selectedSource, nextCursor || undefined, false);
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
      <div className="min-h-screen bg-background pt-16">
        <div className="flex max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 gap-8">
          {/* 侧边栏 */}
          <SourceSidebar
            sources={sources}
            selectedSource={selectedSource}
            onSourceChange={setSelectedSource}
            loadingSources={loadingSources}
            newsCount={0}
          />
          
          {/* 主内容区域 */}
          <div className="flex-1">
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
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background pt-16">
        <div className="flex max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 gap-8">
          {/* 侧边栏 */}
          <SourceSidebar
            sources={sources}
            selectedSource={selectedSource}
            onSourceChange={setSelectedSource}
            loadingSources={loadingSources}
            newsCount={0}
          />
          
          {/* 主内容区域 */}
          <div className="flex-1">
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
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-16">
      <div className="flex max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 gap-8">
        {/* 侧边栏 */}
        <SourceSidebar
          sources={sources}
          selectedSource={selectedSource}
          onSourceChange={setSelectedSource}
          loadingSources={loadingSources}
          newsCount={news.length}
        />
        
        {/* 主内容区域 */}
        <main className="flex-1">
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

            {/* 加载更多 */}
            <div className="text-center pt-8">
              {hasMore ? (
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingMore ? '加载中...' : '加载更多'}
                </button>
              ) : (
                <span className="text-sm text-muted-foreground">没有更多了</span>
              )}
            </div>
          </div>
        )}
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-sm text-muted-foreground">
            新闻内容来源于自有爬虫系统
          </p>
        </div>
      </footer>
    </div>
  );
}