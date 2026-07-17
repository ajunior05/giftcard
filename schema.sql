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

-- v3: histórico de uso de gift cards

create table if not exists historico_uso_gift_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  gift_card_id uuid references gift_cards(id) on delete set null,
  card_name text not null,
  company text default '',
  valor_debitado numeric not null,
  saldo_anterior numeric not null,
  saldo_novo numeric not null,
  currency text default 'US$',
  created_at timestamptz default now()
);

create index if not exists idx_historico_uso_user on historico_uso_gift_cards(user_id, created_at desc);
