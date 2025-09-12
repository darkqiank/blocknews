-- 创建示例表
CREATE TABLE public.todos (
    id SERIAL PRIMARY KEY,
    task TEXT NOT NULL,
    done BOOLEAN DEFAULT FALSE
);

-- 创建匿名角色, 一般不需要
-- CREATE ROLE anon NOLOGIN;
-- GRANT USAGE ON SCHEMA public TO anon;

-- 给角色赋权限
-- GRANT SELECT ON todos TO anon;           -- 匿名只读

-- 插入示例数据
INSERT INTO todos (task, done) VALUES
('Buy milk', false),
('Write report', false);


-- 创建 JWT 验证用户角色
CREATE ROLE webuser LOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOSUPERUSER;
GRANT USAGE ON SCHEMA public TO webuser;

GRANT SELECT ON todos TO webuser;

-- GRANT SELECT ON articles TO webuser;
-- GRANT SELECT ON links TO webuser;
-- GRANT SELECT ON t_x_users TO webuser;
-- GRANT SELECT ON t_x TO webuser;