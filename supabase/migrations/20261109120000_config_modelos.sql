-- Modelo e esforço do Claude por etapa e alvo (principal ou subagente). Tudo no schema "planejamento".
-- Linha ausente equivale a padrão nos dois campos (modelo e esforço null).
-- Acesso só pelo servidor do app (service_role); RLS ligado e sem políticas fecha o resto.

create table if not exists planejamento.config_modelos (
  etapa text not null,
  alvo text not null,
  modelo text,
  esforco text check (esforco in ('low', 'medium', 'high', 'xhigh', 'max')),
  alterado_por text,
  alterado_em timestamptz,
  primary key (etapa, alvo)
);

alter table planejamento.config_modelos enable row level security;

revoke all on planejamento.config_modelos from public, anon, authenticated;
grant all on planejamento.config_modelos to service_role;
