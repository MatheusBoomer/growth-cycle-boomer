-- Custos por turno e tempo de presença. Tudo no schema "planejamento"; nada fora dele é tocado.
-- Idempotente: pode rodar mais de uma vez. Acesso só pelo servidor do app (service_role).

-- Custo e modelos por turno. Todas aceitam nulo: os turnos antigos ficam sem estes campos.
alter table planejamento.uso_turnos add column if not exists sessao text;
alter table planejamento.uso_turnos add column if not exists custo_turno_usd numeric(10, 4);
alter table planejamento.uso_turnos add column if not exists modelos jsonb;
alter table planejamento.uso_turnos add column if not exists modelos_acumulado jsonb;
alter table planejamento.uso_turnos add column if not exists esforco text;

create index if not exists uso_turnos_slug_sessao on planejamento.uso_turnos (slug, sessao);

-- Presença: um registro por batida da tela aberta, para somar o tempo de cada pessoa por etapa.
create table if not exists planejamento.presenca (
  id bigint generated always as identity primary key,
  slug text not null references planejamento.prospects (slug),
  email text not null,
  etapa text not null,
  em timestamptz not null default now(),
  visivel boolean not null,
  segundos_sem_interacao integer not null
);
create index if not exists presenca_slug_em on planejamento.presenca (slug, em);
create index if not exists presenca_email_em on planejamento.presenca (email, em);

alter table planejamento.presenca enable row level security;

revoke all on planejamento.presenca from public, anon, authenticated;
grant all on planejamento.presenca to service_role;
grant usage, select on sequence planejamento.presenca_id_seq to service_role;
