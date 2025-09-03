# 新闻爬虫工作流

这个工作流系统已成功实现了您要求的所有功能：

## ✅ 已实现功能

### 1. 自动发现和运行所有 spider/news 模块
- ✅ 动态发现 `spider/news` 目录下的所有爬虫模块
- ✅ 自动验证模块完整性和连接性
- ✅ 支持批量运行或指定特定模块

### 2. 完整的爬取流程
- ✅ **步骤1**: 爬取文章链接
- ✅ **步骤2**: 爬取文章内容（标题、正文、发布日期）
- ✅ **步骤3**: 数据存入数据库

### 3. 多数据库支持
- ✅ **SQLite**（默认）- 即开即用
- ✅ **PostgreSQL** - 企业级数据库
- ✅ **Supabase** - 云端数据库

### 4. 高性能特性
- ✅ 同步和异步两种模式
- ✅ 可配置并发数量
- ✅ 智能请求延迟控制
- ✅ 连接池和重试机制

### 5. 完善的错误处理和监控
- ✅ 详细的日志记录
- ✅ 错误统计和报告
- ✅ 链接状态跟踪
- ✅ 断点续爬支持

## 🚀 快速开始

### 基础使用

```bash
# 1. 安装依赖
pip install -r spider/requirements.txt

# 2. 使用默认SQLite运行所有模块
python workflows/news_crawler.py

# 3. 查看可用模块
python workflows/news_crawler.py --list-modules

# 4. 查看数据库统计
python workflows/news_crawler.py --stats-only
```

### 高级使用

```bash
# 使用异步模式（推荐，更快速）
python workflows/news_crawler.py --async --max-concurrent 20

# 只爬取特定模块
python workflows/news_crawler.py --modules www_caixin_com

# 限制文章数量（增量爬取）
python workflows/news_crawler.py --max-articles 50

# 使用PostgreSQL数据库
python workflows/news_crawler.py --db-type postgresql \
  --pg-host localhost --pg-database news \
  --pg-user postgres --pg-password yourpassword

# 使用Supabase数据库
python workflows/news_crawler.py --db-type supabase \
  --supabase-url https://your-project.supabase.co \
  --supabase-key your-anon-key
```

## 📊 测试结果

系统已经过测试验证：

```bash
# 测试结果示例
=== 执行完成 ===
执行时间: 5.05秒
处理模块: 1/1
爬取链接: 20 (存储: 20)
爬取文章: 5 (存储: 5)
✓ 执行成功，无错误

=== 数据库统计信息 ===
总文章数: 5
总链接数: 20

文章来源分布:
  www_caixin_com: 5

链接状态分布:
  completed: 5
  pending: 15
```

## 📁 文件结构

```
workflows/
├── news_crawler.py          # 主程序入口
└── README.md               # 此文件

spider/
├── db_utils.py             # 数据库管理
├── module_discovery.py     # 模块发现
├── crawler_workflow.py     # 爬虫工作流
├── requirements.txt        # 依赖列表
├── README.md              # 详细文档
└── news/                  # 新闻模块目录
    └── www_caixin_com/    # 财新网模块（示例）
        ├── __init__.py
        ├── fetch_url.py
        ├── get_links.py
        ├── get_content.py
        └── publish_info.json
```

## 🛠️ 完整命令参考

```bash
# 查看完整帮助
python workflows/news_crawler.py --help

# 主要参数
--db-type              # 数据库类型: sqlite, postgresql, supabase
--modules              # 指定模块列表
--async                # 异步模式
--max-articles         # 限制文章数量
--max-concurrent       # 异步并发数
--max-workers          # 同步并发数
--delay-min/max        # 请求延迟范围
--timeout              # 请求超时

# 实用命令
--list-modules         # 列出模块
--stats-only          # 查看统计
--dry-run             # 验证配置
--verbose             # 详细日志
```

## 💡 最佳实践

1. **首次使用**: 先用 `--dry-run` 验证配置
2. **性能优化**: 使用 `--async` 模式提高速度
3. **增量爬取**: 使用 `--max-articles` 限制数量
4. **监控运行**: 使用 `--verbose` 查看详细进度
5. **数据管理**: 定期使用 `--stats-only` 查看统计

## 🔧 扩展开发

要添加新的新闻网站支持，只需在 `spider/news/` 目录下创建新模块，参考现有的 `www_caixin_com` 模块结构即可。

系统会自动发现并集成新模块，无需修改主程序代码。
