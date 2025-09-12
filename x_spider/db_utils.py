import psycopg2
import psycopg2.extras
from datetime import datetime
import json
import os
from typing import Dict, Any, List, Optional

# Database configuration - should be moved to environment variables in production
DB_CONFIG = {
    'dbname': os.getenv('DB_DATABASE', 'your_db_name'),
    'user': os.getenv('DB_USER', 'your_user'),
    'password': os.getenv('DB_PASSWD', 'your_password'),
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': os.getenv('DB_PORT', '5432')
}

def parse_twitter_date(date_str: Optional[str]) -> Optional[datetime]:
    """
    Parse Twitter date format 'Tue Sep 20 04:05:29 +0000 2011' to datetime object
    Args:
        date_str: Twitter date string or None
    Returns:
        datetime object or None if parsing fails or input is None
    """
    if not date_str:
        return None
    
    try:
        # Twitter date format: 'Tue Sep 20 04:05:29 +0000 2011'
        return datetime.strptime(date_str, '%a %b %d %H:%M:%S %z %Y')
    except (ValueError, TypeError) as e:
        print(f"Error parsing Twitter date '{date_str}': {e}")
        return None

def get_db_connection():
    """Create and return a database connection"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except Exception as e:
        print(f"Error connecting to database: {e}")
        raise

def create_x_users_table():
    """Create the X users table if it doesn't exist"""
    create_table_sql = """
    CREATE TABLE IF NOT EXISTS t_x_users (
        user_id TEXT PRIMARY KEY,
        user_name TEXT NOT NULL,
        screen_name TEXT NOT NULL,
        user_link TEXT NOT NULL,
        avatar TEXT,
        expire BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    """
    
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute(create_table_sql)
        conn.commit()
        print("Table t_x_users created successfully")
    except Exception as e:
        print(f"Error creating table: {e}")
        if conn:
            conn.rollback()
        raise
    finally:
        if conn:
            conn.close()

def create_x_table():
    """Create the X data table if it doesn't exist"""
    create_table_sql = """
    CREATE TABLE IF NOT EXISTS t_x (
        id SERIAL PRIMARY KEY,
        x_id TEXT UNIQUE NOT NULL,
        item_type TEXT NOT NULL,
        data JSONB NOT NULL,
        username TEXT,
        user_id TEXT,
        user_link TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Create index on x_id for faster lookups
    CREATE INDEX IF NOT EXISTS idx_t_x_x_id ON t_x(x_id);
    -- Create index on created_at for ordering
    CREATE INDEX IF NOT EXISTS idx_t_x_created_at ON t_x(created_at DESC);
    -- Create index on user_id for user-specific queries
    CREATE INDEX IF NOT EXISTS idx_t_x_user_id ON t_x(user_id);
    """
    
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute(create_table_sql)
        conn.commit()
        print("Table t_x created successfully")
    except Exception as e:
        print(f"Error creating table: {e}")
        if conn:
            conn.rollback()
        raise
    finally:
        if conn:
            conn.close()

def insert_x_data(data: Dict[str, Any]) -> None:
    """
    Batch insert X data into the database
    Args:
        data: Dictionary containing X data items
    """
    insert_sql = """
    INSERT INTO t_x (x_id, item_type, data, username, user_id, user_link, created_at)
    VALUES %s
    ON CONFLICT (x_id) DO NOTHING
    """
    
    conn = None
    try:
        conn = get_db_connection()
        # 准备批量插入的数据
        values = []
        for x_id, item in data.items():
            # 尝试从推文数据中获取created_at时间
            tweet_created_at = None
            item_data = item.get('data', {})
            if isinstance(item_data, dict) and 'created_at' in item_data:
                tweet_created_at = parse_twitter_date(item_data['created_at'])
            
            values.append((
                x_id,
                item.get('itemType'),
                json.dumps(item.get('data')),
                item.get('username'),
                item.get('user_id'),
                item.get('user_link'),
                tweet_created_at  # 使用解析后的推文时间，如果为None则数据库会使用默认值
            ))
        
        
        with conn.cursor() as cur:
            # 使用execute_values进行批量插入
            psycopg2.extras.execute_values(
                cur,
                insert_sql,
                values,
                template=None,  # 使用默认模板
                page_size=100   # 每批次插入100条数据
            )
        conn.commit()
        print(f"Successfully batch inserted {len(data)} records")
    except Exception as e:
        print(f"Error batch inserting data: {e}")
        if conn:
            conn.rollback()
        raise
    finally:
        if conn:
            conn.close()

def upsert_x_user(user_datas: List[Dict[str, Any]]) -> None:
    """
    Insert or update X user data into the database
    Args:
        user_data: Dictionary containing X user data
    """
    upsert_sql = """
    INSERT INTO t_x_users (user_id, user_name, screen_name, user_link, avatar, updated_at)
    VALUES (%s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        user_name = EXCLUDED.user_name,
        screen_name = EXCLUDED.screen_name,
        user_link = EXCLUDED.user_link,
        avatar = EXCLUDED.avatar,
        updated_at = CURRENT_TIMESTAMP;
    """
    
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            values = [
                (
                    user_data['user_id'],
                    user_data['user_name'],
                    user_data['screen_name'],
                    user_data['user_link'],
                    user_data.get('avatar')  # avatar is optional
                )
                for user_data in user_datas
            ]
            cur.executemany(upsert_sql, values)
        conn.commit()
        print(f"Successfully upserted users")
    except Exception as e:
        print(f"Error upserting user data: {e}")
        if conn:
            conn.rollback()
        raise
    finally:
        if conn:
            conn.close()

def get_all_x_users(include_expired: bool = False) -> list:
    """
    Retrieve all X users from the database
    Args:
        include_expired: If True, include expired users in the results. Default is False.
    Returns:
        List of dictionaries containing user information
    """
    select_sql = """
    SELECT 
        user_id,
        user_name,
        screen_name,
        user_link,
        avatar,
        expire,
        created_at,
        updated_at
    FROM t_x_users
    """
    
    if not include_expired:
        select_sql += " WHERE expire = FALSE"
    
    select_sql += " ORDER BY created_at DESC"
    
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute(select_sql)
            results = cur.fetchall()
            # Convert results to list of dictionaries and handle datetime serialization
            users = []
            for row in results:
                user = dict(row)
                user['created_at'] = user['created_at'].isoformat() if user['created_at'] else None
                user['updated_at'] = user['updated_at'].isoformat() if user['updated_at'] else None
                users.append(user)
            return users
    except Exception as e:
        print(f"Error retrieving users: {e}")
        raise
    finally:
        if conn:
            conn.close()

# Initialize tables when module is imported
try:
    create_x_table()
    create_x_users_table()
except Exception as e:
    print(f"Warning: Could not initialize tables: {e}")
