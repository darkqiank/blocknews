# 新闻爬虫系统

这是一个模块化的新闻爬虫系统，可以自动发现和运行`spider/news`目录下的所有爬虫模块，实现文章链接爬取、内容抓取和数据存储。

## 功能特性

- **模块化设计**: 自动发现和加载所有news模块
- **多数据库支持**: SQLite（默认）、PostgreSQL、Supabase
- **异步处理**: 支持同步和异步两种模式，提供更高性能
- **并发控制**: 可配置并发数和请求延迟
- **错误处理**: 完善的错误处理和日志记录
- **命令行界面**: 丰富的命令行参数支持
- **状态管理**: 链接状态跟踪，支持断点续爬

## 快速开始

### 1. 安装依赖

```bash
pip install -r spider/requirements.txt
```

### 2. 基本使用

```bash
# 使用默认SQLite数据库运行所有模块
python workflows/news_crawler.py

# 查看帮助
python workflows/news_crawler.py --help

# 列出所有可用模块
python workflows/news_crawler.py --list-modules

# 查看数据库统计信息
python workflows/news_crawler.py --stats-only
```

### 3. 数据库配置

#### SQLite (默认)
```bash
python workflows/news_crawler.py --db-type sqlite
```

#### PostgreSQL
```bash
python workflows/news_crawler.py --db-type postgresql \
  --pg-host localhost --pg-port 5432 --pg-database news \
  --pg-user postgres --pg-password yourpassword
```

#### Supabase
```bash
python workflows/news_crawler.py --db-type supabase \
  --supabase-url https://your-project.supabase.co \
  --supabase-key your-anon-key
```

### 4. 高级功能

#### 异步模式（推荐用于高性能）
```bash
python workflows/news_crawler.py --async --max-concurrent 20
```

#### 指定特定模块
```bash
python workflows/news_crawler.py --modules www_caixin_com
```

#### 限制文章数量
```bash
python workflows/news_crawler.py --max-articles 50
```

#### 只爬取链接，不爬取文章内容
```bash
python workflows/news_crawler.py --no-articles
```

#### 详细模式
```bash
python workflows/news_crawler.py --verbose
```

#### 干运行模式（测试配置）
```bash
python workflows/news_crawler.py --dry-run
```

## 命令行参数

### 基本参数
- `--db-type`: 数据库类型 (sqlite, postgresql, pg, supabase)
- `--modules`: 指定要运行的模块名称
- `--no-links`: 跳过链接爬取
- `--no-articles`: 跳过文章内容爬取
- `--max-articles`: 每个模块最大文章数量限制

### 性能参数
- `--async`: 使用异步模式
- `--max-workers`: 同步模式最大并发数 (默认: 5)
- `--max-concurrent`: 异步模式最大并发数 (默认: 10)
- `--delay-min`: 请求间隔最小延迟(秒) (默认: 1.0)
- `--delay-max`: 请求间隔最大延迟(秒) (默认: 3.0)
- `--timeout`: 请求超时时间(秒) (默认: 30)

### 数据库参数
#### SQLite
- `--sqlite-path`: SQLite数据库文件路径

#### PostgreSQL
- `--pg-host`: PostgreSQL主机地址
- `--pg-port`: PostgreSQL端口
- `--pg-database`: PostgreSQL数据库名
- `--pg-user`: PostgreSQL用户名
- `--pg-password`: PostgreSQL密码

#### Supabase
- `--supabase-url`: Supabase项目URL
- `--supabase-key`: Supabase匿名密钥

### 其他参数
- `--dry-run`: 仅验证模块和显示配置
- `--stats-only`: 仅显示当前数据库统计信息
- `--list-modules`: 仅列出所有可用模块
- `--verbose, -v`: 显示详细日志
- `--config`: 从JSON配置文件加载参数

## 配置文件

你可以使用JSON配置文件来管理复杂的配置：

```json
{
  "db_type": "postgresql",
  "pg_host": "localhost",
  "pg_database": "news",
  "pg_user": "postgres",
  "pg_password": "password",
  "async": true,
  "max_concurrent": 15,
  "delay_min": 0.5,
  "delay_max": 2.0,
  "max_articles": 100
}
```

使用配置文件：
```bash
python workflows/news_crawler.py --config config.json
```

## 系统架构

### 核心组件

1. **ModuleDiscovery** (`spider/module_discovery.py`)
   - 自动发现news模块
   - 验证模块完整性
   - 模块连接性测试

2. **DatabaseManager** (`spider/db_utils.py`)
   - 多数据库支持
   - 数据模型管理
   - 统计信息获取

3. **CrawlerWorkflow** (`spider/crawler_workflow.py`)
   - 同步爬虫工作流
   - 并发控制
   - 错误处理

4. **AsyncCrawlerWorkflow** (`spider/crawler_workflow.py`)
   - 异步爬虫工作流
   - 高性能处理
   - 协程管理

### 数据库表结构

#### articles表
```sql
CREATE TABLE articles (
    id INTEGER/SERIAL PRIMARY KEY,
    url TEXT UNIQUE NOT NULL,
    url_hash TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    pub_date TEXT,
    source TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### links表
```sql
CREATE TABLE links (
    id INTEGER/SERIAL PRIMARY KEY,
    url TEXT UNIQUE NOT NULL,
    url_hash TEXT UNIQUE NOT NULL,
    source TEXT NOT NULL,
    status TEXT DEFAULT 'pending',  -- pending, completed, failed
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 模块开发

### 模块结构
每个news模块需要包含以下文件：

```
spider/news/your_module/
├── __init__.py          # 模块配置和导出
├── fetch_url.py         # 网页获取功能
├── get_links.py         # 链接提取功能
├── get_content.py       # 内容提取功能
└── publish_info.json    # 发布信息（可选）
```

### 必需函数
每个模块必须实现以下函数：

1. `fetch_url(url, headers=None, timeout=20, use_proxy=False)`: 获取网页内容
2. `get_links(content)`: 从页面内容中提取文章链接
3. `get_content(content)`: 从文章页面中提取标题、内容、发布日期

### 示例模块
参考 `spider/news/www_caixin_com/` 目录下的实现。

## 日志

日志文件保存在 `spider/logs/crawler.log`，包含详细的执行信息和错误记录。

## 性能优化

1. **使用异步模式**: `--async` 参数可以显著提高爬取速度
2. **调整并发数**: 根据目标网站的承受能力调整 `--max-concurrent`
3. **设置合理延迟**: 通过 `--delay-min` 和 `--delay-max` 避免被反爬
4. **限制文章数量**: 使用 `--max-articles` 进行增量爬取

## 故障排除

### 常见问题

1. **模块验证失败**
   - 检查模块是否包含所有必需文件
   - 确认函数命名和签名正确

2. **数据库连接失败**
   - 检查数据库配置参数
   - 确认数据库服务正在运行
   - 验证用户权限

3. **爬取失败**
   - 检查网络连接
   - 验证目标网站是否可访问
   - 调整超时时间和重试策略

### 调试技巧

1. 使用 `--dry-run` 验证配置
2. 使用 `--verbose` 查看详细日志
3. 使用 `--list-modules` 检查模块状态
4. 使用 `--stats-only` 查看数据库状态

## 许可证

此项目基于MIT许可证开源。
