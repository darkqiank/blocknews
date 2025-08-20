// RSS 配置 - 您可以在这里配置 RSS 源
export const RSS_CONFIG = {
  // RSS 源列表
  feeds: [
    'https://feeds.bbci.co.uk/news/rss.xml',
    'https://rss.cnn.com/rss/edition.rss', 
    'https://feeds.npr.org/1001/rss.xml'
  ],
  // 新闻数量限制
  maxNewsCount: 20,
  // 缓存时间（分钟）
  cacheTime: 10
};

// 从环境变量获取配置，如果没有则使用默认配置
export function getRSSConfig() {
  return {
    feeds: process.env.RSS_FEEDS ? process.env.RSS_FEEDS.split(',') : RSS_CONFIG.feeds,
    maxNewsCount: process.env.MAX_NEWS_COUNT ? parseInt(process.env.MAX_NEWS_COUNT) : RSS_CONFIG.maxNewsCount,
    cacheTime: RSS_CONFIG.cacheTime
  };
}
