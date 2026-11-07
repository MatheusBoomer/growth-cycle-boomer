-- Asserções da migração 20261107120000_usuarios.sql.
-- Cada bloco DO dá "raise exception" quando falha. Rodam em ordem: o primeiro confere o seed
-- da migração, os demais partem de uma tabela limpa com a@x admin e b@x usuário.
-- Rodar com: psql -v ON_ERROR_STOP=1 -f usuarios.sql

-- A migração aplicada: o seed do Matheus existe como admin.
do $$
begin
  if not exists (
    select 1 from planejamento.usuarios
    where email = 'matheus.moreira@boomer.com.br' and papel = 'admin'
  ) then
    raise exception 'seed: matheus.moreira@boomer.com.br deveria existir como admin';
  end if;
end $$;

-- A migração é reaplicável: o seed não duplica nem rebaixa quem já existe.
do $$
begin
  update planejamento.usuarios set papel = 'usuario' where email = 'matheus.moreira@boomer.com.br';
  insert into planejamento.usuarios (email, papel)
  values ('matheus.moreira@boomer.com.br', 'admin')
  on conflict do nothing;
  if (select papel from planejamento.usuarios where email = 'matheus.moreira@boomer.com.br') <> 'usuario' then
    raise exception 'seed: on conflict do nothing não deveria sobrescrever o papel';
  end if;
end $$;

-- Promover outro usuário.
do $$
begin
  delete from planejamento.usuarios;
  insert into planejamento.usuarios (email, papel) values ('a@x', 'admin'), ('b@x', 'usuario');
  perform planejamento.alterar_papel('b@x', 'admin', 'a@x');
  if (select papel from planejamento.usuarios where email = 'b@x') <> 'admin' then
    raise exception 'promoção: b@x deveria virar admin';
  end if;
end $$;

-- Rebaixar outro admin.
do $$
begin
  delete from planejamento.usuarios;
  insert into planejamento.usuarios (email, papel) values ('a@x', 'admin'), ('b@x', 'admin');
  perform planejamento.alterar_papel('a@x', 'usuario', 'b@x');
  if (select papel from planejamento.usuarios where email = 'a@x') <> 'usuario' then
    raise exception 'rebaixamento: a@x deveria virar usuario';
  end if;
end $$;

-- Rebaixar o único admin: ultimo_admin.
do $$
declare
  falhou text := null;
begin
  delete from planejamento.usuarios;
  insert into planejamento.usuarios (email, papel) values ('b@x', 'admin');
  begin
    perform planejamento.alterar_papel('b@x', 'usuario', 'b@x');
  exception when sqlstate 'P0001' then
    falhou := sqlerrm;
  end;
  if falhou is distinct from 'ultimo_admin' then
    raise exception 'ultimo_admin: esperava o erro, veio %', coalesce(falhou, 'nenhum erro');
  end if;
  if (select papel from planejamento.usuarios where email = 'b@x') <> 'admin' then
    raise exception 'ultimo_admin: b@x deveria continuar admin';
  end if;
end $$;

-- Autor que não é admin: autor_nao_admin.
do $$
declare
  falhou text := null;
begin
  delete from planejamento.usuarios;
  insert into planejamento.usuarios (email, papel)
  values ('a@x', 'admin'), ('b@x', 'usuario'), ('c@x', 'usuario');
  begin
    perform planejamento.alterar_papel('b@x', 'admin', 'c@x');
  exception when sqlstate 'P0001' then
    falhou := sqlerrm;
  end;
  if falhou is distinct from 'autor_nao_admin' then
    raise exception 'autor_nao_admin: esperava o erro, veio %', coalesce(falhou, 'nenhum erro');
  end if;
  if (select papel from planejamento.usuarios where email = 'b@x') <> 'usuario' then
    raise exception 'autor_nao_admin: b@x não deveria ter mudado';
  end if;
end $$;

-- Autor que nem está na tabela também não é admin.
do $$
declare
  falhou text := null;
begin
  delete from planejamento.usuarios;
  insert into planejamento.usuarios (email, papel) values ('a@x', 'admin'), ('b@x', 'usuario');
  begin
    perform planejamento.alterar_papel('b@x', 'admin', 'fantasma@x');
  exception when sqlstate 'P0001' then
    falhou := sqlerrm;
  end;
  if falhou is distinct from 'autor_nao_admin' then
    raise exception 'autor fantasma: esperava autor_nao_admin, veio %', coalesce(falhou, 'nenhum erro');
  end if;
end $$;

-- Alvo inexistente: alvo_inexistente.
do $$
declare
  falhou text := null;
begin
  delete from planejamento.usuarios;
  insert into planejamento.usuarios (email, papel) values ('a@x', 'admin'), ('b@x', 'usuario');
  begin
    perform planejamento.alterar_papel('z@x', 'admin', 'a@x');
  exception when sqlstate 'P0001' then
    falhou := sqlerrm;
  end;
  if falhou is distinct from 'alvo_inexistente' then
    raise exception 'alvo_inexistente: esperava o erro, veio %', coalesce(falhou, 'nenhum erro');
  end if;
end $$;

-- Papel fora da lista: papel_invalido.
do $$
declare
  falhou text := null;
begin
  delete from planejamento.usuarios;
  insert into planejamento.usuarios (email, papel) values ('a@x', 'admin'), ('b@x', 'usuario');
  begin
    perform planejamento.alterar_papel('b@x', 'dono', 'a@x');
  exception when sqlstate 'P0001' then
    falhou := sqlerrm;
  end;
  if falhou is distinct from 'papel_invalido' then
    raise exception 'papel_invalido: esperava o erro, veio %', coalesce(falhou, 'nenhum erro');
  end if;
end $$;

-- Promover quem já é admin: sem erro e sem tocar em papel_alterado_em.
do $$
declare
  antes timestamptz := '2026-01-01 00:00:00+00';
  depois timestamptz;
  por text;
begin
  delete from planejamento.usuarios;
  insert into planejamento.usuarios (email, papel, papel_alterado_por, papel_alterado_em)
  values ('a@x', 'admin', 'quem@x', antes), ('b@x', 'admin', null, null);
  perform planejamento.alterar_papel('a@x', 'admin', 'b@x');
  select papel_alterado_em, papel_alterado_por into depois, por
  from planejamento.usuarios where email = 'a@x';
  if depois is distinct from antes or por is distinct from 'quem@x' then
    raise exception 'idempotência: papel_alterado_em/por não deveriam mudar (veio % / %)', depois, por;
  end if;
end $$;

-- Troca bem-sucedida grava quem e quando.
do $$
declare
  por text;
  em timestamptz;
begin
  delete from planejamento.usuarios;
  insert into planejamento.usuarios (email, papel) values ('a@x', 'admin'), ('b@x', 'usuario');
  perform planejamento.alterar_papel('b@x', 'admin', 'a@x');
  select papel_alterado_por, papel_alterado_em into por, em
  from planejamento.usuarios where email = 'b@x';
  if por is distinct from 'a@x' then
    raise exception 'auditoria: papel_alterado_por deveria ser a@x, veio %', por;
  end if;
  if em is null or em < now() - interval '1 minute' then
    raise exception 'auditoria: papel_alterado_em deveria ser recente, veio %', em;
  end if;
end $$;

-- A tabela recusa papel fora da lista, direto no INSERT.
do $$
declare
  barrou boolean := false;
begin
  begin
    insert into planejamento.usuarios (email, papel) values ('d@x', 'dono');
  exception when check_violation then
    barrou := true;
  end;
  if not barrou then
    raise exception 'check: a tabela deveria recusar papel = dono';
  end if;
end $$;

-- Permissões: só o service_role usa a tabela e a função; RLS ligado.
do $$
begin
  if not has_function_privilege('service_role', 'planejamento.alterar_papel(text, text, text)', 'execute') then
    raise exception 'permissão: service_role deveria executar alterar_papel';
  end if;
  if has_function_privilege('anon', 'planejamento.alterar_papel(text, text, text)', 'execute')
     or has_function_privilege('authenticated', 'planejamento.alterar_papel(text, text, text)', 'execute') then
    raise exception 'permissão: anon/authenticated não deveriam executar alterar_papel';
  end if;
  if not has_table_privilege('service_role', 'planejamento.usuarios', 'select,insert,update,delete') then
    raise exception 'permissão: service_role deveria ter acesso total à tabela';
  end if;
  if has_table_privilege('anon', 'planejamento.usuarios', 'select')
     or has_table_privilege('authenticated', 'planejamento.usuarios', 'select') then
    raise exception 'permissão: anon/authenticated não deveriam ler a tabela';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'planejamento.usuarios'::regclass) then
    raise exception 'RLS: deveria estar ligado em planejamento.usuarios';
  end if;
end $$;

select 'usuarios: todas as asserções passaram' as resultado;
