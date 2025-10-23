'use client';

import { useState, useEffect } from 'react';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { CustomSelect, type SelectOption } from '@/components/ui/custom-select';

interface XUserData {
  user_id: string;
  user_name: string;
  screen_name: string;
  user_link: string;
  avatar?: string;
  expire: boolean;
  created_at: string;
  updated_at: string;
}

interface XUsersResponse {
  success: boolean;
  data: XUserData[];
  total: number;
}

export default function RssPageClient() {
  const [users, setUsers] = useState<XUserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [onlyImportant, setOnlyImportant] = useState(false);
  const [limit, setLimit] = useState(30);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchXUsers();
  }, []);

  const fetchXUsers = async () => {
    try {
      const response = await fetch('/api/x/users');
      if (!response.ok) {
        throw new Error('Failed to fetch X users');
      }
      const data: XUsersResponse = await response.json();
      if (data.success) {
        setUsers(data.data);
      } else {
        throw new Error('Failed to fetch X users');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const buildRSSUrl = () => {
    const baseUrl = selectedUser 
      ? `/api/x/rss/${selectedUser}` 
      : '/api/x/rss';
    
    const params = new URLSearchParams();
    if (limit !== 30) {
      params.set('limit', limit.toString());
    }
    if (onlyImportant) {
      params.set('onlyImportant', 'true');
    }
    
    const queryString = params.toString();
    return queryString ? `${baseUrl}?${queryString}` : baseUrl;
  };

  const copyToClipboard = async () => {
    try {
      const rssUrl = buildRSSUrl();
      const fullUrl = `${window.location.origin}${rssUrl}`;
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  if (loading) {
    return <LoadingSpinner fullPage message="加载中..." />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center font-mono">
        <div className="text-center text-xs">
          <p className="text-red-500 mb-4">ERROR: {error}</p>
          <button
            onClick={fetchXUsers}
            className="text-foreground hover:text-muted-foreground transition-colors"
          >
            [重试]
          </button>
        </div>
      </div>
    );
  }

  const currentUrl = buildRSSUrl();
  const fullUrl = typeof window !== 'undefined' ? `${window.location.origin}${currentUrl}` : currentUrl;

  // 用户选项
  const userOptions: SelectOption[] = [
    { value: '', label: 'all' },
    ...users.map(user => ({
      value: user.screen_name,
      label: user.screen_name
    }))
  ];

  // 数量选项
  const limitOptions: SelectOption[] = [
    { value: '10', label: '10' },
    { value: '20', label: '20' },
    { value: '30', label: '30' },
    { value: '40', label: '40' },
    { value: '50', label: '50' }
  ];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center py-8 px-4 font-mono">
      {/* 黄金分割位置：约 38.2% */}
      <div className="w-full max-w-2xl" style={{ marginTop: '-8vh' }}>
        {/* 外框和标题 */}
        <div className="border border-border p-6 sm:p-8">
          {/* 标题 */}
          <h1 className="text-lg sm:text-xl font-bold mb-6 tracking-tight">
            Just subscribe it!
          </h1>

          <div className="space-y-4 text-xs">
            {/* URL 显示 + Copy 按钮 */}
            <div className="flex items-center gap-2">
              <div className="flex-1 p-3 bg-muted/50 border border-border overflow-hidden whitespace-nowrap text-ellipsis">
                {fullUrl}
              </div>
              <button
                onClick={copyToClipboard}
                className={`px-3 py-3 border transition-all whitespace-nowrap ${
                  copied
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border text-foreground hover:border-foreground'
                }`}
              >
                {copied ? '[✓]' : '[复制]'}
              </button>
            </div>

            {/* 控件行 - 大屏一行，小屏多行 */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
              {/* 重要筛选 */}
              <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={onlyImportant}
                  onChange={(e) => setOnlyImportant(e.target.checked)}
                  className="appearance-none w-3 h-3 border border-foreground checked:bg-foreground cursor-pointer"
                />
                <span className={onlyImportant ? 'text-foreground' : 'text-muted-foreground'}>
                  只看重要
                </span>
              </label>

              {/* 用户选择 */}
              <CustomSelect
                options={userOptions}
                value={selectedUser}
                onChange={(value) => setSelectedUser(value || '')}
                placeholder="选择用户"
                className="w-full sm:min-w-[160px]"
              />

              {/* 数量选择 */}
              <CustomSelect
                options={limitOptions}
                value={limit.toString()}
                onChange={(value) => setLimit(parseInt(value || '30'))}
                placeholder="数量"
                className="w-full sm:w-[100px]"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
