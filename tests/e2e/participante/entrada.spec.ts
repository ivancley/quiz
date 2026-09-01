/** UC-009 — Entrar na corrida pelo QR Code. */
import { expect, test } from '@playwright/test'

import {
  abrirSessao,
  limparBanco,
  participantesDaSessao,
  semearQuiz,
} from '../apoio/banco'
import { desligarCelulares, novoCelular } from '../apoio/celular'
import { alertaComTexto } from '../apoio/pagina'

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
    ],
  })

  return { quiz, sessao: await abrirSessao(quiz.id) }
}

test('a tela de entrada mostra o quiz e o tamanho da corrida', async ({
  page,
}) => {
  const { quiz } = await salaAberta()

  await page.goto(`/e/${quiz.codigo}`)

  await expect(
    page.getByRole('heading', { name: 'Formação de Professores' })
  ).toBeVisible()
  await expect(page.getByText('1 etapa · 2 perguntas')).toBeVisible()
  await expect(page.getByText('Sem cadastro. Sem instalar nada.')).toBeVisible()
})

test('quem informa o nome entra na grade', async ({ page }) => {
  const { quiz, sessao } = await salaAberta()

  await page.goto(`/e/${quiz.codigo}`)

  // Sem nome não há corrida: o botão só libera quando há o que enviar.
  await expect(
    page.getByRole('button', { name: 'ENTRAR NA CORRIDA' })
  ).toBeDisabled()

  await page.getByLabel('SEU NOME').fill('Marina Alves')
  await page.getByRole('button', { name: 'ENTRAR NA CORRIDA' }).click()

  await expect(page).toHaveURL(new RegExp(`/e/${quiz.codigo}/jogo$`))

  const naGrade = await participantesDaSessao(sessao.id)
  expect(naGrade.map((pessoa) => pessoa.nome)).toEqual(['Marina Alves'])
})

test('o nome já usado na sala é recusado com uma explicação', async ({
  page,
  browser,
}) => {
  const { quiz } = await salaAberta()

  await page.goto(`/e/${quiz.codigo}`)
  await page.getByLabel('SEU NOME').fill('Marina')
  await page.getByRole('button', { name: 'ENTRAR NA CORRIDA' }).click()
  await expect(page).toHaveURL(new RegExp(`/e/${quiz.codigo}/jogo$`))

  // Outro aparelho, outro cookie: é a segunda pessoa da sala, não a mesma.
  const outro = await novoCelular(browser)
  await outro.goto(`/e/${quiz.codigo}`)
  await outro.getByLabel('SEU NOME').fill('marina')
  await outro.getByRole('button', { name: 'ENTRAR NA CORRIDA' }).click()

  await expect(alertaComTexto(outro)).toContainText(
    'Esse nome já está na pista'
  )
  await expect(outro).toHaveURL(new RegExp(`/e/${quiz.codigo}$`))
})

test('dois nomes diferentes entram na mesma sala', async ({
  page,
  browser,
}) => {
  const { quiz, sessao } = await salaAberta()

  await page.goto(`/e/${quiz.codigo}`)
  await page.getByLabel('SEU NOME').fill('Marina')
  await page.getByRole('button', { name: 'ENTRAR NA CORRIDA' }).click()
  await expect(page).toHaveURL(new RegExp(`/e/${quiz.codigo}/jogo$`))

  const outro = await novoCelular(browser)
  await outro.goto(`/e/${quiz.codigo}`)
  await outro.getByLabel('SEU NOME').fill('Rafael')
  await outro.getByRole('button', { name: 'ENTRAR NA CORRIDA' }).click()
  await expect(outro).toHaveURL(new RegExp(`/e/${quiz.codigo}/jogo$`))

  const naGrade = await participantesDaSessao(sessao.id)
  expect(naGrade.map((pessoa) => pessoa.nome).sort()).toEqual([
    'Marina',
    'Rafael',
  ])
})

test('quem já está na grade volta direto para o jogo', async ({ page }) => {
  const { quiz } = await salaAberta()

  await page.goto(`/e/${quiz.codigo}`)
  await page.getByLabel('SEU NOME').fill('Marina')
  await page.getByRole('button', { name: 'ENTRAR NA CORRIDA' }).click()
  await expect(page).toHaveURL(new RegExp(`/e/${quiz.codigo}/jogo$`))

  // Escanear o QR de novo é o gesto mais provável de quem se perdeu na sala.
  await page.goto(`/e/${quiz.codigo}`)

  await expect(page).toHaveURL(new RegExp(`/e/${quiz.codigo}/jogo$`))
  await expect(page.getByLabel('SEU NOME')).toHaveCount(0)
})
