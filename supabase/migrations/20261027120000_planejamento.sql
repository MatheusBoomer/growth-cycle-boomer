-- Planejamento estratégico: tudo no schema "planejamento" e nos buckets "planejamento-*".
-- O projeto é compartilhado com o sistema "pit": nada aqui cria, altera ou remove coisa fora disso.
-- Acesso só pelo servidor do app (service_role); RLS ligado e sem políticas fecha o resto.

create schema if not exists planejamento;

create table if not exists planejamento.prospects (
  slug text primary key,
  nome text,
  estado jsonb,
  etapa_atual text,
  criado_por text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  versao integer not null default 0,
  sincronizacao_pendente boolean not null default false,
  excluido_em timestamptz
);

create table if not exists planejamento.eventos_conversa (
  id bigint generated always as identity primary key,
  slug text not null references planejamento.prospects (slug),
  etapa text not null,
  evento jsonb not null,
  autor text,
  em timestamptz not null
);
create index if not exists eventos_conversa_slug_etapa_id on planejamento.eventos_conversa (slug, etapa, id);

create table if not exists planejamento.comentarios (
  slug text not null references planejamento.prospects (slug),
  entregavel_id text not null,
  lista jsonb not null,
  atualizado_em timestamptz not null default now(),
  primary key (slug, entregavel_id)
);

create table if not exists planejamento.uso_turnos (
  id bigint generated always as identity primary key,
  slug text not null references planejamento.prospects (slug),
  etapa text not null,
  autor text,
  custo_usd numeric(10, 4),
  tokens_entrada integer,
  tokens_saida integer,
  inicio timestamptz not null,
  fim timestamptz not null,
  status text not null
);
create index if not exists uso_turnos_slug on planejamento.uso_turnos (slug);

create table if not exists planejamento.arquivos (
  slug text not null references planejamento.prospects (slug),
  caminho text not null,
  sha256 text not null,
  tamanho bigint not null,
  atualizado_em timestamptz not null default now(),
  primary key (slug, caminho)
);

create table if not exists planejamento.arquivos_lixeira (
  id bigint generated always as identity primary key,
  slug text not null,
  caminho text not null,
  sha256 text not null,
  removido_em timestamptz not null default now()
);
create index if not exists arquivos_lixeira_slug on planejamento.arquivos_lixeira (slug);

alter table planejamento.prospects enable row level security;
alter table planejamento.eventos_conversa enable row level security;
alter table planejamento.comentarios enable row level security;
alter table planejamento.uso_turnos enable row level security;
alter table planejamento.arquivos enable row level security;
alter table planejamento.arquivos_lixeira enable row level security;

revoke all on schema planejamento from public, anon, authenticated;
grant usage on schema planejamento to service_role;
grant all on all tables in schema planejamento to service_role;
grant usage, select on all sequences in schema planejamento to service_role;
alter default privileges in schema planejamento grant all on tables to service_role;
alter default privileges in schema planejamento grant usage, select on sequences to service_role;

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('planejamento-prospects', 'planejamento-prospects', false, 104857600),
  ('planejamento-sessoes', 'planejamento-sessoes', false, 104857600)
on conflict (id) do nothing;
