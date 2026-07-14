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
  currency text default 'US$',
  code text not null,
  pin_encrypted text,
  created_at timestamptz default now()
);

create index if not exists idx_gift_cards_user on gift_cards(user_id);

-- v2: roteiros de viagem

create table if not exists roteiros (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  titulo text not null,
  destino text default '',
  data_inicio date,
  data_fim date,
  adultos integer default 1,
  token_publico text unique,
  created_at timestamptz default now()
);

create table if not exists atividades_roteiro (
  id uuid primary key default gen_random_uuid(),
  roteiro_id uuid not null references roteiros(id) on delete cascade,
  dia_numero integer not null,
  data_dia date,
  dia_semana text default '',
  ordem integer not null default 0,
  titulo text not null,
  horario_inicio text default '',
  horario_fim text default '',
  endereco text default '',
  notas text default '',
  concluida boolean default false,
  created_at timestamptz default now()
);

create index if not exists idx_atividades_roteiro on atividades_roteiro(roteiro_id, dia_numero, ordem);
