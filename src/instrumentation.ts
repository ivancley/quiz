import { verificarAmbiente } from '@/server/ambiente'

/**
 * Roda uma vez, quando o servidor sobe, antes de atender qualquer requisição.
 * É onde uma configuração incompleta precisa aparecer: descobrir que falta a
 * chave de assinatura quando o administrador tenta entrar significa descobrir
 * com a sala já sentada.
 */
export function register() {
  verificarAmbiente()
}
