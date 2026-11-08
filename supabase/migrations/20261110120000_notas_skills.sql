-- Notas de melhoria das skills (catálogo do admin). Tudo no schema "planejamento"; nada fora dele é tocado.
-- Idempotente: pode rodar mais de uma vez. Acesso só pelo servidor do app (service_role).
-- Tabela global: não tem slug, não pertence a um prospect.

create table if not exists planejamento.notas_skills (
  id bigint generated always as identity primary key,
  item text not null,
  texto text not null check (char_length(texto) between 1 and 2000),
  autor text not null,
  criada_em timestamptz not null default now(),
  resolvida_em timestamptz,
  resolvida_por text
);
create index if not exists notas_skills_item on planejamento.notas_skills (item, resolvida_em);

alter table planejamento.notas_skills enable row level security;

revoke all on planejamento.notas_skills from public, anon, authenticated;
grant all on planejamento.notas_skills to service_role;
grant usage, select on sequence planejamento.notas_skills_id_seq to service_role;
