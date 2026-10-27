# Fase C: colocar o app no ar — Design

**Data:** 2026-10-27
**Status:** aguardando revisão do documento
**Escopo:** a Fase C do desenho `2026-10-27-deploy-railway-supabase-design.md` (seções 5.6 e 5.7). Depende das Fases A (dados no Supabase) e B (login), já na `main`.

## 1. Objetivo

Hoje o app só roda no Mac de quem desenvolve. Ao fim da Fase C, ele roda num servidor sempre ligado, acessível pelo navegador por um endereço HTTPS, com tudo que o agente precisa instalado, e se comporta bem quando o servidor reinicia no meio de um turno.

**Critério de sucesso:** (a) a imagem do servidor constrói e sobe sozinha, localmente e no provedor; (b) um analista abre o endereço, entra com a conta Google da Boomer e percorre as etapas 01 a 03 da Verdeluz, inclusive uma prévia de planilha e de apresentação (LibreOffice) e um gráfico (matplotlib); (c) com um turno em andamento, um `SIGTERM` deixa o turno terminar e sincroniza os arquivos antes de desligar; (d) depois de reiniciar com o disco vazio, o prospect volta do Supabase e o agente retoma a conversa.

**Não é objetivo:** domínio próprio da Boomer (primeiro vale o endereço gratuito do provedor), mais de uma instância, escala automática, migração dos prospects atuais (Fase D) e bloquear no Supabase o cadastro de e-mails de fora.

## 2. Decisões

| # | Decisão | Escolha |
|---|---|---|
| 1 | Hospedagem | Railway, com um serviço, um volume e uma réplica. **Bloqueio atual:** a Railway pausou novas contas (incidente de 21/10). Todo o trabalho local desta fase vale para qualquer provedor com Docker e disco persistente (Fly.io e Render servem); só a Task final de deploy depende da escolha |
| 2 | Empacotamento | Um `Dockerfile` na raiz, testado localmente com o Docker (Colima) antes de qualquer deploy |
| 3 | Endereço | O gratuito do provedor. O domínio da Boomer entra depois e só exige atualizar as listas de URLs do Google e do Supabase |
| 4 | Execução do agente | Sempre o Agent SDK com `ANTHROPIC_API_KEY` (`PLANEJAMENTO_EXECUTOR=sdk`). O Claude Code instalado na máquina não é usado |
| 5 | Usuário do processo | Sem privilégio de administrador (o agente roda `python3`, `pandoc` e arquivos do prospect) |
| 6 | Pendências que a Fase B deixou | Entram aqui: autor dos turnos disparados pela fila, renovação de sessão em `/login` |

## 3. Arquitetura da imagem

```
 imagem (Debian 12, Node 22)
 ├─ /app                     código do git, instalado e compilado
 │   ├─ .claude/  scripts/  src/  (skills, agentes, scripts Python, app)
 │   ├─ clientes-base/       _template e _fixtures (do git)
 │   └─ clientes  ──► /data/clientes   (link criado na subida)
 ├─ /opt/venv                Python: python-pptx, openpyxl, Pillow, requests,
 │                           pandas, numpy, matplotlib (versões fixas)
 └─ programas: LibreOffice (Impress, Calc, Writer), poppler, ImageMagick,
               ffmpeg, pandoc, fontes Liberation, tini, gosu

 volume /data (persistente)
 ├─ clientes/<slug>/         mesa de trabalho (cópia dos arquivos)
 ├─ claude/                  CLAUDE_CONFIG_DIR (memória do agente)
 └─ home/                    HOME do processo (perfil do LibreOffice)
```

- **Subida** (`entrypoint.sh`, como root, depois baixa privilégio com `gosu`): cria `/data/{clientes,claude,home}`, entrega a pasta ao usuário do app, atualiza `_template` e `_fixtures` dentro de `/data/clientes` a partir de `/app/clientes-base` (assim uma atualização do código vale na hora), aponta `/app/clientes` para `/data/clientes` e inicia `tini -- next start -H 0.0.0.0 -p $PORT`.
- **Variáveis fixas na imagem:** `PLANEJAMENTO_ROOT=/app`, `CLAUDE_CONFIG_DIR=/data/claude`, `HOME=/data/home`, `PLANEJAMENTO_EXECUTOR=sdk`, `PLANEJAMENTO_DADOS=supabase`, `PLANEJAMENTO_AUTH=google`, `NEXT_MANUAL_SIG_HANDLE=true`, `PLANEJAMENTO_URL_INTERNA=http://127.0.0.1:$PORT`.
- **Variáveis de segredo** (só no painel do provedor, nunca na imagem nem no git): `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `PLANEJAMENTO_APP_URL` (endereço público), `APIFY_TOKEN`, `FIRECRAWL_API_KEY`.
- A imagem é grande (1,5 a 2 GB). O build usa camadas na ordem "programas do sistema, Python, dependências Node, código" para que mudar só o código reconstrua em segundos.
- `.dockerignore` deixa de fora `.env*`, `clientes/*` (menos `_template` e `_fixtures`), `node_modules`, `.next`, `.git`, `.superpowers`, `.claude/worktrees` e `docs`.

## 4. Componentes de código

### 4.1 Rota de saúde

`GET /api/saude` devolve `200 { "ok": true }` sem nenhum dado. É livre em `decidirAcesso`, **para qualquer host** (os verificadores de saúde dos provedores usam hosts próprios, que o app recusaria), e só aceita `GET`. Serve para o provedor saber que o servidor subiu.

### 4.2 Desligamento seguro

`NEXT_MANUAL_SIG_HANDLE=true` desliga o tratamento de sinais do próprio Next, e o app passa a tratar o `SIGTERM` em `instrumentation.ts`:

1. `ServicoTurnos.drenar(prazoMs)` para de aceitar turnos novos (erro 503 `reiniciando`, texto "O servidor está reiniciando. Tente de novo em instantes.") e espera os turnos em andamento até `PLANEJAMENTO_DRENAGEM_MS` (padrão 300000, 5 minutos).
2. Sincroniza o que ainda estiver agendado (`NuvemArmazenamento.sincronizarTudo()`, que cancela os temporizadores e roda a sincronização de cada prospect tocado).
3. Se o prazo estoura, aborta os turnos que sobraram (viram "interrompido"), sincroniza e sai.
4. Fecha o servidor HTTP e termina com código 0.

O provedor precisa esperar o mesmo tempo entre o `SIGTERM` e o `SIGKILL` (na Railway, `RAILWAY_DEPLOYMENT_DRAINING_SECONDS=300`). Com volume, não existem duas instâncias ao mesmo tempo: o app fica fora do ar por alguns instantes a cada atualização.

### 4.3 Ajustes de interface e de API para a nuvem

- `/api/sistema` ganha `executor: "sdk" | "cli" | "demo"`. Com `sdk`, o item "Claude Code" vira "chave da API configurada" (`ANTHROPIC_API_KEY` não vazia; nunca devolve o valor), e a janela "Falta configurar esta máquina" deixa de pedir instalação do Claude Code. As mensagens de ffmpeg e Apify perdem o "brew install" e o ".env da raiz" quando o app está na nuvem. A checagem de `soffice` deixa de procurar o caminho do macOS na nuvem. A leitura do `.env` em disco continua só no modo local.
- "Abrir pasta no Finder" e "Mostrar no Finder" (`/api/prospects/[slug]/abrir-pasta`) somem do menu quando os dados estão no Supabase, e a rota devolve 404 nesse modo. Os arquivos continuam abríveis pela rota de arquivo já existente (baixar).
- O painel de uso da assinatura (`/api/uso`) não aparece no modo `sdk`.

### 4.4 Ferramentas do agente na nuvem

O `pesquisador-benchmark` usa o Firecrawl, que hoje vem da configuração do Claude Code do usuário. No SDK, `montarMcpConfig` passa a declarar também o servidor `firecrawl` (pacote `firecrawl-mcp`, instalado na imagem) com `FIRECRAWL_API_KEY` do ambiente, quando a variável existe. Sem ela, a etapa 08 avisa que a pesquisa de mercado está indisponível, em vez de falhar no meio.

### 4.5 Pendências da Fase B

- **Autor dos turnos da fila:** `ItemFila` ganha `autor` (opcional), preenchido por quem aprova, pede ajuste ou envia o insumo que gera o turno, e `processarFila` o repassa. O gasto por analista deixa de ser subcontado.
- **`/login` com sessão válida:** o `proxy` passa a validar a sessão em `/login`; com sessão válida redireciona para o `proximo` (ou `/`), o que também deixa o proxy renovar o token ali e fecha a perda de rotação do refresh token.

## 5. Falhas

| Situação | Comportamento |
|---|---|
| Imagem sobe sem `ANTHROPIC_API_KEY` | O app sobe; a verificação de sistema mostra "Falta a chave da API" e o turno do agente responde a mensagem já existente |
| Imagem sobe com `PLANEJAMENTO_AUTH` inválida | Falha na subida (já é assim), o provedor mostra o erro no log e não troca a versão |
| `SIGTERM` com turno em andamento | Drenagem de até 5 minutos, sincronização e saída limpa (4.2) |
| Volume vazio depois de um problema | Arquivos voltam do Supabase na primeira leitura de cada prospect (Fase A) e a sessão do agente volta do bucket de sessões; se ela falhar, retomada pelo histórico |
| Verificador de saúde com host desconhecido | `/api/saude` responde 200; qualquer outra rota recusa o host (403) |
| Build quebra no provedor | A versão anterior continua no ar; os logs do build dizem a camada |

## 6. Testes

1. Rota de saúde: livre para qualquer host, só `GET`, sem dados; `decidirAcesso` por tabela.
2. `ServicoTurnos.drenar`: recusa turno novo com o texto exato, espera o turno ativo, respeita o prazo e aborta o que sobrar; `NuvemArmazenamento.sincronizarTudo`.
3. `/api/sistema` com `executor` nos três valores; mensagens e itens da janela para cada um (nuvem e local).
4. Autor da fila: o turno disparado por uma aprovação grava o autor de quem aprovou em `uso_turnos` (memória e fake do Supabase; contrato ao vivo opt-in).
5. `montarMcpConfig` com e sem `FIRECRAWL_API_KEY`.
6. **Teste do contêiner, local:** `docker build` ok; subir com variáveis falsas e conferir `/api/saude` 200, `/` redireciona ao login, API sem sessão 401; dentro do contêiner, `python3 -c "import pptx, openpyxl, PIL, pandas, matplotlib"`, uma conversão real de um `.pptx` e de um `.xlsx` de exemplo para PDF com `soffice --headless`, `pdftoppm`, `ffmpeg -version`, `pandoc --version`; `docker stop` com um turno simulado mostra a drenagem no log.
7. **Aceitação local com a Verdeluz de verdade** (precisa das chaves reais, que só o analista fornece ao contêiner): etapas 01 a 03, uma prévia de planilha, `docker stop` no meio de uma etapa, subir de novo com o volume apagado e confirmar que o prospect e a conversa voltam.
8. **Aceitação no provedor:** o mesmo roteiro pelo endereço público, com o login Google.

## 6. Riscos e limites conhecidos

- **Não há como testar a imagem do provedor de graça antes de existir a conta.** O contêiner local reproduz o ambiente (Debian, Linux), mas é `arm64` no Mac e `amd64` no provedor. As bibliotecas e programas são os mesmos; se algo divergir, o log do build mostra.
- **Tamanho e tempo de build** da imagem (LibreOffice). Aceito.
- **O agente roda comandos na máquina do servidor** e lê páginas de terceiros (anúncios, sites), então um texto malicioso poderia tentar induzir comandos. Mitigações: a lista `FERRAMENTAS_PERMITIDAS` já limita o `Bash` a `python3`, `pandoc`, `ls`, `mkdir`, `cat`, `head` e `wc`; o processo roda sem privilégio; e o subprocesso do agente recebe um ambiente reduzido, definido em `montarOpcoesSdk`, **sem** `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_URL` (o agente não precisa do banco, só o app). A `ANTHROPIC_API_KEY` precisa ficar no ambiente do agente, então a mitigação é parcial: um limite de gasto no Console da Anthropic é a proteção final.
- **`Host` e `x-forwarded-*` no provedor** ainda precisam ser conferidos com tráfego real (a regra de acesso falha fechada, 403).
- Contas de fora do domínio ainda criam uma linha em `auth.users` antes de serem recusadas (endurecimento opcional: função "before user created" no Supabase).
- Custo estimado: provedor de US$ 5 a 20 por mês, Supabase Pro US$ 25, mais o uso da API da Anthropic.

## 7. Tarefas previstas (viram o plano de implementação)

| # | Entrega |
|---|---|
| 0 | Decisão e conta do provedor (manual, adiada pelo bloqueio da Railway) |
| 1 | Pendências da Fase B: autor da fila e `/login` com sessão |
| 2 | Rota de saúde e regra de acesso |
| 3 | Desligamento seguro: `drenar`, `sincronizarTudo`, `instrumentation.ts` |
| 4 | Ajustes para a nuvem: `/api/sistema`, "abrir pasta", painel de uso |
| 5 | Firecrawl no SDK e ambiente reduzido do subprocesso do agente |
| 6 | `requirements.txt`, `Dockerfile`, `entrypoint.sh`, `.dockerignore` |
| 7 | Teste do contêiner local e aceitação local com a Verdeluz |
| 8 | Deploy no provedor e aceitação pelo endereço público |
