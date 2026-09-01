/** UC-010 — Esperar a largada na sala. */
import { expect, test } from '@playwright/test'

import { abrirSessao, limparBanco, semearQuiz } from '../apoio/banco'
import { desligarCelulares, entrarNaSala, novoCelular } from '../apoio/celular'

test.beforeEach(async () => {
  await limparBanco()
})

test.afterEach(desligarCelulares)

async function salaAberta() {
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

test('quem entra fica na sala de espera com o próprio kart', async ({
  page,
}) => {
  const { quiz } = await salaAberta()

  await entrarNaSala(page, quiz.codigo, 'Marina Alves')

  await expect(
    page.getByRole('heading', { name: 'Aguardando a largada' })
  ).toBeVisible()
  await expect(page.getByText('Marina Alves')).toBeVisible()
  await expect(page.getByText('KART 01 · NA GRADE')).toBeVisible()
  await expect(page.getByText('PREPARANDO ETAPA 1')).toBeVisible()
})

test('a sala mostra que o canal de avisos está de pé', async ({ page }) => {
  const { quiz } = await salaAberta()

  await entrarNaSala(page, quiz.codigo, 'Marina')

  // A pílula nasce em RECONECTANDO e só passa a CONECTADO quando o canal
  // responde — é o que separa "a etapa não abriu" de "meu celular caiu".
  await expect(page.getByText('CONECTADO', { exact: true })).toBeVisible()
})

test('o número do kart segue a ordem de chegada', async ({ page, browser }) => {
  const { quiz } = await salaAberta()

  await entrarNaSala(page, quiz.codigo, 'Marina')
  await expect(page.getByText('KART 01 · NA GRADE')).toBeVisible()

  const outro = await novoCelular(browser)
  await entrarNaSala(outro, quiz.codigo, 'Rafael')

  await expect(outro.getByText('KART 02 · NA GRADE')).toBeVisible()
  await expect(outro.getByText('Participantes na pista')).toBeVisible()
  await expect(outro.getByText('2', { exact: true })).toBeVisible()
})

test('recarregar a sala de espera não devolve ninguém ao formulário', async ({
  page,
}) => {
  const { quiz } = await salaAberta()

  await entrarNaSala(page, quiz.codigo, 'Marina')
  await page.reload()

  await expect(
    page.getByRole('heading', { name: 'Aguardando a largada' })
  ).toBeVisible()
  await expect(page.getByText('KART 01 · NA GRADE')).toBeVisible()
})
