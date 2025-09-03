import { Article } from './supabase';

export interface RSSItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  guid: string;
  source: string;
}

export interface RSSFeed {
  title: string;
  description: string;
  link: string;
  lastBuildDate: string;
  items: RSSItem[];
}

// Convert Article to RSS item
export function articleToRSSItem(article: Article): RSSItem {
  return {
    title: article.title,
    link: article.url,
    description: article.content.substring(0, 500) + (article.content.length > 500 ? '...' : ''),
    // pubDate: new Date(article.pub_date || article.created_at).toUTCString(),
    pubDate: new Date(article.created_at).toUTCString(),
    guid: article.url_hash,
    source: article.source
  };
}

// Generate RSS XML from articles
export function generateRSSXML(feed: RSSFeed): string {
  const items = feed.items.map(item => `
    <item>
      <title><![CDATA[${item.title}]]></title>
      <link>${item.link}</link>
      <description><![CDATA[${item.description}]]></description>
      <pubDate>${item.pubDate}</pubDate>
      <guid isPermaLink="true">${item.link}</guid>
      <source><![CDATA[${item.source}]]></source>
    </item>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title><![CDATA[${feed.title}]]></title>
    <description><![CDATA[${feed.description}]]></description>
    <link>${feed.link}</link>
    <lastBuildDate>${feed.lastBuildDate}</lastBuildDate>
    <atom:link href="${feed.link}" rel="self" type="application/rss+xml" />
    <language>zh-CN</language>
    <ttl>60</ttl>
    ${items}
  </channel>
</rss>`;
}

// Generate RSS feed for latest articles
export function generateLatestArticlesFeed(articles: Article[], baseUrl: string): RSSFeed {
  return {
    title: 'BlockNews - 最新文章',
    description: '来自 BlockNews 的最新新闻文章聚合',
    link: `${baseUrl}/rss/latest`,
    lastBuildDate: new Date().toUTCString(),
    items: articles.map(articleToRSSItem)
  };
}

// Generate RSS feed for source-specific articles
export function generateSourceArticlesFeed(articles: Article[], source: string, baseUrl: string): RSSFeed {
  return {
    title: `BlockNews - ${source}`,
    description: `来自 ${source} 的最新新闻文章`,
    link: `${baseUrl}/rss/source/${encodeURIComponent(source)}`,
    lastBuildDate: new Date().toUTCString(),
    items: articles.map(articleToRSSItem)
  };
}
