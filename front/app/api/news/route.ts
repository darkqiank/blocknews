import { NextResponse } from 'next/server';
import Parser from 'rss-parser';
import { getRSSConfig } from '@/config/rss-feeds';

// RSS 解析器
const parser = new Parser();

// 新闻项接口
export interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  description?: string;
}

// 内存缓存
let cachedNews: NewsItem[] = [];
let lastFetchTime = 0;

export async function GET() {
  try {
    const config = getRSSConfig();
    const currentTime = Date.now();
    
    // 检查缓存是否过期（缓存时间以毫秒为单位）
    if (currentTime - lastFetchTime < config.cacheTime * 60 * 1000 && cachedNews.length > 0) {
      return NextResponse.json(cachedNews);
    }

    const allNews: NewsItem[] = [];

    // 并行获取所有 RSS 源
    const fetchPromises = config.feeds.map(async (feedUrl) => {
      try {
        const feed = await parser.parseURL(feedUrl);
        const sourceName = feed.title || new URL(feedUrl).hostname;

        return feed.items.map(item => ({
          title: item.title || '',
          link: item.link || '',
          pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
          source: sourceName,
          description: item.contentSnippet || item.content || ''
        }));
      } catch (error) {
        console.error(`Error fetching RSS from ${feedUrl}:`, error);
        return [];
      }
    });

    const results = await Promise.all(fetchPromises);
    
    // 合并所有结果
    results.forEach(newsItems => {
      allNews.push(...newsItems);
    });

    // 按发布时间排序（最新的在前）
    allNews.sort((a, b) => {
      const dateA = new Date(a.pubDate).getTime();
      const dateB = new Date(b.pubDate).getTime();
      return dateB - dateA;
    });

    // 限制新闻数量
    const limitedNews = allNews.slice(0, config.maxNewsCount);

    // 更新缓存
    cachedNews = limitedNews;
    lastFetchTime = currentTime;

    return NextResponse.json(limitedNews);

  } catch (error) {
    console.error('Error fetching news:', error);
    return NextResponse.json(
      { error: 'Failed to fetch news' },
      { status: 500 }
    );
  }
}
