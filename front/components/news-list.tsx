'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { CustomSelect, type SelectOption } from '@/components/ui/custom-select';
import { ExternalLink, Calendar, Globe, ArrowUp, ReplyAll } from 'lucide-react';

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

// 移动端筛选栏组件
const MobileFilterBar = ({
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
}) => {
  // 转换数据格式为 CustomSelect 需要的格式
  const selectOptions: SelectOption[] = [
    {
      value: '',
      label: '全部来源',
      icon: <ReplyAll className="h-3 w-3" />
    },
    ...sources.map(s => ({
      value: s.source,
      label: s.label,
      icon: <Globe className="h-3 w-3" />
    }))
  ];

  return (
    <div className="md:hidden w-full sticky top-16 z-30 bg-background/95 backdrop-blur-sm border-b border-border mb-4 font-mono">
      <div className="px-4 py-3">
        <div className="flex items-center gap-3">
          <CustomSelect
            options={selectOptions}
            value={selectedSource}
            onChange={(value) => {
              onSourceChange(value);
              // 筛选后自动回到顶部
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            placeholder="全部来源"
            disabled={loadingSources}
            className="flex-1"
          />
          <div className="text-xs text-muted-foreground border border-border px-2 py-1">
            {newsCount} 条
          </div>
        </div>
      </div>
    </div>
  );
};

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
    <div className="bg-card border border-border p-4 font-mono">
      {/* 标题区域 */}
      <div className="mb-4">
        <h1 className="text-xl font-bold text-foreground mb-1">实时新闻</h1>
        <p className="text-sm text-muted-foreground">
          {newsCount} 条新闻
          {selectedSource && ` · ${sources.find(s => s.source === selectedSource)?.label || selectedSource}`}
        </p>
      </div>
      
      {/* 新闻源筛选 */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-foreground mb-3">新闻来源</h3>
        
        {/* 全部来源按钮 */}
        <button
          onClick={() => onSourceChange(null)}
          className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            selectedSource === null 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
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
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
                title={`查看 ${source.label} 的新闻`}
              >
                {source.label}
              </button>
            ))
          )}
        </div>
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
  const [showScrollTop, setShowScrollTop] = useState<boolean>(false);

  useEffect(() => {
    fetchSources();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Reset list when source changes
    setNews([]);
    setNextCursor(null);
    setHasMore(false);
    fetchNews(selectedSource, undefined, true);
  }, [selectedSource]);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const fetchSources = useCallback(async () => {
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
  }, [sources.length]);

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
        <div className="flex max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 gap-4 md:gap-8">
          {/* 侧边栏（桌面端） */}
          <div className="hidden md:block md:sticky md:top-20 md:z-20 md:h-fit">
            <SourceSidebar
              sources={sources}
              selectedSource={selectedSource}
              onSourceChange={setSelectedSource}
              loadingSources={loadingSources}
              newsCount={0}
            />
          </div>
          
          {/* 主内容区域 */}
          <div className="flex-1">
            <MobileFilterBar
              sources={sources}
              selectedSource={selectedSource}
              onSourceChange={setSelectedSource}
              loadingSources={loadingSources}
              newsCount={0}
            />
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
        <div className="flex max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 gap-4 md:gap-8">
          {/* 侧边栏（桌面端） */}
          <div className="hidden md:block md:sticky md:top-20 md:z-20 md:h-fit">
            <SourceSidebar
              sources={sources}
              selectedSource={selectedSource}
              onSourceChange={setSelectedSource}
              loadingSources={loadingSources}
              newsCount={0}
            />
          </div>
          
          {/* 主内容区域 */}
          <div className="flex-1">
            <MobileFilterBar
              sources={sources}
              selectedSource={selectedSource}
              onSourceChange={setSelectedSource}
              loadingSources={loadingSources}
              newsCount={0}
            />
            <Card className="border-destructive">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-destructive font-medium">加载新闻时出错</p>
                  <p className="text-sm text-muted-foreground mt-2">{error}</p>
                  <button 
                    onClick={() => fetchNews(selectedSource)}
                    className="mt-4 px-4 py-2 border border-foreground hover:bg-foreground hover:text-background transition-all uppercase text-xs font-bold"
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
      <div className="flex max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 gap-4 md:gap-8">
        {/* 侧边栏（桌面端） */}
        <div className="hidden md:block md:sticky md:top-20 md:z-20 md:h-fit">
          <SourceSidebar
            sources={sources}
            selectedSource={selectedSource}
            onSourceChange={setSelectedSource}
            loadingSources={loadingSources}
            newsCount={news.length}
          />
        </div>
        
        {/* 主内容区域 */}
        <main className="flex-1">
        <MobileFilterBar
          sources={sources}
          selectedSource={selectedSource}
          onSourceChange={setSelectedSource}
          loadingSources={loadingSources}
          newsCount={news.length}
        />
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
              <Card key={index} className="group hover:border-foreground transition-all duration-200 border border-border">
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
                  <div className="flex flex-row items-center gap-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>{formatDate(item.pubDate)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      <span>{sources.find(s => s.source === item.source)?.label || item.source}</span>
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
            className="px-4 sm:px-6 py-2 sm:py-3 border border-foreground text-xs sm:text-sm uppercase font-bold hover:bg-foreground hover:text-background disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 mx-auto"
          >
                {loadingMore && (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
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

      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-40 p-3 border-2 border-foreground bg-background hover:bg-foreground hover:text-background focus:outline-none transition-all"
          aria-label="回到顶部"
          title="回到顶部"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      )}

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