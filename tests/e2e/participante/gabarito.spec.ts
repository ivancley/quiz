/** UC-011 — A fronteira do gabarito: nada revela a alternativa certa antes da resposta. */
import { readdirSync } from 'node:fs'

import { expect, test } from '@playwright/test'

import {
  abrirEtapaNoBanco,
  abrirSessao,
  limparBanco,
  respostasDaPergunta,
  semearQuiz,
} from '../apoio/banco'
import { desligarCelulares, entrarNaSala } from '../apoio/celular'

test.beforeEach(async () => {
  await limparBanco()
})

test.afterEach(desligarCelulares)

/**
 * As rotas do participante lidas do disco, e não escritas à mão: uma rota nova
 * entra nesta varredura sozinha, que é a única forma de a proteção não ficar
 * para trás do código.
 */
const ROTAS_DO_PARTICIPANTE = readdirSync('src/app/api/e/[codigo]', {
  withFileTypes: true,
})
  .filter((entrada) => entrada.isDirectory())
  .map((entrada) => entrada.name)
  .sort()

const PERGUNTA_INEXISTENTE = '00000000-0000-0000-0000-000000000000'

async function corridaEmAndamento() {
  const quiz = await semearQuiz({
    titulo: 'Formação de Professores',
    etapas: [
      {
        titulo: 'Currículo em ação',
        perguntas: [
          { texto: 'O que as competências gerais descrevem?', correta: 'B' },
          { texto: 'Quem define o currículo da rede?', correta: 'C' },
        ],
      },
    ],
  })

  const sessao = await abrirSessao(quiz.id)
  return { quiz, sessao }
}

test('a varredura conhece todas as rotas do participante', () => {
  expect(ROTAS_DO_PARTICIPANTE).toEqual(['entrar', 'estado', 'responder'])
})

test('nenhuma rota do participante revela a alternativa certa antes da resposta', async ({
  page,
}) => {
  const { quiz, sessao } = await corridaEmAndamento()
  await entrarNaSala(page, quiz.codigo, 'Marina')
  await abrirEtapaNoBanco(sessao.id, quiz.etapas[0].id)
  await page.reload()

  const corpos: string[] = []

  // Leitura do estado: é a rota que monta a tela inteira do celular.
  const estado = await page.request.get(`/api/e/${quiz.codigo}/estado`)
  expect(estado.ok()).toBe(true)
  corpos.push(await estado.text())

  // Entrada: recusada por nome repetido, é o corpo que a tela mostraria.
  const entrar = await page.request.post(`/api/e/${quiz.codigo}/entrar`, {
    data: { nome: 'Marina' },
  })
  corpos.push(await entrar.text())

  // Envio de resposta com pergunta inexistente: exercita a rota sem registrar
  // resposta nenhuma, que é a condição deste caso.
  const responder = await page.request.post(`/api/e/${quiz.codigo}/responder`, {
    data: { perguntaId: PERGUNTA_INEXISTENTE, escolhida: 'B' },
  })
  corpos.push(await responder.text())

  // As duas telas em HTML, que carregam o estado embutido no documento.
  for (const endereco of [`/e/${quiz.codigo}`, `/e/${quiz.codigo}/jogo`]) {
    const tela = await page.request.get(endereco)
    corpos.push(await tela.text())
  }

  for (const corpo of corpos) {
    expect(corpo).not.toContain('correta')
    expect(corpo).not.toContain('acertou')
    expect(corpo).not.toContain('gabarito')
  }

  // E nada foi respondido no caminho: a varredura mediu a tela de antes.
  expect(await respostasDaPergunta(quiz.etapas[0].perguntas[0].id)).toEqual([])
})

test('os segmentos da barra não adiantam nada sobre as perguntas pendentes', async ({
  page,
}) => {
  const { quiz, sessao } = await corridaEmAndamento()
  await entrarNaSala(page, quiz.codigo, 'Marina')
  await abrirEtapaNoBanco(sessao.id, quiz.etapas[0].id)
  await page.reload()

  const resposta = await page.request.get(`/api/e/${quiz.codigo}/estado`)
  const { dados } = await resposta.json()

  expect(dados.tela).toBe('pergunta')
  expect(dados.segmentos).toEqual(['atual', 'pendente'])
  expect(dados.pontosNaEtapa).toBe(0)
})

test('depois de responder, o servidor diz se acertou', async ({ page }) => {
  const { quiz, sessao } = await corridaEmAndamento()
  await entrarNaSala(page, quiz.codigo, 'Marina')
  await abrirEtapaNoBanco(sessao.id, quiz.etapas[0].id)
  await page.reload()

  const resposta = await page.request.post(`/api/e/${quiz.codigo}/responder`, {
    data: { perguntaId: quiz.etapas[0].perguntas[0].id, escolhida: 'B' },
  })

  // Saber se acertou depois de ter respondido é o comportamento desenhado; o
  // que a fronteira proíbe é saber antes.
  expect(await resposta.json()).toEqual({
    dados: { correta: true, pontosNaEtapa: 4 },
  })
})
