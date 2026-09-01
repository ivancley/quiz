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

test('o placar final mostra pódio e tabela de uma sessão encerrada', async ({
  page,
}) => {
  const quiz = await semearQuiz({
    titulo: 'Formação de Professores',
    etapas: [
      {
        titulo: 'Currículo em ação',
        perguntas: [
          { texto: 'O que as competências gerais descrevem?', correta: 'B' },
        ],
      },
    ],
  })
  const pergunta = quiz.etapas[0].perguntas[0]
  const sessao = await abrirSessao(quiz.id)

  // A ordem de acerto define o pódio: 4, 3 e 2 pontos. Bruno erra e fica com 0.
  const marina = await entrarNaSessao(sessao.id, 'Marina')
  const rafael = await entrarNaSessao(sessao.id, 'Rafael')
  const juliana = await entrarNaSessao(sessao.id, 'Juliana')
  const bruno = await entrarNaSessao(sessao.id, 'Bruno')

  await responder(marina.id, pergunta.id, 'B')
  await responder(rafael.id, pergunta.id, 'B')
  await responder(juliana.id, pergunta.id, 'B')
  await responder(bruno.id, pergunta.id, 'A')

  await entrarComoAdmin(page)
  await page.request.patch(`/api/sessions/${sessao.id}`, {
    data: { acao: 'finalizar' },
  })

  await page.goto(`/admin/sessions/${sessao.id}/final`)

  await expect(page.getByText('BANDEIRADA FINAL')).toBeVisible()

  const podio = page.getByRole('region', { name: 'Pódio' })
  await expect(podio).toContainText('Marina')
  await expect(podio).toContainText('4 PTS')
  await expect(podio).toContainText('1º')

  const linhas = page.getByRole('row')
  // Cabeçalho e quatro participantes, na ordem da classificação.
  await expect(linhas).toHaveCount(5)
  await expect(linhas.nth(1)).toContainText('Marina')
  await expect(linhas.nth(2)).toContainText('Rafael')
  await expect(linhas.nth(3)).toContainText('Juliana')
  await expect(linhas.nth(4)).toContainText('Bruno')

  // Quem errou continua na tabela, com tudo zerado.
  await expect(linhas.nth(4)).toContainText('0')
})

test('o placar final é alcançado pela lista de sessões realizadas', async ({
  page,
}) => {
  const quiz = await semearQuiz({
    titulo: 'Formação de Professores',
    etapas: [
      { titulo: 'Etapa única', perguntas: [{ texto: 'Vale?', correta: 'B' }] },
    ],
  })
  const sessao = await abrirSessao(quiz.id)
  await entrarNaSessao(sessao.id, 'Marina')

  await entrarComoAdmin(page)
  await page.request.patch(`/api/sessions/${sessao.id}`, {
    data: { acao: 'finalizar' },
  })

  await page.goto(`/admin/quizzes/${quiz.id}`)
  await page.getByRole('link', { name: 'VER PLACAR →' }).click()

  await expect(page.getByText('BANDEIRADA FINAL')).toBeVisible()
  // O nome aparece no pódio e na tabela; a célula é o alvo sem ambiguidade.
  await expect(page.getByRole('cell', { name: 'Marina' })).toBeVisible()
})
