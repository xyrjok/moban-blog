CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT
);

INSERT INTO config (key, value) VALUES 
('admin_user', 'admin'),
('admin_pass', '123456'),
('github_user', ''), 
('github_repo', ''), 
('github_token', '');

CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    image TEXT,
    content TEXT,
    category TEXT,
    views INTEGER DEFAULT 0,
    created_at INTEGER
);
