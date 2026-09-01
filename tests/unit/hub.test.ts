import { describe, expect, it } from 'vitest'

import { inscrever, publicar, quantosOuvindo } from '@/server/realtime/hub'

/** Um ouvinte que só conta quantas vezes foi avisado. */
function ouvinte() {
  const registro = { avisos: 0 }
  return {
    registro,
    avisar: () => {
      registro.avisos += 1
    },
  }
}

describe('avisos de uma sessão', () => {
  it('alcança todos os que estão ouvindo aquela sessão', () => {
    const um = ouvinte()
    const outro = ouvinte()
    const cancelarUm = inscrever('sessao-1', 'todos', um.avisar)
    const cancelarOutro = inscrever('sessao-1', 'todos', outro.avisar)

    publicar('sessao-1', 'todos')

    expect(um.registro.avisos).toBe(1)
    expect(outro.registro.avisos).toBe(1)

    cancelarUm()
    cancelarOutro()
  })

  it('não alcança quem está ouvindo outra sessão', () => {
    const daSala = ouvinte()
    const deOutraSala = ouvinte()
    const cancelarUm = inscrever('sessao-1', 'todos', daSala.avisar)
    const cancelarOutro = inscrever('sessao-2', 'todos', deOutraSala.avisar)

    publicar('sessao-1', 'todos')

    expect(daSala.registro.avisos).toBe(1)
    expect(deOutraSala.registro.avisos).toBe(0)

    cancelarUm()
    cancelarOutro()
  })

  it('não quebra quando ninguém está ouvindo', () => {
    expect(() => publicar('sessao-deserta', 'todos')).not.toThrow()
  })
})

describe('alvo do aviso', () => {
  it('manda só ao painel o que só interessa ao painel', () => {
    const painel = ouvinte()
    const celular = ouvinte()
    const cancelarPainel = inscrever('sessao-3', 'admin', painel.avisar)
    const cancelarCelular = inscrever('sessao-3', 'todos', celular.avisar)

    // Alguém respondeu: muda o placar do painel, não a tela de quem respondeu.
    publicar('sessao-3', 'admin')

    expect(painel.registro.avisos).toBe(1)
    expect(celular.registro.avisos).toBe(0)

    cancelarPainel()
    cancelarCelular()
  })

  it('manda a todos, painel incluído, o que muda o rumo da dinâmica', () => {
    const painel = ouvinte()
    const celular = ouvinte()
    const cancelarPainel = inscrever('sessao-4', 'admin', painel.avisar)
    const cancelarCelular = inscrever('sessao-4', 'todos', celular.avisar)

    // A etapa abriu: todo mundo troca de tela.
    publicar('sessao-4', 'todos')

    expect(painel.registro.avisos).toBe(1)
    expect(celular.registro.avisos).toBe(1)

    cancelarPainel()
    cancelarCelular()
  })
})

describe('saída de quem estava ouvindo', () => {
  it('para de avisar quem cancelou', () => {
    const quemFica = ouvinte()
    const quemSai = ouvinte()
    const cancelarQuemFica = inscrever('sessao-5', 'todos', quemFica.avisar)
    const cancelarQuemSai = inscrever('sessao-5', 'todos', quemSai.avisar)

    cancelarQuemSai()
    publicar('sessao-5', 'todos')

    expect(quemSai.registro.avisos).toBe(0)
    // Fechar uma aba não pode afetar as outras.
    expect(quemFica.registro.avisos).toBe(1)

    cancelarQuemFica()
  })

  it('não deixa a sessão vazia no registro depois que o último sai', () => {
    const cancelar = inscrever('sessao-6', 'todos', () => {})
    expect(quantosOuvindo('sessao-6')).toBe(1)

    cancelar()

    expect(quantosOuvindo('sessao-6')).toBe(0)
  })

  it('aguenta cancelar duas vezes', () => {
    const cancelar = inscrever('sessao-7', 'todos', () => {})

    cancelar()

    expect(() => cancelar()).not.toThrow()
  })

  it('não deixa um ouvinte quebrado calar os outros', () => {
    const saudavel = ouvinte()
    const cancelarQuebrado = inscrever('sessao-8', 'todos', () => {
      throw new Error('conexão já morreu')
    })
    const cancelarSaudavel = inscrever('sessao-8', 'todos', saudavel.avisar)

    publicar('sessao-8', 'todos')

    expect(saudavel.registro.avisos).toBe(1)

    cancelarQuebrado()
    cancelarSaudavel()
  })
})
