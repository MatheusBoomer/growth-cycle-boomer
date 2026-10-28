# Imagem do servidor do planejamento estratégico (app web + agente + ferramentas).
# Camadas da mais estável para a mais volátil: programas do sistema, Python, dependências
# Node, código e build do Next. Mudar só o código reconstrói a partir da cópia do código.
# Nada aqui depende da arquitetura (roda em linux/amd64 no provedor e linux/arm64 local).
# Segredos nunca entram na imagem: chegam por variável de ambiente na hora de rodar.
FROM node:22-bookworm-slim

# ---------------------------------------------------------------- programas do sistema
# LibreOffice (prévias de .pptx/.xlsx/.docx), poppler (pdftoppm), ImageMagick, ffmpeg
# (benchmark de anúncios), pandoc (transcrições .docx), fontes métricas da Arial,
# tini (processo 1) e gosu (baixar o privilégio na subida).
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      python3 python3-venv \
      libreoffice-impress libreoffice-calc libreoffice-writer \
      poppler-utils imagemagick ffmpeg pandoc \
      fonts-liberation fonts-dejavu-core fontconfig \
      ca-certificates curl tini gosu \
 && rm -rf /var/lib/apt/lists/* \
 && fc-cache -f

# Usuário sem privilégio do app e do agente (uid 1000; a imagem do node já usa esse uid para "node").
RUN userdel -r node \
 && groupadd --gid 1000 app \
 && useradd --uid 1000 --gid app --home-dir /data/home --no-create-home --shell /bin/bash app

# ---------------------------------------------------------------- Python
ENV VIRTUAL_ENV=/opt/venv \
    PATH=/opt/venv/bin:$PATH \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    LANG=C.UTF-8
COPY docker/requirements.txt /tmp/requirements.txt
RUN python3 -m venv /opt/venv \
 && pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir -r /tmp/requirements.txt \
 && rm /tmp/requirements.txt

# ---------------------------------------------------------------- MCP do Firecrawl (pesquisa web do agente)
RUN npm install -g --no-fund --no-audit firecrawl-mcp@3.36.0 \
 && npm cache clean --force

# ---------------------------------------------------------------- dependências Node
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app/src
COPY src/package.json src/package-lock.json src/.npmrc ./
COPY src/apps/web/package.json apps/web/
COPY src/packages/core/package.json packages/core/
COPY src/packages/eslint-config/package.json packages/eslint-config/
COPY src/packages/mcp-planejamento/package.json packages/mcp-planejamento/
COPY src/packages/typescript-config/package.json packages/typescript-config/
COPY src/packages/ui/package.json packages/ui/
RUN npm ci --no-fund --no-audit \
 && npm cache clean --force

# ---------------------------------------------------------------- código
# Lista explícita do que vai para /app (o .dockerignore é a segunda trava).
COPY CLAUDE.md /app/CLAUDE.md
COPY .claude /app/.claude
COPY .agents /app/.agents
COPY scripts /app/scripts
COPY clientes/_template /app/clientes-base/_template
COPY clientes/_fixtures /app/clientes-base/_fixtures
COPY docker/entrypoint.sh /app/docker/entrypoint.sh
COPY src /app/src

# ---------------------------------------------------------------- build do Next
# O build não lê nenhum arquivo de ambiente: tudo que o app usa é lido na hora de rodar.
# O resto de /app fica do root (só leitura para o app); o cache do Next é a exceção.
RUN cd /app/src/apps/web && node /app/src/node_modules/next/dist/bin/next build \
 && rm -rf /app/src/apps/web/.next/cache \
 && install -d -o app -g app /app/src/apps/web/.next/cache \
 && ln -s /data/clientes /app/clientes

# ---------------------------------------------------------------- execução
ENV NODE_ENV=production \
    PORT=3000 \
    PLANEJAMENTO_ROOT=/app \
    CLAUDE_CONFIG_DIR=/data/claude \
    HOME=/data/home \
    PLANEJAMENTO_EXECUTOR=sdk \
    PLANEJAMENTO_DADOS=supabase \
    PLANEJAMENTO_AUTH=google \
    NEXT_MANUAL_SIG_HANDLE=true
# PLANEJAMENTO_URL_INTERNA é montada no entrypoint.sh a partir da PORT da subida
# (o provedor pode trocar a porta; um valor fixo aqui ficaria velho).

# O volume persistente é montado em /data pelo provedor (sem instrução VOLUME: a Railway a recusa).
WORKDIR /app
EXPOSE 3000
ENTRYPOINT ["/usr/bin/tini", "--", "/app/docker/entrypoint.sh"]
# Sem o CMD ["node"] herdado da imagem base: o entrypoint não recebe argumentos.
CMD []
