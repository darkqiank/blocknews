import RssPageClient from '../../components/rss-client';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '订阅 RSS - Beno',
  description: '订阅我们的 RSS 源，获取最新的新闻和文章更新。支持多种分类订阅源，实时获取平台最新内容。',
  keywords: ['RSS', '订阅', '新闻', '文章', 'Beno'],
  openGraph: {
    title: '订阅 RSS - Beno',
    description: '订阅我们的 RSS 源，获取最新的新闻和文章更新',
    type: 'website',
  },
};

export default function RSSPage() {
  return <RssPageClient />;
}