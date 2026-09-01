/** UC-004 — Cadastrar e corrigir as perguntas de uma etapa. */
import { expect, test, type Page } from '@playwright/test'

import { confirmarDialogos, entrarComoAdmin } from './apoio/admin'
import { limparBanco, semearQuiz } from './apoio/banco'
import { alertaComTexto } from './apoio/pagina'

test.beforeEach(async ({ page }) => {
  await limparBanco()
  confirmarDialogos(page)
  await entrarComoAdmin(page)
})

/** Uma etapa sem perguntas, para elas nascerem pela tela. */
async function etapaVazia(page: Page) {
  const quiz = await semearQuiz({
    titulo: 'Formação de Professores',
    etapas: [{ titulo: 'Currículo em ação', perguntas: [] }],
  })
  await page.goto(`/admin/quizzes/${quiz.id}/stages/${quiz.etapas[0].id}`)
  return quiz
}

/**
 * Os cartões de pergunta. O filtro é pelo botão EDITAR porque o cartão e a
 * alternativa marcada são ambos itens de lista e ambos contêm "CORRETA" — só o
 * cartão tem as ações.
 */
function perguntasNaTela(page: Page) {
  return page.getByRole('listitem').filter({ hasText: 'EDITAR' })
}

async function preencher(
  page: Page,
  enunciado: string,
  correta: 'A' | 'B' | 'C' | 'D',
  alternativas = ['Primeira', 'Segunda', 'Terceira', 'Quarta']
) {
  await page.getByLabel('ENUNCIADO').fill(enunciado)
  for (const [indice, letra] of ['A', 'B', 'C', 'D'].entries()) {
    await page
      .getByPlaceholder(`Alternativa ${letra}`)
      .fill(alternativas[indice])
  }
  await page
    .getByRole('radio', {
      name: `Marcar a alternativa ${correta} como correta`,
    })
    .check()
}

test('a pergunta guarda as quatro alternativas e o gabarito marcado', async ({
  page,
}) => {
  await etapaVazia(page)
  await expect(page.getByText(/Nenhuma pergunta ainda/)).toBeVisible()

  await page.getByRole('button', { name: 'NOVA PERGUNTA' }).click()
  await preencher(page, 'O que as competências gerais descrevem?', 'B', [
    'Conteúdos por bimestre',
    'Aprendizagens para toda a educação básica',
    'Critérios de avaliação externa',
    'A lista do PNLD',
  ])
  await page.getByRole('button', { name: 'ADICIONAR' }).click()

  const pergunta = perguntasNaTela(page)
  await expect(pergunta).toHaveCount(1)
  await expect(pergunta).toContainText(
    'O que as competências gerais descrevem?'
  )
  await expect(pergunta).toContainText(
    'Aprendizagens para toda a educação básica'
  )

  // O gabarito é marcado visualmente na alternativa certa, e só nela.
  const marcada = pergunta.getByRole('listitem').filter({ hasText: 'CORRETA' })
  await expect(marcada).toHaveCount(1)
  await expect(marcada).toContainText(
    'Aprendizagens para toda a educação básica'
  )
})

test('a alternativa em branco é recusada com a razão na tela', async ({
  page,
}) => {
  await etapaVazia(page)

  await page.getByRole('button', { name: 'NOVA PERGUNTA' }).click()
  // Espaços passam pela exigência do navegador e morrem na regra do servidor,
  // que é justamente a fronteira que interessa conferir aqui.
  await preencher(page, 'Pergunta incompleta', 'A', [
    'Primeira',
    'Segunda',
    '   ',
    'Quarta',
  ])
  await page.getByRole('button', { name: 'ADICIONAR' }).click()

  await expect(alertaComTexto(page)).toContainText(
    'A pergunta precisa do enunciado, das quatro alternativas preenchidas'
  )
  await expect(perguntasNaTela(page)).toHaveCount(0)
})

test('as perguntas aparecem na ordem de cadastro e podem ser reordenadas', async ({
  page,
}) => {
  const quiz = await semearQuiz({
    titulo: 'Formação de Professores',
    etapas: [
      {
        titulo: 'Currículo em ação',
        perguntas: [
          { texto: 'Pergunta um', correta: 'B' },
          { texto: 'Pergunta dois', correta: 'B' },
          { texto: 'Pergunta três', correta: 'B' },
        ],
      },
    ],
  })
  await page.goto(`/admin/quizzes/${quiz.id}/stages/${quiz.etapas[0].id}`)

  const perguntas = perguntasNaTela(page)
  await expect(perguntas.nth(0)).toContainText('Pergunta um')
  await expect(perguntas.nth(2)).toContainText('Pergunta três')

  await perguntas
    .nth(2)
    .getByRole('button', { name: 'Subir esta pergunta' })
    .click()

  await expect(perguntasNaTela(page).nth(1)).toContainText('Pergunta três')
  await expect(perguntasNaTela(page).nth(2)).toContainText('Pergunta dois')
})

test('editar a pergunta troca o gabarito sem mudar o lugar dela', async ({
  page,
}) => {
  const quiz = await semearQuiz({
    titulo: 'Formação de Professores',
    etapas: [
      {
        titulo: 'Currículo em ação',
        perguntas: [
          { texto: 'Pergunta um', correta: 'B' },
          { texto: 'Gabarito errado', correta: 'B' },
        ],
      },
    ],
  })
  await page.goto(`/admin/quizzes/${quiz.id}/stages/${quiz.etapas[0].id}`)

  const segunda = perguntasNaTela(page).nth(1)
  await segunda.getByRole('button', { name: 'EDITAR' }).click()
  await page
    .getByRole('radio', { name: 'Marcar a alternativa D como correta' })
    .check()
  await page.getByRole('button', { name: 'SALVAR' }).click()

  const depois = perguntasNaTela(page).nth(1)
  await expect(depois).toContainText('02')
  await expect(depois).toContainText('Gabarito errado')
  await expect(
    depois.getByRole('listitem').filter({ hasText: 'CORRETA' })
  ).toContainText('A lista de livros do PNLD')
})

test('excluir uma pergunta do meio fecha o buraco na numeração', async ({
  page,
}) => {
  const quiz = await semearQuiz({
    titulo: 'Formação de Professores',
    etapas: [
      {
        titulo: 'Currículo em ação',
        perguntas: [
          { texto: 'Pergunta um', correta: 'B' },
          { texto: 'Pergunta dois', correta: 'B' },
          { texto: 'Pergunta três', correta: 'B' },
        ],
      },
    ],
  })
  await page.goto(`/admin/quizzes/${quiz.id}/stages/${quiz.etapas[0].id}`)

  await perguntasNaTela(page)
    .nth(1)
    .getByRole('button', { name: 'EXCLUIR' })
    .click()

  const perguntas = perguntasNaTela(page)
  await expect(perguntas).toHaveCount(2)
  await expect(perguntas.nth(0)).toContainText('01')
  await expect(perguntas.nth(1)).toContainText('02')
  await expect(perguntas.nth(1)).toContainText('Pergunta três')
})
