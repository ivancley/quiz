import { sessaoDeAdminAtual } from '@/server/auth/admin'
import { inscrever } from '@/server/realtime/hub'

// A conexão fica aberta enquanto a sessão durar; não há nada aqui que possa ser
// pré-renderizado, e o registro de inscritos vive na memória do processo Node.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Contexto = { params: Promise<{ sessionId: string }> }

/** Proxies costumam derrubar conexão parada; um comentário periódico segura. */
const PULSO_EM_MS = 15_000

export async function GET(pedido: Request, { params }: Contexto) {
  const { sessionId } = await params

  // O painel do organizador recebe também o que só interessa a ele; quem está
  // no celular recebe apenas as mudanças de rumo da dinâmica.
  //
  // Quem se declara participante recebe o conjunto menor mesmo estando no
  // navegador do organizador — pedir menos nunca precisa de permissão, e sem
  // isso o celular aberto na máquina de quem conduz recarregaria a cada
  // resposta da sala.
  const como = new URL(pedido.url).searchParams.get('como')
  const alvo =
    como !== 'participante' && (await sessaoDeAdminAtual()) ? 'admin' : 'todos'

  const codificador = new TextEncoder()

  const fluxo = new ReadableStream<Uint8Array>({
    start(canal) {
      let aberto = true

      const escrever = (texto: string) => {
        if (!aberto) return
        try {
          canal.enqueue(codificador.encode(texto))
        } catch {
          // A conexão caiu entre a checagem e a escrita; encerrar cuida disso.
          encerrar()
        }
      }

      const cancelarInscricao = inscrever(sessionId, alvo, () =>
        escrever('event: atualizar\ndata: 1\n\n')
      )

      const pulso = setInterval(() => escrever(':\n\n'), PULSO_EM_MS)

      function encerrar() {
        if (!aberto) return
        aberto = false
        clearInterval(pulso)
        cancelarInscricao()
        pedido.signal.removeEventListener('abort', encerrar)
        try {
          canal.close()
        } catch {
          // Já fechado pelo outro lado.
        }
      }

      // Sem isto, cada aba fechada deixaria um inscrito vivo para sempre.
      pedido.signal.addEventListener('abort', encerrar)

      // Aviso imediato na conexão: reconectar passa a ser a mesma coisa que
      // ressincronizar, sem replay de eventos perdidos nem histórico guardado.
      escrever('event: atualizar\ndata: 1\n\n')
    },
  })

  return new Response(fluxo, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      // `no-transform` é o que impede um proxy de comprimir o fluxo. Comprimido,
      // ele chega em blocos, e o evento só aparece muito depois de ter ocorrido.
      'Cache-Control': 'no-cache, no-store, no-transform',
      Connection: 'keep-alive',
      // Desliga o buffer do nginx, que seguraria os eventos pelo mesmo motivo.
      'X-Accel-Buffering': 'no',
    },
  })
}
