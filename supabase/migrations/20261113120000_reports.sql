-- Reports de bug e melhoria enviados pelos usuários do app. Tudo no schema "planejamento" e no bucket
-- "planejamento-reports"; nada fora disso é tocado. Idempotente: pode rodar mais de uma vez.
-- Acesso só pelo servidor do app (service_role). Tabela global: não pertence a um prospect.

create table if not exists planejamento.reports (
  id bigint generated always as identity primary key,
  tipo text not null check (tipo in ('bug', 'melhoria')),
  comentario text not null check (char_length(comentario) between 1 and 2000),
  status text not null default 'aberto' check (status in ('aberto', 'em_andamento', 'resolvido', 'descartado')),
  autor text not null,
  contexto jsonb not null default '{}'::jsonb,
  imagens text[] not null default '{}',
  nota_admin text check (nota_admin is null or char_length(nota_admin) <= 2000),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz,
  atualizado_por text
);
create index if not exists reports_status_criado on planejamento.reports (status, criado_em desc);

alter table planejamento.reports enable row level security;

revoke all on planejamento.reports from public, anon, authenticated;
grant all on planejamento.reports to service_role;
grant usage, select on sequence planejamento.reports_id_seq to service_role;

-- Prints e imagens dos reports: privado, até 5 MB, só PNG e JPEG.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('planejamento-reports', 'planejamento-reports', false, 5242880, array['image/png', 'image/jpeg'])
on conflict (id) do nothing;
