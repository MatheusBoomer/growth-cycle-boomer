-- Papéis do app: quem é admin e quem é usuário. Tudo no schema "planejamento"; nada fora dele é tocado.
-- Acesso só pelo servidor do app (service_role); RLS ligado e sem políticas fecha o resto.

create table if not exists planejamento.usuarios (
  email text primary key,
  papel text not null default 'usuario' check (papel in ('admin', 'usuario')),
  primeiro_acesso timestamptz not null default now(),
  ultimo_acesso timestamptz not null default now(),
  papel_alterado_por text,
  papel_alterado_em timestamptz
);

alter table planejamento.usuarios enable row level security;

revoke all on planejamento.usuarios from public, anon, authenticated;
grant all on planejamento.usuarios to service_role;

-- Troca o papel de "alvo" a mando de "autor", sem nunca deixar o app sem admin.
-- O lock nas linhas dos admins serializa trocas simultâneas: sem ele, dois admins rebaixando
-- um ao outro passariam pela checagem ao mesmo tempo e zerariam os admins.
-- Os erros têm mensagem fixa (P0001) para a camada TypeScript mapear por error.message.
create or replace function planejamento.alterar_papel(alvo text, novo_papel text, autor text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  papel_atual text;
begin
  if novo_papel is null or novo_papel not in ('admin', 'usuario') then
    raise exception 'papel_invalido' using errcode = 'P0001';
  end if;

  perform 1 from planejamento.usuarios where papel = 'admin' for update;

  if not exists (select 1 from planejamento.usuarios where email = autor and papel = 'admin') then
    raise exception 'autor_nao_admin' using errcode = 'P0001';
  end if;

  select papel into papel_atual from planejamento.usuarios where email = alvo;
  if not found then
    raise exception 'alvo_inexistente' using errcode = 'P0001';
  end if;

  if papel_atual = novo_papel then
    return;
  end if;

  if novo_papel = 'usuario'
     and (select count(*) from planejamento.usuarios where papel = 'admin') <= 1 then
    raise exception 'ultimo_admin' using errcode = 'P0001';
  end if;

  update planejamento.usuarios
  set papel = novo_papel, papel_alterado_por = autor, papel_alterado_em = now()
  where email = alvo;
end;
$$;

revoke all on function planejamento.alterar_papel(text, text, text) from public, anon, authenticated;
grant execute on function planejamento.alterar_papel(text, text, text) to service_role;

insert into planejamento.usuarios (email, papel)
values ('matheus.moreira@boomer.com.br', 'admin')
on conflict do nothing;
