import { LETRAS, type Letra, type Pergunta } from '@/server/db/schema'

/**
 * O único ponto do sistema em que uma pergunta do banco vira uma pergunta para
 * o celular.
 *
 * A linha do banco carrega o gabarito; o que sai daqui não carrega. Toda rota
 * do participante devolve apenas o que passou por esta função, e é essa regra —
 * um ponto de passagem só — que torna o vazamento do gabarito verificável em
 * vez de uma promessa espalhada por dezenas de arquivos.
 *
 * Os campos são nomeados um a um, deliberadamente. Espalhar a linha inteira com
 * `...` funcionaria hoje e vazaria `correta` no dia em que alguém acrescentasse
 * uma coluna — o tipo de erro que passa despercebido numa revisão de diff.
 */

export type Alternativa = {
  letra: Letra
  texto: string
}

export type PerguntaEmJogo = {
  id: string
  posicao: number
  texto: string
  alternativas: Alternativa[]
}

export function perguntaEmJogo(linha: Pergunta): PerguntaEmJogo {
  const textos: Record<Letra, string> = {
    A: linha.altA,
    B: linha.altB,
    C: linha.altC,
    D: linha.altD,
  }

  return {
    id: linha.id,
    posicao: linha.posicao,
    texto: linha.texto,
    // Na ordem cadastrada, sem embaralhar: é o que mantém a tela do celular
    // conferindo com a projeção que o organizador tem na frente.
    alternativas: LETRAS.map((letra) => ({ letra, texto: textos[letra] })),
  }
}
