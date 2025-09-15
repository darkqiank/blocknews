'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { TweetCard } from '@/components/ui/tweet-card';
import { getProxiedImageUrl } from '@/db_lib/image-utils';

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
            <Card className="bg-white shadow-sm py-2 relative">
              {/* 展开按钮 - 固定在顶部 */}
              <div className="absolute top-0 left-0 right-0 z-20 rounded-t-xl overflow-hidden">
                {/* 背景渐变遮罩 */}
                <div className="absolute inset-0 bg-gradient-to-b from-white via-white to-white/60 backdrop-blur-sm"></div>
                {/* 下方模糊边缘 */}
                <div className="absolute bottom-0 left-0 right-0 h-3 bg-gradient-to-b from-transparent to-white/40 blur-sm"></div>
                
                <div className="relative flex justify-center pt-2 pb-2">
                  <button
                    onClick={() => setIsUserListExpanded(true)}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-blue-500 hover:bg-blue-50/30 transition-all duration-200 backdrop-blur-sm shadow-sm hover:shadow-md transform hover:scale-105"
                    title="展开用户列表"
                    aria-label="展开用户列表"
                  >
                    <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-1.5 sm:p-2 pt-12 sm:pt-14 flex flex-col items-center max-h-[calc(100vh-12rem)] overflow-y-auto gap-1.5 sm:gap-2 scrollbar-hide">
                {/* ALL按钮 - 跟随滚动 */}
                <div className="relative">
                  <button
                    onClick={() => setSelectedUserId('')}
                    className={`relative w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden border bg-white transition-all shadow-sm ${
                      selectedUserId === '' ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-white border-blue-200 scale-[1.02]' : 'border-transparent hover:ring-1 hover:ring-gray-300'
                    }`}
                    title="全部用户"
                    aria-label="全部用户"
                  >
                    <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs sm:text-sm">
                      ALL
                    </div>
                  </button>
                </div>
                {/* 用户头像列表（仅头像+角标） */}
                {getSortedUsers().map((user) => (
                    <div key={user.user_id} className="relative">
                      <button
                        onClick={() => setSelectedUserId(user.user_id)}
                        className={`relative w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden border bg-white transition-all shadow-sm ${
                          selectedUserId === user.user_id ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-white border-blue-200 scale-[1.02]' : 'border-transparent hover:ring-1 hover:ring-gray-300'
                        }`}
                        title={user.user_name}
                        aria-label={user.user_name}
                      >
                        <Image
                          src={getProxiedImageUrl(user.avatar || `${process.env.NEXT_PUBLIC_BASE_IMAGES_URL || '/avatars/'}${user.user_id}.png`)}
                          alt={user.user_name}
                          width={48}
                          height={48}
                          className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gray-200 object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = `data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"48\" height=\"48\" viewBox=\"0 0 40 40\"><rect width=\"40\" height=\"40\" fill=\"%23e5e7eb\"/><text x=\"20\" y=\"25\" text-anchor=\"middle\" fill=\"%236b7280\" font-size=\"12\">${user.user_name.charAt(0).toUpperCase()}</text></svg>`;
                          }}
                          unoptimized
                        />
                      </button>
                      {/* 最新推文数角标 - 在容器外部避免被圆形蒙版切掉 */}
                      <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 min-w-[14px] sm:min-w-[16px] h-3.5 sm:h-4 px-1 sm:px-1.5 rounded-full bg-gray-900/80 text-white text-[9px] sm:text-[10px] leading-3.5 sm:leading-4 text-center backdrop-blur-sm shadow z-10 pointer-events-none">
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
          <div className="md:hidden fixed inset-0 z-50 bg-white">
            <div className="flex flex-col h-full">
              {/* 头部 */}
              <div className="flex items-center justify-between p-4 border-b bg-white">
                <h2 className="text-lg font-semibold text-gray-900">选择用户</h2>
                <button
                  onClick={() => setIsUserListExpanded(false)}
                  className="w-8 h-8 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  ✕
                </button>
              </div>
              
              {/* 用户列表 */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {/* 全部用户选项 */}
                <div
                  onClick={() => setSelectedUserId('')}
                  className={`flex items-center p-3 rounded-lg cursor-pointer transition-all ${
                    selectedUserId === '' 
                      ? 'bg-blue-50 border-2 border-blue-200' 
                      : 'hover:bg-gray-50 border border-transparent'
                  }`}
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm mr-3">
                    ALL
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">全部用户</div>
                    <div className="text-sm text-gray-500">查看所有最新数据</div>
                  </div>
                </div>

                {/* 用户列表 */}
                {getSortedUsers().map((user) => (
                  <div
                    key={user.user_id}
                    onClick={() => setSelectedUserId(user.user_id)}
                    className={`flex items-center p-3 rounded-lg cursor-pointer transition-all ${
                      selectedUserId === user.user_id 
                        ? 'bg-blue-50 border-2 border-blue-200' 
                        : 'hover:bg-gray-50 border border-transparent'
                    }`}
                  >
                    <div className="relative mr-3">
                      <Image
                        src={getProxiedImageUrl(user.avatar || `${process.env.NEXT_PUBLIC_BASE_IMAGES_URL || '/avatars/'}${user.user_id}.png`)}
                        alt={user.user_name}
                        width={40}
                        height={40}
                        className="w-10 h-10 rounded-full bg-gray-200 border"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><rect width="40" height="40" fill="%23e5e7eb"/><text x="20" y="25" text-anchor="middle" fill="%236b7280" font-size="12">${user.user_name.charAt(0).toUpperCase()}</text></svg>`;
                        }}
                        unoptimized
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">{user.user_name}</div>
                      <div className="text-sm text-gray-500 truncate">@{user.screen_name}</div>
                      <div className="text-xs text-gray-400">
                        {userLatestPosts[user.user_id] ? 
                          `最新: ${new Date(userLatestPosts[user.user_id]).toLocaleString('zh-CN')}` :
                          new Date(user.updated_at).toLocaleString('zh-CN')
                        }
                      </div>
                    </div>
                    <div className="text-right ml-2">
                      <div className="text-sm font-medium text-blue-600">
                        {userStats[user.user_id] || 0}
                      </div>
                      <div className="text-xs text-gray-400">今日</div>
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
            <Card className="bg-white shadow-sm py-4">
              <div className="p-4 flex flex-col min-h-[400px] max-h-[calc(100vh-12rem)]">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">用户列表</h2>
                  <div className="text-sm text-gray-500">
                    {users.filter(u => !u.expire).length}/{users.length}
                  </div>
                </div>
                
                {/* 全部用户选项 */}
                <div
                  onClick={() => setSelectedUserId('')}
                  className={`flex items-center p-3 rounded-lg cursor-pointer transition-all mb-2 ${
                    selectedUserId === '' 
                      ? 'bg-blue-50 border-2 border-blue-200' 
                      : 'hover:bg-gray-50 border border-transparent'
                  }`}
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm mr-3">
                    ALL
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">全部用户</div>
                    <div className="text-sm text-gray-500">查看所有最新数据</div>
                  </div>
                </div>
                
                {/* 用户列表 */}
                <div className="flex-1 overflow-y-auto space-y-2 scrollbar-hide relative group">
                  
                {getSortedUsers().map((user) => (
                  <div
                    key={user.user_id}
                    onClick={() => setSelectedUserId(user.user_id)}
                    className={`flex items-center p-3 rounded-lg cursor-pointer transition-all ${
                      selectedUserId === user.user_id 
                        ? 'bg-blue-50 border-2 border-blue-200' 
                        : 'hover:bg-gray-50 border border-transparent'
                    }`}
                  >
                    <div className="relative mr-3">
                      <Image
                        src={getProxiedImageUrl(user.avatar || `${process.env.NEXT_PUBLIC_BASE_IMAGES_URL || '/avatars/'}${user.user_id}.png`)}
                        alt={user.user_name}
                        width={40}
                        height={40}
                        className="w-10 h-10 rounded-full bg-gray-200 border"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><rect width="40" height="40" fill="%23e5e7eb"/><text x="20" y="25" text-anchor="middle" fill="%236b7280" font-size="12">${user.user_name.charAt(0).toUpperCase()}</text></svg>`;
                        }}
                        unoptimized
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">{user.user_name}</div>
                      <div className="text-sm text-gray-500 truncate">@{user.screen_name}</div>
                      <div className="text-xs text-gray-400">
                        {userLatestPosts[user.user_id] ? 
                          `最新: ${new Date(userLatestPosts[user.user_id]).toLocaleString('zh-CN')}` :
                          new Date(user.updated_at).toLocaleString('zh-CN')
                        }
                      </div>
                    </div>
                    <div className="text-right ml-2">
                      <div className="text-sm font-medium text-blue-600">
                        {userStats[user.user_id] || 0}
                      </div>
                      <div className="text-xs text-gray-400">今日</div>
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
          <Card className="bg-white shadow-sm w-full py-3 sm:py-4">
            <div className="p-3 sm:p-4">
              <div className="flex items-center justify-between mb-4 sm:mb-6 gap-2">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 truncate flex-1 min-w-0">
                  {selectedUserId ? 
                    `${users.find(u => u.user_id === selectedUserId)?.user_name || '用户'} 的数据 (${latestData.length})` : 
                    `最新 X 数据 (${latestData.length})`
                  }
                </h2>
                <button
                  onClick={() => fetchLatestData(true)}
                  disabled={loading}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                  title="刷新数据"
                >
                  <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
              
              {/* 数据展示区域 */}
              <div>
                {latestData.length === 0 && !loading ? (
                  /* 空状态 */
                  <div className="text-center py-12">
                    <div className="text-gray-400 mb-2">
                      <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2 2v-5m16 0h-2M4 13h2m0 0v5a2 2 0 002 2h4a2 2 0 002-2v-5m0 0V9a2 2 0 00-2-2H8a2 2 0 00-2 2v4.01" />
                      </svg>
                    </div>
                    <h3 className="text-sm font-medium text-gray-900 mb-1">暂无数据</h3>
                    <p className="text-sm text-gray-500">
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
                          <div key={`loading-${i}`} className="p-3 sm:p-4 border border-gray-200 rounded-lg animate-pulse w-full">
                            <div className="flex items-start space-x-3">
                              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-200 rounded-full flex-shrink-0"></div>
                              <div className="flex-1 space-y-2 min-w-0">
                                <div className="h-3 sm:h-4 bg-gray-200 rounded w-1/4"></div>
                                <div className="h-3 sm:h-4 bg-gray-200 rounded w-3/4"></div>
                                <div className="h-3 sm:h-4 bg-gray-200 rounded w-1/2"></div>
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
                          className="px-4 sm:px-6 py-2 sm:py-3 bg-blue-600 text-white text-sm sm:text-base rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 mx-auto"
                        >
                          {loadingMore && (
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          )}
                          {loadingMore ? '加载中...' : '加载更多'}
                        </button>
                      ) : latestData.length > 0 ? (
                        <span className="text-sm text-gray-500">没有更多了</span>
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
            className="fixed bottom-6 right-6 w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110 z-40"
            title="回到顶部"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
