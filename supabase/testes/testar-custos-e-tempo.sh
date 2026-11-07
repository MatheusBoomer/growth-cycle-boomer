#!/usr/bin/env bash
# Testa a migração de custos e tempo num Postgres descartável (Docker).
# Não toca no Supabase real: sobe postgres:16, cria os papéis e o schema "storage" que o Supabase
# já tem, aplica a migração base e a nova (duas vezes, para provar a idempotência), confere a
# estrutura e derruba o contêiner.
#
# Uso: bash supabase/testes/testar-custos-e-tempo.sh
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BASE="$RAIZ/supabase/migrations/20261027120000_planejamento.sql"
MIGRACAO="$RAIZ/supabase/migrations/20261108120000_custos_e_tempo.sql"
CONTEINER="planejamento-teste-custos-$$-$RANDOM"

limpar() {
  docker rm -f "$CONTEINER" >/dev/null 2>&1 || true
}
trap limpar EXIT

# psql dentro do contêiner; o SQL entra pela entrada padrão.
psql_c() { docker exec -i "$CONTEINER" psql -X -q -U postgres -v ON_ERROR_STOP=1 "$@"; }

falhar() {
  echo "FALHOU: $1" >&2
  exit 1
}

echo "Subindo postgres:16 ($CONTEINER)..."
docker run -d --name "$CONTEINER" -e POSTGRES_HOST_AUTH_METHOD=trust postgres:16 >/dev/null

# A imagem sobe um servidor temporário só no socket e reinicia; esperar pelo TCP evita pegá-lo.
for _ in $(seq 1 60); do
  if docker exec "$CONTEINER" psql -X -q -h 127.0.0.1 -U postgres -c 'select 1' >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
docker exec "$CONTEINER" psql -X -q -h 127.0.0.1 -U postgres -c 'select 1' >/dev/null

# O Supabase real já tem estes papéis (o service_role com bypassrls) e o schema "storage" (a migração base insere em storage.buckets).
psql_c >/dev/null <<'SQL'
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema storage;
create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint
);
SQL

echo "Aplicando a migração base..."
psql_c -f - <"$BASE" >/dev/null

echo "Aplicando a migração nova (1ª vez)..."
psql_c -f - <"$MIGRACAO" >/dev/null
echo "Aplicando a migração nova (2ª vez)..."
psql_c -f - <"$MIGRACAO" >/dev/null

echo "Conferindo a estrutura..."
psql_c -c '\d planejamento.presenca'
psql_c -c '\d planejamento.uso_turnos'

consulta() { psql_c -t -A -c "$1"; }

COLUNAS="$(consulta "select string_agg(column_name, ',' order by column_name) from information_schema.columns where table_schema = 'planejamento' and table_name = 'uso_turnos' and column_name in ('sessao','custo_turno_usd','modelos','modelos_acumulado','esforco')")"
[ "$COLUNAS" = "custo_turno_usd,esforco,modelos,modelos_acumulado,sessao" ] || falhar "colunas novas de uso_turnos: $COLUNAS"

[ "$(consulta "select count(*) from information_schema.columns where table_schema = 'planejamento' and table_name = 'presenca'")" = "7" ] || falhar "presenca deveria ter 7 colunas"

INDICES="$(consulta "select count(*) from pg_indexes where schemaname = 'planejamento' and indexname in ('presenca_slug_em','presenca_email_em','uso_turnos_slug_sessao')")"
[ "$INDICES" = "3" ] || falhar "índices esperados: 3, achados: $INDICES"

[ "$(consulta "select relrowsecurity from pg_class where oid = 'planejamento.presenca'::regclass")" = "t" ] || falhar "RLS desligado em presenca"

[ "$(consulta "select count(*) from pg_constraint where conrelid = 'planejamento.presenca'::regclass and contype = 'f' and confrelid = 'planejamento.prospects'::regclass")" = "1" ] || falhar "falta a FK presenca.slug -> prospects"

[ "$(consulta "select has_table_privilege('service_role', 'planejamento.presenca', 'insert')")" = "t" ] || falhar "service_role sem insert em presenca"
[ "$(consulta "select has_sequence_privilege('service_role', 'planejamento.presenca_id_seq', 'usage')")" = "t" ] || falhar "service_role sem usage na sequência"
[ "$(consulta "select has_table_privilege('authenticated', 'planejamento.presenca', 'select') or has_table_privilege('anon', 'planejamento.presenca', 'select')")" = "f" ] || falhar "anon/authenticated com acesso a presenca"

# Uso real: o service_role grava presença (precisa da sequência) e lê.
psql_c >/dev/null <<'SQL'
insert into planejamento.prospects (slug) values ('teste');
set role service_role;
insert into planejamento.presenca (slug, email, etapa, visivel, segundos_sem_interacao)
values ('teste', 'a@x', '03-diagnostico-performance', true, 0);
select count(*) from planejamento.presenca;
SQL

echo "custos-e-tempo: migração aplicada duas vezes sem erro"
