# Quiz ao Vivo — Grand Prix do Conhecimento

Quiz de sala, jogado ao mesmo tempo por todo mundo. O organizador projeta um QR
Code na parede; quem está na sala aponta a câmera, escreve o nome e entra. As
perguntas vão ao ar uma de cada vez, e o ranking aparece como uma pista de
karts que se reordena sozinha.

Não há cadastro, aplicativo para instalar nem login para quem participa.

## Como pontua

Cada acerto vale **1 ponto**. Os três primeiros a acertar **cada pergunta**
ganham um bônus de velocidade de **+3**, **+2** e **+1**. Quem erra não ganha
nada e não ocupa lugar na fila do bônus.

Nada disso é armazenado: o placar é derivado das respostas a cada consulta, a
partir da ordem em que cada acerto chegou. É o que torna impossível duas
pessoas receberem o mesmo bônus, mesmo respondendo no mesmo instante.

## Requisitos

- Node.js 24 ou superior — os scripts do projeto são TypeScript executado
  nativamente, sem transpilador no caminho.
- Docker, para o Postgres.

## Rodando na sua máquina

```bash
npm install
cp .env.example .env          # e preencha, ver abaixo
docker compose up -d db
npm run db:migrate
npm run dev
```

A aplicação sobe em <http://localhost:3031> e o Postgres em `5463`.

> **As portas são as padrão + 31.** Convenção deste projeto, para não colidir
> com os outros serviços em Docker da máquina: Next.js 3000 → 3031, Postgres
> 5432 → 5463. Ajustáveis por `APP_PORT` e `DB_PORT`.

### Preenchendo o `.env`

```bash
# A senha do organizador. Cole a linha inteira, como o comando entrega.
npm run admin:hash -- 'a-senha-que-voce-escolher'

# A chave que assina os cookies.
openssl rand -base64 48
```

> **Os cifrões do hash saem escapados de propósito.** Um hash bcrypt é feito de
> cifrões, e leitor de `.env` costuma tratar `$` como início de variável.
> Colado cru, o hash chega mutilado ao servidor e **todo login passa a ser
> recusado**, sem nenhum erro que aponte para a causa. A aplicação confere a
> forma do hash quando sobe e se recusa a subir se ele estiver quebrado.

## Testes

```bash
npm test          # unidade e integração, contra um Postgres de verdade
npm run test:e2e  # bateria no navegador, contra a aplicação em build de produção
```

A bateria recria o banco `quiz_e2e` do zero e sobe uma segunda aplicação na
porta 3032 — o `npm run dev` do dia a dia pode continuar aberto.

## Implantação

A aplicação vai para a VPS pelo Dokploy, a partir de
[`docker-compose.producao.yml`](./docker-compose.producao.yml).

```bash
docker compose -f docker-compose.producao.yml up --build -d
```

As variáveis a definir no painel do Dokploy:

| Variável              | O que é                                                                  |
| --------------------- | ------------------------------------------------------------------------ |
| `DB_PASSWORD`         | senha do Postgres                                                        |
| `APP_BASE_URL`        | endereço público, sem barra no final — **é o que vai dentro do QR Code** |
| `ADMIN_EMAIL`         | e-mail do organizador                                                    |
| `ADMIN_PASSWORD_HASH` | saída de `npm run admin:hash`, com os cifrões escapados                  |
| `AUTH_SECRET`         | `openssl rand -base64 48`                                                |

> **Sobre os cifrões, de novo.** A aplicação aceita o hash das duas formas, com
> os cifrões escapados ou crus — ela desfaz o escape na leitura e confere o
> formato. No painel do Dokploy, cole a linha como o gerador entrega. Se em vez
> disso você subir por `docker compose --env-file`, saiba que o compose faz a
> própria interpolação naquele arquivo, e lá o cifrão literal se escreve `$$`.

As migrações são aplicadas quando o contêiner sobe, antes de ele atender a
primeira requisição. Se falharem, o servidor não sobe — é o que se quer:
servir sobre um banco desatualizado quebra de formas bem piores.

### Duas restrições que não são detalhe

**Uma réplica só.** Quem está ouvindo cada sessão vive na memória do processo.
Com duas réplicas, cada uma conheceria metade da sala, e a outra metade ficaria
com a tela parada na pergunta anterior — sem erro nenhum em lugar nenhum. É a
falha mais difícil de diagnosticar deste sistema. Está fixada em
`deploy.replicas: 1`, com o motivo escrito ao lado.

**O proxy não pode comprimir o fluxo de eventos.** As telas mudam por Server-Sent
Events, e SSE comprimido chega em blocos: o evento só aparece muito depois de ter
acontecido, ou não aparece. No Traefik do Dokploy, isso significa **não habilitar
o middleware `compress`** na rota desta aplicação. Se ele for necessário por
outro motivo, inclua `text/event-stream` em `excludedContentTypes`:

```yaml
http:
  middlewares:
    compressao-sem-sse:
      compress:
        excludedContentTypes:
          - text/event-stream
```

A aplicação já manda `Cache-Control: no-transform` e `X-Accel-Buffering: no` na
rota de eventos, e um pulso de manutenção a cada 15 segundos contra o
encerramento de conexões ociosas. Isso cobre nginx e proxies bem-comportados,
mas não substitui a configuração acima.

## Por que Next.js 16.3.3 ou superior

As versões anteriores têm duas vulnerabilidades críticas corrigidas na release
de segurança de 25/08/2026. A versão está fixada no `package.json` e não deve
ser rebaixada.

## Onde as regras moram

As quatro regras que costumam virar bug são **constraints do Postgres**, não
validações de aplicação — o estado inválido não chega a ser representável:

- uma sessão viva por quiz, por índice único parcial;
- nome de participante único dentro da sessão, sem diferenciar maiúsculas;
- uma resposta por pessoa por pergunta;
- exatamente quatro alternativas, e a correta restrita a A–D.

O código traduz a violação dessas constraints em uma recusa explicada na tela,
em vez de reverificar a regra por conta própria.
