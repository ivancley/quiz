/**
 * Verifica a própria bateria, não o produto: se este arquivo falha, nenhum
 * resultado dos demais specs significa alguma coisa.
 *
 * Roda primeiro por ordem alfabética entre os arquivos de tests/e2e/.
 */
import { expect, test } from '@playwright/test'

import { fecharBanco, limparBanco, semearQuiz } from './apoio/banco'

test.afterAll(async () => {
  await fecharBanco()
})

test('a aplicação sob teste responde sem erro de servidor', async ({
  request,
}) => {
  const resposta = await request.get('/')
  // Que ela responde já foi garantido pelo projeto `preparar`. O que se afirma
  // aqui é outra coisa: um 5xx seria a aplicação de pé mas quebrada — quase
  // sempre por não conseguir falar com o banco recém-criado.
  expect(resposta.status()).toBeLessThan(500)
})

test('o banco da bateria está migrado e isolado do desenvolvimento', async () => {
  expect(process.env.DATABASE_URL).toMatch(/_e2e$/)

  await limparBanco()

  const criado = await semearQuiz({
    titulo: 'Sanidade do ambiente',
    etapas: [
      {
        titulo: 'Etapa única',
        perguntas: [
          { texto: 'A bateria consegue escrever no banco?', correta: 'B' },
        ],
      },
    ],
  })

  expect(criado.id).toBeTruthy()
  expect(criado.etapas).toHaveLength(1)
  expect(criado.etapas[0].perguntas[0].correta).toBe('B')

  await limparBanco()
})
