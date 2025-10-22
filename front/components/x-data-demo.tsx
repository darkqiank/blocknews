'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { TweetCard } from '@/components/ui/tweet-card';
import { getProxiedImageUrl } from '@/db_lib/image-utils';
import { formatRelativeTime } from '@/components/ui/time-utils';

interface XUser {
  user_id: string;
  user_name: string;
  screen_name: string;
  user_link: string;
  avatar?: string;
  expire: boolean;
  created_at: string;
  updated_at: string;
}

interface XData {
  id: number; // Auto-increment primary key
  x_id: string;
  item_type: string;
  data: Record<string, unknown>;
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
    [key: string]: unknown;
  };
}

export function XDataDemo() {
  const [users, setUsers] = useState<XUser[]>([]);
  const [latestData, setLatestData] = useState<XData[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [userStats, setUserStats] = useState<{ [key: string]: number }>({});
  const [userLatestPosts, setUserLatestPosts] = useState<{ [key: string]: string }>({});
  const [isUserListExpanded, setIsUserListExpanded] = useState<boolean>(false);
  const [showBackToTop, setShowBackToTop] = useState<boolean>(false);
  const [onlyImportant, setOnlyImportant] = useState<boolean>(true);

  useEffect(() => {
    fetchUsers();
    fetchLatestData();
    fetchUserStats();
    
    // 监听滚动事件，控制回到顶部按钮显示
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 300);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // 当选择用户改变时重新获取数据
    fetchLatestData(true);
    setNextCursor(null);
    setHasMore(false);
    
    // 滚动到顶部
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
    
    // 在移动端选择用户后，收起用户列表
    if (window.innerWidth < 768 && selectedUserId) {
      setIsUserListExpanded(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId]);

  useEffect(() => {
    // 当重要性过滤改变时重新获取数据
    fetchLatestData(true);
    setNextCursor(null);
    setHasMore(false);
    
    // 滚动到顶部
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlyImportant]);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/x/users');
      const result = await response.json();
      if (result.success) {
        setUsers(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const fetchUserStats = async () => {
    try {
      const response = await fetch('/api/x/users/stats');
      const result = await response.json();
      if (result.success) {
        setUserStats(result.data.stats);
        setUserLatestPosts(result.data.latestPosts);
      }
    } catch (error) {
      console.error('Failed to fetch user stats:', error);
    }
  };

  const fetchLatestData = async (reset: boolean = true) => {
    try {
      let url = '/api/x/latest?limit=10&paginated=true';
      if (selectedUserId) {
        url += `&userId=${selectedUserId}`;
      }
      if (onlyImportant) {
        url += `&onlyImportant=true`;
      }
      
      const response = await fetch(url);
      const result = await response.json();
      if (result.success) {
        if (reset) {
          setLatestData(result.data);
        } else {
          setLatestData(prev => [...prev, ...result.data]);
        }
        setNextCursor(result.pagination?.nextCursor || null);
        setHasMore(result.pagination?.hasMore || false);
      }
    } catch (error) {
      console.error('Failed to fetch latest data:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMoreData = async () => {
    if (!hasMore || !nextCursor || loadingMore) return;
    
    setLoadingMore(true);
    try {
      let url = `/api/x/latest?limit=10&paginated=true&cursor=${encodeURIComponent(nextCursor)}`;
      if (selectedUserId) {
        url += `&userId=${selectedUserId}`;
      }
      if (onlyImportant) {
        url += `&onlyImportant=true`;
      }
      
      const response = await fetch(url);
      const result = await response.json();
      if (result.success) {
        setLatestData(prev => [...prev, ...result.data]);
        setNextCursor(result.pagination?.nextCursor || null);
        setHasMore(result.pagination?.hasMore || false);
      }
    } catch (error) {
      console.error('Failed to load more data:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  // 回到顶部函数
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  // 获取用户排序的逻辑（按最新文章时间排序）
  const getSortedUsers = () => {
    return users.sort((a, b) => {
      // 优先使用userLatestPosts中的时间，如果没有则使用updated_at
      const timeA = userLatestPosts[a.user_id] || a.updated_at;
      const timeB = userLatestPosts[b.user_id] || b.updated_at;
      return new Date(timeB).getTime() - new Date(timeA).getTime();
    });
  };


  if (loading) {
    return <LoadingSpinner message="加载数据中..." />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-8">
      {/* 页面标题 */}
      {/* <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">X (Twitter) 数据管理</h1>
        <p className="text-sm text-gray-600">管理和查看X平台的用户数据和推文内容</p>
      </div> */}

      {/* 左右分栏布局 */}
      <div className="flex gap-2 md:gap-6 lg:gap-8 min-h-0 relative">
        {/* 移动端窄侧栏头像轨道 */}
        <div className={`md:hidden transition-all duration-300 ${isUserListExpanded ? 'w-0 opacity-0' : 'w-14 sm:w-16'} flex-shrink-0`}>
          <div className="sticky top-20">
            <Card className="bg-card border border-border py-2 relative font-mono">
              {/* 展开按钮 - 固定在顶部 */}
              <div className="absolute top-0 left-0 right-0 z-20 overflow-hidden border-b border-border">
                <div className="absolute inset-0 bg-background"></div>
                
                <div className="relative flex justify-center pt-2 pb-2">
                  <button
                    onClick={() => setIsUserListExpanded(true)}
                    className="w-7 h-7 sm:w-8 sm:h-8 border border-transparent hover:border-foreground flex items-center justify-center transition-all"
                    title="展开用户列表"
                    aria-label="展开用户列表"
                  >
                    <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                      <path strokeLinecap="square" strokeLinejoin="miter" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-1.5 sm:p-2 pt-12 sm:pt-14 flex flex-col items-center max-h-[calc(100vh-12rem)] overflow-y-auto gap-1.5 sm:gap-2 scrollbar-hide">
                {/* ALL按钮 - 跟随滚动 */}
                <div className="relative">
                  <button
                    onClick={() => setSelectedUserId('')}
                    className={`relative w-10 h-10 sm:w-12 sm:h-12 overflow-hidden border transition-all ${
                      selectedUserId === '' ? 'border-foreground bg-foreground' : 'border-border hover:border-foreground'
                    }`}
                    title="全部用户"
                    aria-label="全部用户"
                  >
                    <div className={`w-full h-full flex items-center justify-center font-bold text-xs ${
                      selectedUserId === '' ? 'text-background' : 'text-foreground'
                    }`}>
                      ALL
                    </div>
                  </button>
                </div>
                {/* 用户头像列表（仅头像+角标） */}
                {getSortedUsers().map((user) => (
                    <div key={user.user_id} className="relative">
                      <button
                        onClick={() => setSelectedUserId(user.user_id)}
                        className={`relative w-10 h-10 sm:w-12 sm:h-12 overflow-hidden border transition-all ${
                          selectedUserId === user.user_id ? 'border-foreground' : 'border-border hover:border-foreground'
                        }`}
                        title={user.user_name}
                        aria-label={user.user_name}
                      >
                        <Image
                          src={getProxiedImageUrl(user.avatar || `${process.env.NEXT_PUBLIC_BASE_IMAGES_URL || '/avatars/'}${user.user_id}.png`)}
                          alt={user.user_name}
                          width={48}
                          height={48}
                          className="w-10 h-10 sm:w-12 sm:h-12 object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = `data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"48\" height=\"48\" viewBox=\"0 0 40 40\"><rect width=\"40\" height=\"40\" fill=\"%23000000\"/><text x=\"20\" y=\"25\" text-anchor=\"middle\" fill=\"%23ffffff\" font-size=\"12\" font-family=\"monospace\">${user.user_name.charAt(0).toUpperCase()}</text></svg>`;
                          }}
                          unoptimized
                        />
                      </button>
                      {/* 最新推文数角标 - 在容器外部避免被圆形蒙版切掉 */}
                      <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 min-w-[14px] sm:min-w-[16px] h-3.5 sm:h-4 px-1 sm:px-1.5 border border-foreground bg-background text-foreground text-[9px] sm:text-[10px] leading-3.5 sm:leading-4 text-center z-10 pointer-events-none font-mono">
                        {userStats[user.user_id] || 0}
                      </span>
                    </div>
                  ))}
              </div>
            </Card>
          </div>
        </div>

        {/* 移动端展开的用户列表 */}
        {isUserListExpanded && (
          <div className="md:hidden fixed inset-0 z-50 bg-background font-mono">
            <div className="flex flex-col h-full">
              {/* 头部 */}
              <div className="flex items-center justify-between p-4 border-b border-border bg-card">
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">[选择用户]</h2>
                <button
                  onClick={() => setIsUserListExpanded(false)}
                  className="w-8 h-8 border border-foreground flex items-center justify-center hover:bg-foreground hover:text-background transition-colors"
                >
                  ✕
                </button>
              </div>
              
              {/* 用户列表 */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {/* 全部用户选项 */}
                <div
                  onClick={() => setSelectedUserId('')}
                  className={`flex items-center p-3 cursor-pointer transition-all border ${
                    selectedUserId === '' 
                      ? 'border-foreground bg-foreground' 
                      : 'border-border hover:border-foreground'
                  }`}
                >
                  <div className={`w-10 h-10 border border-foreground flex items-center justify-center font-bold text-sm mr-3 ${
                    selectedUserId === '' ? 'bg-background text-foreground' : 'bg-foreground text-background'
                  }`}>
                    ALL
                  </div>
                  <div className="flex-1">
                    <div className={`font-bold text-xs uppercase ${selectedUserId === '' ? 'text-background' : 'text-foreground'}`}>全部用户</div>
                    <div className={`text-[10px] opacity-60 ${selectedUserId === '' ? 'text-background' : 'text-foreground'}`}>查看所有数据</div>
                  </div>
                </div>

                {/* 用户列表 */}
                {getSortedUsers().map((user) => (
                  <div
                    key={user.user_id}
                    onClick={() => setSelectedUserId(user.user_id)}
                    className={`flex items-center p-3 cursor-pointer transition-all border ${
                      selectedUserId === user.user_id 
                        ? 'border-foreground bg-foreground' 
                        : 'border-border hover:border-foreground'
                    }`}
                  >
                    <div className="relative mr-3">
                      <Image
                        src={getProxiedImageUrl(user.avatar || `${process.env.NEXT_PUBLIC_BASE_IMAGES_URL || '/avatars/'}${user.user_id}.png`)}
                        alt={user.user_name}
                        width={40}
                        height={40}
                        className="w-10 h-10 border border-border"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><rect width="40" height="40" fill="%23000000"/><text x="20" y="25" text-anchor="middle" fill="%23ffffff" font-size="12" font-family="monospace">${user.user_name.charAt(0).toUpperCase()}</text></svg>`;
                        }}
                        unoptimized
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`font-bold text-xs truncate uppercase ${selectedUserId === user.user_id ? 'text-background' : 'text-foreground'}`}>{user.user_name}</div>
                      <div className={`text-[11px] truncate opacity-60 ${selectedUserId === user.user_id ? 'text-background' : 'text-foreground'}`}>@{user.screen_name}</div>
                      <div className={`text-[10px] opacity-60 ${selectedUserId === user.user_id ? 'text-background' : 'text-foreground'}`}>
                        {userLatestPosts[user.user_id] ? 
                          `${formatRelativeTime(userLatestPosts[user.user_id])}` :
                          formatRelativeTime(user.updated_at)
                        }
                      </div>
                    </div>
                    <div className="text-right ml-2">
                      <div className={`text-xs font-bold ${selectedUserId === user.user_id ? 'text-background' : 'text-foreground'}`}>
                        {userStats[user.user_id] || 0}
                      </div>
                      <div className={`text-[10px] opacity-60 ${selectedUserId === user.user_id ? 'text-background' : 'text-foreground'}`}>今日</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 左侧用户列表（桌面端） */}
        <div className="hidden md:block w-72 lg:w-80 flex-shrink-0">
          <div className="sticky top-20">
            <Card className="bg-card border border-border py-4 font-mono">
              <div className="p-4 flex flex-col min-h-[400px] max-h-[calc(100vh-12rem)]">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
                  <h2 className="text-xs font-bold text-foreground uppercase tracking-wider">[选择用户]</h2>
                  <div className="text-[10px] opacity-60">
                    {users.filter(u => !u.expire).length}/{users.length}
                  </div>
                </div>
                
                {/* 全部用户选项 */}
                <div
                  onClick={() => setSelectedUserId('')}
                  className={`flex items-center p-3 cursor-pointer transition-all mb-2 border ${
                    selectedUserId === '' 
                      ? 'border-foreground bg-foreground' 
                      : 'border-border hover:border-foreground'
                  }`}
                >
                  <div className={`w-10 h-10 border border-foreground flex items-center justify-center font-bold text-sm mr-3 ${
                    selectedUserId === '' ? 'bg-background text-foreground' : 'bg-foreground text-background'
                  }`}>
                    ALL
                  </div>
                  <div className="flex-1">
                    <div className={`font-bold text-xs uppercase ${selectedUserId === '' ? 'text-background' : 'text-foreground'}`}>全部用户</div>
                    <div className={`text-[10px] opacity-60 ${selectedUserId === '' ? 'text-background' : 'text-foreground'}`}>查看所有最新数据</div>
                  </div>
                </div>
                
                {/* 用户列表 */}
                <div className="flex-1 overflow-y-auto space-y-2 scrollbar-hide relative group">
                  
                {getSortedUsers().map((user) => (
                  <div
                    key={user.user_id}
                    onClick={() => setSelectedUserId(user.user_id)}
                    className={`flex items-center p-3 cursor-pointer transition-all border ${
                      selectedUserId === user.user_id 
                        ? 'border-foreground bg-foreground' 
                        : 'border-border hover:border-foreground'
                    }`}
                  >
                    <div className="relative mr-3">
                      <Image
                        src={getProxiedImageUrl(user.avatar || `${process.env.NEXT_PUBLIC_BASE_IMAGES_URL || '/avatars/'}${user.user_id}.png`)}
                        alt={user.user_name}
                        width={40}
                        height={40}
                        className="w-10 h-10 border border-border"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><rect width="40" height="40" fill="%23000000"/><text x="20" y="25" text-anchor="middle" fill="%23ffffff" font-size="12" font-family="monospace">${user.user_name.charAt(0).toUpperCase()}</text></svg>`;
                        }}
                        unoptimized
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`font-bold text-xs truncate uppercase ${selectedUserId === user.user_id ? 'text-background' : 'text-foreground'}`}>{user.user_name}</div>
                      <div className={`text-[11px] truncate opacity-60 ${selectedUserId === user.user_id ? 'text-background' : 'text-foreground'}`}>@{user.screen_name}</div>
                      <div className={`text-[10px] opacity-60 ${selectedUserId === user.user_id ? 'text-background' : 'text-foreground'}`}>
                        {userLatestPosts[user.user_id] ? 
                          `${formatRelativeTime(userLatestPosts[user.user_id])}` :
                          formatRelativeTime(user.updated_at)
                        }
                      </div>
                    </div>
                    <div className="text-right ml-2">
                      <div className={`text-xs font-bold ${selectedUserId === user.user_id ? 'text-background' : 'text-foreground'}`}>
                        {userStats[user.user_id] || 0}
                      </div>
                      <div className={`text-[10px] opacity-60 ${selectedUserId === user.user_id ? 'text-background' : 'text-foreground'}`}>今日</div>
                    </div>
                  </div>
                ))}
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* 右侧数据展示 */}
        <div className={`flex-1 min-w-0 transition-all duration-300 ${isUserListExpanded ? 'md:block hidden' : 'block'}`}>
          <Card className="bg-card border border-border w-full py-3 sm:py-4 font-mono">
            <div className="p-3 sm:p-4">
              <div className="flex items-center justify-between mb-4 sm:mb-6 gap-2 pb-3 border-b border-border">
                <h2 className="text-xs sm:text-sm font-bold text-foreground truncate flex-1 min-w-0 uppercase tracking-wider">
                  {selectedUserId ? 
                    `[${users.find(u => u.user_id === selectedUserId)?.user_name || 'USER'}] (${latestData.length})` : 
                    `[最新] (${latestData.length})`
                  }
                </h2>
                
                {/* 重要性切换开关 */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] opacity-60 font-bold uppercase">只看重要</span>
                  <button
                    onClick={() => setOnlyImportant(!onlyImportant)}
                    className={`relative inline-flex h-4 w-8 items-center border border-foreground transition-colors duration-200 ${
                      onlyImportant ? 'bg-foreground' : 'bg-background'
                    }`}
                    title={onlyImportant ? '关闭重要筛选' : '开启重要筛选'}
                  >
                    <span
                      className={`inline-block h-2 w-2 border border-foreground transform transition-transform duration-200 ${
                        onlyImportant ? 'translate-x-5 bg-background' : 'translate-x-1 bg-foreground'
                      }`}
                    />
                  </button>
                </div>
                
                <button
                  onClick={() => fetchLatestData(true)}
                  disabled={loading}
                  className="p-2 border border-transparent hover:border-foreground transition-all disabled:opacity-50 flex-shrink-0"
                  title="刷新数据"
                >
                  <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={1} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
              
              {/* 数据展示区域 */}
              <div>
                {latestData.length === 0 && !loading ? (
                  /* 空状态 */
                  <div className="text-center py-12 border border-border">
                    <div className="mb-2 opacity-60">
                      <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2 2v-5m16 0h-2M4 13h2m0 0v5a2 2 0 002 2h4a2 2 0 002-2v-5m0 0V9a2 2 0 00-2-2H8a2 2 0 00-2 2v4.01" />
                      </svg>
                    </div>
                    <h3 className="text-xs font-bold mb-1 uppercase">[NO_DATA]</h3>
                    <p className="text-[10px] opacity-60">
                      {selectedUserId ? '该用户暂无X数据' : '当前没有X数据'}
                    </p>
                  </div>
                ) : (
                  /* 推文列表和加载更多 */
                  <div className="space-y-3 sm:space-y-4 w-full">
                    {latestData.map((item) => (
                      <div key={item.x_id} className="w-full">
                        <TweetCard item={item} users={users} />
                      </div>
                    ))}
                    
                    {/* 加载中的推文占位符 */}
                    {loadingMore && (
                      <div className="space-y-3 sm:space-y-4 w-full">
                        {[...Array(3)].map((_, i) => (
                          <div key={`loading-${i}`} className="p-3 sm:p-4 border border-border animate-pulse w-full">
                            <div className="flex items-start space-x-3">
                              <div className="w-8 h-8 sm:w-10 sm:h-10 border border-border flex-shrink-0"></div>
                              <div className="flex-1 space-y-2 min-w-0">
                                <div className="h-px bg-border w-1/4"></div>
                                <div className="h-px bg-border w-3/4"></div>
                                <div className="h-px bg-border w-1/2"></div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* 加载更多按钮 */}
                    <div className="text-center pt-6 sm:pt-8">
                      {hasMore ? (
                        <button
                          onClick={loadMoreData}
                          disabled={loadingMore}
                          className="px-4 sm:px-6 py-2 sm:py-3 border border-foreground text-sm uppercase font-bold hover:bg-foreground hover:text-background disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 mx-auto"
                        >
                          {loadingMore && (
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          )}
                          {loadingMore ? '[加载中...]' : '[加载更多]'}
                        </button>
                      ) : latestData.length > 0 ? (
                        <span className="text-[10px] opacity-60 uppercase">[NO_MORE_DATA]</span>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
        
        {/* 回到顶部按钮 */}
        {showBackToTop && (
          <button
            onClick={scrollToTop}
            className="fixed bottom-6 right-6 w-12 h-12 border-2 border-foreground bg-background hover:bg-foreground hover:text-background flex items-center justify-center transition-all z-40 font-mono"
            title="回到顶部"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={1} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </button>
        )}
      </div>
      </div>
    </div>
  );
}
