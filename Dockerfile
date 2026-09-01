# Imagem de produção do Quiz ao Vivo.
#
# Três estágios: dependências, build e execução. Só o último vai para a VPS, e
# ele carrega a saída autônoma do Next.js — o servidor e as poucas bibliotecas
# que ele de fato usa, sem o `node_modules` inteiro nem o código-fonte.

FROM node:24-alpine AS dependencias
WORKDIR /app
# Copiar só os manifestos antes do resto faz esta camada ser reaproveitada
# enquanto as dependências não mudarem, mesmo com o código mudando toda hora.
COPY package.json package-lock.json ./
# `npm install` e não `npm ci`: o lock é gerado no macOS de quem desenvolve e
# não registra os binários nativos que só existem no Linux, e o `npm ci` recusa
# instalar quando falta qualquer coisa. Gerar o lock aqui dentro resolveria este
# lado e quebraria o outro — sairiam os binários do macOS. As versões continuam
# vindo do lock; o que o `install` faz a mais é preencher o que falta.
RUN npm install --no-audit --no-fund


FROM node:24-alpine AS construcao
WORKDIR /app
COPY --from=dependencias /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# O build não fala com o banco nem lê credencial: as telas que dependem disso
# são todas renderizadas a cada requisição.
RUN npm run build


FROM node:24-alpine AS producao
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Servir como root não traz nenhuma vantagem e amplia o estrago de qualquer
# falha na aplicação.
RUN addgroup -S quiz && adduser -S quiz -G quiz

COPY --from=construcao --chown=quiz:quiz /app/.next/standalone ./
COPY --from=construcao --chown=quiz:quiz /app/.next/static ./.next/static
# As migrações são lidas do disco quando a aplicação sobe, então os arquivos SQL
# precisam viajar junto com a imagem.
COPY --from=construcao --chown=quiz:quiz /app/drizzle ./drizzle

USER quiz

# Aplica as migrações pendentes antes de atender a primeira requisição. Seguro
# porque a aplicação roda em uma réplica só.
ENV MIGRAR_NO_START=1

ENV PORT=3000
ENV HOSTNAME=0.0.0.0
EXPOSE 3000

CMD ["node", "server.js"]
