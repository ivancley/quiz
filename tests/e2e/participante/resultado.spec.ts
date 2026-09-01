/** UC-012 — Ver o resultado da etapa no celular. */
import { expect, test } from '@playwright/test'

import { conduzirSessao, entrarComoAdmin } from '../apoio/admin'
import { abrirSessao, limparBanco, semearQuiz } from '../apoio/banco'
import {
  desligarCelulares,
  enderecoBase,
  entrarNaSala,
  novoCelular,
} from '../apoio/celular'

test.beforeEach(async () => {
  await limparBanco()
})

test.afterEach(desligarCelulares)

const CERTA = 'Aprendizagens e capacidades para toda a educação básica'
const ERRADA = 'A lista de livros do PNLD'

async function corridaDeDuasEtapas() {
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

  return { quiz, sessao: await abrirSessao(quiz.id) }
}

test('terminar a etapa mostra pontos, total, posição e a volta inteira', async ({
  page,
  browser,
}) => {
  const { quiz, sessao } = await corridaDeDuasEtapas()
  await entrarNaSala(page, quiz.codigo, 'Marina')
  await conduzirSessao(browser, sessao.id, {
    acao: 'abrir-etapa',
    etapaId: quiz.etapas[0].id,
  })

  await page.getByRole('button', { name: CERTA }).click()
  await expect(page.getByText('ETAPA 1 · VOLTA 2/2')).toBeVisible()
  await page.getByRole('button', { name: ERRADA }).click()

  // Um acerto em primeiro lugar (1 + 3) e um erro: 4 pontos na etapa.
  await expect(page.getByText('PONTOS DESTA ETAPA')).toBeVisible()
  await expect(
    page.getByText('1 acerto · 3 de bônus de velocidade')
  ).toBeVisible()
  await expect(page.getByText('TOTAL', { exact: true })).toBeVisible()
  await expect(page.getByText('POSIÇÃO', { exact: true })).toBeVisible()
  await expect(page.getByText('1º')).toBeVisible()

  const voltas = page.getByRole('listitem')
  await expect(voltas).toHaveCount(2)
  await expect(voltas.nth(0)).toContainText('+4')
  await expect(voltas.nth(1)).toContainText('0')
})

test('quem termina antes espera o resto da sala, e não a próxima etapa', async ({
  page,
  browser,
}) => {
  const { quiz, sessao } = await corridaDeDuasEtapas()
  await entrarNaSala(page, quiz.codigo, 'Marina')

  const outro = await novoCelular(browser)
  await entrarNaSala(outro, quiz.codigo, 'Rafael')

  await conduzirSessao(browser, sessao.id, {
    acao: 'abrir-etapa',
    etapaId: quiz.etapas[0].id,
  })

  await page.getByRole('button', { name: CERTA }).click()
  await expect(page.getByText('ETAPA 1 · VOLTA 2/2')).toBeVisible()
  await page.getByRole('button', { name: CERTA }).click()

  await expect(page.getByText('VOLTA COMPLETA')).toBeVisible()
  await expect(
    page.getByText('Aguardando o resto da sala terminar a etapa 1.')
  ).toBeVisible()

  // Quando o organizador encerra, o mesmo resultado passa a anunciar o que vem.
  await conduzirSessao(browser, sessao.id, { acao: 'encerrar-etapa' })
  await expect(page.getByText('ETAPA 1 ENCERRADA')).toBeVisible()
  await expect(
    page.getByText('Aguardando o organizador abrir a etapa 2.')
  ).toBeVisible()
})

test('o resultado dá lugar à próxima etapa sem ninguém tocar na tela', async ({
  page,
  browser,
}) => {
  const { quiz, sessao } = await corridaDeDuasEtapas()
  await entrarNaSala(page, quiz.codigo, 'Marina')
  await conduzirSessao(browser, sessao.id, {
    acao: 'abrir-etapa',
    etapaId: quiz.etapas[0].id,
  })

  await page.getByRole('button', { name: CERTA }).click()
  await expect(page.getByText('ETAPA 1 · VOLTA 2/2')).toBeVisible()
  await page.getByRole('button', { name: CERTA }).click()
  await expect(page.getByText('PONTOS DESTA ETAPA')).toBeVisible()

  await conduzirSessao(browser, sessao.id, {
    acao: 'abrir-etapa',
    etapaId: quiz.etapas[1].id,
  })

  await expect(page.getByText('ETAPA 2 · VOLTA 1/1')).toBeVisible()
})

test('a posição que o celular mostra é a mesma da pista projetada', async ({
  page,
  browser,
}) => {
  const { quiz, sessao } = await corridaDeDuasEtapas()
  await entrarNaSala(page, quiz.codigo, 'Marina')

  const doRafael = await novoCelular(browser)
  await entrarNaSala(doRafael, quiz.codigo, 'Rafael')

  await conduzirSessao(browser, sessao.id, {
    acao: 'abrir-etapa',
    etapaId: quiz.etapas[0].id,
  })

  // Rafael acerta as duas primeiro; Marina acerta uma e erra a outra.
  await doRafael.getByRole('button', { name: CERTA }).click()
  await expect(doRafael.getByText('ETAPA 1 · VOLTA 2/2')).toBeVisible()
  await doRafael.getByRole('button', { name: CERTA }).click()

  await page.getByRole('button', { name: ERRADA }).click()
  await expect(page.getByText('ETAPA 1 · VOLTA 2/2')).toBeVisible()
  await page.getByRole('button', { name: CERTA }).click()

  await expect(doRafael.getByText('POSIÇÃO')).toBeVisible()
  await expect(page.getByText('POSIÇÃO')).toBeVisible()

  // A mesma sessão, vista do painel do organizador — que roda numa tela larga,
  // e não num celular.
  const doPainel = await browser.newContext({ baseURL: enderecoBase() })
  const painel = await doPainel.newPage()
  await entrarComoAdmin(painel)
  await painel.goto(`/admin/sessions/${sessao.id}`)

  const raias = painel.getByRole('listitem').filter({ hasText: 'KART' })
  await expect(raias.nth(0)).toContainText('Rafael')
  await expect(raias.nth(1)).toContainText('Marina')

  // O que a pista projeta em primeiro e segundo é o que cada celular diz.
  await expect(doRafael.getByText('1º')).toBeVisible()
  await expect(page.getByText('2º')).toBeVisible()

  await doPainel.close()
})
