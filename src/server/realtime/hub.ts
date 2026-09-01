/**
 * Quem está ouvindo cada sessão, e como avisá-los de que algo mudou.
 *
 * Existe um aviso só: "atualizar". Ele não carrega o que mudou — quem recebe
 * refaz a consulta do próprio estado. Isso elimina de uma vez a classe de bug
 * em que o que trafega e o que é verdade divergem, e faz de reconectar a mesma
 * coisa que ressincronizar.
 *
 * O registro vive na memória do processo. Isso só está correto com **uma única
 * réplica** da aplicação: com duas, cada uma conheceria metade da sala e a
 * outra metade nunca receberia aviso nenhum — sem erro visível.
 */

/**
 * Para quem o aviso interessa.
 *
 * `todos` são as mudanças de rumo da dinâmica — abrir etapa, encerrar etapa,
 * bandeirada final —, poucas por sessão. `admin` é o resto: alguém entrou,
 * alguém respondeu. Sem essa separação, cinquenta respostas virariam cinquenta
 * avisos vezes cinquenta celulares, e a sala inteira recarregaria à toa.
 */
export type Alvo = 'todos' | 'admin'

export type Aviso = () => void

type Inscrito = {
  alvo: Alvo
  avisar: Aviso
}

type Registro = Map<string, Set<Inscrito>>

// Em desenvolvimento o módulo é recarregado a cada edição. Sem guardar o
// registro fora dele, cada recarregamento criaria um Map novo e os inscritos
// que já estavam conectados deixariam de ser encontrados — a tela pararia de
// atualizar sem nenhum erro aparecer.
const global_ = globalThis as unknown as { inscritosDoQuiz?: Registro }
const porSessao: Registro = (global_.inscritosDoQuiz ??= new Map())

/**
 * Registra quem quer ser avisado e devolve a função que cancela a inscrição.
 * Chamar o cancelamento é obrigatório quando a conexão cai: um inscrito
 * esquecido segura a referência para sempre.
 */
export function inscrever(
  sessaoId: string,
  alvo: Alvo,
  avisar: Aviso
): () => void {
  const inscrito: Inscrito = { alvo, avisar }
  const daSessao = porSessao.get(sessaoId) ?? new Set<Inscrito>()
  daSessao.add(inscrito)
  porSessao.set(sessaoId, daSessao)

  return () => {
    daSessao.delete(inscrito)
    // Sessão sem ninguém ouvindo sai do registro: um quiz rodado cem vezes não
    // deixa cem conjuntos vazios para trás.
    if (daSessao.size === 0) porSessao.delete(sessaoId)
  }
}

/**
 * Avisa quem está ouvindo aquela sessão. Um aviso `admin` chega só ao painel;
 * um aviso `todos` chega a todo mundo, painel incluído.
 */
export function publicar(sessaoId: string, alvo: Alvo): void {
  const daSessao = porSessao.get(sessaoId)
  if (!daSessao) return

  for (const inscrito of daSessao) {
    if (alvo === 'todos' || inscrito.alvo === 'admin') {
      // Uma conexão que já morreu não pode derrubar o aviso das outras.
      try {
        inscrito.avisar()
      } catch {
        // A limpeza é feita pelo cancelamento da própria conexão.
      }
    }
  }
}

/** Quantos estão ouvindo aquela sessão. Existe para os testes e o diagnóstico. */
export function quantosOuvindo(sessaoId: string): number {
  return porSessao.get(sessaoId)?.size ?? 0
}
