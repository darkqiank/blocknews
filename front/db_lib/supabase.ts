// import { createClient } from '@supabase/supabase-js';
import { PostgrestClient } from '@supabase/postgrest-js'

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables not found. RSS feeds will not work properly.');
}

// export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 添加认证头
export const supabase = new PostgrestClient(supabaseUrl, {
  headers: {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${supabaseAnonKey}`
  }
})

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

// X (Twitter) related interfaces
export interface XUser {
  user_id: string;
  user_name: string;
  screen_name: string;
  user_link: string;
  avatar?: string;
  expire: boolean;
  created_at: string;
  updated_at: string;
}

export interface XData {
  id: number; // Auto-increment primary key
  x_id: string;
  item_type: string;
  data: any; // JSONB data
  username?: string;
  user_id?: string;
  user_link?: string;
  created_at: string;
  more_info?: {
    ai_result?: {
      summary?: string;
      highlight_label?: string[];
      analyzed_at: string;
      is_important: boolean;
      model?: string;
    };
    [key: string]: any; // Allow for future extensions
  };
}

// X user helper functions
export async function getAllXUsers(includeExpired: boolean = false): Promise<XUser[]> {
  let query = supabase
    .from('t_x_users')
    .select('*')
    .order('created_at', { ascending: false });

  if (!includeExpired) {
    query = query.eq('expire', false);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching X users:', error);
    return [];
  }

  return data || [];
}

export async function getXUserById(userId: string): Promise<XUser | null> {
  const { data, error } = await supabase
    .from('t_x_users')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    console.error(`Error fetching X user ${userId}:`, error);
    return null;
  }

  return data;
}

// X data helper functions
export async function getLatestXData(limit: number = 30): Promise<XData[]> {
  const { data, error } = await supabase
    .from('t_x')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching latest X data:', error);
    return [];
  }

  return data || [];
}

export async function getXDataByUserId(userId: string, limit: number = 30): Promise<XData[]> {
  const { data, error } = await supabase
    .from('t_x')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error(`Error fetching X data for user ${userId}:`, error);
    return [];
  }

  return data || [];
}

export interface PagedXDataParams {
  userId?: string;
  itemType?: string;
  limit?: number;
  beforeCreatedAt?: string; // ISO timestamp cursor for created_at based pagination
  onlyImportant?: boolean; // Filter for only important AI analyzed content
}

export interface PagedXDataResult {
  items: XData[];
  nextCursor: string | null; // Now returns created_at timestamp as cursor
  hasMore: boolean;
}

export async function getPagedXData(params: PagedXDataParams = {}): Promise<PagedXDataResult> {
  const { userId, itemType, limit = 20, beforeCreatedAt, onlyImportant } = params;
  const pageSize = Math.max(1, Math.min(50, limit));

  let query = supabase
    .from('t_x')
    .select('*')
    .order('created_at', { ascending: false }) // Sort by created_at (newest first)
    .limit(pageSize + 1);

  if (userId) {
    query = query.eq('user_id', userId);
  }
  if (itemType) {
    query = query.eq('item_type', itemType);
  }
  if (beforeCreatedAt) {
    // Use created_at timestamp for cursor-based pagination
    query = query.lt('created_at', beforeCreatedAt);
  }
  if (onlyImportant) {
    // Filter for items that have AI analysis and are marked as important
    query = query.not('more_info->ai_result', 'is', null)
                 .eq('more_info->ai_result->is_important', true);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching paged X data:', error);
    return { items: [], nextCursor: null, hasMore: false };
  }

  const rows = data || [];
  const hasMore = rows.length > pageSize;
  const items = hasMore ? rows.slice(0, pageSize) : rows;
  const last = items[items.length - 1] || null;
  const nextCursor = last ? last.created_at : null;

  return { items, nextCursor, hasMore };
}
