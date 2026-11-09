# Roteiro de verificação: `20261111120000_renumera_etapas.sql`

O projeto não tem harness de SQL: este roteiro é a verificação manual da migration de renumeração
das etapas (07 antiga → `briefing-benchmark`, 08 → 07, 09 → 08). Foi executado num Postgres 16 local
descartável (Docker), nunca no Supabase de produção. Para repetir numa branch do Supabase, pule a
parte 1 e rode as consultas das partes 3 a 6 com `execute_sql` (na branch, nunca em produção).

Aplicar com o app parado: se o app novo estiver no ar, alguém pode gravar modelo da nova 07 e a migração o moveria
para briefing-benchmark. (O app novo recusa abrir um prospect ainda não migrado com `ErroNumeracaoAntiga`, mas a
gravação de modelos por etapa em `config_modelos` não passa por essa guarda.)

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
| `velho-08` | etapa atual = 08 antiga `em_andamento` | `etapa_atual` = 07; cadeia `secoes/07-a`, `08-a`, `09-a` (e `.app/anexos/07`, `08`, `09`) sem colisão de chave |
| `velho-09` | 9 etapas de verdade, 08 concluída e 09 liberada | migra (`etapa_atual` = 08, nova 08 `liberada`) |
| `legado-09-injetada` | 8 etapas (07 = mídia paga, 08 = plano, ambas concluídas, final em andamento) com a `09` bloqueada que o app antigo injetava desde 14/10, como a `adda` | intocado: mesmo md5 do estado, mesmos arquivos, eventos, uso e presença (C6) |

Anexos do chat (`.app/anexos/<etapa>/`) em `velho-07`: `07/` vai para `entrega/arquivo-etapa-07/anexos/`, `08/`→`07/`,
`09/`→`08/`, `06/` fica.

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
where caminho ~ '^(contexto/decisoes/\d\d-|entrega/ativos-aprovados/(secoes/\d\d-|benchmark/)|kit-de-teste/\d\d/|entrega/arquivo-etapa-07/|\.app/conversas/|\.app/anexos/)'
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
-- C6. Impressão digital por prospect (estado, arquivos, eventos, uso, presença): o legado tem de sair idêntico
select p.slug, md5(p.estado::text) estado, p.versao,
  (select md5(coalesce(string_agg(a.caminho || '=' || a.sha256, '|' order by a.caminho), '')) from planejamento.arquivos a where a.slug = p.slug) arquivos,
  (select md5(coalesce(string_agg(x.etapa, '|' order by x.etapa, x.id), '')) from planejamento.eventos_conversa x where x.slug = p.slug) eventos,
  (select md5(coalesce(string_agg(x.etapa, '|' order by x.etapa), '')) from planejamento.uso_turnos x where x.slug = p.slug) uso,
  (select md5(coalesce(string_agg(x.etapa, '|' order by x.etapa), '')) from planejamento.presenca x where x.slug = p.slug) presenca
from planejamento.prospects p order by p.slug;
```

Resultado antes (local):

```
        tabela         | etapa | count 
-----------------------+-------+-------
 eventos_conversa      | 01    |     1
 eventos_conversa      | 02    |     2
 eventos_conversa      | 04    |     1
 eventos_conversa      | 06    |     2
 eventos_conversa      | 07    |     5
 eventos_conversa      | 08    |     4
 eventos_conversa      | 09    |     2
 presenca              | 04    |     1
 presenca              | 07    |     1
 presenca              | 08    |     4
 presenca              | 09    |     1
 prospects.etapa_atual | 02    |     2
 prospects.etapa_atual | 04    |     1
 prospects.etapa_atual | 06    |     1
 prospects.etapa_atual | 07    |     1
 prospects.etapa_atual | 08    |     2
 prospects.etapa_atual | 09    |     1
 prospects.etapa_atual | final |     1
 uso_turnos            | 06    |     1
 uso_turnos            | 07    |     3
 uso_turnos            | 08    |     3
(21 rows)

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

        slug        | etapa_atual | versao | versao_etapas |              chaves              |            md5_estado            
--------------------+-------------+--------+---------------+----------------------------------+----------------------------------
 legado-09-injetada | final       |      0 |               | 01,02,03,04,05,06,07,08,09,final | bef169a5c8a3a9e2307be9c273292251
 legado-8           | 08          |      0 |               | 01,02,03,04,05,06,07,08,final    | bc3ba4c61c886ac858960f9ef59f8eeb
 sottile-teste-2    | 02          |      0 |               | 01,02,03,04,05,06,07,08,09,final | 92b4ada7a45108e6b8f0a1de1a42e7d1
 teste-login        | 02          |      0 |               | 01,02,03,04,05,06,07,08,09,final | 42d3dc094963a77acd7ad39ff4931008
 velho-07           | 07          |      0 |               | 01,02,03,04,05,06,07,08,09,final | 97db7d80c458b010f1379ffac8dd258d
 velho-08           | 08          |      0 |               | 01,02,03,04,05,06,07,08,09,final | 1f27a28818086991ed94686ff29d359d
 velho-09           | 09          |      0 |               | 01,02,03,04,05,06,07,08,09,final | e410def029d79afa4a21aa3159c4363f
 verdeluz-nuvem     | 04          |      0 |               | 01,02,03,04,05,06,07,08,09,final | 6bf24bb2a566b88ddc66de342f7ae356
 verdeluz-teste     | 06          |      0 |               | 01,02,03,04,05,06,07,08,09,final | c6a107cf6223ba4ab285e73dcf044bdf
(9 rows)

        slug        |                      caminho                       | sha256 
--------------------+----------------------------------------------------+--------
 legado-09-injetada | .app/anexos/07/1-midia.pdf                         | h33
 legado-09-injetada | .app/conversas/07.jsonl                            | h34
 legado-09-injetada | contexto/decisoes/07-midia-paga.md                 | h30
 legado-09-injetada | contexto/decisoes/08-plano-de-acao.md              | h31
 legado-09-injetada | entrega/ativos-aprovados/secoes/07-midia-paga.md   | h32
 legado-8           | contexto/decisoes/08-plano.md                      | h7
 legado-8           | kit-de-teste/08/x.xlsx                             | h8
 velho-07           | .app/anexos/06/0-metas.xlsx                        | h40
 velho-07           | .app/anexos/07/1-briefing.docx                     | h41
 velho-07           | .app/anexos/08/2-midia.pdf                         | h42
 velho-07           | .app/anexos/09/3-plano.xlsx                        | h43
 velho-07           | contexto/decisoes/06-metas.md                      | h9
 velho-07           | contexto/decisoes/07-briefing.md                   | h10
 velho-07           | contexto/decisoes/08-midia.md                      | h11
 velho-07           | contexto/decisoes/09-plano.md                      | h12
 velho-07           | entrega/ativos-aprovados/benchmark/criativos/a.png | h14
 velho-07           | entrega/ativos-aprovados/benchmark/relatorio.html  | h13
 velho-07           | entrega/ativos-aprovados/secoes/07-briefing.md     | h15
 velho-07           | entrega/ativos-aprovados/secoes/08-midia.md        | h16
 velho-07           | entrega/ativos-aprovados/secoes/09-plano.md        | h17
 velho-07           | entrega/ativos-aprovados/secoes/10-apresentacao.md | h18
 velho-08           | .app/anexos/07/k.pdf                               | h44
 velho-08           | .app/anexos/08/k.pdf                               | h45
 velho-08           | .app/anexos/09/k.pdf                               | h46
 velho-08           | entrega/ativos-aprovados/secoes/07-a.md            | h20
 velho-08           | entrega/ativos-aprovados/secoes/08-a.md            | h21
 velho-08           | entrega/ativos-aprovados/secoes/09-a.md            | h22
 velho-08           | kit-de-teste/07/k.md                               | h23
 velho-08           | kit-de-teste/08/k.md                               | h24
 velho-08           | kit-de-teste/09/k.md                               | h25
 verdeluz-nuvem     | contexto/decisoes/03-diagnostico.md                | h6
 verdeluz-teste     | contexto/decisoes/06-metas.md                      | h5
 verdeluz-teste     | kit-de-teste/06/metas.xlsx                         | h1
 verdeluz-teste     | kit-de-teste/07/briefing.docx                      | h2
 verdeluz-teste     | kit-de-teste/08/midia.xlsx                         | h3
 verdeluz-teste     | kit-de-teste/09/plano.xlsx                         | h4
(36 rows)

        t         | count |               md5                
------------------+-------+----------------------------------
 arquivos         |    37 | 2f4100f8a4aa76ee4df53a2845e6702b
 arquivos_lixeira |     1 | d7a05a2f58b450584fddeac508ba68c1
 comentarios      |     1 | 2177a5c4cd8dff5315c1e367147af4b8
 config_modelos   |    13 | 0012e831eb322a2ed83b38f1d8506cfd
 eventos_conversa |    17 | b25d390617b36ca2c87e5b52fdc14859
 notas_skills     |     5 | 901b35d5d31c0bc4a3dace64cf55ec5a
 presenca         |     7 | 186d09398b354ea1e4297cba396c52b1
 prospects        |     9 | 023de2a73b55379d01b08293fa5086cc
 uso_turnos       |     7 | 41f6f5b1d0e22e3aaf475089f50868dd
 usuarios         |     1 | d80a55ee4baa545f4282a4a130a8a910
(10 rows)

        slug        |              estado              | versao |             arquivos             |             eventos              |               uso                |             presenca             
--------------------+----------------------------------+--------+----------------------------------+----------------------------------+----------------------------------+----------------------------------
 legado-09-injetada | bef169a5c8a3a9e2307be9c273292251 |      0 | 7f54d9a8150f3feb5dbd0e44a35d30e1 | 0373bc5cee5ce5777d4b147683bbe563 | 0373bc5cee5ce5777d4b147683bbe563 | fad6f4e614a212e80c67249a666d2b09
 legado-8           | bc3ba4c61c886ac858960f9ef59f8eeb |      0 | 56ba22a9ad441442580a7e2a04f1da71 | 0373bc5cee5ce5777d4b147683bbe563 | fad6f4e614a212e80c67249a666d2b09 | fad6f4e614a212e80c67249a666d2b09
 sottile-teste-2    | 92b4ada7a45108e6b8f0a1de1a42e7d1 |      0 | d41d8cd98f00b204e9800998ecf8427e | 337d3676e2b96572cd4173e68da2843d | d41d8cd98f00b204e9800998ecf8427e | d41d8cd98f00b204e9800998ecf8427e
 teste-login        | 42d3dc094963a77acd7ad39ff4931008 |      0 | d41d8cd98f00b204e9800998ecf8427e | a2ef406e2c2351e0b9e80029c909242d | d41d8cd98f00b204e9800998ecf8427e | d41d8cd98f00b204e9800998ecf8427e
 velho-07           | 97db7d80c458b010f1379ffac8dd258d |      0 | a21c00f9786f7d9d339e93b76783499b | 2af58904ae6a4aa08173c56fb65358a8 | d72d187df41e10ea7d9fcdc7f5909205 | 0373bc5cee5ce5777d4b147683bbe563
 velho-08           | 1f27a28818086991ed94686ff29d359d |      0 | f52da8d77a4ab91633fd24b9e4899999 | 6d82adb44f53fda102f70d5eb79566ab | 0373bc5cee5ce5777d4b147683bbe563 | ff85fc508ecd32e6ff835f9d1f61872b
 velho-09           | e410def029d79afa4a21aa3159c4363f |      0 | d41d8cd98f00b204e9800998ecf8427e | ff85fc508ecd32e6ff835f9d1f61872b | d41d8cd98f00b204e9800998ecf8427e | d41d8cd98f00b204e9800998ecf8427e
 verdeluz-nuvem     | 6bf24bb2a566b88ddc66de342f7ae356 |      0 | 758f55659a986a7fafcc9910d8fc9ab6 | 7d0665438e81d8eceb98c1e31fca80c1 | d41d8cd98f00b204e9800998ecf8427e | 7d0665438e81d8eceb98c1e31fca80c1
 verdeluz-teste     | c6a107cf6223ba4ab285e73dcf044bdf |      0 | 123afc03771c269bfde7bd61ccc7c1e0 | faeac4e1eef307c2ab7b0a3821e6c667 | faeac4e1eef307c2ab7b0a3821e6c667 | d41d8cd98f00b204e9800998ecf8427e
(9 rows)
```

Resultado depois (local):

```
        tabela         |       etapa        | count 
-----------------------+--------------------+-------
 eventos_conversa      | 01                 |     1
 eventos_conversa      | 02                 |     2
 eventos_conversa      | 04                 |     1
 eventos_conversa      | 06                 |     2
 eventos_conversa      | 07                 |     4
 eventos_conversa      | 08                 |     4
 eventos_conversa      | briefing-benchmark |     3
 presenca              | 04                 |     1
 presenca              | 07                 |     2
 presenca              | 08                 |     3
 presenca              | briefing-benchmark |     1
 prospects.etapa_atual | 02                 |     2
 prospects.etapa_atual | 04                 |     1
 prospects.etapa_atual | 06                 |     1
 prospects.etapa_atual | 07                 |     2
 prospects.etapa_atual | 08                 |     2
 prospects.etapa_atual | final              |     1
 uso_turnos            | 06                 |     1
 uso_turnos            | 07                 |     2
 uso_turnos            | 08                 |     2
 uso_turnos            | briefing-benchmark |     2
(21 rows)

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

        slug        | etapa_atual | versao | versao_etapas |              chaves              |            md5_estado            
--------------------+-------------+--------+---------------+----------------------------------+----------------------------------
 legado-09-injetada | final       |      0 |               | 01,02,03,04,05,06,07,08,09,final | bef169a5c8a3a9e2307be9c273292251
 legado-8           | 08          |      0 |               | 01,02,03,04,05,06,07,08,final    | bc3ba4c61c886ac858960f9ef59f8eeb
 sottile-teste-2    | 02          |      1 | 2             | 01,02,03,04,05,06,07,08,final    | b65f5e1a2f2b0c6dcfd2eddc1deea8fe
 teste-login        | 02          |      1 | 2             | 01,02,03,04,05,06,07,08,final    | dca1c6c07c307b42edabaa8ad10bc537
 velho-07           | 07          |      1 | 2             | 01,02,03,04,05,06,07,08,final    | 70b4a9c71c8c7a1431014dffa98bc294
 velho-08           | 07          |      1 | 2             | 01,02,03,04,05,06,07,08,final    | 09e871bc677f163c7f04d69ce100d4d0
 velho-09           | 08          |      1 | 2             | 01,02,03,04,05,06,07,08,final    | 39b40d140e45385ac85d8e4010b6e3fe
 verdeluz-nuvem     | 04          |      1 | 2             | 01,02,03,04,05,06,07,08,final    | 35a602cf9ce95e88174aaddea08daf56
 verdeluz-teste     | 06          |      1 | 2             | 01,02,03,04,05,06,07,08,final    | dd1d703f479c07ecb09da8a029198ec0
(9 rows)

        slug        |                       caminho                       | sha256 
--------------------+-----------------------------------------------------+--------
 legado-09-injetada | .app/anexos/07/1-midia.pdf                          | h33
 legado-09-injetada | .app/conversas/07.jsonl                             | h34
 legado-09-injetada | contexto/decisoes/07-midia-paga.md                  | h30
 legado-09-injetada | contexto/decisoes/08-plano-de-acao.md               | h31
 legado-09-injetada | entrega/ativos-aprovados/secoes/07-midia-paga.md    | h32
 legado-8           | contexto/decisoes/08-plano.md                       | h7
 legado-8           | kit-de-teste/08/x.xlsx                              | h8
 velho-07           | .app/anexos/06/0-metas.xlsx                         | h40
 velho-07           | .app/anexos/07/2-midia.pdf                          | h42
 velho-07           | .app/anexos/08/3-plano.xlsx                         | h43
 velho-07           | contexto/decisoes/06-metas.md                       | h9
 velho-07           | contexto/decisoes/07-midia.md                       | h11
 velho-07           | contexto/decisoes/08-plano.md                       | h12
 velho-07           | entrega/arquivo-etapa-07/anexos/1-briefing.docx     | h41
 velho-07           | entrega/arquivo-etapa-07/benchmark/criativos/a.png  | h14
 velho-07           | entrega/arquivo-etapa-07/benchmark/relatorio.html   | h13
 velho-07           | entrega/arquivo-etapa-07/decisoes/07-briefing.md    | h10
 velho-07           | entrega/arquivo-etapa-07/secoes/07-briefing.md      | h15
 velho-07           | entrega/ativos-aprovados/secoes/07-midia.md         | h16
 velho-07           | entrega/ativos-aprovados/secoes/08-plano.md         | h17
 velho-07           | entrega/ativos-aprovados/secoes/09-apresentacao.md  | h18
 velho-08           | .app/anexos/07/k.pdf                                | h45
 velho-08           | .app/anexos/08/k.pdf                                | h46
 velho-08           | entrega/arquivo-etapa-07/anexos/k.pdf               | h44
 velho-08           | entrega/arquivo-etapa-07/kit-de-teste/k.md          | h23
 velho-08           | entrega/arquivo-etapa-07/secoes/07-a.md             | h20
 velho-08           | entrega/ativos-aprovados/secoes/07-a.md             | h21
 velho-08           | entrega/ativos-aprovados/secoes/08-a.md             | h22
 velho-08           | kit-de-teste/07/k.md                                | h24
 velho-08           | kit-de-teste/08/k.md                                | h25
 verdeluz-nuvem     | contexto/decisoes/03-diagnostico.md                 | h6
 verdeluz-teste     | contexto/decisoes/06-metas.md                       | h5
 verdeluz-teste     | entrega/arquivo-etapa-07/kit-de-teste/briefing.docx | h2
 verdeluz-teste     | kit-de-teste/06/metas.xlsx                          | h1
 verdeluz-teste     | kit-de-teste/07/midia.xlsx                          | h3
 verdeluz-teste     | kit-de-teste/08/plano.xlsx                          | h4
(36 rows)

        t         | count |               md5                
------------------+-------+----------------------------------
 arquivos         |    37 | 8471e89e8fb22da69ff7e994120b1159
 arquivos_lixeira |     1 | d7a05a2f58b450584fddeac508ba68c1
 comentarios      |     1 | 2177a5c4cd8dff5315c1e367147af4b8
 config_modelos   |    13 | ebaf430493f4bb5e6fb004ead74c5ba2
 eventos_conversa |    17 | 598f4278d7ecdabe5391ca26e54bc3eb
 notas_skills     |     5 | 9e57875aee2275c99d0118b253e8b675
 presenca         |     7 | 9f8cece9502f70b270becc2befa74400
 prospects        |     9 | a088b27865c7e7e24109e482f4bfe62e
 uso_turnos       |     7 | 831dd5c06b25451b72bf1299b88f6496
 usuarios         |     1 | d80a55ee4baa545f4282a4a130a8a910
(10 rows)

        slug        |              estado              | versao |             arquivos             |             eventos              |               uso                |             presenca             
--------------------+----------------------------------+--------+----------------------------------+----------------------------------+----------------------------------+----------------------------------
 legado-09-injetada | bef169a5c8a3a9e2307be9c273292251 |      0 | 7f54d9a8150f3feb5dbd0e44a35d30e1 | 0373bc5cee5ce5777d4b147683bbe563 | 0373bc5cee5ce5777d4b147683bbe563 | fad6f4e614a212e80c67249a666d2b09
 legado-8           | bc3ba4c61c886ac858960f9ef59f8eeb |      0 | 56ba22a9ad441442580a7e2a04f1da71 | 0373bc5cee5ce5777d4b147683bbe563 | fad6f4e614a212e80c67249a666d2b09 | fad6f4e614a212e80c67249a666d2b09
 sottile-teste-2    | b65f5e1a2f2b0c6dcfd2eddc1deea8fe |      1 | d41d8cd98f00b204e9800998ecf8427e | 337d3676e2b96572cd4173e68da2843d | d41d8cd98f00b204e9800998ecf8427e | d41d8cd98f00b204e9800998ecf8427e
 teste-login        | dca1c6c07c307b42edabaa8ad10bc537 |      1 | d41d8cd98f00b204e9800998ecf8427e | a2ef406e2c2351e0b9e80029c909242d | d41d8cd98f00b204e9800998ecf8427e | d41d8cd98f00b204e9800998ecf8427e
 velho-07           | 70b4a9c71c8c7a1431014dffa98bc294 |      1 | 69fadd58f35da0a50647f8ed5bc9f235 | 0d0fbb50d0231db3690ea1d09b58b07e | 26880b46b44ad4dfc0504c391a2871a2 | 770b8bddb8ad9f2c55aac960fa08cdc6
 velho-08           | 09e871bc677f163c7f04d69ce100d4d0 |      1 | aa0da6a21c978f668d004c78677a66aa | b52abc7e18f1d38eeb7d8d5e53c7f7cd | 770b8bddb8ad9f2c55aac960fa08cdc6 | 0373bc5cee5ce5777d4b147683bbe563
 velho-09           | 39b40d140e45385ac85d8e4010b6e3fe |      1 | d41d8cd98f00b204e9800998ecf8427e | 0373bc5cee5ce5777d4b147683bbe563 | d41d8cd98f00b204e9800998ecf8427e | d41d8cd98f00b204e9800998ecf8427e
 verdeluz-nuvem     | 35a602cf9ce95e88174aaddea08daf56 |      1 | 758f55659a986a7fafcc9910d8fc9ab6 | 7d0665438e81d8eceb98c1e31fca80c1 | d41d8cd98f00b204e9800998ecf8427e | 7d0665438e81d8eceb98c1e31fca80c1
 verdeluz-teste     | dd1d703f479c07ecb09da8a029198ec0 |      1 | bc2bd7d1297a407268cab255dfa87246 | faeac4e1eef307c2ab7b0a3821e6c667 | faeac4e1eef307c2ab7b0a3821e6c667 | d41d8cd98f00b204e9800998ecf8427e
(9 rows)
```

O que conferir: `legado-8` e `legado-09-injetada` com o mesmo `md5_estado` antes e depois (`bc3ba4c6…`, `bef169a5…`),
`versao` 0 e a mesma linha em C6 (arquivos, eventos, uso, presença); nenhum prospect migrado com a chave `09`
(só o legado com a 09 injetada a mantém); `config_modelos` sem `09` e com `briefing-benchmark`;
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
  -- Nenhum prospect migrado com a chave 09, e nenhum prospect que ainda se qualifique como "atual" (mesma regra da migration).
  select count(*) into n from planejamento.prospects
   where (estado -> 'etapas') ? '09'
     and ((estado -> 'versaoEtapas') = '2'::jsonb
          or not ((estado -> 'etapas' -> '09' ->> 'status') is not distinct from 'bloqueada'
                  and ((estado -> 'etapas' -> '08' ->> 'status') is not distinct from 'concluida'
                       or (estado -> 'etapas' -> 'final' ->> 'status') is distinct from 'bloqueada')));
  if n > 0 then raise exception 'FALHA: % prospect(s) migrado(s) ou ainda "atual" com a chave 09 em estado.etapas', n; end if;
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
-- C. Correção final: legado com a 09 injetada intocado, velho-09 migrado, anexos do chat renumerados
do $$
declare faltando text;
begin
  if (select estado -> 'versaoEtapas' from planejamento.prospects where slug = 'legado-09-injetada') is not null
     or not (select (estado -> 'etapas') ? '09' from planejamento.prospects where slug = 'legado-09-injetada') then
    raise exception 'FALHA: legado-09-injetada foi migrado'; end if;
  if (select estado -> 'versaoEtapas' from planejamento.prospects where slug = 'velho-09') is distinct from '2'::jsonb
     or (select etapa_atual from planejamento.prospects where slug = 'velho-09') <> '08'
     or (select estado -> 'etapas' -> '08' ->> 'status' from planejamento.prospects where slug = 'velho-09') <> 'liberada' then
    raise exception 'FALHA: velho-09 não migrou como esperado'; end if;
  select string_agg(v.slug || ':' || v.caminho || '=' || v.sha, ', ') into faltando
    from (values
      ('velho-07', '.app/anexos/06/0-metas.xlsx', 'h40'),
      ('velho-07', 'entrega/arquivo-etapa-07/anexos/1-briefing.docx', 'h41'),
      ('velho-07', '.app/anexos/07/2-midia.pdf', 'h42'),
      ('velho-07', '.app/anexos/08/3-plano.xlsx', 'h43'),
      ('velho-08', 'entrega/arquivo-etapa-07/anexos/k.pdf', 'h44'),
      ('velho-08', '.app/anexos/07/k.pdf', 'h45'),
      ('velho-08', '.app/anexos/08/k.pdf', 'h46'),
      ('legado-09-injetada', '.app/anexos/07/1-midia.pdf', 'h33')) v(slug, caminho, sha)
   where not exists (select 1 from planejamento.arquivos a where a.slug = v.slug and a.caminho = v.caminho and a.sha256 = v.sha);
  if faltando is not null then raise exception 'FALHA: anexos fora do lugar: %', faltando; end if;
  if exists (select 1 from planejamento.arquivos where slug in ('velho-07', 'velho-08') and caminho ~ '^\.app/anexos/09/') then
    raise exception 'FALHA: anexo ainda na 09'; end if;
  raise notice 'OK: asserções da correção final (legado com 09 injetada, velho-09, anexos)';
end $$;
```

Resultado (local):

```
NOTICE:  OK: asserções gerais
        slug        | etapa_atual |     s06      |     s07      |     s08      | etapa_inicial |   entregaveis   | insumos | perguntas |    fila     | tem_teste | tem_perguntas | tem_fila 
--------------------+-------------+--------------+--------------+--------------+---------------+-----------------+---------+-----------+-------------+-----------+---------------+----------
 legado-09-injetada | final       | concluida    | concluida    | concluida    |               | m-07:07,p-08:08 |         |           |             | f         | t             | t
 legado-8           | 08          | concluida    | concluida    | em_andamento |               | l-08:08         |         |           |             | f         | t             | t
 sottile-teste-2    | 02          | bloqueada    | bloqueada    | bloqueada    |               |                 |         |           |             | f         | f             | f
 teste-login        | 02          | bloqueada    | bloqueada    | bloqueada    |               |                 |         |           |             | f         | t             | t
 velho-07           | 07          | concluida    | liberada     | bloqueada    | 07            | a:06,c:07,d:08  | i9:08   |           | f8:07,f3:03 | t         | t             | t
 velho-08           | 07          | concluida    | em_andamento | bloqueada    | 08            |                 |         |           |             | t         | t             | t
 velho-09           | 08          | concluida    | concluida    | liberada     |               |                 |         |           |             | f         | t             | t
 verdeluz-nuvem     | 04          | bloqueada    | bloqueada    | bloqueada    |               |                 |         |           |             | f         | t             | t
 verdeluz-teste     | 06          | em_andamento | bloqueada    | bloqueada    | 06            | e-06:06         |         |           |             | t         | t             | t
(9 rows)

NOTICE:  OK: asserções da correção final (legado com 09 injetada, velho-09, anexos)
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

## 6. Atomicidade (local, base `colisao` com os mesmos dados)

Com um destino já ocupado (`entrega/arquivo-etapa-07/anexos/1-briefing.docx` inserido antes em `velho-07`; na
rodada anterior, `entrega/arquivo-etapa-07/decisoes/07-briefing.md`), a migration falha no `update` de `planejamento.arquivos` (chave `(slug, caminho)` duplicada) e
`q_contagens.sql` sai idêntico ao de antes, sem marca em `planejamento.migracoes` (count = 0).
Sem a colisão, a mesma base migra normalmente.

## 7. Conferência contra o código TypeScript

Os estados e as listas de caminhos de antes (base `colisao`, que ficou como antes) passaram por `migrarEstado` e `planoDeArquivos`
(`src/packages/core/src/migracao-etapas.ts`) com `npx tsx` e foram comparados com o resultado do SQL:

```
legado-09-injetada   legada  estado: igual ao TS | arquivos: igual ao TS
legado-8             legada  estado: igual ao TS | arquivos: igual ao TS
sottile-teste-2      atual   estado: igual ao TS | arquivos: igual ao TS
teste-login          atual   estado: igual ao TS | arquivos: igual ao TS
velho-07             atual   estado: igual ao TS | arquivos: igual ao TS
velho-08             atual   estado: igual ao TS | arquivos: igual ao TS
velho-09             atual   estado: igual ao TS | arquivos: igual ao TS
verdeluz-nuvem       atual   estado: igual ao TS | arquivos: igual ao TS
verdeluz-teste       atual   estado: igual ao TS | arquivos: igual ao TS
```

A regra de qualificação também foi comparada isoladamente: 689 combinações de status da 08, da 09 e da final
(inclusive ausentes, `09` que não é objeto e com/sem `versaoEtapas: 2`) passaram por `classificarNumeracao` e pelo
predicado do `where` da migration; as 689 deram a mesma classe.

Antes da correção (o SQL do commit a7bad40 sobre o mesmo `seed.sql`), `legado-09-injetada` era migrado: entregável
`m-07` (mídia paga) descartado, `p-08` (plano) virava `07`, `contexto/decisoes/07-midia-paga.md` e
`secoes/07-midia-paga.md` iam para `entrega/arquivo-etapa-07/` como se fossem briefing e o evento da 07 virava
`briefing-benchmark`.

(Lista ausente: o TS a grava como `[]`, o SQL a deixa ausente; para `sottile-teste-2` a comparação removeu do
resultado do TS as listas que estavam ausentes antes. Comportamento do SQL mantido como aprovado: no app,
`normalizarEstado` completa `perguntas` ausente, mas não `filaAutomatica`, o que já valia antes desta migration.)

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

-- Casos da correção final (I1 e M2).
-- legado de 8 etapas com a 09 injetada pelo app antigo (como a adda salva depois de 14/10): não pode mudar nada
insert into planejamento.prospects (slug, nome, estado, etapa_atual) values
('legado-09-injetada', 'Legado 09 injetada', pg_temp.base('legado-09-injetada',
   pg_temp.etapas8(array['concluida','concluida','concluida','concluida','concluida','concluida','concluida','concluida','em_andamento'])
   || jsonb_build_object('09', pg_temp.et('bloqueada')))
   || jsonb_build_object('entregaveis', jsonb_build_array(jsonb_build_object('id','m-07','etapa','07'), jsonb_build_object('id','p-08','etapa','08'))), 'final'),
-- 9 etapas de verdade com a 08 concluída e a 09 liberada: migra
('velho-09', 'Velho 09', pg_temp.base('velho-09', pg_temp.etapas9(array['concluida','concluida','concluida','concluida','concluida','concluida','concluida','concluida','liberada','bloqueada'])), '09');

insert into planejamento.arquivos (slug, caminho, sha256, tamanho) values
('legado-09-injetada', 'contexto/decisoes/07-midia-paga.md', 'h30', 1),
('legado-09-injetada', 'contexto/decisoes/08-plano-de-acao.md', 'h31', 1),
('legado-09-injetada', 'entrega/ativos-aprovados/secoes/07-midia-paga.md', 'h32', 1),
('legado-09-injetada', '.app/anexos/07/1-midia.pdf', 'h33', 1),
('legado-09-injetada', '.app/conversas/07.jsonl', 'h34', 1),
-- anexos do chat (.app/anexos/<etapa>/): 07 arquivado, 08→07, 09→08
('velho-07', '.app/anexos/06/0-metas.xlsx', 'h40', 1),
('velho-07', '.app/anexos/07/1-briefing.docx', 'h41', 1),
('velho-07', '.app/anexos/08/2-midia.pdf', 'h42', 1),
('velho-07', '.app/anexos/09/3-plano.xlsx', 'h43', 1),
-- cadeia que colidiria num update único: anexos/08/k → 07/k e 09/k → 08/k
('velho-08', '.app/anexos/07/k.pdf', 'h44', 1),
('velho-08', '.app/anexos/08/k.pdf', 'h45', 1),
('velho-08', '.app/anexos/09/k.pdf', 'h46', 1);

insert into planejamento.eventos_conversa (slug, etapa, evento, em)
select s, e, '{"tipo":"turno_inicio"}'::jsonb, now() from (values
 ('legado-09-injetada','07'),('legado-09-injetada','08'),('velho-09','08'),('velho-09','09')) v(s, e);
insert into planejamento.uso_turnos (slug, etapa, inicio, fim, status)
select s, e, now(), now(), 'ok' from (values ('legado-09-injetada','07'),('legado-09-injetada','08')) v(s, e);
insert into planejamento.presenca (slug, email, etapa, visivel, segundos_sem_interacao)
select s, 'a@b.c', e, true, 0 from (values ('legado-09-injetada','08')) v(s, e);
```
