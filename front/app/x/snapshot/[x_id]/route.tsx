import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'
import { getXDataByXId, getXUserById } from '@/db_lib/supabase'
import { getProxiedImageUrl } from '@/db_lib/image-utils'

export const runtime = 'edge'

interface RouteParams {
  params: Promise<{ x_id: string }>
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { x_id } = await params
    const url = new URL(req.url)
    const autoHeight = url.searchParams.get('auto') !== '0' // 默认自动高度
    const includeMedia = url.searchParams.get('media') !== '0' // 默认包含媒体
    const maxHeightParam = parseInt(url.searchParams.get('maxHeight') || '')
    const maxHeight = Number.isFinite(maxHeightParam) ? Math.max(300, Math.min(8192, maxHeightParam)) : 4096
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
    }

    const username = item.username ? `@${item.username}` : '@用户'
    const createdAt = new Date(item.created_at).toLocaleString('zh-CN')

    // 文本和画布尺寸估算
    const baseWidth = 1200
    const horizontalPadding = 32 * 2
    const contentWidth = baseWidth - horizontalPadding
    const rawText = (fullText || '').toString()
    // 根据长度调整字体
    let textFontSize = 28
    if (rawText.length > 1200) textFontSize = 18
    else if (rawText.length > 600) textFontSize = 22
    const lineHeight = Math.round(textFontSize * 1.45)
    const avgCharWidth = textFontSize * 0.56 // 粗略估算
    const charsPerLine = Math.max(18, Math.floor(contentWidth / avgCharWidth))
    const lines = rawText.length === 0 ? 0 : Math.ceil(rawText.replace(/\n/g, '  ').length / charsPerLine)
    const textHeight = lines * lineHeight
    const headerHeight = 64 + 24 // 头像行 + 间距估算
    const mediaHeight = includeMedia && firstMedia ? 430 + 24 : 0
    const footerHeight = 28
    const verticalPadding = 32 * 2
    const requiredHeight = headerHeight + textHeight + mediaHeight + footerHeight + verticalPadding
    const finalHeight = autoHeight ? Math.min(Math.max(630, requiredHeight), maxHeight) : 630
    const didTruncate = autoHeight && requiredHeight > maxHeight
    const displayText = didTruncate ? (rawText.slice(0, charsPerLine * Math.floor((maxHeight - headerHeight - mediaHeight - footerHeight - verticalPadding) / lineHeight) - 1) + '…') : rawText

    return new ImageResponse(
      (
        <div
          style={{
            width: 1200,
            height: finalHeight,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#ffffff',
            color: '#111827',
            padding: 32,
            fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, Ubuntu, Cantarell, Helvetica Neue, Arial',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} width={64} height={64} style={{ borderRadius: 9999, display: 'flex' }} alt="avatar" />
            ) : (
              <div style={{ width: 64, height: 64, borderRadius: 9999, background: '#e5e7eb', display: 'flex' }} />
            )}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 28, fontWeight: 700, display: 'flex' }}>{username}</div>
              <div style={{ fontSize: 18, color: '#6b7280', display: 'flex' }}>{createdAt}</div>
            </div>
          </div>

          <div style={{ marginTop: 24, fontSize: textFontSize, lineHeight: 1.45, whiteSpace: 'pre-wrap', display: 'flex', wordBreak: 'break-word' }}>
            {displayText || '[无文本]'}
          </div>

          {includeMedia && firstMedia && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={firstMedia}
              alt="media"
              width={100}
              height={50}
              style={{ marginTop: 24, borderRadius: 16, objectFit: 'cover', display: 'flex' }}
            />
          )}

          <div style={{ marginTop: 'auto', fontSize: 16, color: '#9ca3af', display: 'flex' }}>
            blocknews snapshot • {x_id}{didTruncate ? ' • 已截断' : ''}
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


