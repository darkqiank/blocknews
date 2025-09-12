import os
import sqlite3
import asyncio
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime
import json
import hashlib


@dataclass
class Article:
    """文章数据模型"""
    url: str
    title: str
    content: str
    pub_date: str
    source: str
    created_at: Optional[str] = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now().isoformat()
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'url': self.url,
            'title': self.title,
            'content': self.content,
            'pub_date': self.pub_date,
            'source': self.source,
            'created_at': self.created_at,
            'url_hash': hashlib.md5(self.url.encode()).hexdigest()
        }


class DatabaseManager:
    """数据库管理器，支持SQLite、PostgreSQL"""
    
    def __init__(self, db_type: str = "sqlite", **kwargs):
        self.db_type = db_type.lower()
        self.kwargs = kwargs
        self._conn = None
        
        if self.db_type == "sqlite":
            self.db_path = kwargs.get("db_path", "spider/db/news.db")
            self._ensure_sqlite_db()
        elif self.db_type in ["postgresql", "pg"]:
            self._init_postgresql()
        else:
            raise ValueError(f"不支持的数据库类型: {db_type}")
    
    def _ensure_sqlite_db(self):
        """确保SQLite数据库和表存在"""
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # 创建文章表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS articles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                url TEXT UNIQUE NOT NULL,
                url_hash TEXT UNIQUE NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                pub_date TEXT,
                source TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # 创建链接表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS links (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                url TEXT UNIQUE NOT NULL,
                url_hash TEXT UNIQUE NOT NULL,
                source TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                created_at TEXT NOT NULL,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # 创建索引
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_articles_url_hash ON articles(url_hash)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_articles_source ON articles(source)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_links_url_hash ON links(url_hash)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_links_status ON links(status)')
        
        conn.commit()
        conn.close()

    
    def _init_postgresql(self):
        """初始化PostgreSQL连接"""
        try:
            import psycopg2
            from psycopg2.extras import RealDictCursor
            
            host = self.kwargs.get("host") or os.getenv("PG_HOST", "localhost")
            port = self.kwargs.get("port") or os.getenv("PG_PORT", "5432")
            database = self.kwargs.get("database") or os.getenv("PG_DATABASE", "news")
            user = self.kwargs.get("user") or os.getenv("PG_USER", "postgres")
            password = self.kwargs.get("password") or os.getenv("PG_PASSWORD", "")
            
            self._conn = psycopg2.connect(
                host=host,
                port=port,
                database=database,
                user=user,
                password=password,
                cursor_factory=RealDictCursor
            )
            self._create_pg_tables()
            print("PostgreSQL连接已建立")
            
        except ImportError:
            raise ImportError("请安装psycopg2: pip install psycopg2-binary")
    
    def _create_pg_tables(self):
        """创建PostgreSQL表"""
        cursor = self._conn.cursor()
        
        # 创建文章表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS articles (
                id SERIAL PRIMARY KEY,
                url TEXT UNIQUE NOT NULL,
                url_hash TEXT UNIQUE NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                pub_date TEXT,
                source TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # 创建链接表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS links (
                id SERIAL PRIMARY KEY,
                url TEXT UNIQUE NOT NULL,
                url_hash TEXT UNIQUE NOT NULL,
                source TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # 创建索引
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_articles_url_hash ON articles(url_hash)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_articles_source ON articles(source)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_links_url_hash ON links(url_hash)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_links_status ON links(status)')
        
        self._conn.commit()
    
    def store_links(self, links: List[str], source: str) -> int:
        """存储链接列表"""
        if not links:
            return 0
        
        stored_count = 0
        
        if self.db_type == "sqlite":
            stored_count = self._store_links_sqlite(links, source)
        elif self.db_type in ["postgresql", "pg"]:
            stored_count = self._store_links_postgresql(links, source)
        
        print(f"成功存储 {stored_count} 个链接到数据库")
        return stored_count
    
    def _store_links_sqlite(self, links: List[str], source: str) -> int:
        """SQLite存储链接"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        stored_count = 0
        for url in links:
            try:
                url_hash = hashlib.md5(url.encode()).hexdigest()
                cursor.execute(
                    'INSERT OR IGNORE INTO links (url, url_hash, source, created_at) VALUES (?, ?, ?, ?)',
                    (url, url_hash, source, datetime.now().isoformat())
                )
                if cursor.rowcount > 0:
                    stored_count += 1
            except Exception as e:
                print(f"存储链接失败 {url}: {e}")
        
        conn.commit()
        conn.close()
        return stored_count
    
    def _store_links_postgresql(self, links: List[str], source: str) -> int:
        """PostgreSQL存储链接"""
        cursor = self._conn.cursor()
        stored_count = 0
        
        for url in links:
            try:
                url_hash = hashlib.md5(url.encode()).hexdigest()
                cursor.execute(
                    'INSERT INTO links (url, url_hash, source) VALUES (%s, %s, %s) ON CONFLICT (url) DO NOTHING',
                    (url, url_hash, source)
                )
                if cursor.rowcount > 0:
                    stored_count += 1
            except Exception as e:
                print(f"存储链接失败 {url}: {e}")
        
        self._conn.commit()
        return stored_count
    
    def store_articles(self, articles: List[Article]) -> int:
        """存储文章列表"""
        if not articles:
            return 0
        
        stored_count = 0
        
        if self.db_type == "sqlite":
            stored_count = self._store_articles_sqlite(articles)
        elif self.db_type in ["postgresql", "pg"]:
            stored_count = self._store_articles_postgresql(articles)
        
        print(f"成功存储 {stored_count} 篇文章到数据库")
        return stored_count
    
    def _store_articles_sqlite(self, articles: List[Article]) -> int:
        """SQLite存储文章"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        stored_count = 0
        for article in articles:
            try:
                data = article.to_dict()
                cursor.execute('''
                    INSERT OR REPLACE INTO articles 
                    (url, url_hash, title, content, pub_date, source, created_at) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (
                    data['url'], data['url_hash'], data['title'], 
                    data['content'], data['pub_date'], data['source'], data['created_at']
                ))
                if cursor.rowcount > 0:
                    stored_count += 1
            except Exception as e:
                print(f"存储文章失败 {article.url}: {e}")
        
        conn.commit()
        conn.close()
        return stored_count
    
    def _store_articles_postgresql(self, articles: List[Article]) -> int:
        """PostgreSQL存储文章"""
        cursor = self._conn.cursor()
        stored_count = 0
        
        for article in articles:
            try:
                data = article.to_dict()
                cursor.execute('''
                    INSERT INTO articles (url, url_hash, title, content, pub_date, source, created_at) 
                    VALUES (%(url)s, %(url_hash)s, %(title)s, %(content)s, %(pub_date)s, %(source)s, %(created_at)s)
                    ON CONFLICT (url) DO NOTHING 
                ''', data)
                if cursor.rowcount > 0:
                    stored_count += 1
            except Exception as e:
                print(f"存储文章失败 {article.url}: {e}")
        
        self._conn.commit()
        return stored_count
    
    def get_pending_links(self, source: Optional[str] = None, limit: Optional[int] = None) -> List[str]:
        """获取待处理的链接"""
        if self.db_type == "sqlite":
            return self._get_pending_links_sqlite(source, limit)
        elif self.db_type in ["postgresql", "pg"]:
            return self._get_pending_links_postgresql(source, limit)
        return []
    
    def _get_pending_links_sqlite(self, source: Optional[str], limit: Optional[int]) -> List[str]:
        """SQLite获取待处理链接"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        query = "SELECT url FROM links WHERE status = 'pending'"
        params = []
        
        if source:
            query += " AND source = ?"
            params.append(source)
        
        if limit:
            query += " LIMIT ?"
            params.append(limit)
        
        cursor.execute(query, params)
        links = [row[0] for row in cursor.fetchall()]
        
        conn.close()
        return links
    
    def _get_pending_links_postgresql(self, source: Optional[str], limit: Optional[int]) -> List[str]:
        """PostgreSQL获取待处理链接"""
        cursor = self._conn.cursor()
        
        query = "SELECT url FROM links WHERE status = 'pending'"
        params = []
        
        if source:
            query += " AND source = %s"
            params.append(source)
        
        if limit:
            query += " LIMIT %s"
            params.append(limit)
        
        cursor.execute(query, params)
        links = [row['url'] for row in cursor.fetchall()]
        return links
    
    def update_link_status(self, url: str, status: str):
        """更新链接状态"""
        if self.db_type == "sqlite":
            self._update_link_status_sqlite(url, status)
        elif self.db_type in ["postgresql", "pg"]:
            self._update_link_status_postgresql(url, status)
    
    def _update_link_status_sqlite(self, url: str, status: str):
        """SQLite更新链接状态"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('UPDATE links SET status = ? WHERE url = ?', (status, url))
        conn.commit()
        conn.close()
    
    
    def _update_link_status_postgresql(self, url: str, status: str):
        """PostgreSQL更新链接状态"""
        cursor = self._conn.cursor()
        cursor.execute('UPDATE links SET status = %s WHERE url = %s', (status, url))
        self._conn.commit()
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取统计信息"""
        if self.db_type == "sqlite":
            return self._get_statistics_sqlite()
        elif self.db_type in ["postgresql", "pg"]:
            return self._get_statistics_postgresql()
        return {}
    
    def _get_statistics_sqlite(self) -> Dict[str, Any]:
        """SQLite获取统计信息"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # 文章统计
        cursor.execute('SELECT COUNT(*) FROM articles')
        total_articles = cursor.fetchone()[0]
        
        cursor.execute('SELECT source, COUNT(*) FROM articles GROUP BY source')
        articles_by_source = dict(cursor.fetchall())
        
        # 链接统计
        cursor.execute('SELECT COUNT(*) FROM links')
        total_links = cursor.fetchone()[0]
        
        cursor.execute('SELECT status, COUNT(*) FROM links GROUP BY status')
        links_by_status = dict(cursor.fetchall())
        
        conn.close()
        
        return {
            'total_articles': total_articles,
            'articles_by_source': articles_by_source,
            'total_links': total_links,
            'links_by_status': links_by_status
        }
    
    
    def _get_statistics_postgresql(self) -> Dict[str, Any]:
        """PostgreSQL获取统计信息"""
        cursor = self._conn.cursor()
        
        # 文章统计
        cursor.execute('SELECT COUNT(*) FROM articles')
        total_articles = cursor.fetchone()['count']
        
        cursor.execute('SELECT source, COUNT(*) FROM articles GROUP BY source')
        articles_by_source = {row['source']: row['count'] for row in cursor.fetchall()}
        
        # 链接统计
        cursor.execute('SELECT COUNT(*) FROM links')
        total_links = cursor.fetchone()['count']
        
        cursor.execute('SELECT status, COUNT(*) FROM links GROUP BY status')
        links_by_status = {row['status']: row['count'] for row in cursor.fetchall()}
        
        return {
            'total_articles': total_articles,
            'articles_by_source': articles_by_source,
            'total_links': total_links,
            'links_by_status': links_by_status
        }
    
    def close(self):
        """关闭数据库连接"""
        if self.db_type in ["postgresql", "pg"] and self._conn:
            self._conn.close()
