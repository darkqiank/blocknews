import asyncio
import time
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
import random

from .db_utils import DatabaseManager, Article
from .module_discovery import ModuleDiscovery


# 确保日志目录存在
import os
os.makedirs('spider/logs', exist_ok=True)

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('spider/logs/crawler.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class CrawlerWorkflow:
    """新闻爬虫工作流管理器"""
    
    def __init__(self, 
                 db_type: str = "sqlite",
                 db_config: Optional[Dict[str, Any]] = None,
                 max_workers: int = 5,
                 delay_range: tuple = (1, 3),
                 timeout: int = 30):
        """
        初始化爬虫工作流
        
        Args:
            db_type: 数据库类型 (sqlite, postgresql)
            db_config: 数据库配置
            max_workers: 最大并发数
            delay_range: 请求延迟范围(秒)
            timeout: 请求超时时间(秒)
        """
        self.db_manager = DatabaseManager(db_type, **(db_config or {}))
        self.module_discovery = ModuleDiscovery()
        self.max_workers = max_workers
        self.delay_range = delay_range
        self.timeout = timeout
        
        # 统计信息
        self.stats = {
            'total_modules': 0,
            'valid_modules': 0,
            'total_links_crawled': 0,
            'total_links_stored': 0,
            'total_articles_crawled': 0,
            'total_articles_stored': 0,
            'errors': [],
            'start_time': None,
            'end_time': None
        }
        
        logger.info(f"初始化爬虫工作流 - 数据库类型: {db_type}, 最大并发: {max_workers}")
    
    def run_full_workflow(self, 
                         modules: Optional[List[str]] = None,
                         crawl_links: bool = True,
                         crawl_articles: bool = True,
                         max_articles_per_module: Optional[int] = None) -> Dict[str, Any]:
        """
        运行完整的爬虫工作流
        
        Args:
            modules: 指定要运行的模块列表，None表示运行所有模块
            crawl_links: 是否爬取链接
            crawl_articles: 是否爬取文章内容
            max_articles_per_module: 每个模块最大文章数量限制
        
        Returns:
            统计信息字典
        """
        self.stats['start_time'] = datetime.now()
        logger.info("开始运行爬虫工作流")
        
        try:
            # 1. 发现和验证模块
            available_modules = self._discover_modules()
            if not available_modules:
                logger.error("没有发现可用的模块")
                return self.stats
            
            # 2. 过滤模块
            target_modules = self._filter_modules(available_modules, modules)
            if not target_modules:
                logger.error("没有找到指定的模块")
                return self.stats
            
            logger.info(f"将处理 {len(target_modules)} 个模块: {[m['name'] for m in target_modules]}")
            
            # 3. 爬取链接
            if crawl_links:
                self._crawl_all_links(target_modules)
            
            # 4. 爬取文章内容
            if crawl_articles:
                self._crawl_all_articles(target_modules, max_articles_per_module)
            
            # 5. 更新统计信息
            self._update_final_stats()
            
        except Exception as e:
            logger.error(f"工作流执行失败: {e}")
            self.stats['errors'].append(f"工作流执行失败: {e}")
        
        finally:
            self.stats['end_time'] = datetime.now()
            self._log_final_stats()
            
        return self.stats
    
    def _discover_modules(self) -> List[Dict[str, Any]]:
        """发现并验证模块"""
        logger.info("开始发现模块...")
        
        modules = self.module_discovery.discover_modules()
        self.stats['total_modules'] = len(modules)
        
        valid_modules = []
        for module_info in modules:
            module_name = module_info['name']
            is_valid, errors = self.module_discovery.validate_module(module_name)
            
            if is_valid:
                valid_modules.append(module_info)
                self.stats['valid_modules'] += 1
                logger.info(f"模块 {module_name} 验证成功")
            else:
                error_msg = f"模块 {module_name} 验证失败: {', '.join(errors)}"
                logger.warning(error_msg)
                self.stats['errors'].append(error_msg)
        
        return valid_modules
    
    def _filter_modules(self, available_modules: List[Dict[str, Any]], 
                       target_modules: Optional[List[str]]) -> List[Dict[str, Any]]:
        """过滤模块"""
        if not target_modules:
            return available_modules
        
        filtered = []
        for module_info in available_modules:
            if module_info['name'] in target_modules:
                filtered.append(module_info)
        
        return filtered
    
    def _crawl_all_links(self, modules: List[Dict[str, Any]]):
        """爬取所有模块的链接"""
        logger.info("开始爬取链接...")
        
        for module_info in modules:
            try:
                self._crawl_module_links(module_info)
                time.sleep(random.uniform(*self.delay_range))
            except Exception as e:
                error_msg = f"模块 {module_info['name']} 链接爬取失败: {e}"
                logger.error(error_msg)
                self.stats['errors'].append(error_msg)
    
    def _crawl_module_links(self, module_info: Dict[str, Any]):
        """爬取单个模块的链接"""
        module_name = module_info['name']
        base_url = module_info['base_url']
        fetch_url = module_info['functions']['fetch_url']
        get_links = module_info['functions']['get_links']
        
        logger.info(f"开始爬取模块 {module_name} 的链接")
        
        try:
            # 获取页面内容
            content = fetch_url(base_url, timeout=self.timeout)
            if not content:
                raise Exception(f"无法获取页面内容: {base_url}")
            
            # 提取链接
            links = get_links(content)
            if not links:
                logger.warning(f"模块 {module_name} 没有找到链接")
                return
            
            self.stats['total_links_crawled'] += len(links)
            logger.info(f"模块 {module_name} 发现 {len(links)} 个链接")
            
            # 存储链接
            stored_count = self.db_manager.store_links(links, module_name)
            self.stats['total_links_stored'] += stored_count
            
            logger.info(f"模块 {module_name} 成功存储 {stored_count} 个链接")
            
        except Exception as e:
            raise Exception(f"爬取链接失败: {e}")
    
    def _crawl_all_articles(self, modules: List[Dict[str, Any]], 
                           max_articles_per_module: Optional[int] = None):
        """爬取所有模块的文章内容"""
        logger.info("开始爬取文章内容...")
        
        for module_info in modules:
            try:
                self._crawl_module_articles(module_info, max_articles_per_module)
            except Exception as e:
                error_msg = f"模块 {module_info['name']} 文章爬取失败: {e}"
                logger.error(error_msg)
                self.stats['errors'].append(error_msg)
    
    def _crawl_module_articles(self, module_info: Dict[str, Any], 
                              max_articles: Optional[int] = None):
        """爬取单个模块的文章内容"""
        module_name = module_info['name']
        fetch_url = module_info['functions']['fetch_url']
        get_content = module_info['functions']['get_content']
        
        logger.info(f"开始爬取模块 {module_name} 的文章内容")
        
        # 获取待处理的链接
        pending_links = self.db_manager.get_pending_links(
            source=module_name, 
            limit=max_articles
        )
        
        if not pending_links:
            logger.info(f"模块 {module_name} 没有待处理的链接")
            return
        
        logger.info(f"模块 {module_name} 有 {len(pending_links)} 个待处理链接")
        
        # 并发爬取文章
        articles = self._crawl_articles_concurrent(
            pending_links, module_name, fetch_url, get_content
        )
        
        if articles:
            # 存储文章
            stored_count = self.db_manager.store_articles(articles)
            self.stats['total_articles_stored'] += stored_count
            
            logger.info(f"模块 {module_name} 成功存储 {stored_count} 篇文章")
    
    def _crawl_articles_concurrent(self, urls: List[str], module_name: str,
                                  fetch_url, get_content) -> List[Article]:
        """并发爬取文章内容"""
        articles = []
        
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            # 提交任务
            future_to_url = {
                executor.submit(self._crawl_single_article, url, module_name, fetch_url, get_content): url 
                for url in urls
            }
            
            # 处理结果
            for future in as_completed(future_to_url):
                url = future_to_url[future]
                try:
                    article = future.result()
                    if article:
                        articles.append(article)
                        self.stats['total_articles_crawled'] += 1
                        
                        # 更新链接状态为已完成
                        self.db_manager.update_link_status(url, 'completed')
                        logger.debug(f"成功爬取文章: {url}")
                    else:
                        # 更新链接状态为失败
                        self.db_manager.update_link_status(url, 'failed')
                        logger.warning(f"文章内容为空: {url}")
                        
                except Exception as e:
                    # 更新链接状态为失败
                    self.db_manager.update_link_status(url, 'failed')
                    error_msg = f"爬取文章失败 {url}: {e}"
                    logger.error(error_msg)
                    self.stats['errors'].append(error_msg)
                
                # 添加延迟
                time.sleep(random.uniform(*self.delay_range))
        
        return articles
    
    def _crawl_single_article(self, url: str, module_name: str, 
                             fetch_url, get_content) -> Optional[Article]:
        """爬取单篇文章"""
        try:
            # 获取文章页面内容
            content = fetch_url(url, timeout=self.timeout)
            if not content:
                return None
            
            # 提取文章信息
            article_data = get_content(content)
            if not article_data or not article_data.get('title'):
                return None
            
            # 创建文章对象
            article = Article(
                url=url,
                title=article_data.get('title', ''),
                content=article_data.get('content', ''),
                pub_date=article_data.get('pub_date', ''),
                source=module_name
            )
            
            return article
            
        except Exception as e:
            logger.error(f"爬取单篇文章失败 {url}: {e}")
            return None
    
    def _update_final_stats(self):
        """更新最终统计信息"""
        db_stats = self.db_manager.get_statistics()
        self.stats.update(db_stats)
    
    def _log_final_stats(self):
        """记录最终统计信息"""
        duration = (self.stats['end_time'] - self.stats['start_time']).total_seconds()
        
        logger.info("=== 爬虫工作流完成 ===")
        logger.info(f"执行时间: {duration:.2f}秒")
        logger.info(f"总模块数: {self.stats['total_modules']}")
        logger.info(f"有效模块数: {self.stats['valid_modules']}")
        logger.info(f"爬取链接数: {self.stats['total_links_crawled']}")
        logger.info(f"存储链接数: {self.stats['total_links_stored']}")
        logger.info(f"爬取文章数: {self.stats['total_articles_crawled']}")
        logger.info(f"存储文章数: {self.stats['total_articles_stored']}")
        logger.info(f"错误数量: {len(self.stats['errors'])}")
        
        if self.stats['errors']:
            logger.warning("错误列表:")
            for error in self.stats['errors']:
                logger.warning(f"  - {error}")
    
    def get_status(self) -> Dict[str, Any]:
        """获取当前状态"""
        return {
            'stats': self.stats,
            'db_stats': self.db_manager.get_statistics(),
            'module_stats': self.module_discovery.get_module_statistics()
        }


class AsyncCrawlerWorkflow:
    """异步版本的爬虫工作流（高性能版本）"""
    
    def __init__(self, 
                 db_type: str = "sqlite",
                 db_config: Optional[Dict[str, Any]] = None,
                 max_concurrent: int = 10,
                 delay_range: tuple = (0.5, 2),
                 timeout: int = 30):
        """
        初始化异步爬虫工作流
        
        Args:
            db_type: 数据库类型
            db_config: 数据库配置
            max_concurrent: 最大并发数
            delay_range: 请求延迟范围(秒)
            timeout: 请求超时时间(秒)
        """
        self.db_manager = DatabaseManager(db_type, **(db_config or {}))
        self.module_discovery = ModuleDiscovery()
        self.semaphore = asyncio.Semaphore(max_concurrent)
        self.delay_range = delay_range
        self.timeout = timeout
        
        self.stats = {
            'total_modules': 0,
            'valid_modules': 0,
            'total_links_crawled': 0,
            'total_links_stored': 0,
            'total_articles_crawled': 0,
            'total_articles_stored': 0,
            'errors': [],
            'start_time': None,
            'end_time': None
        }
        
        logger.info(f"初始化异步爬虫工作流 - 最大并发: {max_concurrent}")
    
    async def run_async_workflow(self, 
                                modules: Optional[List[str]] = None,
                                crawl_links: bool = True,
                                crawl_articles: bool = True,
                                max_articles_per_module: Optional[int] = None) -> Dict[str, Any]:
        """运行异步爬虫工作流"""
        self.stats['start_time'] = datetime.now()
        logger.info("开始运行异步爬虫工作流")
        
        try:
            # 发现和验证模块
            available_modules = self._discover_modules()
            if not available_modules:
                logger.error("没有发现可用的模块")
                return self.stats
            
            # 过滤模块
            target_modules = self._filter_modules(available_modules, modules)
            if not target_modules:
                logger.error("没有找到指定的模块")
                return self.stats
            
            logger.info(f"将处理 {len(target_modules)} 个模块")
            
            # 并发爬取链接和文章
            tasks = []
            
            if crawl_links:
                for module_info in target_modules:
                    tasks.append(self._async_crawl_module_links(module_info))
            
            if crawl_articles:
                # 等待链接爬取完成再开始文章爬取
                if crawl_links:
                    await asyncio.gather(*tasks)
                    tasks = []
                
                for module_info in target_modules:
                    tasks.append(self._async_crawl_module_articles(module_info, max_articles_per_module))
            
            # 等待所有任务完成
            await asyncio.gather(*tasks)
            
            # 更新统计信息
            self._update_final_stats()
            
        except Exception as e:
            logger.error(f"异步工作流执行失败: {e}")
            self.stats['errors'].append(f"异步工作流执行失败: {e}")
        
        finally:
            self.stats['end_time'] = datetime.now()
            self._log_final_stats()
        
        return self.stats
    
    async def _async_crawl_module_links(self, module_info: Dict[str, Any]):
        """异步爬取模块链接"""
        async with self.semaphore:
            module_name = module_info['name']
            try:
                # 这里需要使用异步版本的fetch_url
                a_fetch_url = module_info['functions'].get('a_fetch_url')
                if not a_fetch_url:
                    # 如果没有异步版本，使用同步版本
                    await asyncio.get_event_loop().run_in_executor(
                        None, self._sync_crawl_module_links, module_info
                    )
                    return
                
                base_url = module_info['base_url']
                get_links = module_info['functions']['get_links']
                
                logger.info(f"异步爬取模块 {module_name} 的链接")
                
                # 异步获取页面内容
                content = await a_fetch_url(base_url, timeout=self.timeout)
                if not content:
                    raise Exception(f"无法获取页面内容: {base_url}")
                
                # 提取链接
                links = get_links(content)
                if not links:
                    logger.warning(f"模块 {module_name} 没有找到链接")
                    return
                
                self.stats['total_links_crawled'] += len(links)
                logger.info(f"模块 {module_name} 发现 {len(links)} 个链接")
                
                # 存储链接
                stored_count = self.db_manager.store_links(links, module_name)
                self.stats['total_links_stored'] += stored_count
                
                logger.info(f"模块 {module_name} 成功存储 {stored_count} 个链接")
                
                # 添加延迟
                await asyncio.sleep(random.uniform(*self.delay_range))
                
            except Exception as e:
                error_msg = f"异步爬取模块 {module_name} 链接失败: {e}"
                logger.error(error_msg)
                self.stats['errors'].append(error_msg)
    
    def _sync_crawl_module_links(self, module_info: Dict[str, Any]):
        """同步爬取模块链接（用于没有异步版本的模块）"""
        module_name = module_info['name']
        base_url = module_info['base_url']
        fetch_url = module_info['functions']['fetch_url']
        get_links = module_info['functions']['get_links']
        
        try:
            content = fetch_url(base_url, timeout=self.timeout)
            if not content:
                raise Exception(f"无法获取页面内容: {base_url}")
            
            links = get_links(content)
            if not links:
                logger.warning(f"模块 {module_name} 没有找到链接")
                return
            
            self.stats['total_links_crawled'] += len(links)
            stored_count = self.db_manager.store_links(links, module_name)
            self.stats['total_links_stored'] += stored_count
            
            logger.info(f"模块 {module_name} 成功存储 {stored_count} 个链接")
            
        except Exception as e:
            error_msg = f"同步爬取模块 {module_name} 链接失败: {e}"
            logger.error(error_msg)
            self.stats['errors'].append(error_msg)
    
    async def _async_crawl_module_articles(self, module_info: Dict[str, Any], 
                                          max_articles: Optional[int] = None):
        """异步爬取模块文章"""
        module_name = module_info['name']
        
        # 获取待处理的链接
        pending_links = self.db_manager.get_pending_links(
            source=module_name, 
            limit=max_articles
        )
        
        if not pending_links:
            logger.info(f"模块 {module_name} 没有待处理的链接")
            return
        
        logger.info(f"异步爬取模块 {module_name} 的 {len(pending_links)} 篇文章")
        
        # 创建文章爬取任务
        tasks = []
        for url in pending_links:
            tasks.append(self._async_crawl_single_article(url, module_info))
        
        # 等待所有文章爬取完成
        articles = await asyncio.gather(*tasks, return_exceptions=True)
        
        # 过滤有效文章
        valid_articles = [a for a in articles if isinstance(a, Article)]
        
        if valid_articles:
            stored_count = self.db_manager.store_articles(valid_articles)
            self.stats['total_articles_stored'] += stored_count
            logger.info(f"模块 {module_name} 成功存储 {stored_count} 篇文章")
    
    async def _async_crawl_single_article(self, url: str, module_info: Dict[str, Any]) -> Optional[Article]:
        """异步爬取单篇文章"""
        async with self.semaphore:
            try:
                module_name = module_info['name']
                a_fetch_url = module_info['functions'].get('a_fetch_url')
                get_content = module_info['functions']['get_content']
                
                if not a_fetch_url:
                    # 使用同步版本
                    fetch_url = module_info['functions']['fetch_url']
                    content = await asyncio.get_event_loop().run_in_executor(
                        None, fetch_url, url, None, self.timeout
                    )
                else:
                    # 使用异步版本
                    content = await a_fetch_url(url, timeout=self.timeout)
                
                if not content:
                    self.db_manager.update_link_status(url, 'failed')
                    return None
                
                # 提取文章信息
                article_data = get_content(content)
                if not article_data or not article_data.get('title'):
                    self.db_manager.update_link_status(url, 'failed')
                    return None
                
                # 创建文章对象
                article = Article(
                    url=url,
                    title=article_data.get('title', ''),
                    content=article_data.get('content', ''),
                    pub_date=article_data.get('pub_date', ''),
                    source=module_name
                )
                
                self.stats['total_articles_crawled'] += 1
                self.db_manager.update_link_status(url, 'completed')
                
                # 添加延迟
                await asyncio.sleep(random.uniform(*self.delay_range))
                
                return article
                
            except Exception as e:
                self.db_manager.update_link_status(url, 'failed')
                error_msg = f"异步爬取文章失败 {url}: {e}"
                logger.error(error_msg)
                self.stats['errors'].append(error_msg)
                return None
    
    def _discover_modules(self) -> List[Dict[str, Any]]:
        """发现并验证模块（复用同步版本）"""
        modules = self.module_discovery.discover_modules()
        self.stats['total_modules'] = len(modules)
        
        valid_modules = []
        for module_info in modules:
            module_name = module_info['name']
            is_valid, errors = self.module_discovery.validate_module(module_name)
            
            if is_valid:
                valid_modules.append(module_info)
                self.stats['valid_modules'] += 1
                logger.info(f"模块 {module_name} 验证成功")
            else:
                error_msg = f"模块 {module_name} 验证失败: {', '.join(errors)}"
                logger.warning(error_msg)
                self.stats['errors'].append(error_msg)
        
        return valid_modules
    
    def _filter_modules(self, available_modules: List[Dict[str, Any]], 
                       target_modules: Optional[List[str]]) -> List[Dict[str, Any]]:
        """过滤模块（复用同步版本）"""
        if not target_modules:
            return available_modules
        
        filtered = []
        for module_info in available_modules:
            if module_info['name'] in target_modules:
                filtered.append(module_info)
        
        return filtered
    
    def _update_final_stats(self):
        """更新最终统计信息"""
        db_stats = self.db_manager.get_statistics()
        self.stats.update(db_stats)
    
    def _log_final_stats(self):
        """记录最终统计信息"""
        duration = (self.stats['end_time'] - self.stats['start_time']).total_seconds()
        
        logger.info("=== 异步爬虫工作流完成 ===")
        logger.info(f"执行时间: {duration:.2f}秒")
        logger.info(f"总模块数: {self.stats['total_modules']}")
        logger.info(f"有效模块数: {self.stats['valid_modules']}")
        logger.info(f"爬取链接数: {self.stats['total_links_crawled']}")
        logger.info(f"存储链接数: {self.stats['total_links_stored']}")
        logger.info(f"爬取文章数: {self.stats['total_articles_crawled']}")
        logger.info(f"存储文章数: {self.stats['total_articles_stored']}")
        logger.info(f"错误数量: {len(self.stats['errors'])}")


def run_crawler_workflow(**kwargs) -> Dict[str, Any]:
    """运行爬虫工作流的便捷函数"""
    workflow = CrawlerWorkflow(**kwargs)
    return workflow.run_full_workflow()


async def run_async_crawler_workflow(**kwargs) -> Dict[str, Any]:
    """运行异步爬虫工作流的便捷函数"""
    workflow = AsyncCrawlerWorkflow(**kwargs)
    return await workflow.run_async_workflow()


if __name__ == "__main__":
    # 测试同步版本
    print("测试同步爬虫工作流...")
    stats = run_crawler_workflow(
        db_type="sqlite",
        max_workers=3,
        delay_range=(1, 2)
    )
    print(f"同步工作流完成: {stats}")
