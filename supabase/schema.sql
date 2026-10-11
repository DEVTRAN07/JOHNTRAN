-- Schema cho JOHNTRAN Bot — chạy 1 lần trong Supabase SQL Editor
-- Bot chỉ cần service_role key (điền vào env SUPABASE_SERVICE_KEY trên Koyeb)

-- Bảng settings của nhóm (prefix, anti_*, auto_down, auto_send, ban...)
create table if not exists bot_threads (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Bảng dữ liệu user (ban, lịch sử AI...)
create table if not exists bot_users (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Bảng metrics theo ngày
create table if not exists bot_metrics (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Index sắp theo thời gian cập nhật (cho audit/cleanup sau này)
create index if not exists bot_threads_updated_idx on bot_threads (updated_at desc);
create index if not exists bot_users_updated_idx on bot_users (updated_at desc);

-- Bật RLS: service_role mặc định bỏ qua RLS nên bot vẫn đọc/ghi được,
-- trong khi anon key (nếu lỡ dùng) sẽ bị chặn hoàn toàn
alter table bot_threads enable row level security;
alter table bot_users enable row level security;
alter table bot_metrics enable row level security;
