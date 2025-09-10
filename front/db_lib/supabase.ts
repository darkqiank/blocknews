import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables not found. RSS feeds will not work properly.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database interfaces matching our spider schema
export interface Article {
  id: number;
  url: string;
  url_hash: string;
  title: string;
  content: string;
  pub_date: string;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface Link {
  id: number;
  url: string;
  url_hash: string;
  source: string;
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
}

// Helper functions for RSS generation
export async function getLatestArticles(limit: number = 30): Promise<Article[]> {
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching latest articles:', error);
    return [];
  }

  return data || [];
}

export async function getArticlesBySource(source: string, limit: number = 30): Promise<Article[]> {
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('source', source)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error(`Error fetching articles for source ${source}:`, error);
    return [];
  }

  return data || [];
}

export interface PagedArticlesParams {
  source?: string;
  limit?: number;
  before?: string; // ISO timestamp (fallback)
  beforeId?: number; // Prefer precise id-based cursor
}

export interface PagedArticlesResult {
  items: Article[];
  nextCursor: string | null;
  hasMore: boolean;
}

export async function getPagedArticles(params: PagedArticlesParams = {}): Promise<PagedArticlesResult> {
  const { source, limit = 20, before, beforeId } = params;
  const pageSize = Math.max(1, Math.min(50, limit));

  let query = supabase
    .from('articles')
    .select('*')
    .order('id', { ascending: false })
    .limit(pageSize + 1);

  if (source) {
    query = query.eq('source', source);
  }
  if (beforeId !== undefined && beforeId !== null) {
    query = query.lt('id', beforeId);
  } else if (before) {
    query = query.lt('created_at', before);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching paged articles:', error);
    return { items: [], nextCursor: null, hasMore: false };
  }

  const rows = data || [];
  const hasMore = rows.length > pageSize;
  const items = hasMore ? rows.slice(0, pageSize) : rows;
  const last = items[items.length - 1] || null;
  const nextCursor = last ? String(last.id) : null;

  return { items, nextCursor, hasMore };
}

export async function getAllSources(): Promise<string[]> {
  const { data, error } = await supabase
    .from('articles')
    .select('source');

  if (error) {
    console.error('Error fetching sources:', error);
    return [];
  }

  // Extract unique sources
  const sources = Array.from(new Set(data?.map(item => item.source) || []));
  return sources;
}

export async function getSourceStats(): Promise<{ source: string; count: number }[]> {
  // Get all articles and group by source manually
  const { data, error } = await supabase
    .from('articles')
    .select('source');

  if (error) {
    console.error('Error fetching source stats:', error);
    return [];
  }

  // Count articles by source
  const sourceCount: { [key: string]: number } = {};
  data?.forEach(item => {
    sourceCount[item.source] = (sourceCount[item.source] || 0) + 1;
  });

  return Object.entries(sourceCount).map(([source, count]) => ({
    source,
    count
  }));
}
