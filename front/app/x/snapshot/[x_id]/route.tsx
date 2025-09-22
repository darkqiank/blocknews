import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'
import { getXDataByXId, getXUserById } from '@/db_lib/supabase'
import { getProxiedImageUrl } from '@/db_lib/image-utils'
import { formatRelativeTime } from '@/components/ui/time-utils'

export const runtime = 'edge'

interface RouteParams {
  params: Promise<{ x_id: string }>
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { x_id } = await params
    const url = new URL(req.url)
    const autoHeight = url.searchParams.get('auto') !== '0' // 默认自动高度
    const includeMedia = url.searchParams.get('media') === '1' // 默认不包含媒体
    const maxHeightParam = parseInt(url.searchParams.get('maxHeight') || '')
    const maxHeight = Number.isFinite(maxHeightParam) ? Math.max(400, Math.min(8192, maxHeightParam)) : 3000
    const item = await getXDataByXId(x_id)
    if (!item) {
      return new Response('Not Found', { status: 404 })
    }

    let avatarUrl = ''
    if (item.user_id) {
      const user = await getXUserById(item.user_id)
      if (user?.avatar) {
        avatarUrl = getProxiedImageUrl(user.avatar)
      }
    }

    const isTweet = item.x_id.startsWith('tweet-')
    const isProfileConversation = item.x_id.startsWith('profile-conversation-')
    let fullText: string | undefined
    let firstMedia: string | undefined
    
    if (isTweet && item.data) {
      fullText = item.data?.full_text
      const medias = item.data?.medias
      if (medias && typeof medias === 'object') {
        const entries = Object.values(medias as Record<string, string[]>) as string[][]
        const flat = entries.flat().filter(Boolean)
        if (flat.length > 0) {
          firstMedia = getProxiedImageUrl(flat[0] as string)
        }
      }
    } else if (isProfileConversation && Array.isArray(item.data)) {
      // 处理 ProfileConversation（对话数组）
      const textParts: string[] = []
      const allMedias: string[] = []
      
      item.data.forEach((subItem: Record<string, unknown>, index: number) => {
        const subData = (subItem.data || {}) as Record<string, unknown>
        const subText = subData.full_text as string
        if (subText) {
          if (index > 0) {
            textParts.push('------------------') // 使用短横线分隔
          }
          textParts.push(subText)
        }
        
        // 收集媒体
        const medias = subData.medias
        if (medias && typeof medias === 'object') {
          const entries = Object.values(medias as Record<string, string[]>) as string[][]
          const flat = entries.flat().filter(Boolean)
          allMedias.push(...flat)
        }
      })
      
      fullText = textParts.join('\n')
      if (allMedias.length > 0) {
        firstMedia = getProxiedImageUrl(allMedias[0])
      }
    }

    const username = item.username ? `@${item.username}` : '@用户'
    // const createdAt = new Date(item.created_at).toLocaleString('zh-CN')
    const createdAt = formatRelativeTime(item.created_at)

    // 文本处理，支持引用和转推的换行
    const processTextForSnapshot = (text: string): string => {
      if (!text) return '[无文本]'
      
      return text
        .replace(/https?:\/\/[^\s]+/g, '[链接]') // 替换长链接
        .replace(/\n{2,}/g, '\n') // 多个换行替换为单个换行
        .replace(/(^|\s)(RT @|quoted From @)/g, (match, prefix, pattern) => {
          const label = pattern === 'RT @' ? '转推：' : '引用：'
          return `${prefix}\n\n${label}@`
        }) // 合并处理转推和引用
        .trim()
    }

    const rawText = processTextForSnapshot(fullText || '')
    
    // 简化布局计算，针对中文优化
    const baseWidth = 1200
    const padding = 40
    const contentWidth = baseWidth - padding * 2
    
    // 中文字符更宽，调整计算
    let textFontSize = 24
    if (rawText.length > 1500) textFontSize = 20
    else if (rawText.length > 800) textFontSize = 22
    else if (rawText.length < 200) textFontSize = 26
    
    const lineHeight = 1.5
    
    // 中文字符宽度约为字体大小的0.9-1.0倍，英文约0.5-0.6倍
    // 估算中英文混合文本的平均字符宽度
    const chineseChars = (rawText.match(/[\u4e00-\u9fff]/g) || []).length
    const totalChars = rawText.length
    const chineseRatio = totalChars > 0 ? chineseChars / totalChars : 0.7 // 默认70%中文
    const avgCharWidth = textFontSize * (0.5 + chineseRatio * 0.4) // 0.5-0.9之间
    
    const charsPerLine = Math.floor(contentWidth / avgCharWidth)
    const newlineCount = (rawText.match(/\n/g) || []).length
    const estimatedLines = Math.ceil(rawText.length / charsPerLine) + newlineCount
    const textHeight = estimatedLines * textFontSize * lineHeight
    
    const headerHeight = 60 // 简化头部
    const mediaHeight = includeMedia && firstMedia ? 250 : 0
    const footerHeight = 24
    const totalPadding = padding * 2
    const minHeight = 300
    
    const requiredHeight = headerHeight + textHeight + mediaHeight + footerHeight + totalPadding
    const finalHeight = autoHeight ? Math.min(Math.max(minHeight, requiredHeight), maxHeight) : 500
    
    // 文本截断逻辑
    const didTruncate = autoHeight && requiredHeight > maxHeight
    let displayText = rawText
    if (didTruncate) {
      const availableHeight = maxHeight - headerHeight - mediaHeight - footerHeight - totalPadding
      const maxLines = Math.floor(availableHeight / (textFontSize * lineHeight))
      const maxChars = Math.max(100, maxLines * charsPerLine - 20)
      displayText = rawText.slice(0, maxChars).trim() + '…'
    }

    return new ImageResponse(
      (
        <div
          style={{
            width: 1200,
            height: finalHeight,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#ffffff',
            color: '#1f2937',
            padding: padding,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          {/* 简化头部 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img 
                src={avatarUrl} 
                width={40} 
                height={40} 
                style={{ borderRadius: 20, display: 'flex' }} 
                alt="avatar" 
              />
            ) : (
              <div style={{ 
                width: 40, 
                height: 40, 
                borderRadius: 20, 
                background: '#e5e7eb', 
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                color: '#6b7280'
              }}>
                {username.slice(1, 2).toUpperCase()}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 18, fontWeight: 600, display: 'flex' }}>
                {username}
              </div>
              <div style={{ fontSize: 14, color: '#6b7280', display: 'flex' }}>
                {createdAt}
              </div>
            </div>
          </div>

          {/* 正文区域 */}
          <div style={{ 
            fontSize: textFontSize, 
            lineHeight,
            whiteSpace: 'pre-wrap', 
            wordBreak: 'break-word',
            color: '#1f2937',
            flex: 1
          }}>
            {displayText}
          </div>

          {/* 媒体区域 */}
          {includeMedia && firstMedia && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={firstMedia}
              alt="media"
              width={contentWidth}
              height={250}
              style={{ 
                borderRadius: 8, 
                objectFit: 'cover', 
                display: 'flex',
                marginTop: 16
              }}
            />
          )}

          {/* 简化底部 */}
          <div style={{ 
            fontSize: 12, 
            color: '#9ca3af', 
            display: 'flex',
            marginTop: 16
          }}>
            blocknews • {x_id}{didTruncate ? ' • 文本已截断' : ''}
          </div>
        </div>
      ),
      {
        width: 1200,
        height: finalHeight,
      }
    )
  } catch (e) {
    console.error('snapshot route error', e)
    return new Response('Snapshot Error', { status: 500 })
  }
}


