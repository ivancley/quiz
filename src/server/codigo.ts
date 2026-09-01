import { randomInt } from 'node:crypto'

/**
 * O código de entrada do quiz é lido de um telão e, quando o QR falha, digitado
 * à mão num celular. Por isso o alfabeto exclui os pares que se confundem em
 * fonte pixel — O/0, I/1/L — e o código é sorteado, nunca sequencial: um código
 * previsível deixaria qualquer pessoa entrar num quiz que não é o dela.
 */

const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const COMPRIMENTO = 6

export function sortearCodigoDeQuiz(): string {
  let codigo = ''
  for (let i = 0; i < COMPRIMENTO; i += 1) {
    codigo += ALFABETO[randomInt(ALFABETO.length)]
  }
  return codigo
}
