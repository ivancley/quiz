/** UC-013 — As bordas da sala: quem chega cedo, quem chega tarde, quem fica. */
import { expect, test } from '@playwright/test'

import { conduzirSessao } from '../apoio/admin'
import {
  abrirSessao,
  finalizarSessaoNoBanco,
  limparBanco,
  participantesDaSessao,
  semearQuiz,
} from '../apoio/banco'
import { desligarCelulares, entrarNaSala, novoCelular } from '../apoio/celular'

test.beforeEach(async () => {
  await limparBanco()
})

test.afterEach(desligarCelulares)

const CERTA = 'Aprendizagens e capacidades para toda a educação básica'

async function quizDeDuasEtapas() {
  return semearQuiz({
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
}

test('escanear antes da sala abrir já pede o nome, e a entrada acontece sozinha', async ({
  page,
}) => {
  const quiz = await quizDeDuasEtapas()

  await page.goto(`/e/${quiz.codigo}`)

  // Escanear o cartaz é o primeiro gesto de quem chega, e ele quase sempre
  // acontece antes de o organizador abrir a sessão: o campo do nome está lá.
  await expect(page.getByText('SALA AINDA FECHADA')).toBeVisible()
  await expect(page.getByLabel('SEU NOME')).toBeVisible()

  await page.getByLabel('SEU NOME').fill('Marina')
  await page.getByRole('button', { name: 'GUARDAR MEU LUGAR' }).click()
  await expect(page.getByText('LUGAR GUARDADO')).toBeVisible()

  // O organizador abre a sessão com a sala já cheia de gente esperando, e
  // ninguém precisa tocar no celular de novo para largar.
  const sessao = await abrirSessao(quiz.id)

  await expect(page).toHaveURL(new RegExp(`/e/${quiz.codigo}/jogo$`))

  const naGrade = await participantesDaSessao(sessao.id)
  expect(naGrade.map((pessoa) => pessoa.nome)).toEqual(['Marina'])
})

test('quem digitou o nome sem confirmar recebe o formulário valendo', async ({
  page,
}) => {
  const quiz = await quizDeDuasEtapas()

  await page.goto(`/e/${quiz.codigo}`)
  await page.getByLabel('SEU NOME').fill('Rafael')

  await abrirSessao(quiz.id)

  // A tela troca sozinha sem cobrar que ele digite o nome de novo.
  await expect(
    page.getByRole('button', { name: 'ENTRAR NA CORRIDA' })
  ).toBeVisible()
  await expect(page.getByText('SALA AINDA FECHADA')).toHaveCount(0)
  await expect(page.getByLabel('SEU NOME')).toHaveValue('Rafael')

  await page.getByRole('button', { name: 'ENTRAR NA CORRIDA' }).click()
  await expect(page).toHaveURL(new RegExp(`/e/${quiz.codigo}/jogo$`))
})

test('quem chega no meio da etapa participa dela, sem pontos do que já passou', async ({
  page,
  browser,
}) => {
  const quiz = await quizDeDuasEtapas()
  const sessao = await abrirSessao(quiz.id)

  // Marina joga a primeira etapa inteira e a etapa encerra.
  await entrarNaSala(page, quiz.codigo, 'Marina')
  await conduzirSessao(browser, sessao.id, {
    acao: 'abrir-etapa',
    etapaId: quiz.etapas[0].id,
  })
  await page.getByRole('button', { name: CERTA }).click()
  await expect(page.getByText('ETAPA 1 · VOLTA 2/2')).toBeVisible()
  await page.getByRole('button', { name: CERTA }).click()
  await expect(page.getByText('PONTOS DESTA ETAPA')).toBeVisible()

  // Rafael chega agora, e a segunda etapa abre com ele já na sala.
  const doRafael = await novoCelular(browser)
  await entrarNaSala(doRafael, quiz.codigo, 'Rafael')
  await conduzirSessao(browser, sessao.id, {
    acao: 'abrir-etapa',
    etapaId: quiz.etapas[1].id,
  })

  await expect(doRafael.getByText('ETAPA 2 · VOLTA 1/1')).toBeVisible()
  await expect(doRafael.getByText('0 PTS')).toBeVisible()

  await doRafael.getByRole('button', { name: CERTA }).click()

  // Os 4 pontos da etapa que ele jogou, e nada da etapa que perdeu.
  await expect(doRafael.getByText('PONTOS DESTA ETAPA')).toBeVisible()
  await expect(
    doRafael.getByText('1 acerto · 3 de bônus de velocidade')
  ).toBeVisible()
})

test('entrar com a etapa já aberta cai direto na pergunta', async ({
  page,
  browser,
}) => {
  const quiz = await quizDeDuasEtapas()
  const sessao = await abrirSessao(quiz.id)

  await conduzirSessao(browser, sessao.id, {
    acao: 'abrir-etapa',
    etapaId: quiz.etapas[0].id,
  })

  await entrarNaSala(page, quiz.codigo, 'Atrasado')

  await expect(page.getByText('ETAPA 1 · VOLTA 1/2')).toBeVisible()
})

test('a etapa encerrada com a pessoa no meio da pergunta a leva ao resultado', async ({
  page,
  browser,
}) => {
  const quiz = await quizDeDuasEtapas()
  const sessao = await abrirSessao(quiz.id)

  await entrarNaSala(page, quiz.codigo, 'Marina')
  await conduzirSessao(browser, sessao.id, {
    acao: 'abrir-etapa',
    etapaId: quiz.etapas[0].id,
  })

  // Responde a primeira e fica parada na segunda.
  await page.getByRole('button', { name: CERTA }).click()
  await expect(page.getByText('ETAPA 1 · VOLTA 2/2')).toBeVisible()

  // O organizador decide que a volta acabou, faltando resposta.
  await conduzirSessao(browser, sessao.id, { acao: 'encerrar-etapa' })

  await expect(page.getByText('ETAPA 1 ENCERRADA')).toBeVisible()
  await expect(page.getByText('PONTOS DESTA ETAPA')).toBeVisible()
  await expect(
    page.getByText('1 acerto · 3 de bônus de velocidade')
  ).toBeVisible()
})

test('a bandeirada final deixa o celular no resultado, e não numa tela de erro', async ({
  page,
  browser,
}) => {
  const quiz = await quizDeDuasEtapas()
  const sessao = await abrirSessao(quiz.id)

  await entrarNaSala(page, quiz.codigo, 'Marina')
  await conduzirSessao(browser, sessao.id, {
    acao: 'abrir-etapa',
    etapaId: quiz.etapas[0].id,
  })
  await page.getByRole('button', { name: CERTA }).click()
  await expect(page.getByText('ETAPA 1 · VOLTA 2/2')).toBeVisible()

  await conduzirSessao(browser, sessao.id, { acao: 'finalizar' })

  await expect(page.getByText('BANDEIRADA FINAL')).toBeVisible()
  await expect(page.getByText('SUA POSIÇÃO')).toBeVisible()
  await expect(page.getByText('1º')).toBeVisible()

  // E continua ali depois de recarregar: o resultado não é uma tela de passagem.
  await page.reload()
  await expect(page.getByText('BANDEIRADA FINAL')).toBeVisible()
})

test('o cookie de uma turma anterior devolve à porta de entrada', async ({
  page,
  browser,
}) => {
  const quiz = await quizDeDuasEtapas()
  const daManha = await abrirSessao(quiz.id)

  await entrarNaSala(page, quiz.codigo, 'Marina')
  await conduzirSessao(browser, daManha.id, { acao: 'finalizar' })
  await expect(page.getByText('BANDEIRADA FINAL')).toBeVisible()

  // À tarde, outra turma. O kart da manhã não vale mais, e quem escanear o QR
  // de novo — com o cookie da manhã ainda no navegador — precisa de outro.
  await abrirSessao(quiz.id)
  await page.goto(`/e/${quiz.codigo}`)

  await expect(page).toHaveURL(new RegExp(`/e/${quiz.codigo}$`))
  await expect(page.getByLabel('SEU NOME')).toBeVisible()

  // E o nome da manhã está livre de novo: a unicidade é da sessão, não do quiz.
  await entrarNaSala(page, quiz.codigo, 'Marina')
  await expect(
    page.getByRole('heading', { name: 'Aguardando a largada' })
  ).toBeVisible()
})

test('o cookie de uma sessão que não existe mais devolve à porta de entrada', async ({
  page,
}) => {
  const quiz = await quizDeDuasEtapas()
  const sessao = await abrirSessao(quiz.id)
  await entrarNaSala(page, quiz.codigo, 'Marina')

  // A sessão some do banco sem que ninguém avise o celular.
  await finalizarSessaoNoBanco(sessao.id)
  await limparBanco()
  await semearQuiz({
    codigo: quiz.codigo,
    titulo: 'Formação de Professores',
    etapas: [
      {
        titulo: 'Currículo em ação',
        perguntas: [{ texto: 'Uma pergunta qualquer', correta: 'B' }],
      },
    ],
  })

  await page.goto(`/e/${quiz.codigo}`)

  await expect(page.getByText('SALA AINDA FECHADA')).toBeVisible()
})
