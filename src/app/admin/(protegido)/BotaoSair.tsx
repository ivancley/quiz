'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { BotaoRelevo } from '@/components/BotaoRelevo'

export function BotaoSair() {
  const router = useRouter()
  const [saindo, setSaindo] = useState(false)

  async function sair() {
    setSaindo(true)
    await fetch('/api/admin/logout', { method: 'POST' })
    router.replace('/admin/login')
    router.refresh()
  }

  return (
    <BotaoRelevo tom="neutro" onClick={sair} disabled={saindo}>
      SAIR
    </BotaoRelevo>
  )
}
