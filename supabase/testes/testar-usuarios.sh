#!/usr/bin/env bash
# Testa a migração de usuários e a função alterar_papel num Postgres descartável (Docker).
# Não toca no Supabase real: sobe postgres:16, cria os papéis e o schema que o Supabase já
# tem, aplica a migração, roda as asserções e o teste de concorrência, e derruba o contêiner.
#
# Uso: bash supabase/testes/testar-usuarios.sh
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MIGRACAO="$RAIZ/supabase/migrations/20261107120000_usuarios.sql"
ASSERCOES="$RAIZ/supabase/testes/usuarios.sql"
CONTEINER="planejamento-teste-usuarios-$$-$RANDOM"
TMP="$(mktemp -d)"

limpar() {
  docker rm -f "$CONTEINER" >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap limpar EXIT

# psql dentro do contêiner; o SQL entra pela entrada padrão.
psql_c() { docker exec -i "$CONTEINER" psql -X -q -U postgres -v ON_ERROR_STOP=1 "$@"; }

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

# O Supabase real já tem estes papéis e o schema (criado pela migração 20261027120000).
psql_c >/dev/null <<'SQL'
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema planejamento;
SQL

echo "Aplicando a migração..."
psql_c -f - <"$MIGRACAO" >/dev/null

echo "Rodando as asserções..."
psql_c -t -A -f - <"$ASSERCOES"

echo "Teste de concorrência..."
# Os dois rebaixamentos cruzados começam ao mesmo tempo. Sem o lock na função, os dois
# passariam pela checagem (ambos admin, count = 2) e a tabela ficaria sem admin.
preparar() {
  psql_c >/dev/null <<'SQL'
delete from planejamento.usuarios;
insert into planejamento.usuarios (email, papel) values ('a@x', 'admin'), ('b@x', 'admin');
SQL
}
sessao() { # $1 = alvo, $2 = autor, $3 = arquivo de saída, $4 = segundos segurando o lock (padrão 1)
  docker exec -i "$CONTEINER" psql -X -q -t -A -U postgres -v ON_ERROR_STOP=1 >"$3" 2>&1 <<SQL || true
begin;
select planejamento.alterar_papel('$1', 'usuario', '$2');
select pg_sleep(${4:-1});
commit;
SQL
}
contar_admins() {
  psql_c -t -A -c "select count(*) from planejamento.usuarios where papel = 'admin'"
}

# Cenário 1: rebaixamento cruzado (a rebaixa b, b rebaixa a).
preparar
sessao b@x a@x "$TMP/s1.txt" &
sessao a@x b@x "$TMP/s2.txt" &
wait
ADMINS="$(contar_admins)"
FALHAS="$(cat "$TMP/s1.txt" "$TMP/s2.txt" | grep -c 'ERROR' || true)"
if [ "$ADMINS" != "1" ] || [ "$FALHAS" != "1" ]; then
  echo "FALHOU no cruzado: admins=$ADMINS (esperado 1), sessões com erro=$FALHAS (esperado 1)" >&2
  cat "$TMP/s1.txt" "$TMP/s2.txt" >&2
  exit 1
fi
# A perdedora vê o autor já rebaixado, então o erro é autor_nao_admin.
if ! cat "$TMP/s1.txt" "$TMP/s2.txt" | grep -q -E 'autor_nao_admin|ultimo_admin'; then
  echo "FALHOU no cruzado: erro inesperado" >&2
  cat "$TMP/s1.txt" "$TMP/s2.txt" >&2
  exit 1
fi

# Cenário 2: b rebaixa a e segura o lock por 3s; b tenta rebaixar a si mesmo 1,5s depois.
# O atraso fixa a ordem: a segunda sessão espera o lock, vê só um admin e dá ultimo_admin.
preparar
sessao a@x b@x "$TMP/s3.txt" 3 &
{ sleep 1.5; sessao b@x b@x "$TMP/s4.txt"; } &
wait
ADMINS="$(contar_admins)"
if [ "$ADMINS" != "1" ] || ! cat "$TMP/s3.txt" "$TMP/s4.txt" | grep -q 'ultimo_admin'; then
  echo "FALHOU no ultimo_admin concorrente: admins=$ADMINS (esperado 1)" >&2
  cat "$TMP/s3.txt" "$TMP/s4.txt" >&2
  exit 1
fi

echo "concorrência: $ADMINS admin restante"
