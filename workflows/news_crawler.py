#!/usr/bin/env python3
"""
新闻爬虫主程序

运行spider/news下的所有模块，实现：
1、爬取文章链接
2、文章链接爬取后，爬取文章内容  
3、数据存入数据库，默认使用sqlite，可指定pg类型数据库

使用方法:
  python workflows/news_crawler.py --help
  python workflows/news_crawler.py --db-type sqlite
  python workflows/news_crawler.py --db-type postgresql --pg-host localhost --pg-database news
"""

import sys
import os
import argparse
import asyncio
import json
from pathlib import Path
from typing import Dict, Any, Optional

# 添加项目根目录到Python路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from news_spider.crawler_workflow import CrawlerWorkflow, AsyncCrawlerWorkflow
from news_spider.db_utils import DatabaseManager
from news_spider.module_discovery import discover_and_validate_modules


def parse_arguments():
    """解析命令行参数"""
    parser = argparse.ArgumentParser(
        description="新闻爬虫 - 自动爬取所有news模块的文章链接和内容",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:

1. 使用默认SQLite数据库:
   python workflows/news_crawler.py

2. 使用PostgreSQL数据库:
   python workflows/news_crawler.py --db-type postgresql \\
     --pg-host localhost --pg-port 5432 --pg-database news \\
     --pg-user postgres --pg-password yourpassword


4. 只爬取特定模块:
   python workflows/news_crawler.py --modules www_caixin_com

5. 使用异步模式 (更快):
   python workflows/news_crawler.py --async --max-concurrent 20

6. 只爬取链接，不爬取文章内容:
   python workflows/news_crawler.py --no-articles

7. 限制每个模块最多爬取的文章数量:
   python workflows/news_crawler.py --max-articles 50
        """
    )
    
    # 基本参数
    parser.add_argument(
        '--db-type', 
        choices=['sqlite', 'postgresql', 'pg'],
        default='sqlite',
        help='数据库类型 (默认: sqlite)'
    )
    
    parser.add_argument(
        '--modules',
        nargs='+',
        help='指定要运行的模块名称，不指定则运行所有模块'
    )
    
    parser.add_argument(
        '--no-links',
        action='store_true',
        help='跳过链接爬取'
    )
    
    parser.add_argument(
        '--no-articles',
        action='store_true',
        help='跳过文章内容爬取'
    )
    
    parser.add_argument(
        '--max-articles',
        type=int,
        help='每个模块最大文章数量限制'
    )
    
    # 性能参数
    parser.add_argument(
        '--async',
        action='store_true',
        help='使用异步模式 (更高性能)'
    )
    
    parser.add_argument(
        '--max-workers',
        type=int,
        default=5,
        help='同步模式最大并发数 (默认: 5)'
    )
    
    parser.add_argument(
        '--max-concurrent',
        type=int,
        default=10,
        help='异步模式最大并发数 (默认: 10)'
    )
    
    parser.add_argument(
        '--delay-min',
        type=float,
        default=1.0,
        help='请求间隔最小延迟(秒) (默认: 1.0)'
    )
    
    parser.add_argument(
        '--delay-max',
        type=float,
        default=3.0,
        help='请求间隔最大延迟(秒) (默认: 3.0)'
    )
    
    parser.add_argument(
        '--timeout',
        type=int,
        default=30,
        help='请求超时时间(秒) (默认: 30)'
    )
    
    # SQLite参数
    parser.add_argument(
        '--sqlite-path',
        default='news_spider/db/news.db',
        help='SQLite数据库文件路径 (默认: news_spider/db/news.db)'
    )
    
    # PostgreSQL参数
    parser.add_argument('--pg-host', help='PostgreSQL主机地址')
    parser.add_argument('--pg-port', type=int, default=5432, help='PostgreSQL端口')
    parser.add_argument('--pg-database', help='PostgreSQL数据库名')
    parser.add_argument('--pg-user', help='PostgreSQL用户名')
    parser.add_argument('--pg-password', help='PostgreSQL密码')
    
    
    # 其他参数
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='仅验证模块和显示配置，不执行爬取'
    )
    
    parser.add_argument(
        '--stats-only',
        action='store_true',
        help='仅显示当前数据库统计信息'
    )
    
    parser.add_argument(
        '--list-modules',
        action='store_true',
        help='仅列出所有可用模块'
    )
    
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='显示详细日志'
    )
    
    parser.add_argument(
        '--config',
        help='从JSON配置文件加载参数'
    )
    
    return parser.parse_args()


def load_config_file(config_path: str) -> Dict[str, Any]:
    """从配置文件加载参数"""
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"加载配置文件失败: {e}")
        return {}


def build_db_config(args) -> Dict[str, Any]:
    """构建数据库配置"""
    db_config = {}
    
    if args.db_type == 'sqlite':
        db_config['db_path'] = args.sqlite_path
    
    elif args.db_type in ['postgresql', 'pg']:
        if args.pg_host:
            db_config['host'] = args.pg_host
        if args.pg_port:
            db_config['port'] = args.pg_port
        if args.pg_database:
            db_config['database'] = args.pg_database
        if args.pg_user:
            db_config['user'] = args.pg_user
        if args.pg_password:
            db_config['password'] = args.pg_password
    
    return db_config


def print_configuration(args, db_config: Dict[str, Any]):
    """打印配置信息"""
    print("=== 配置信息 ===")
    print(f"数据库类型: {args.db_type}")
    print(f"数据库配置: {db_config}")
    print(f"指定模块: {args.modules or '全部'}")
    print(f"爬取链接: {not args.no_links}")
    print(f"爬取文章: {not args.no_articles}")
    print(f"最大文章数: {args.max_articles or '无限制'}")
    print(f"异步模式: {getattr(args, 'async')}")
    print(f"并发数: {args.max_concurrent if getattr(args, 'async') else args.max_workers}")
    print(f"延迟范围: {args.delay_min}-{args.delay_max}秒")
    print(f"超时时间: {args.timeout}秒")
    print()


def list_modules_command():
    """列出所有可用模块"""
    print("=== 发现模块 ===")
    discovery = discover_and_validate_modules()
    
    if not discovery.list_modules():
        print("未发现任何模块")
        return
    
    stats = discovery.get_module_statistics()
    print(f"\n=== 模块统计 ===")
    print(f"总数: {stats['total_modules']}")
    print(f"有效: {stats['valid_modules']}")
    print(f"无效: {len(stats['invalid_modules'])}")
    
    if stats['invalid_modules']:
        print(f"\n=== 无效模块 ===")
        for invalid in stats['invalid_modules']:
            print(f"- {invalid['name']}: {', '.join(invalid['errors'])}")


def show_stats_command(db_config: Dict[str, Any], db_type: str):
    """显示数据库统计信息"""
    try:
        db_manager = DatabaseManager(db_type, **db_config)
        stats = db_manager.get_statistics()
        
        print("=== 数据库统计信息 ===")
        print(f"总文章数: {stats.get('total_articles', 0)}")
        print(f"总链接数: {stats.get('total_links', 0)}")
        
        if 'articles_by_source' in stats:
            print(f"\n文章来源分布:")
            for source, count in stats['articles_by_source'].items():
                print(f"  {source}: {count}")
        
        if 'links_by_status' in stats:
            print(f"\n链接状态分布:")
            for status, count in stats['links_by_status'].items():
                print(f"  {status}: {count}")
        
        db_manager.close()
        
    except Exception as e:
        print(f"获取统计信息失败: {e}")


def main():
    """主函数"""
    args = parse_arguments()
    
    # 加载配置文件
    if args.config:
        config = load_config_file(args.config)
        # 用配置文件更新参数（命令行参数优先）
        for key, value in config.items():
            if not hasattr(args, key) or getattr(args, key) is None:
                setattr(args, key, value)
    
    # 构建数据库配置
    db_config = build_db_config(args)
    
    # 处理特殊命令
    if args.list_modules:
        list_modules_command()
        return
    
    if args.stats_only:
        show_stats_command(db_config, args.db_type)
        return
    
    # 打印配置
    if args.verbose or args.dry_run:
        print_configuration(args, db_config)
    
    # 干运行模式
    if args.dry_run:
        print("=== 干运行模式 - 验证配置 ===")
        
        # 测试数据库连接
        try:
            db_manager = DatabaseManager(args.db_type, **db_config)
            print("✓ 数据库连接成功")
            db_manager.close()
        except Exception as e:
            print(f"✗ 数据库连接失败: {e}")
            return
        
        # 发现模块
        discovery = discover_and_validate_modules()
        if discovery.list_modules():
            print("✓ 模块发现成功")
        else:
            print("✗ 未发现有效模块")
        
        return
    
    # 执行爬虫工作流
    try:
        if getattr(args, 'async'):
            # 异步模式
            stats = asyncio.run(run_async_crawler(args, db_config))
        else:
            # 同步模式
            stats = run_sync_crawler(args, db_config)
        
        # 显示结果
        print_final_results(stats)
        
    except KeyboardInterrupt:
        print("\n用户中断执行")
    except Exception as e:
        print(f"执行失败: {e}")
        if args.verbose:
            import traceback
            traceback.print_exc()


def run_sync_crawler(args, db_config: Dict[str, Any]) -> Dict[str, Any]:
    """运行同步爬虫"""
    workflow = CrawlerWorkflow(
        db_type=args.db_type,
        db_config=db_config,
        max_workers=args.max_workers,
        delay_range=(args.delay_min, args.delay_max),
        timeout=args.timeout
    )
    
    return workflow.run_full_workflow(
        modules=args.modules,
        crawl_links=not args.no_links,
        crawl_articles=not args.no_articles,
        max_articles_per_module=args.max_articles
    )


async def run_async_crawler(args, db_config: Dict[str, Any]) -> Dict[str, Any]:
    """运行异步爬虫"""
    workflow = AsyncCrawlerWorkflow(
        db_type=args.db_type,
        db_config=db_config,
        max_concurrent=args.max_concurrent,
        delay_range=(args.delay_min, args.delay_max),
        timeout=args.timeout
    )
    
    return await workflow.run_async_workflow(
        modules=args.modules,
        crawl_links=not args.no_links,
        crawl_articles=not args.no_articles,
        max_articles_per_module=args.max_articles
    )


def print_final_results(stats: Dict[str, Any]):
    """打印最终结果"""
    duration = (stats['end_time'] - stats['start_time']).total_seconds()
    
    print(f"\n=== 执行完成 ===")
    print(f"执行时间: {duration:.2f}秒")
    print(f"处理模块: {stats['valid_modules']}/{stats['total_modules']}")
    print(f"爬取链接: {stats['total_links_crawled']} (存储: {stats['total_links_stored']})")
    print(f"爬取文章: {stats['total_articles_crawled']} (存储: {stats['total_articles_stored']})")
    
    if stats['errors']:
        print(f"\n遇到 {len(stats['errors'])} 个错误:")
        for error in stats['errors'][:5]:  # 只显示前5个错误
            print(f"  - {error}")
        if len(stats['errors']) > 5:
            print(f"  ... 还有 {len(stats['errors']) - 5} 个错误")
    else:
        print("\n✓ 执行成功，无错误")


if __name__ == "__main__":
    main()
