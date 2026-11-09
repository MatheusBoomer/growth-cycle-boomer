-- Renumeração das etapas (Growth Cycle): a antiga 07 (briefing e benchmark) deixa de ser etapa e fica
-- arquivada com o id "briefing-benchmark"; a 08 vira 07, a 09 vira 08; 01 a 06 e "final" não mudam.
-- Equivalente em SQL de src/packages/core/src/migracao-etapas.ts (classificarNumeracao, migrarEstado, planoDeArquivos).
-- Tudo no schema "planejamento"; nada fora dele é tocado (o projeto é compartilhado com o "pit").
-- Idempotente: a marca 'renumera-etapas-growth-cycle' em planejamento.migracoes faz uma segunda execução não mudar nada.
-- O bloco "do" é um único comando: ou tudo é aplicado, ou nada.
-- Aplicar com o app parado: se o app novo estiver no ar, alguém pode gravar modelo da nova 07 e a migração o moveria
-- para briefing-benchmark. (O app novo também recusa abrir um prospect ainda não migrado: ErroNumeracaoAntiga.)

create table if not exists planejamento.migracoes (
  nome text primary key,
  aplicada_em timestamptz not null default now()
);

alter table planejamento.migracoes enable row level security;

revoke all on planejamento.migracoes from public, anon, authenticated;
grant all on planejamento.migracoes to service_role;

do $$
declare
  p record;
  e jsonb;
  etapas jsonb;
  nova_lista jsonb;
  lista text;
  inicial text;
  slugs text[] := '{}';
  fase_atual integer;
begin
  -- Duas execuções ao mesmo tempo esperam uma pela outra; a segunda encontra a marca e sai.
  lock table planejamento.migracoes in exclusive mode;

  if exists (select 1 from planejamento.migracoes where nome = 'renumera-etapas-growth-cycle') then
    raise notice 'renumera-etapas-growth-cycle já aplicada: nada a fazer.';
    return;
  end if;

  -- 1. Prospects na numeração "atual" (mesma regra de classificarNumeracao): estado com a etapa 09, sem versaoEtapas = 2
  --    e sem a 09 que o app antigo injetava num legado de 8 etapas (desde 14/10 ele completava todo estado lido com uma
  --    "09" bloqueada). Num prospect de 9 etapas de verdade a 09 é liberada assim que a 08 é concluída e a final só começa
  --    depois da 09: 09 bloqueada com a 08 concluída, ou com a final fora de "bloqueada", prova a chave injetada.
  --    Prospect legado (sem a chave 09 ou com ela injetada) ou já migrado fica intocado, inclusive os arquivos e eventos.
  for p in
    select slug, estado, etapa_atual
    from planejamento.prospects
    where jsonb_typeof(estado -> 'etapas') = 'object'
      and (estado -> 'etapas') ? '09'
      and (estado -> 'versaoEtapas') is distinct from '2'::jsonb
      and not (
        (estado -> 'etapas' -> '09' ->> 'status') is not distinct from 'bloqueada'
        and ((estado -> 'etapas' -> '08' ->> 'status') is not distinct from 'concluida'
             or (estado -> 'etapas' -> 'final' ->> 'status') is distinct from 'bloqueada')
      )
    order by slug
    for update
  loop
    e := p.estado;

    -- etapas: a 07 antiga sai; 08 vira 07 e 09 vira 08.
    select coalesce(
             jsonb_object_agg(case k when '08' then '07' when '09' then '08' else k end, v),
             '{}'::jsonb)
      into etapas
      from jsonb_each(e -> 'etapas') as x(k, v)
     where k <> '07';

    -- A nova 07 era a 08, bloqueada atrás da antiga 07: com a 06 concluída ela já pode começar.
    if etapas -> '07' ->> 'status' = 'bloqueada' and etapas -> '06' ->> 'status' = 'concluida' then
      etapas := jsonb_set(etapas, '{07,status}', '"liberada"'::jsonb);
    end if;

    -- Listas com "etapa": os itens da 07 antiga saem e os demais são renumerados, na mesma ordem.
    -- Lista ausente (ou que não é array) fica como está.
    foreach lista in array array['entregaveis', 'insumos', 'perguntas', 'filaAutomatica'] loop
      if jsonb_typeof(e -> lista) = 'array' then
        select coalesce(
                 jsonb_agg(
                   case
                     when i ->> 'etapa' = '08' then jsonb_set(i, '{etapa}', '"07"'::jsonb)
                     when i ->> 'etapa' = '09' then jsonb_set(i, '{etapa}', '"08"'::jsonb)
                     else i
                   end
                   order by ord),
                 '[]'::jsonb)
          into nova_lista
          from jsonb_array_elements(e -> lista) with ordinality as x(i, ord)
         where (i ->> 'etapa') is distinct from '07';
        e := jsonb_set(e, array[lista], nova_lista);
      end if;
    end loop;

    -- Cliente de teste: quem recomeçaria na antiga 07 recomeça na nova 07, a próxima que existe.
    if jsonb_typeof(e -> 'teste') = 'object' and jsonb_typeof(e -> 'teste' -> 'etapaInicial') = 'string' then
      inicial := e -> 'teste' ->> 'etapaInicial';
      e := jsonb_set(e, '{teste,etapaInicial}',
                     to_jsonb(case inicial when '07' then '07' when '08' then '07' when '09' then '08' else inicial end));
    end if;

    e := e || jsonb_build_object('versaoEtapas', 2, 'etapas', etapas);

    -- etapa_atual: quem estava na 07 antiga passa para a nova 07 (a próxima que existe).
    -- A versão sobe para que uma instância do app com o estado antigo em memória receba conflito em vez de sobrescrever.
    update planejamento.prospects
       set estado = e,
           etapa_atual = case p.etapa_atual when '07' then '07' when '08' then '07' when '09' then '08' else p.etapa_atual end,
           versao = versao + 1,
           atualizado_em = now()
     where slug = p.slug;

    slugs := slugs || p.slug;
  end loop;

  -- 2. Tabelas por prospect com coluna "etapa", só dos prospects migrados.
  --    Nesta ordem (arquivar a 07, depois 08→07, depois 09→08) para nunca juntar duas etapas no mesmo id.
  update planejamento.eventos_conversa set etapa = 'briefing-benchmark' where etapa = '07' and slug = any (slugs);
  update planejamento.eventos_conversa set etapa = '07' where etapa = '08' and slug = any (slugs);
  update planejamento.eventos_conversa set etapa = '08' where etapa = '09' and slug = any (slugs);

  update planejamento.uso_turnos set etapa = 'briefing-benchmark' where etapa = '07' and slug = any (slugs);
  update planejamento.uso_turnos set etapa = '07' where etapa = '08' and slug = any (slugs);
  update planejamento.uso_turnos set etapa = '08' where etapa = '09' and slug = any (slugs);

  update planejamento.presenca set etapa = 'briefing-benchmark' where etapa = '07' and slug = any (slugs);
  update planejamento.presenca set etapa = '07' where etapa = '08' and slug = any (slugs);
  update planejamento.presenca set etapa = '08' where etapa = '09' and slug = any (slugs);

  -- 3. Arquivos dos prospects migrados (regras de planoDeArquivos). Só o caminho muda: o objeto no Storage
  --    é guardado por hash (<slug>/<sha256>), então o conteúdo continua o mesmo.
  --    Uma fase por update, na ordem de planoDeArquivos: a chave (slug, caminho) é checada linha a linha,
  --    então cada destino precisa já estar livre quando o update da fase roda.
  --    Fase 0: tudo da 07 antiga (e o benchmark, que é dela inteiro) vai para entrega/arquivo-etapa-07/.
  --    Fases 1 a 3: 08→07, 09→08 e 10→09 (a apresentação final, numerada 10 nos nomes de arquivo, vira 09).
  for fase_atual in 0..3 loop
    update planejamento.arquivos a
       set caminho = regexp_replace(a.caminho, r.padrao, r.destino)
      from (values
        (0, '^entrega/ativos-aprovados/benchmark/(.*)$',          'entrega/arquivo-etapa-07/benchmark/\1'),
        (0, '^\.app/conversas/07\.jsonl$',                         'entrega/arquivo-etapa-07/conversas/07.jsonl'),
        (0, '^contexto/decisoes/07-(.+)$',                         'entrega/arquivo-etapa-07/decisoes/07-\1'),
        (0, '^entrega/ativos-aprovados/secoes/07-(.+)$',           'entrega/arquivo-etapa-07/secoes/07-\1'),
        (0, '^kit-de-teste/07/(.+)$',                              'entrega/arquivo-etapa-07/kit-de-teste/\1'),
        (0, '^\.app/anexos/07/(.+)$',                              'entrega/arquivo-etapa-07/anexos/\1'),
        (1, '^\.app/conversas/08\.jsonl$',                         '.app/conversas/07.jsonl'),
        (1, '^contexto/decisoes/08-(.+)$',                         'contexto/decisoes/07-\1'),
        (1, '^entrega/ativos-aprovados/secoes/08-(.+)$',           'entrega/ativos-aprovados/secoes/07-\1'),
        (1, '^kit-de-teste/08/(.+)$',                              'kit-de-teste/07/\1'),
        (1, '^\.app/anexos/08/(.+)$',                              '.app/anexos/07/\1'),
        (2, '^\.app/conversas/09\.jsonl$',                         '.app/conversas/08.jsonl'),
        (2, '^contexto/decisoes/09-(.+)$',                         'contexto/decisoes/08-\1'),
        (2, '^entrega/ativos-aprovados/secoes/09-(.+)$',           'entrega/ativos-aprovados/secoes/08-\1'),
        (2, '^kit-de-teste/09/(.+)$',                              'kit-de-teste/08/\1'),
        (2, '^\.app/anexos/09/(.+)$',                              '.app/anexos/08/\1'),
        (3, '^\.app/conversas/10\.jsonl$',                         '.app/conversas/09.jsonl'),
        (3, '^contexto/decisoes/10-(.+)$',                         'contexto/decisoes/09-\1'),
        (3, '^entrega/ativos-aprovados/secoes/10-(.+)$',           'entrega/ativos-aprovados/secoes/09-\1'),
        (3, '^kit-de-teste/10/(.+)$',                              'kit-de-teste/09/\1'),
        (3, '^\.app/anexos/10/(.+)$',                              '.app/anexos/09/\1')
      ) as r(fase, padrao, destino)
     where r.fase = fase_atual
       and a.slug = any (slugs)
       and a.caminho ~ r.padrao;
  end loop;

  -- 4. Tabelas globais (sem slug): renumeradas uma vez só, guardadas pela marca, haja ou não prospect migrado.
  --    Mesma ordem, por causa da chave primária (etapa, alvo) de config_modelos.
  update planejamento.config_modelos set etapa = 'briefing-benchmark' where etapa = '07';
  update planejamento.config_modelos set etapa = '07' where etapa = '08';
  update planejamento.config_modelos set etapa = '08' where etapa = '09';

  update planejamento.notas_skills set item = 'etapa:briefing-benchmark' where item = 'etapa:07';
  update planejamento.notas_skills set item = 'etapa:07' where item = 'etapa:08';
  update planejamento.notas_skills set item = 'etapa:08' where item = 'etapa:09';

  -- 5. A marca: daqui em diante o bloco não muda mais nada.
  insert into planejamento.migracoes (nome) values ('renumera-etapas-growth-cycle');

  raise notice 'renumera-etapas-growth-cycle aplicada: % prospect(s) migrado(s): %', cardinality(slugs), slugs;
end
$$;
