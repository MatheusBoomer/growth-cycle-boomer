#!/usr/bin/env bash
# Testa a migração de notas de melhoria das skills num Postgres descartável (Docker).
# Não toca no Supabase real: sobe postgres:16, cria os papéis e o schema "storage" que o Supabase
# já tem, aplica a migração base e a nova (duas vezes, para provar a idempotência), confere a
# estrutura e derruba o contêiner.
#
# Uso: bash supabase/testes/testar-notas-skills.sh
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BASE="$RAIZ/supabase/migrations/20261027120000_planejamento.sql"
MIGRACAO="$RAIZ/supabase/migrations/20261110120000_notas_skills.sql"
CONTEINER="planejamento-teste-notas-skills-$$-$RANDOM"

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
psql_c -c '\d planejamento.notas_skills'

consulta() { psql_c -t -A -c "$1"; }

COLUNAS="$(consulta "select string_agg(column_name, ',' order by ordinal_position) from information_schema.columns where table_schema = 'planejamento' and table_name = 'notas_skills'")"
[ "$COLUNAS" = "id,item,texto,autor,criada_em,resolvida_em,resolvida_por" ] || falhar "colunas de notas_skills: $COLUNAS"

CHAVE="$(consulta "select string_agg(a.attname, ',' order by a.attnum) from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey) where c.conrelid = 'planejamento.notas_skills'::regclass and c.contype = 'p'")"
[ "$CHAVE" = "id" ] || falhar "chave primária de notas_skills: $CHAVE"

[ "$(consulta "select count(*) from pg_constraint where conrelid = 'planejamento.notas_skills'::regclass and contype = 'c'")" = "1" ] || falhar "notas_skills deveria ter 1 check"

[ "$(consulta "select count(*) from pg_indexes where schemaname = 'planejamento' and tablename = 'notas_skills' and indexname = 'notas_skills_item'")" = "1" ] || falhar "falta o índice notas_skills_item"

[ "$(consulta "select count(*) from pg_class where relkind = 'S' and relnamespace = 'planejamento'::regnamespace and relname = 'notas_skills_id_seq'")" = "1" ] || falhar "falta a sequência notas_skills_id_seq"

[ "$(consulta "select relrowsecurity from pg_class where oid = 'planejamento.notas_skills'::regclass")" = "t" ] || falhar "RLS desligado em notas_skills"

[ "$(consulta "select has_table_privilege('service_role', 'planejamento.notas_skills', 'select') and has_table_privilege('service_role', 'planejamento.notas_skills', 'insert')")" = "t" ] || falhar "service_role sem select/insert em notas_skills"
[ "$(consulta "select has_sequence_privilege('service_role', 'planejamento.notas_skills_id_seq', 'usage')")" = "t" ] || falhar "service_role sem uso da sequência de notas_skills"
[ "$(consulta "select has_table_privilege('authenticated', 'planejamento.notas_skills', 'select') or has_table_privilege('anon', 'planejamento.notas_skills', 'select')")" = "f" ] || falhar "anon/authenticated com acesso a notas_skills"

# Uso real: o service_role grava uma nota válida, marca como resolvida e lê de volta.
psql_c >/dev/null <<'SQL'
set role service_role;
insert into planejamento.notas_skills (item, texto, autor) values ('03', 'Checagem por bloco', 'a@x');
update planejamento.notas_skills set resolvida_em = now(), resolvida_por = 'a@x' where item = '03';
select count(*) from planejamento.notas_skills where resolvida_em is not null;
SQL

# O check recusa texto vazio e texto com mais de 2000 caracteres.
erro_esperado() {
  local sql="$1" saida
  saida="$(docker exec -i "$CONTEINER" psql -X -q -U postgres -v ON_ERROR_STOP=1 2>&1 <<SQL || true
set role service_role;
$sql
SQL
)"
  grep -q "notas_skills_texto_check" <<<"$saida"
}

erro_esperado "insert into planejamento.notas_skills (item, texto, autor) values ('02', '', 'a@x');" \
  || falhar "insert com texto vazio deveria falhar pelo check"

erro_esperado "insert into planejamento.notas_skills (item, texto, autor) values ('02', repeat('x', 2001), 'a@x');" \
  || falhar "insert com 2001 caracteres deveria falhar pelo check"

# O limite exato (2000) passa.
psql_c >/dev/null <<'SQL'
set role service_role;
insert into planejamento.notas_skills (item, texto, autor) values ('02', repeat('x', 2000), 'a@x');
SQL

echo "notas-skills: migração aplicada duas vezes sem erro"
