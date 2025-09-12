-- 创建匿名角色
CREATE ROLE anon NOLOGIN;
GRANT USAGE ON SCHEMA public TO anon;

-- 创建 JWT 用户角色
CREATE ROLE webuser NOLOGIN;
GRANT USAGE ON SCHEMA public TO webuser;

-- 创建示例表
CREATE TABLE public.todos (
    id SERIAL PRIMARY KEY,
    task TEXT NOT NULL,
    done BOOLEAN DEFAULT FALSE
);

-- 给角色赋权限
GRANT SELECT ON todos TO anon;           -- 匿名只读
GRANT SELECT, INSERT, UPDATE, DELETE ON todos TO webuser;

-- 插入示例数据
INSERT INTO todos (task, done) VALUES
('Buy milk', false),
('Write report', false);
