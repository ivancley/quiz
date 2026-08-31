import Link from 'next/link'
import type { ReactNode } from 'react'

import { exigirAdministrador } from '@/server/auth/admin'

import { BotaoSair } from './BotaoSair'
import estilos from './admin.module.css'

/**
 * Tudo que exige estar autenticado mora sob este layout — o login fica fora do
 * grupo, e é por isso que ele não se tranca a si mesmo. Uma tela nova criada
 * aqui dentro nasce protegida sem que ninguém precise lembrar disso.
 */
export default async function LayoutDaArea({
  children,
}: {
  children: ReactNode
}) {
  const { email } = await exigirAdministrador()

  return (
    <div className={estilos.area}>
      <header className={estilos.barra}>
        <Link href="/admin" className={`pixel ${estilos.marca}`}>
          GRAND PRIX
        </Link>
        <div className={estilos.identificacao}>
          <span className={estilos.email}>{email}</span>
          <BotaoSair />
        </div>
      </header>
      <main className={estilos.conteudo}>{children}</main>
    </div>
  )
}
