'use client';

import { useEffect, useState, useRef } from 'react';
import type { ReactNode } from 'react';
import Image from 'next/image';
import { Sparkles, Camera } from 'lucide-react';
import { XData } from '@/db_lib/supabase';
import { getProxiedImageUrl } from '@/db_lib/image-utils';
import { formatRelativeTime } from '@/components/ui/time-utils';
import { SnapshotModal } from '@/components/ui/snapshot-modal';
import { XIcon } from '@/components/ui/icons';


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

interface TweetCardProps {
  item: XData;
  users?: XUser[]; // 用户列表数据，用于获取头像信息
}

// 可折叠文本组件
function CollapsibleText({ 
  text, 
  limit = 500,
  renderContent 
}: { 
  text: string; 
  limit?: number;
  renderContent?: (text: string) => ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  
  if (!text) return null;
  
  const isLong = text.length > limit;
  const displayText = expanded ? text : text.slice(0, limit);
  
  return (
    <div className="whitespace-pre-wrap break-words font-mono text-xs">
      {renderContent ? renderContent(displayText) : displayText}
      {isLong && !expanded && (
        <>
          <span className="opacity-50">...</span>
          <button
            className="font-bold underline ml-1"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(true);
            }}
          >
            [EXPAND]
          </button>
        </>
      )}
      {isLong && expanded && (
        <>
          <span className="opacity-50">  </span>
        <button
          className="font-bold underline ml-1"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(false);
          }}
        >
          <span>[COLLAPSE]</span>
        </button>
        </>
      )}
    </div>
  );
}

export function TweetCard({ item, users = [] }: TweetCardProps) {
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isTouched, setIsTouched] = useState<boolean>(false);
  const [showSnapshotModal, setShowSnapshotModal] = useState<boolean>(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const isTweet = item.x_id.startsWith('tweet-');
  const isProfileConversation = item.x_id.startsWith('profile-conversation-');
  
  // 提取AI分析结果
  const getAIResult = () => {
    try {
      // 优先从 more_info 字段获取 ai_result
      if (item.more_info?.ai_result) {
        return item.more_info.ai_result;
      }
      // 兼容性处理：如果 more_info 中没有，尝试从 data 字段获取（用于迁移期间）
      // const data = typeof item.data === 'string' ? JSON.parse(item.data) : item.data;
      // return data?.ai_result || null;
    } catch {
      return null;
    }
  };
  
  const aiResult = getAIResult();
  
  // 渲染AI分析结果
  const renderAIAnalysis = () => {
    // 只显示重要信号（is_important: true 且有 summary）
    if (!aiResult || !aiResult.summary || aiResult.is_important === false) return null;
    
    return (
      <div className="mb-3 border border-foreground p-3 bg-background font-mono">
      {/* 内容主体 */}
      <div className="flex items-start space-x-2">
        <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-xs mb-2">
          <span className="font-bold mr-1">
            [AI解读]:
          </span>
            {aiResult.summary}
          </p>

          {/* 高亮标签 */}
          {aiResult.highlight_label && aiResult.highlight_label.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {aiResult.highlight_label.map((label: string, index: number) => (
                <span
                  key={index}
                  className="border border-foreground px-2 py-0.5 text-[10px] uppercase"
                >
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
    );
  };
  
  // 监听 ESC 关闭预览
  useEffect(() => {
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewImage(null);
    };
    document.addEventListener('keydown', keyHandler);
    return () => document.removeEventListener('keydown', keyHandler);
  }, []);
  
  // 构建原文链接
  const getOriginalUrl = (): string | null => {
    const base = item.user_link;
    if (!base) return null;
    const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
    const xid = item.x_id || '';
    if (xid.startsWith('tweet-')) {
      const tweetId = xid.substring(6);
      if (tweetId) return `${normalizedBase}/status/${tweetId}`;
    }
    if (xid.startsWith('profile-conversation-tweet-')) {
      const rest = xid.substring(27);
      const tweetId = rest.split('-tweet-')[0];
      if (tweetId) return `${normalizedBase}/status/${tweetId}`;
    }
    return null;
  };
  const originalUrl = getOriginalUrl();
  
  

  // 查找对应的用户数据以获取头像信息
  const currentUser = users.find(user => user.user_id === item.user_id);
  
  // 获取头像 URL，优先使用用户数据中的 avatar 字段
  const getAvatarUrl = () => {
    if (currentUser?.avatar) {
      return getProxiedImageUrl(currentUser.avatar);
    }
    // 回退到默认头像 URL
    return `${process.env.NEXT_PUBLIC_BASE_IMAGES_URL || '/avatars/'}${item.user_id}.png`;
  };
  
  // 处理推文文本中的特殊标记（@用户名、#话题标签、$股票标签）
  const processTextWithLinks = (text: string) => {
    if (!text) return null;
    
    // 正则表达式匹配 @用户名、#话题标签、$股票标签
    // @用户名和#话题标签：支持中英文、数字、下划线、连字符
    // $股票标签：必须以英文字母开头，只包含英文字母+数字+下划线+连字符，最长15个字符
    const regex = /(@[a-zA-Z0-9_\u4e00-\u9fa5-]+)|(\$[a-zA-Z][a-zA-Z0-9_-]{0,14})|(#[a-zA-Z0-9_\u4e00-\u9fa5-]+)/g;
    
    const parts = [];
    let lastIndex = 0;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      // 添加匹配前的普通文本
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      
      const matchedText = match[0];
      let href = '';
      
      if (matchedText.startsWith('@')) {
        // @用户名 -> https://x.com/username
        const username = matchedText.slice(1);
        href = `https://x.com/${username}`;
      } else if (matchedText.startsWith('$')) {
        // $股票标签 -> https://x.com/search?q=%24xxxx&src=cashtag_click
        const symbol = matchedText.slice(1);
        href = `https://x.com/search?q=%24${symbol}&src=cashtag_click`;
      } else if (matchedText.startsWith('#')) {
        // #话题标签 -> https://x.com/hashtag/xxxx
        const hashtag = matchedText.slice(1);
        href = `https://x.com/hashtag/${hashtag}`;
      }
      
      // 添加链接元素
      parts.push(
        <a
          key={`${match.index}-${matchedText}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="underline font-bold"
          onClick={(e) => e.stopPropagation()} // 防止事件冒泡
        >
          {matchedText}
        </a>
      );
      
      lastIndex = regex.lastIndex;
    }
    
    // 添加剩余的普通文本
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }
    
    return parts.length > 0 ? parts : text;
  };

  // 在正文中遇到 "RT @" 或 "quoted From @"（非开头）插入分割线
  const renderTextWithSeparators = (text: string) => {
    if (!text) return null;
    
    // 匹配 RT @ 或 quoted From @ 模式
    const separatorRegex = /(RT\s@|quoted From\s@)/gi;
    const firstNonWs = text.search(/\S/);
    const insertPositions: number[] = [];
    let match: RegExpExecArray | null;
    
    while ((match = separatorRegex.exec(text)) !== null) {
      const idx = match.index;
      // 只在非开头位置插入分割线
      if (idx > -1 && idx !== firstNonWs) {
        insertPositions.push(idx);
      }
    }

    if (insertPositions.length === 0) {
      // return processTextWithLinks(text);
      return <span>
        <CollapsibleText 
          text={text}
          renderContent={(text) => processTextWithLinks(text)}
        />
      </span>
    }

    const parts: ReactNode[] = [];
    let prev = 0;
    insertPositions.forEach((pos, i) => {
      if (pos > prev) {
        const segment = text.slice(prev, pos);
        parts.push(
          <span key={`seg-${i}`}>
            <CollapsibleText 
              text={segment}
              renderContent={(text) => processTextWithLinks(text)}
            />
          </span>
        );
      }
      // 添加分割线
      parts.push(
        <div key={`sep-${i}`} className="border-t border-border my-3 pt-3">
          <div className="text-[10px] opacity-60 mb-2 uppercase">
            {text.slice(pos).startsWith('RT @') ? '[RETWEET]' : '[QUOTE]'}
          </div>
        </div>
      );
      prev = pos;
    });
    
    if (prev < text.length) {
      const segment = text.slice(prev);
      parts.push(
        <span key={`seg-last`}>
          <CollapsibleText 
            text={segment}
            renderContent={(text) => processTextWithLinks(text)}
          />
        </span>
      );
    }
    
    return parts;
  };

  // 渲染推文内容
  const renderTweetContent = (data: Record<string, unknown>, isSubItem: boolean = false) => {
    const fullText = data.full_text as string;
    const urls = data.urls as Record<string, string[]>;
    const medias = data.medias as Record<string, string[]>;
    
    return (
      <div className={`${isSubItem ? 'ml-4 pl-4 border-l border-border' : ''}`}>
        {fullText && (
          <div className="mb-3">
            {renderTextWithSeparators(fullText)}
          </div>
        )}
        
        {/* 链接 */}
        {urls && Object.keys(urls).length > 0 && (
          <div className="mb-3">
            <div className="inline-flex items-center px-2 py-1 border border-foreground text-[10px] uppercase mb-2">
              [LINKS]
            </div>
            <div className="space-y-1">
              {Object.entries(urls).map(([, links]) =>
                links
                  .filter((link: string) => link !== null)
                  .map((link: string, index: number) => {
                    // 根据屏幕尺寸调整截断长度
                    const getMaxLength = () => {
                      if (typeof window !== 'undefined') {
                        return window.innerWidth < 640 ? 25 : window.innerWidth < 768 ? 35 : 45;
                      }
                      return 35; // 默认值
                    };
                    
                    const maxLength = getMaxLength();
                    const displayText = link.length > maxLength ? `${link.substring(0, maxLength)}...` : link;
                    
                    return (
                      <div key={index} className="w-full">
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-start text-[11px] underline break-all w-full"
                          title={link} // 显示完整链接作为提示
                        >
                          <svg className="w-3 h-3 mr-1 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
                          </svg>
                          <span className="break-all">{displayText}</span>
                        </a>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        )}
        
        {/* 媒体 */}
        {medias && Object.keys(medias).length > 0 && (
          <div className="mb-3">
            <div className="inline-flex items-center px-2 py-1 border border-foreground text-[10px] uppercase mb-2">
              [MEDIA]
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(medias).map(([, mediaLinks]) =>
                mediaLinks.map((media: string, index: number) => (
                  <div key={index} className="relative">
                    <Image
                      src={getProxiedImageUrl(media)}
                      alt="媒体内容"
                      width={200}
                      height={96}
                      className="w-full h-24 object-cover border border-border cursor-zoom-in"
                      onClick={() => setPreviewImage(media)}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = '/placeholder-image.png';
                      }}
                      unoptimized
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // 提取展示的创建时间，实现相对时间显示
  const getDisplayCreatedAt = (x: XData): string => {
    const rawData: unknown = x.data;
    let createdAt: string | undefined;
    if (Array.isArray(rawData)) {
      const first = rawData[0] as unknown;
      if (first && typeof first === 'object' && first !== null) {
        const firstObj = first as Record<string, unknown>;
        const nested = firstObj['data'];
        if (nested && typeof nested === 'object' && nested !== null) {
          const val = (nested as Record<string, unknown>)['created_at'];
          if (typeof val === 'string') {
            createdAt = val;
          }
        }
      }
    } else if (rawData && typeof rawData === 'object') {
      const val = (rawData as Record<string, unknown>)['created_at'];
      if (typeof val === 'string') {
        createdAt = val;
      }
    }
    const finalVal = createdAt ?? x.created_at;
    return formatRelativeTime(finalVal);
  };


  return (
    <>
    <div 
      ref={cardRef}
      className={`p-3 sm:p-4 border border-border transition-all w-full font-mono hover:border-foreground ${
        isTouched 
          ? 'border-foreground bg-muted' 
          : ''
      }`}
      onTouchStart={() => setIsTouched(true)}
      onTouchEnd={() => setIsTouched(false)}
      onTouchCancel={() => setIsTouched(false)}
    >
      {/* 头部信息 */}
      <div className="flex justify-between items-start mb-3 pb-3 border-b border-border">
        <div className="flex items-center space-x-3 min-w-0 flex-1">
          {/* 用户头像 */}
          {item.user_id && (
            <Image
              src={getAvatarUrl()}
              alt={currentUser?.user_name || item.username || '用户'}
              width={40}
              height={40}
              className="w-8 h-8 sm:w-10 sm:h-10 border border-border flex-shrink-0"
              onError={(e) => {
                // 使用与用户列表相同的错误处理逻辑
                const userName = currentUser?.user_name || item.username || '用户';
                (e.currentTarget as HTMLImageElement).src = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><rect width="40" height="40" fill="%23000000"/><text x="20" y="25" text-anchor="middle" fill="%23ffffff" font-size="12" font-family="monospace">${userName.charAt(0).toUpperCase()}</text></svg>`;
              }}
              unoptimized
            />
          )}
          
          <div className="min-w-0 flex-1">
            {/* 用户名和链接 */}
            <div className="font-bold text-xs sm:text-sm truncate uppercase">
              {item.user_link ? (
                <a
                  href={item.user_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  @{item.username || 'UNKNOWN'}
                </a>
              ) : (
                `@${item.username || 'UNKNOWN'}`
              )}
            </div>
            {/* 时间显示在用户名下方 */}
            <div className="text-[10px] opacity-60 mt-1 uppercase">
              {getDisplayCreatedAt(item)}
            </div>
          </div>
        </div>
        
        {/* 右侧操作按钮组 */}
        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
          {/* 原文链接 - 使用 X 图标 */}
          {originalUrl && (
            <a
              href={originalUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="查看 X 原文"
              className="p-1 border border-transparent hover:border-foreground"
            >
              <XIcon className="w-[14px] h-[14px]" />
            </a>
          )}
          
          {/* 截图按钮 */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowSnapshotModal(true);
            }}
            title="截图"
            className="p-1 border border-transparent hover:border-foreground"
            data-no-snapshot
          >
            <Camera size={14} />
          </button>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="">
        {/* AI分析结果 - 放在正文开头 */}
        {renderAIAnalysis()}
        
        {isTweet && renderTweetContent(item.data)}
        
        {isProfileConversation && Array.isArray(item.data) && (
          <div className="space-y-4">
            {item.data.map((subItem: Record<string, unknown>, index: number) => (
              <div key={(subItem.x_id as string) || index}>
                {index > 0 && <div className="border-t border-border pt-3 mt-3" />}
                {renderTweetContent(subItem.data as Record<string, unknown>, true)}
              </div>
            ))}
          </div>
        )}
        
        {/* 如果不是推文或对话，显示原始数据预览 */}
        {!isTweet && !isProfileConversation && (
          <div className="border border-border p-3">
            <div className="text-[10px] font-bold mb-2 uppercase">[DATA_PREVIEW]:</div>
            <div className="text-[11px] opacity-80 border border-border p-2 max-h-20 overflow-y-auto break-all">
              {typeof item.data === 'object' ? 
                JSON.stringify(item.data, null, 2).substring(0, 200) + (JSON.stringify(item.data).length > 200 ? '...' : '') :
                String(item.data).substring(0, 200) + (String(item.data).length > 200 ? '...' : '')
              }
            </div>
          </div>
        )}
      </div>

      {/* 图片预览遮罩 */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <Image
            src={getProxiedImageUrl(previewImage)}
            alt="预览"
            width={800}
            height={600}
            className="max-h-[90vh] max-w-[90vw] border border-white cursor-zoom-out object-contain"
            onClick={() => setPreviewImage(null)}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = '/placeholder-image.png';
            }}
            unoptimized
          />
        </div>
      )}
    </div>

    {/* 截图模态框 */}
    <SnapshotModal
      isOpen={showSnapshotModal}
      onClose={() => setShowSnapshotModal(false)}
      targetElement={cardRef.current}
      tweetId={item.x_id}
    />
    </>
  );
}
