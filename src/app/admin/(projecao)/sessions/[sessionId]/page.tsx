import { notFound } from 'next/navigation'

import { estadoDoPainel } from '@/server/estado'

import { Painel } from './Painel'

export const dynamic = 'force-dynamic'

export default async function PaginaDoPainel({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await params
  const inicial = await estadoDoPainel(sessionId)
  if (!inicial) notFound()

  // O estado já vem montado do servidor: a tela é projetada, e um piscar de
  // "carregando" na parede é justamente o que não pode acontecer.
  return <Painel sessaoId={sessionId} inicial={inicial} />
}
