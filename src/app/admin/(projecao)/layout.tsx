import type { ReactNode } from 'react'

import { exigirAdministrador } from '@/server/auth/admin'

/**
 * As telas deste grupo vão para o projetor, à vista da sala inteira. Elas são
 * protegidas como o resto da área do organizador, mas não herdam a barra com o
 * e-mail e o botão de sair: nada disso deve aparecer na parede.
 */
export default async function LayoutDeProjecao({
  children,
}: {
  children: ReactNode
}) {
  await exigirAdministrador()
  return children
}
