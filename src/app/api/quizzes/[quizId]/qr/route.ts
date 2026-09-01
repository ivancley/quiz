import { buscarQuiz } from '@/server/acoes'
import { sessaoDeAdminAtual } from '@/server/auth/admin'
import { qrEmPng } from '@/server/qr'

type Contexto = { params: Promise<{ quizId: string }> }

/** O QR como arquivo, para colar em slide, cartaz ou convite. */
export async function GET(_pedido: Request, { params }: Contexto) {
  // Esta rota devolve bytes, e não JSON, então trata a recusa por conta própria
  // em vez de passar pela ponte que embrulha as ações.
  if (!(await sessaoDeAdminAtual())) {
    return new Response('Entre como administrador para continuar.', {
      status: 401,
    })
  }

  const { quizId } = await params
  const quiz = await buscarQuiz(quizId)
  if (!quiz) return new Response('Quiz não encontrado.', { status: 404 })

  const imagem = await qrEmPng(quiz.codigo)

  return new Response(new Uint8Array(imagem), {
    headers: {
      'Content-Type': 'image/png',
      // O nome do arquivo carrega o código: baixados dois QRs, dá para saber
      // qual é qual sem abrir os dois.
      'Content-Disposition': `attachment; filename="quiz-${quiz.codigo}.png"`,
      'Cache-Control': 'no-store',
    },
  })
}
