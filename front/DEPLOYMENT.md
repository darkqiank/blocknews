# BlockNews - 新闻聚合应用

## 项目简介

BlockNews 是一个现代化的新闻聚合应用，采用 Next.js 15 和 shadcn/ui 构建，具有以下特点：

### 🎨 设计特色
- **Classic Blog Style**: 经典博客风格设计，简洁优雅
- **Minimalist Style**: 极简主义风格，突出内容
- **现代风**: 采用现代设计元素和交互
- **响应式布局**: 
  - 宽屏时两栏留白居中布局
  - 窄屏时新闻信息顶到两侧（移动端适配）

### ✨ 功能特性
- **多RSS源聚合**: 支持配置多个RSS源
- **实时新闻**: 自动获取最新新闻内容
- **缓存机制**: 内置缓存减少API调用
- **响应式设计**: 完美适配各种屏幕尺寸
- **现代UI组件**: 使用 shadcn/ui 组件库

## 技术栈

- **前端框架**: Next.js 15 with React 19
- **UI组件**: shadcn/ui + Tailwind CSS
- **RSS解析**: rss-parser
- **字体**: Geist Sans & Geist Mono
- **图标**: Lucide React

## 项目结构

```
front/
├── app/
│   ├── api/news/route.ts    # RSS API路由
│   ├── layout.tsx           # 应用布局
│   ├── page.tsx            # 主页
│   └── globals.css         # 全局样式
├── components/
│   ├── ui/                 # shadcn/ui组件
│   └── news-list.tsx       # 新闻列表组件
├── config/
│   └── rss-feeds.ts        # RSS配置
└── lib/
    └── utils.ts            # 工具函数
```

## 配置说明

### RSS源配置

在 `config/rss-feeds.ts` 中配置RSS源：

```typescript
export const RSS_CONFIG = {
  feeds: [
    'https://feeds.bbci.co.uk/news/rss.xml',    // BBC News
    'https://rss.cnn.com/rss/edition.rss',      // CNN
    'https://feeds.npr.org/1001/rss.xml'        // NPR
  ],
  maxNewsCount: 20,
  cacheTime: 10 // 缓存时间（分钟）
};
```

### 环境变量（可选）

您也可以通过环境变量配置RSS源：

```bash
# .env.local
RSS_FEEDS=https://feeds.bbci.co.uk/news/rss.xml,https://rss.cnn.com/rss/edition.rss
MAX_NEWS_COUNT=20
```

## 快速开始

1. **安装依赖**
   ```bash
   npm install
   ```

2. **启动开发服务器**
   ```bash
   npm run dev
   ```

3. **访问应用**
   打开浏览器访问 `http://localhost:3000`

## 构建部署

1. **构建生产版本**
   ```bash
   npm run build
   ```

2. **启动生产服务器**
   ```bash
   npm run start
   ```

## API接口

### GET /api/news

获取聚合的新闻列表

**响应格式**:
```json
[
  {
    "title": "新闻标题",
    "link": "https://example.com/news/1",
    "pubDate": "2024-01-01T00:00:00.000Z",
    "source": "BBC News",
    "description": "新闻描述..."
  }
]
```

## 自定义配置

### 添加新的RSS源

在 `config/rss-feeds.ts` 的 `feeds` 数组中添加新的RSS URL：

```typescript
feeds: [
  'https://feeds.bbci.co.uk/news/rss.xml',
  'https://your-new-rss-source.com/feed.xml'  // 添加新源
]
```

### 调整缓存时间

修改 `cacheTime` 值（单位：分钟）：

```typescript
cacheTime: 15 // 15分钟缓存
```

### 调整新闻数量

修改 `maxNewsCount` 值：

```typescript
maxNewsCount: 50 // 显示50条新闻
```

## 浏览器兼容性

- Chrome/Edge 88+
- Firefox 85+
- Safari 14+
- 移动端浏览器完全支持

## 许可证

MIT License
