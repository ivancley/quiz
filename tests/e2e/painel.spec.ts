import { expect, test } from '@playwright/test'

import { entrarComoAdmin } from './apoio/admin'
import {
  abrirSessao,
  entrarNaSessao,
  limparBanco,
  responder,
  semearQuiz,
} from './apoio/banco'

test.beforeEach(async () => {
  await limparBanco()
})

async function salaMontada() {
  const quiz = await semearQuiz({
    titulo: 'Formação de Professores',
    etapas: [
      {
        titulo: 'Currículo em ação',
        perguntas: [
          { texto: 'O que as competências gerais descrevem?', correta: 'B' },
          { texto: 'Quem define o currículo da rede?', correta: 'B' },
        ],
      },
      {
        titulo: 'Avaliação formativa',
        perguntas: [{ texto: 'Para que serve a devolutiva?', correta: 'B' }],
      },
    ],
  })

  const sessao = await abrirSessao(quiz.id)
  const marina = await entrarNaSessao(sessao.id, 'Marina')
  const rafael = await entrarNaSessao(sessao.id, 'Rafael')

  return { quiz, sessao, marina, rafael }
}

test('o painel mostra a grade e o placar montados por quem já respondeu', async ({
  page,
}) => {
  const { quiz, sessao, marina, rafael } = await salaMontada()

  // Marina acerta primeiro; Rafael acerta a mesma pergunta depois.
  await responder(marina.id, quiz.etapas[0].perguntas[0].id, 'B')
  await responder(rafael.id, quiz.etapas[0].perguntas[0].id, 'B')

  await entrarComoAdmin(page)
  await page.goto(`/admin/sessions/${sessao.id}`)

  const raias = page.getByRole('listitem').filter({ hasText: 'KART' })

  // Primeira a acertar: 1 ponto do acerto + 3 de bônus. Segundo: 1 + 2.
  await expect(raias.nth(0)).toContainText('Marina')
  await expect(raias.nth(0)).toContainText('4 PTS')
  await expect(raias.nth(1)).toContainText('Rafael')
  await expect(raias.nth(1)).toContainText('3 PTS')
})

test('abrir uma etapa muda o painel sem recarregar a página', async ({
  page,
}) => {
  const { quiz, sessao } = await salaMontada()

  await entrarComoAdmin(page)
  await page.goto(`/admin/sessions/${sessao.id}`)

  await expect(page.getByText('A corrida ainda não começou')).toBeVisible()

  // Uma marca que só sobrevive se a página não for recarregada — é o que separa
  // "a tela reagiu ao aviso" de "a tela foi buscar tudo de novo do zero".
  await page.evaluate(() => {
    ;(window as unknown as { marcaDoTeste?: string }).marcaDoTeste = 'viva'
  })

  // A etapa é aberta por fora desta página, como se fosse de outro dispositivo:
  // o painel só pode saber disso pelo canal de avisos.
  const resposta = await page.request.patch(`/api/sessions/${sessao.id}`, {
    data: { acao: 'abrir-etapa', etapaId: quiz.etapas[0].id },
  })
  expect(resposta.ok()).toBe(true)

  await expect(page.getByText('Currículo em ação')).toBeVisible()
  await expect(page.getByText('ETAPA ABERTA', { exact: true })).toBeVisible()
  await expect(page.getByText('ETAPA 1 / 2')).toBeVisible()

  const marca = await page.evaluate(
    () => (window as unknown as { marcaDoTeste?: string }).marcaDoTeste
  )
  expect(marca).toBe('viva')
})

test('encerrar a etapa e a sessão chega ao painel pelo mesmo caminho', async ({
  page,
}) => {
  const { quiz, sessao } = await salaMontada()

  await entrarComoAdmin(page)
  await page.goto(`/admin/sessions/${sessao.id}`)

  await page.request.patch(`/api/sessions/${sessao.id}`, {
    data: { acao: 'abrir-etapa', etapaId: quiz.etapas[0].id },
  })
  await expect(page.getByText('ETAPA ABERTA', { exact: true })).toBeVisible()

  await page.request.patch(`/api/sessions/${sessao.id}`, {
    data: { acao: 'encerrar-etapa' },
  })
  await expect(
    page.getByText('NENHUMA ETAPA ABERTA', { exact: true })
  ).toBeVisible()

  await page.request.patch(`/api/sessions/${sessao.id}`, {
    data: { acao: 'finalizar' },
  })
  await expect(page.getByText('● ENCERRADA')).toBeVisible()
})

test('o organizador conduz as etapas pelos botões do painel', async ({
  page,
}) => {
  const { sessao } = await salaMontada()

  await entrarComoAdmin(page)
  await page.goto(`/admin/sessions/${sessao.id}`)

  const encerrarEtapa = page.getByRole('button', { name: 'ENCERRAR ETAPA' })
  await expect(encerrarEtapa).toBeDisabled()

  await page.getByRole('button', { name: 'INICIAR ETAPA 1' }).click()

  await expect(page.getByText('ETAPA ABERTA', { exact: true })).toBeVisible()
  await expect(encerrarEtapa).toBeEnabled()
  // Nunca duas etapas ao mesmo tempo.
  await expect(
    page.getByRole('button', { name: /INICIAR ETAPA/ })
  ).toBeDisabled()

  await encerrarEtapa.click()

  await expect(
    page.getByText('NENHUMA ETAPA ABERTA', { exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'INICIAR ETAPA 2' })
  ).toBeEnabled()
})
