create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  created_at timestamptz default now()
);

create table if not exists gift_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  company text default '',
  name text not null,
  value numeric default 0,
  currency text default 'R$',
  code text not null,
  pin_encrypted text,
  created_at timestamptz default now()
);

create index if not exists idx_gift_cards_user on gift_cards(user_id);
