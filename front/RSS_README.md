# RSS 展示页面使用说明

## 功能概述

RSS展示页面是一个基于Supabase数据库的RSS feed生成系统，可以将爬虫收集的文章数据转换为标准的RSS格式，供用户订阅。

## 主要功能

### 1. 最新文章RSS
- **路径**: `/api/rss/latest`
- **功能**: 提供所有来源的最新30篇文章
- **更新频率**: 每小时更新一次

### 2. 按来源分类的RSS
- **路径**: `/api/rss/source/[source]`
- **功能**: 提供特定来源的最新30篇文章
- **示例**: `/api/rss/source/www_caixin_com`

### 3. RSS展示页面
- **路径**: `/rss`
- **功能**: 展示所有可用的RSS源，支持复制链接和预览

## 配置步骤

### 1. 环境变量配置

复制 `env.example` 文件为 `.env.local` 并配置以下变量：

```bash
# Supabase 配置
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# 网站基础URL
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### 2. Supabase数据库设置

确保您的Supabase数据库包含以下表：

#### articles表
```sql
CREATE TABLE articles (
    id SERIAL PRIMARY KEY,
    url TEXT UNIQUE NOT NULL,
    url_hash TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    pub_date TEXT,
    source TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### links表（可选，用于爬虫状态管理）
```sql
CREATE TABLE links (
    id SERIAL PRIMARY KEY,
    url TEXT UNIQUE NOT NULL,
    url_hash TEXT UNIQUE NOT NULL,
    source TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 3. 运行爬虫收集数据

使用项目根目录的爬虫系统收集文章数据：

```bash
# 使用Supabase数据库运行爬虫
python workflows/news_crawler.py --db-type supabase \
  --supabase-url $SUPABASE_URL \
  --supabase-key $SUPABASE_KEY
```

### 4. 启动前端应用

```bash
cd front
npm install
npm run dev
```

## 使用方法

### 访问RSS展示页面
打开浏览器访问: `http://localhost:3000/rss`

### RSS订阅方式
1. **复制RSS链接**: 在RSS展示页面点击复制按钮
2. **添加到RSS阅读器**: 将链接粘贴到Feedly、Inoreader等RSS阅读器
3. **直接访问**: 也可直接在浏览器中访问RSS链接查看XML内容

### 可用的RSS链接
- 最新文章: `http://localhost:3000/api/rss/latest`
- 按来源分类: `http://localhost:3000/api/rss/source/[source名称]`

## API 接口

### GET /api/rss/latest
返回最新30篇文章的RSS XML格式

### GET /api/rss/source/[source]
返回指定来源最新30篇文章的RSS XML格式

### GET /api/rss/sources
返回所有可用RSS源的JSON数据
```json
{
  "sources": [
    {
      "source": "www_caixin_com",
      "count": 25,
      "rssUrl": "/api/rss/source/www_caixin_com"
    }
  ],
  "latestRssUrl": "/api/rss/latest"
}
```

## 特性

- **缓存机制**: RSS feeds每小时更新一次，提高性能
- **错误处理**: 完善的错误处理机制，确保RSS feed始终可用
- **响应式设计**: RSS展示页面支持移动端访问
- **标准兼容**: 生成的RSS遵循RSS 2.0标准
- **中文支持**: 完整支持中文内容和UTF-8编码

## 故障排除

### 常见问题

1. **RSS页面显示"暂无可用的RSS源"**
   - 确认爬虫已运行并收集了文章数据
   - 检查Supabase数据库连接配置
   - 确认数据库中存在articles表和数据

2. **RSS链接无法访问**
   - 检查环境变量配置是否正确
   - 确认Supabase服务正常运行
   - 检查网络连接

3. **RSS内容为空**
   - 确认数据库中有文章数据
   - 检查文章的pub_date字段格式
   - 查看浏览器控制台错误信息

### 调试技巧

1. 访问 `/api/rss/sources` 查看源数据
2. 检查浏览器网络标签页的API请求
3. 查看Next.js应用的控制台日志

## 部署注意事项

在生产环境部署时：

1. 更新 `NEXT_PUBLIC_BASE_URL` 为实际域名
2. 确保Supabase配置指向生产数据库
3. 设置适当的缓存策略
4. 配置HTTPS以确保RSS链接安全

## 技术栈

- **前端**: Next.js 15 + React 19
- **数据库**: Supabase (PostgreSQL)
- **UI组件**: shadcn/ui + Tailwind CSS
- **RSS生成**: 自定义RSS XML生成器
- **状态管理**: React Hooks
