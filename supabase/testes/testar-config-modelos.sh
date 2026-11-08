#!/usr/bin/env bash
# Testa a migração de modelo e esforço por etapa num Postgres descartável (Docker).
# Não toca no Supabase real: sobe postgres:16, cria os papéis e o schema "storage" que o Supabase
# já tem, aplica a migração base e a nova (duas vezes, para provar a idempotência), confere a
# estrutura e derruba o contêiner.
#
# Uso: bash supabase/testes/testar-config-modelos.sh
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BASE="$RAIZ/supabase/migrations/20261027120000_planejamento.sql"
MIGRACAO="$RAIZ/supabase/migrations/20261109120000_config_modelos.sql"
CONTEINER="planejamento-teste-config-modelos-$$-$RANDOM"

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
psql_c -c '\d planejamento.config_modelos'

consulta() { psql_c -t -A -c "$1"; }

COLUNAS="$(consulta "select string_agg(column_name, ',' order by column_name) from information_schema.columns where table_schema = 'planejamento' and table_name = 'config_modelos'")"
[ "$COLUNAS" = "alterado_em,alterado_por,alvo,esforco,etapa,modelo" ] || falhar "colunas de config_modelos: $COLUNAS"

CHAVE="$(consulta "select string_agg(a.attname, ',' order by a.attnum) from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey) where c.conrelid = 'planejamento.config_modelos'::regclass and c.contype = 'p'")"
[ "$CHAVE" = "etapa,alvo" ] || falhar "chave primária de config_modelos: $CHAVE"

[ "$(consulta "select count(*) from pg_constraint where conrelid = 'planejamento.config_modelos'::regclass and contype = 'c'")" = "1" ] || falhar "config_modelos deveria ter 1 check"

[ "$(consulta "select count(*) from pg_class where relkind = 'S' and relnamespace = 'planejamento'::regnamespace and relname like 'config_modelos%'")" = "0" ] || falhar "config_modelos não deveria ter sequência"

[ "$(consulta "select relrowsecurity from pg_class where oid = 'planejamento.config_modelos'::regclass")" = "t" ] || falhar "RLS desligado em config_modelos"

[ "$(consulta "select has_table_privilege('service_role', 'planejamento.config_modelos', 'select') and has_table_privilege('service_role', 'planejamento.config_modelos', 'insert')")" = "t" ] || falhar "service_role sem select/insert em config_modelos"
[ "$(consulta "select has_table_privilege('authenticated', 'planejamento.config_modelos', 'select') or has_table_privilege('anon', 'planejamento.config_modelos', 'select')")" = "f" ] || falhar "anon/authenticated com acesso a config_modelos"

# Uso real: o service_role grava uma configuração válida e lê de volta.
psql_c >/dev/null <<'SQL'
set role service_role;
insert into planejamento.config_modelos (etapa, alvo, modelo, esforco, alterado_por, alterado_em)
values ('01', 'principal', 'haiku', 'low', 'a@x', now());
select count(*) from planejamento.config_modelos;
SQL

# O check de esforço recusa um nível fora da lista.
if docker exec -i "$CONTEINER" psql -X -q -U postgres -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<'SQL'
insert into planejamento.config_modelos (etapa, alvo, esforco) values ('02', 'principal', 'turbo');
SQL
then
  falhar "insert com esforco = 'turbo' deveria falhar"
fi

echo "config-modelos: migração aplicada duas vezes sem erro"
