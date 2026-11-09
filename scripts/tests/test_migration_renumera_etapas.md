# Roteiro de verificação: `20261111120000_renumera_etapas.sql`

O projeto não tem harness de SQL: este roteiro é a verificação manual da migration de renumeração
das etapas (07 antiga → `briefing-benchmark`, 08 → 07, 09 → 08). Foi executado num Postgres 16 local
descartável (Docker), nunca no Supabase de produção. Para repetir numa branch do Supabase, pule a
parte 1 e rode as consultas das partes 3 a 6 com `execute_sql` (na branch, nunca em produção).

Arquivos citados abaixo (`bootstrap.sql`, `seed.sql`, `q_contagens.sql`, `q_asserts.sql`, `bloco_do.sql`)
são cópias locais do conteúdo deste roteiro; nenhum deles é versionado.

## 1. Postgres local descartável

```bash
docker run --rm -d --name sdd-pg-growthcycle -e POSTGRES_PASSWORD=x -p 55432:5432 postgres:16
docker exec sdd-pg-growthcycle pg_isready -U postgres
P() { docker exec -i sdd-pg-growthcycle psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }

P < bootstrap.sql                       # stubs do que o Supabase já tem (abaixo)
for f in 20261027120000_planejamento 20261107120000_usuarios 20261108120000_custos_e_tempo \
         20261109120000_config_modelos 20261110120000_notas_skills; do
  P < supabase/migrations/$f.sql
done
P < seed.sql                            # dados de teste (apêndice A)

P < q_contagens.sql > antes.txt         # parte 3
P < supabase/migrations/20261111120000_renumera_etapas.sql
P < q_contagens.sql > depois.txt
P < q_asserts.sql                       # parte 4
awk '/^do \$\$/{f=1} f' supabase/migrations/20261111120000_renumera_etapas.sql > bloco_do.sql
P < bloco_do.sql                        # parte 5: segunda execução
P < q_contagens.sql > depois2.txt && diff depois.txt depois2.txt && echo "nenhuma diferença"

docker stop sdd-pg-growthcycle          # --rm apaga o container
```

`bootstrap.sql` (só local, imita o Supabase):

```sql
create role anon nologin; create role authenticated nologin; create role service_role nologin;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint);
```

## 2. Casos cobertos pelos dados de teste (apêndice A)

| slug | situação | o que precisa acontecer |
|---|---|---|
| `sottile-teste-2`, `teste-login` | 9 etapas, na 02 (como na nuvem); `sottile` sem `teste`, `perguntas` e `filaAutomatica` | migra; chaves ausentes continuam ausentes |
| `verdeluz-nuvem` | 9 etapas, na 04 | migra |
| `verdeluz-teste` | 9 etapas, na 06, `kit-de-teste/0[6789]/` (como na nuvem) | `kit-de-teste/07/` vai para `entrega/arquivo-etapa-07/kit-de-teste/`, 08→07, 09→08 |
| `legado-8` | 8 etapas, sem a chave `09` | intocado (estado, arquivos, eventos) |
| `velho-07` | etapa atual = 07 antiga `em_andamento` | nova 07 `liberada`, `etapa_atual` = 07, itens da 07 antiga somem, benchmark e `07-*` arquivados, `10-*` → `09-*` |
| `velho-08` | etapa atual = 08 antiga `em_andamento` | `etapa_atual` = 07; cadeia `secoes/07-a`, `08-a`, `09-a` sem colisão de chave |

`config_modelos` com 01..09 e final (como na nuvem) e alvos de subagente na 07/08/09;
`notas_skills` com `etapa:03`, `etapa:07`, `etapa:08`, `etapa:09` (vazia na nuvem, testada mesmo assim).

## 3. Contagens antes e depois (`q_contagens.sql`)

```sql
-- C1. Contagem por etapa em cada tabela com etapa
select 'eventos_conversa' tabela, etapa, count(*) from planejamento.eventos_conversa group by etapa
union all select 'uso_turnos', etapa, count(*) from planejamento.uso_turnos group by etapa
union all select 'presenca', etapa, count(*) from planejamento.presenca group by etapa
union all select 'prospects.etapa_atual', coalesce(etapa_atual, '(null)'), count(*) from planejamento.prospects group by etapa_atual
order by 1, 2;
-- C2. config_modelos e notas_skills
select etapa, string_agg(alvo, ', ' order by alvo) alvos from planejamento.config_modelos group by etapa order by etapa;
select item, count(*) from planejamento.notas_skills group by item order by item;
-- C3. Prospects: classe, chaves de etapas, impressão digital do estado
select slug, etapa_atual, versao, estado->'versaoEtapas' versao_etapas,
       (select string_agg(k, ',' order by k) from jsonb_object_keys(estado->'etapas') k) chaves,
       md5(estado::text) md5_estado
from planejamento.prospects order by slug;
-- C4. Arquivos com número de etapa no caminho (ou do benchmark)
select slug, caminho, sha256 from planejamento.arquivos
where caminho ~ '^(contexto/decisoes/\d\d-|entrega/ativos-aprovados/(secoes/\d\d-|benchmark/)|kit-de-teste/\d\d/|entrega/arquivo-etapa-07/|\.app/conversas/)'
order by slug, caminho;
-- C5. Impressão digital de cada tabela do schema (para a checagem de "nada mudou" da segunda execução)
select 'prospects' t, count(*), md5(coalesce(string_agg(x::text, '|' order by x::text), '')) from planejamento.prospects x
union all select 'eventos_conversa', count(*), md5(coalesce(string_agg(x::text, '|' order by x::text), '')) from planejamento.eventos_conversa x
union all select 'uso_turnos', count(*), md5(coalesce(string_agg(x::text, '|' order by x::text), '')) from planejamento.uso_turnos x
union all select 'presenca', count(*), md5(coalesce(string_agg(x::text, '|' order by x::text), '')) from planejamento.presenca x
union all select 'config_modelos', count(*), md5(coalesce(string_agg(x::text, '|' order by x::text), '')) from planejamento.config_modelos x
union all select 'notas_skills', count(*), md5(coalesce(string_agg(x::text, '|' order by x::text), '')) from planejamento.notas_skills x
union all select 'arquivos', count(*), md5(coalesce(string_agg(x::text, '|' order by x::text), '')) from planejamento.arquivos x
union all select 'arquivos_lixeira', count(*), md5(coalesce(string_agg(x::text, '|' order by x::text), '')) from planejamento.arquivos_lixeira x
union all select 'comentarios', count(*), md5(coalesce(string_agg(x::text, '|' order by x::text), '')) from planejamento.comentarios x
union all select 'usuarios', count(*), md5(coalesce(string_agg(x::text, '|' order by x::text), '')) from planejamento.usuarios x
order by 1;
```

Resultado antes (local):

```
        tabela         | etapa | count 
-----------------------+-------+-------
 eventos_conversa      | 01    |     1
 eventos_conversa      | 02    |     2
 eventos_conversa      | 04    |     1
 eventos_conversa      | 06    |     2
 eventos_conversa      | 07    |     4
 eventos_conversa      | 08    |     2
 eventos_conversa      | 09    |     1
 presenca              | 04    |     1
 presenca              | 07    |     1
 presenca              | 08    |     3
 presenca              | 09    |     1
 prospects.etapa_atual | 02    |     2
 prospects.etapa_atual | 04    |     1
 prospects.etapa_atual | 06    |     1
 prospects.etapa_atual | 07    |     1
 prospects.etapa_atual | 08    |     2
 uso_turnos            | 06    |     1
 uso_turnos            | 07    |     2
 uso_turnos            | 08    |     2
(19 rows)

 etapa |                   alvos                    
-------+--------------------------------------------
 01    | principal
 02    | principal
 03    | principal
 04    | principal
 05    | principal
 06    | principal
 07    | principal, subagente:pesquisador-benchmark
 08    | principal, subagente:pesquisador-benchmark
 09    | principal, subagente:analista-dados
 final | principal
(10 rows)

           item           | count 
--------------------------+-------
 etapa:03                 |     1
 etapa:07                 |     1
 etapa:08                 |     1
 etapa:09                 |     1
 subagente:analista-dados |     1
(5 rows)

      slug       | etapa_atual | versao | versao_etapas |              chaves              |            md5_estado            
-----------------+-------------+--------+---------------+----------------------------------+----------------------------------
 legado-8        | 08          |      0 |               | 01,02,03,04,05,06,07,08,final    | bc3ba4c61c886ac858960f9ef59f8eeb
 sottile-teste-2 | 02          |      0 |               | 01,02,03,04,05,06,07,08,09,final | 92b4ada7a45108e6b8f0a1de1a42e7d1
 teste-login     | 02          |      0 |               | 01,02,03,04,05,06,07,08,09,final | 42d3dc094963a77acd7ad39ff4931008
 velho-07        | 07          |      0 |               | 01,02,03,04,05,06,07,08,09,final | 97db7d80c458b010f1379ffac8dd258d
 velho-08        | 08          |      0 |               | 01,02,03,04,05,06,07,08,09,final | 1f27a28818086991ed94686ff29d359d
 verdeluz-nuvem  | 04          |      0 |               | 01,02,03,04,05,06,07,08,09,final | 6bf24bb2a566b88ddc66de342f7ae356
 verdeluz-teste  | 06          |      0 |               | 01,02,03,04,05,06,07,08,09,final | c6a107cf6223ba4ab285e73dcf044bdf
(7 rows)

      slug      |                      caminho                       | sha256 
----------------+----------------------------------------------------+--------
 legado-8       | contexto/decisoes/08-plano.md                      | h7
 legado-8       | kit-de-teste/08/x.xlsx                             | h8
 velho-07       | contexto/decisoes/06-metas.md                      | h9
 velho-07       | contexto/decisoes/07-briefing.md                   | h10
 velho-07       | contexto/decisoes/08-midia.md                      | h11
 velho-07       | contexto/decisoes/09-plano.md                      | h12
 velho-07       | entrega/ativos-aprovados/benchmark/criativos/a.png | h14
 velho-07       | entrega/ativos-aprovados/benchmark/relatorio.html  | h13
 velho-07       | entrega/ativos-aprovados/secoes/07-briefing.md     | h15
 velho-07       | entrega/ativos-aprovados/secoes/08-midia.md        | h16
 velho-07       | entrega/ativos-aprovados/secoes/09-plano.md        | h17
 velho-07       | entrega/ativos-aprovados/secoes/10-apresentacao.md | h18
 velho-08       | entrega/ativos-aprovados/secoes/07-a.md            | h20
 velho-08       | entrega/ativos-aprovados/secoes/08-a.md            | h21
 velho-08       | entrega/ativos-aprovados/secoes/09-a.md            | h22
 velho-08       | kit-de-teste/07/k.md                               | h23
 velho-08       | kit-de-teste/08/k.md                               | h24
 velho-08       | kit-de-teste/09/k.md                               | h25
 verdeluz-nuvem | contexto/decisoes/03-diagnostico.md                | h6
 verdeluz-teste | contexto/decisoes/06-metas.md                      | h5
 verdeluz-teste | kit-de-teste/06/metas.xlsx                         | h1
 verdeluz-teste | kit-de-teste/07/briefing.docx                      | h2
 verdeluz-teste | kit-de-teste/08/midia.xlsx                         | h3
 verdeluz-teste | kit-de-teste/09/plano.xlsx                         | h4
(24 rows)

        t         | count |               md5                
------------------+-------+----------------------------------
 arquivos         |    25 | e75e5ed1380dcdd10f06d5db22d615c3
 arquivos_lixeira |     1 | 308a80bc00efe6cef04cdc2a70d7a793
 comentarios      |     1 | ebfd1040bc9a3b9b0a14c4e08d54c638
 config_modelos   |    13 | 0012e831eb322a2ed83b38f1d8506cfd
 eventos_conversa |    13 | 742ccb286ad3e3906d0dacc568288b43
 notas_skills     |     5 | 146d1fe5332a6afbfda6abb3c676b56b
 presenca         |     6 | 98f496a226d2185f8a81bb483f63e13a
 prospects        |     7 | 7c3475d5c444366b06f1ed3561a3a58f
 uso_turnos       |     5 | bca42509853cede7d8d368e4f08fdf39
 usuarios         |     1 | 6964ea26e32c3c6747a066b92a9ec628
(10 rows)

```

Resultado depois (local):

```
        tabela         |       etapa        | count 
-----------------------+--------------------+-------
 eventos_conversa      | 01                 |     1
 eventos_conversa      | 02                 |     2
 eventos_conversa      | 04                 |     1
 eventos_conversa      | 06                 |     2
 eventos_conversa      | 07                 |     2
 eventos_conversa      | 08                 |     2
 eventos_conversa      | briefing-benchmark |     3
 presenca              | 04                 |     1
 presenca              | 07                 |     2
 presenca              | 08                 |     2
 presenca              | briefing-benchmark |     1
 prospects.etapa_atual | 02                 |     2
 prospects.etapa_atual | 04                 |     1
 prospects.etapa_atual | 06                 |     1
 prospects.etapa_atual | 07                 |     2
 prospects.etapa_atual | 08                 |     1
 uso_turnos            | 06                 |     1
 uso_turnos            | 07                 |     1
 uso_turnos            | 08                 |     1
 uso_turnos            | briefing-benchmark |     2
(20 rows)

       etapa        |                   alvos                    
--------------------+--------------------------------------------
 01                 | principal
 02                 | principal
 03                 | principal
 04                 | principal
 05                 | principal
 06                 | principal
 07                 | principal, subagente:pesquisador-benchmark
 08                 | principal, subagente:analista-dados
 briefing-benchmark | principal, subagente:pesquisador-benchmark
 final              | principal
(10 rows)

           item           | count 
--------------------------+-------
 etapa:03                 |     1
 etapa:07                 |     1
 etapa:08                 |     1
 etapa:briefing-benchmark |     1
 subagente:analista-dados |     1
(5 rows)

      slug       | etapa_atual | versao | versao_etapas |            chaves             |            md5_estado            
-----------------+-------------+--------+---------------+-------------------------------+----------------------------------
 legado-8        | 08          |      0 |               | 01,02,03,04,05,06,07,08,final | bc3ba4c61c886ac858960f9ef59f8eeb
 sottile-teste-2 | 02          |      1 | 2             | 01,02,03,04,05,06,07,08,final | b65f5e1a2f2b0c6dcfd2eddc1deea8fe
 teste-login     | 02          |      1 | 2             | 01,02,03,04,05,06,07,08,final | dca1c6c07c307b42edabaa8ad10bc537
 velho-07        | 07          |      1 | 2             | 01,02,03,04,05,06,07,08,final | 70b4a9c71c8c7a1431014dffa98bc294
 velho-08        | 07          |      1 | 2             | 01,02,03,04,05,06,07,08,final | 09e871bc677f163c7f04d69ce100d4d0
 verdeluz-nuvem  | 04          |      1 | 2             | 01,02,03,04,05,06,07,08,final | 35a602cf9ce95e88174aaddea08daf56
 verdeluz-teste  | 06          |      1 | 2             | 01,02,03,04,05,06,07,08,final | dd1d703f479c07ecb09da8a029198ec0
(7 rows)

      slug      |                       caminho                       | sha256 
----------------+-----------------------------------------------------+--------
 legado-8       | contexto/decisoes/08-plano.md                       | h7
 legado-8       | kit-de-teste/08/x.xlsx                              | h8
 velho-07       | contexto/decisoes/06-metas.md                       | h9
 velho-07       | contexto/decisoes/07-midia.md                       | h11
 velho-07       | contexto/decisoes/08-plano.md                       | h12
 velho-07       | entrega/arquivo-etapa-07/benchmark/criativos/a.png  | h14
 velho-07       | entrega/arquivo-etapa-07/benchmark/relatorio.html   | h13
 velho-07       | entrega/arquivo-etapa-07/decisoes/07-briefing.md    | h10
 velho-07       | entrega/arquivo-etapa-07/secoes/07-briefing.md      | h15
 velho-07       | entrega/ativos-aprovados/secoes/07-midia.md         | h16
 velho-07       | entrega/ativos-aprovados/secoes/08-plano.md         | h17
 velho-07       | entrega/ativos-aprovados/secoes/09-apresentacao.md  | h18
 velho-08       | entrega/arquivo-etapa-07/kit-de-teste/k.md          | h23
 velho-08       | entrega/arquivo-etapa-07/secoes/07-a.md             | h20
 velho-08       | entrega/ativos-aprovados/secoes/07-a.md             | h21
 velho-08       | entrega/ativos-aprovados/secoes/08-a.md             | h22
 velho-08       | kit-de-teste/07/k.md                                | h24
 velho-08       | kit-de-teste/08/k.md                                | h25
 verdeluz-nuvem | contexto/decisoes/03-diagnostico.md                 | h6
 verdeluz-teste | contexto/decisoes/06-metas.md                       | h5
 verdeluz-teste | entrega/arquivo-etapa-07/kit-de-teste/briefing.docx | h2
 verdeluz-teste | kit-de-teste/06/metas.xlsx                          | h1
 verdeluz-teste | kit-de-teste/07/midia.xlsx                          | h3
 verdeluz-teste | kit-de-teste/08/plano.xlsx                          | h4
(24 rows)

        t         | count |               md5                
------------------+-------+----------------------------------
 arquivos         |    25 | df1cc024e88bdfd27d9782393eb1c705
 arquivos_lixeira |     1 | 308a80bc00efe6cef04cdc2a70d7a793
 comentarios      |     1 | ebfd1040bc9a3b9b0a14c4e08d54c638
 config_modelos   |    13 | ebaf430493f4bb5e6fb004ead74c5ba2
 eventos_conversa |    13 | 0eeb135b9fd6c2c05fa8984b73aa73c8
 notas_skills     |     5 | 0e0751fb398e95fe3068142132a91d43
 presenca         |     6 | d01fd8bc9a45c2b070d14ef53005e2aa
 prospects        |     7 | 76bdc646f7fbe7cb58cb790fae5de89e
 uso_turnos       |     5 | 390923ab1eb15e34397a5a2c5975f5eb
 usuarios         |     1 | 6964ea26e32c3c6747a066b92a9ec628
(10 rows)

```

O que conferir: `legado-8` com o mesmo `md5_estado` antes e depois (`bc3ba4c6…`), `versao` 0 e os mesmos
caminhos; nenhum prospect com a chave `09`; `config_modelos` sem `09` e com `briefing-benchmark`;
`arquivos_lixeira`, `comentarios` e `usuarios` com a mesma impressão digital.

## 4. Asserções (`q_asserts.sql`)

O bloco `do` levanta exceção na primeira falha; a consulta seguinte mostra o detalhe.

```sql
-- A. Asserções gerais (valem em qualquer base depois da migration); erro = falha
do $$
declare n integer;
begin
  if not exists (select 1 from planejamento.migracoes where nome = 'renumera-etapas-growth-cycle') then
    raise exception 'FALHA: marca ausente em planejamento.migracoes'; end if;
  select count(*) into n from planejamento.prospects where (estado -> 'etapas') ? '09';
  if n > 0 then raise exception 'FALHA: % prospect(s) ainda com a chave 09 em estado.etapas', n; end if;
  select count(*) into n from planejamento.config_modelos where etapa = '09';
  if n > 0 then raise exception 'FALHA: config_modelos ainda tem a etapa 09'; end if;
  select count(*) into n from planejamento.prospects p
   where p.estado -> 'versaoEtapas' = '2'::jsonb
     and (exists (select 1 from planejamento.eventos_conversa x where x.slug = p.slug and x.etapa = '09')
       or exists (select 1 from planejamento.uso_turnos x where x.slug = p.slug and x.etapa = '09')
       or exists (select 1 from planejamento.presenca x where x.slug = p.slug and x.etapa = '09')
       or exists (select 1 from planejamento.arquivos x where x.slug = p.slug
                   and x.caminho ~ '^(entrega/ativos-aprovados/benchmark/|contexto/decisoes/09-|kit-de-teste/09/)')
       or p.etapa_atual = '09'
       or exists (select 1 from jsonb_array_elements(coalesce(p.estado->'entregaveis','[]') || coalesce(p.estado->'insumos','[]')
                                                || coalesce(p.estado->'perguntas','[]') || coalesce(p.estado->'filaAutomatica','[]')) i
                   where i->>'etapa' = '09'));
  if n > 0 then raise exception 'FALHA: % prospect(s) migrado(s) ainda com referência à etapa 09 ou ao benchmark', n; end if;
  raise notice 'OK: asserções gerais';
end $$;
-- B. Detalhe dos estados migrados
select slug, etapa_atual,
       estado->'etapas'->'06'->>'status' s06, estado->'etapas'->'07'->>'status' s07, estado->'etapas'->'08'->>'status' s08,
       estado->'teste'->>'etapaInicial' etapa_inicial,
       (select string_agg(i->>'id' || ':' || (i->>'etapa'), ',') from jsonb_array_elements(estado->'entregaveis') i) entregaveis,
       (select string_agg(i->>'id' || ':' || (i->>'etapa'), ',') from jsonb_array_elements(estado->'insumos') i) insumos,
       (select string_agg(i->>'id' || ':' || (i->>'etapa'), ',') from jsonb_array_elements(estado->'perguntas') i) perguntas,
       (select string_agg(i->>'id' || ':' || (i->>'etapa'), ',') from jsonb_array_elements(estado->'filaAutomatica') i) fila,
       estado ? 'teste' tem_teste, estado ? 'perguntas' tem_perguntas, estado ? 'filaAutomatica' tem_fila
from planejamento.prospects order by slug;
```

Resultado (local):

```
NOTICE:  OK: asserções gerais
      slug       | etapa_atual |     s06      |     s07      |     s08      | etapa_inicial |  entregaveis   | insumos | perguntas |    fila     | tem_teste | tem_perguntas | tem_fila 
-----------------+-------------+--------------+--------------+--------------+---------------+----------------+---------+-----------+-------------+-----------+---------------+----------
 legado-8        | 08          | concluida    | concluida    | em_andamento |               | l-08:08        |         |           |             | f         | t             | t
 sottile-teste-2 | 02          | bloqueada    | bloqueada    | bloqueada    |               |                |         |           |             | f         | f             | f
 teste-login     | 02          | bloqueada    | bloqueada    | bloqueada    |               |                |         |           |             | f         | t             | t
 velho-07        | 07          | concluida    | liberada     | bloqueada    | 07            | a:06,c:07,d:08 | i9:08   |           | f8:07,f3:03 | t         | t             | t
 velho-08        | 07          | concluida    | em_andamento | bloqueada    | 08            |                |         |           |             | t         | t             | t
 verdeluz-nuvem  | 04          | bloqueada    | bloqueada    | bloqueada    |               |                |         |           |             | f         | t             | t
 verdeluz-teste  | 06          | em_andamento | bloqueada    | bloqueada    | 06            | e-06:06        |         |           |             | t         | t             | t
(7 rows)

```

## 5. Segunda execução: nada muda

Rodar só o bloco `do $$ … $$` da migration (na branch: colar o bloco em `execute_sql`) e depois
`q_contagens.sql` de novo. Toda a saída, inclusive as impressões digitais por tabela (C5), tem de ser
idêntica à do "depois".

```
NOTICE:  renumera-etapas-growth-cycle já aplicada: nada a fazer.
SEGUNDA EXECUCAO: nenhuma diferença      (diff depois.txt depois2.txt vazio)
```

O arquivo inteiro rodado uma terceira vez também não muda nada (`create table if not exists` só avisa).

## 6. Atomicidade (local, base `cmp` com os mesmos dados)

Com um destino já ocupado (`entrega/arquivo-etapa-07/decisoes/07-briefing.md` inserido antes em `velho-07`),
a migration falha no `update` de `planejamento.arquivos` (chave `(slug, caminho)` duplicada) e
`q_contagens.sql` sai idêntico ao de antes, sem marca em `planejamento.migracoes` (count = 0).
Sem a colisão, a mesma base migra normalmente.

## 7. Conferência contra o código TypeScript

Os estados e as listas de caminhos de antes (base `cmp`) passaram por `migrarEstado` e `planoDeArquivos`
(`src/packages/core/src/migracao-etapas.ts`) com `npx tsx` e foram comparados com o resultado do SQL:

```
legado-8         legada  estado: igual ao TS | arquivos: igual ao TS
sottile-teste-2  atual   estado: igual ao TS | arquivos: igual ao TS
teste-login      atual   estado: igual ao TS | arquivos: igual ao TS
velho-07         atual   estado: igual ao TS | arquivos: igual ao TS
velho-08         atual   estado: igual ao TS | arquivos: igual ao TS
verdeluz-nuvem   atual   estado: igual ao TS | arquivos: igual ao TS
verdeluz-teste   atual   estado: igual ao TS | arquivos: igual ao TS
```

(O TS exige as quatro listas no estado; para `sottile-teste-2` a comparação preencheu as ausentes com `[]`
antes de migrar e as removeu depois, que é o comportamento do SQL: lista ausente continua ausente.)

## Apêndice A: `seed.sql`

```sql
-- Dados locais que imitam a nuvem + casos extremos. Não versionado.
create function pg_temp.et(st text) returns jsonb language sql as $f$
  select jsonb_build_object('status', st, 'sessionId', null, 'iniciadaEm', null, 'concluidaEm', null,
                            'sinalizada', false, 'resumoDecisoes', null, 'handoff', null)
$f$;
-- etapas 01..09 + final a partir de uma lista de status (9 etapas numeradas + final)
create function pg_temp.etapas9(s text[]) returns jsonb language sql as $f$
  select jsonb_build_object('01', pg_temp.et(s[1]), '02', pg_temp.et(s[2]), '03', pg_temp.et(s[3]),
    '04', pg_temp.et(s[4]), '05', pg_temp.et(s[5]), '06', pg_temp.et(s[6]), '07', pg_temp.et(s[7]),
    '08', pg_temp.et(s[8]), '09', pg_temp.et(s[9]), 'final', pg_temp.et(s[10]))
$f$;
create function pg_temp.etapas8(s text[]) returns jsonb language sql as $f$
  select jsonb_build_object('01', pg_temp.et(s[1]), '02', pg_temp.et(s[2]), '03', pg_temp.et(s[3]),
    '04', pg_temp.et(s[4]), '05', pg_temp.et(s[5]), '06', pg_temp.et(s[6]), '07', pg_temp.et(s[7]),
    '08', pg_temp.et(s[8]), 'final', pg_temp.et(s[9]))
$f$;
create function pg_temp.base(slug text, etapas jsonb) returns jsonb language sql as $f$
  select jsonb_build_object('versao', 1, 'prospect', jsonb_build_object('slug', slug, 'nome', slug, 'site', null, 'criadoEm', '2026-11-01T00:00:00Z'),
    'etapas', etapas, 'entregaveis', '[]'::jsonb, 'insumos', '[]'::jsonb, 'perguntas', '[]'::jsonb, 'filaAutomatica', '[]'::jsonb,
    'atualizadoEm', '2026-11-01T00:00:00Z')
$f$;

insert into planejamento.prospects (slug, nome, estado, etapa_atual) values
-- sem teste, sem perguntas, sem filaAutomatica (robustez 3b)
('sottile-teste-2', 'Sottile', pg_temp.base('sottile-teste-2', pg_temp.etapas9(array['concluida','em_andamento','bloqueada','bloqueada','bloqueada','bloqueada','bloqueada','bloqueada','bloqueada','bloqueada'])) - 'perguntas' - 'filaAutomatica', '02'),
('teste-login', 'Teste login', pg_temp.base('teste-login', pg_temp.etapas9(array['concluida','em_andamento','bloqueada','bloqueada','bloqueada','bloqueada','bloqueada','bloqueada','bloqueada','bloqueada'])), '02'),
('verdeluz-nuvem', 'Verdeluz nuvem', pg_temp.base('verdeluz-nuvem', pg_temp.etapas9(array['concluida','concluida','concluida','em_andamento','bloqueada','bloqueada','bloqueada','bloqueada','bloqueada','bloqueada'])), '04'),
('verdeluz-teste', 'Verdeluz teste', pg_temp.base('verdeluz-teste', pg_temp.etapas9(array['concluida','concluida','concluida','concluida','concluida','em_andamento','bloqueada','bloqueada','bloqueada','bloqueada']))
   || jsonb_build_object('teste', jsonb_build_object('fixture', 'verdeluz', 'etapaInicial', '06'),
                         'entregaveis', jsonb_build_array(jsonb_build_object('id','e-06','etapa','06','titulo','Metas'))), '06'),
-- legado de 8 etapas (sem a chave 09): não pode mudar nada
('legado-8', 'Legado', pg_temp.base('legado-8', pg_temp.etapas8(array['concluida','concluida','concluida','concluida','concluida','concluida','concluida','em_andamento','bloqueada']))
   || jsonb_build_object('entregaveis', jsonb_build_array(jsonb_build_object('id','l-08','etapa','08'))), '08'),
-- etapa atual = 07 antiga em andamento
('velho-07', 'Velho 07', pg_temp.base('velho-07', pg_temp.etapas9(array['concluida','concluida','concluida','concluida','concluida','concluida','em_andamento','bloqueada','bloqueada','bloqueada']))
   || jsonb_build_object(
     'teste', jsonb_build_object('fixture', 'verdeluz', 'etapaInicial', '07'),
     'entregaveis', jsonb_build_array(jsonb_build_object('id','a','etapa','06'), jsonb_build_object('id','b','etapa','07'), jsonb_build_object('id','c','etapa','08'), jsonb_build_object('id','d','etapa','09')),
     'insumos', jsonb_build_array(jsonb_build_object('id','i7','etapa','07'), jsonb_build_object('id','i9','etapa','09')),
     'perguntas', jsonb_build_array(jsonb_build_object('id','p7','etapa','07')),
     'filaAutomatica', jsonb_build_array(jsonb_build_object('id','f8','etapa','08'), jsonb_build_object('id','f3','etapa','03'))), '07'),
-- etapa atual = 08 antiga em andamento
('velho-08', 'Velho 08', pg_temp.base('velho-08', pg_temp.etapas9(array['concluida','concluida','concluida','concluida','concluida','concluida','concluida','em_andamento','bloqueada','bloqueada']))
   || jsonb_build_object('teste', jsonb_build_object('fixture', 'verdeluz', 'etapaInicial', '09')), '08');

insert into planejamento.arquivos (slug, caminho, sha256, tamanho) values
('verdeluz-teste', 'kit-de-teste/06/metas.xlsx', 'h1', 1),
('verdeluz-teste', 'kit-de-teste/07/briefing.docx', 'h2', 1),
('verdeluz-teste', 'kit-de-teste/08/midia.xlsx', 'h3', 1),
('verdeluz-teste', 'kit-de-teste/09/plano.xlsx', 'h4', 1),
('verdeluz-teste', 'contexto/decisoes/06-metas.md', 'h5', 1),
('verdeluz-nuvem', 'contexto/decisoes/03-diagnostico.md', 'h6', 1),
('legado-8', 'contexto/decisoes/08-plano.md', 'h7', 1),
('legado-8', 'kit-de-teste/08/x.xlsx', 'h8', 1),
('velho-07', 'contexto/decisoes/06-metas.md', 'h9', 1),
('velho-07', 'contexto/decisoes/07-briefing.md', 'h10', 1),
('velho-07', 'contexto/decisoes/08-midia.md', 'h11', 1),
('velho-07', 'contexto/decisoes/09-plano.md', 'h12', 1),
('velho-07', 'entrega/ativos-aprovados/benchmark/relatorio.html', 'h13', 1),
('velho-07', 'entrega/ativos-aprovados/benchmark/criativos/a.png', 'h14', 1),
('velho-07', 'entrega/ativos-aprovados/secoes/07-briefing.md', 'h15', 1),
('velho-07', 'entrega/ativos-aprovados/secoes/08-midia.md', 'h16', 1),
('velho-07', 'entrega/ativos-aprovados/secoes/09-plano.md', 'h17', 1),
('velho-07', 'entrega/ativos-aprovados/secoes/10-apresentacao.md', 'h18', 1),
('velho-07', 'entrega/ativos-aprovados/graficos/08-roas.png', 'h19', 1),
-- cadeia que colidiria num update único: 08-a → 07-a e 09-a → 08-a
('velho-08', 'entrega/ativos-aprovados/secoes/07-a.md', 'h20', 1),
('velho-08', 'entrega/ativos-aprovados/secoes/08-a.md', 'h21', 1),
('velho-08', 'entrega/ativos-aprovados/secoes/09-a.md', 'h22', 1),
('velho-08', 'kit-de-teste/07/k.md', 'h23', 1),
('velho-08', 'kit-de-teste/08/k.md', 'h24', 1),
('velho-08', 'kit-de-teste/09/k.md', 'h25', 1);

insert into planejamento.eventos_conversa (slug, etapa, evento, em)
select s, e, '{"tipo":"turno_inicio"}'::jsonb, now() from (values
 ('sottile-teste-2','01'),('sottile-teste-2','02'),('teste-login','02'),('verdeluz-nuvem','04'),
 ('verdeluz-teste','06'),('legado-8','07'),('legado-8','08'),
 ('velho-07','06'),('velho-07','07'),('velho-07','07'),
 ('velho-08','07'),('velho-08','08'),('velho-08','09')) v(s, e);

insert into planejamento.uso_turnos (slug, etapa, inicio, fim, status)
select s, e, now(), now(), 'ok' from (values
 ('verdeluz-teste','06'),('legado-8','08'),('velho-07','07'),('velho-08','07'),('velho-08','08')) v(s, e);

insert into planejamento.presenca (slug, email, etapa, visivel, segundos_sem_interacao)
select s, 'a@b.c', e, true, 0 from (values
 ('verdeluz-nuvem','04'),('legado-8','08'),('velho-07','07'),('velho-07','08'),('velho-08','08'),('velho-08','09')) v(s, e);

insert into planejamento.config_modelos (etapa, alvo, modelo)
select e, 'principal', 'sonnet' from unnest(array['01','02','03','04','05','06','07','08','09','final']) e;
insert into planejamento.config_modelos (etapa, alvo, modelo) values
 ('07','subagente:pesquisador-benchmark','haiku'), ('08','subagente:pesquisador-benchmark','haiku'), ('09','subagente:analista-dados','opus');

insert into planejamento.notas_skills (item, texto, autor) values
 ('etapa:03','n3','x'), ('etapa:07','n7','x'), ('etapa:08','n8','x'), ('etapa:09','n9','x'), ('subagente:analista-dados','ns','x');

insert into planejamento.comentarios (slug, entregavel_id, lista) values ('velho-07', 'b', '[]');
insert into planejamento.arquivos_lixeira (slug, caminho, sha256) values ('velho-07', 'contexto/decisoes/08-antigo.md', 'hx');
```
