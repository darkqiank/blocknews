import { Article, XData } from './supabase';

export interface RSSItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  guid: string;
  source: string;
  id?: number;
  created_at?: string;
  author?: string;
  username?: string;
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
    source: article.source,
    id: article.id,
    created_at: article.created_at
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
      <bn:id>${item.id ?? ''}</bn:id>
      <bn:created_at>${item.created_at ?? ''}</bn:created_at>
    </item>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:bn="https://blocknews.local/ns">
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

// Convert XData to RSS item
export function xDataToRSSItem(xData: XData): RSSItem {
  const data = xData.data || {};
  const text = data.text || data.full_text || '';
  const createdAt = data.created_at || xData.created_at;
  
  // Extract username from data or use fallback
  const username = xData.username || data.username || data.screen_name || 'unknown';
  const userId = xData.user_id || data.user_id || '';
  
  // Build title
  let title = `@${username}`;
  if (xData.more_info?.ai_result?.is_important) {
    title = `🔥 ${title}`;
  }
  if (text) {
    const preview = text.substring(0, 100);
    title += `: ${preview}${text.length > 100 ? '...' : ''}`;
  }
  
  // Build description with AI analysis if available
  let description = text;
  if (xData.more_info?.ai_result) {
    const aiResult = xData.more_info.ai_result;
    description = `<div>`;
    if (aiResult.summary) {
      description += `<p><strong>AI 摘要：</strong>${aiResult.summary}</p>`;
    }
    if (aiResult.highlight_label && aiResult.highlight_label.length > 0) {
      description += `<p><strong>标签：</strong>${aiResult.highlight_label.join(', ')}</p>`;
    }
    description += `<p><strong>原文：</strong>${text}</p>`;
    description += `</div>`;
  }
  
  // Build link to X post
  const xId = xData.x_id;
  const link = `https://x.com/${username}/status/${xId}`;
  
  return {
    title,
    link,
    description: description.substring(0, 1000) + (description.length > 1000 ? '...' : ''),
    pubDate: new Date(createdAt).toUTCString(),
    guid: xId,
    source: `X/@${username}`,
    id: xData.id,
    created_at: xData.created_at,
    author: username,
    username: username
  };
}

// Generate RSS feed for X data by user
export function generateXUserFeed(xDataList: XData[], username: string, baseUrl: string): RSSFeed {
  return {
    title: `X - @${username}`,
    description: `来自 @${username} 的 X (Twitter) 推文`,
    link: `${baseUrl}/api/x/rss/${username}`,
    lastBuildDate: new Date().toUTCString(),
    items: xDataList.map(xDataToRSSItem)
  };
}

// Generate RSS feed for all X data
export function generateAllXFeed(xDataList: XData[], baseUrl: string): RSSFeed {
  return {
    title: 'X - 全部推文',
    description: '来自所有订阅用户的 X (Twitter) 推文',
    link: `${baseUrl}/api/x/rss`,
    lastBuildDate: new Date().toUTCString(),
    items: xDataList.map(xDataToRSSItem)
  };
}
