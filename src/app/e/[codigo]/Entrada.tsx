'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'

import { BotaoRelevo } from '@/components/BotaoRelevo'
import { Moldura } from '@/components/Moldura'
import { CORES_DE_KART, inicialDoNome } from '@/lib/kart'
import { enviar } from '@/lib/pedidos'
import type { ResumoDoQuiz } from '@/server/estado'

import estilos from './entrada.module.css'

/**
 * A cor definitiva do kart sai do identificador do participante, que só existe
 * depois da entrada. Aqui a prévia mostra a forma e a inicial — a primeira cor
 * da paleta, para o selo não nascer sem cor nenhuma.
 */
const PREVIA_DO_KART = CORES_DE_KART[0]

/**
 * De quanto em quanto tempo a tela pergunta se a sala já abriu.
 *
 * Aqui não há canal de avisos: ele é assinado por sessão, e a sessão é
 * justamente o que ainda não existe. Alguns segundos de espera são o preço de
 * não pedir a ninguém que fique recarregando a página.
 */
const INTERVALO_DE_ESPERA = 3000

type Props = {
  codigo: string
  quiz: ResumoDoQuiz
  salaAberta: boolean
}

export function Entrada({ codigo, quiz, salaAberta }: Props) {
  const router = useRouter()
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [entrando, setEntrando] = useState(false)

  /**
   * O nome de quem escreveu e confirmou antes de a sala abrir.
   *
   * Escanear o QR do cartaz é o primeiro gesto de quem chega, e ele acontece
   * quase sempre antes de o organizador abrir a sessão. Guardar o nome aqui é o
   * que permite à pessoa largar o celular no bolso: a entrada é refeita sozinha
   * na abertura, em vez de depender de ela estar olhando para a tela.
   */
  const [guardado, setGuardado] = useState<string | null>(null)

  const entrar = useCallback(
    async (escolhido: string) => {
      setEntrando(true)
      setErro(null)

      const falha = await enviar(`/api/e/${codigo}/entrar`, 'POST', {
        nome: escolhido,
      })

      if (falha) {
        // O nome guardado pode ter sido tomado por outra pessoa enquanto a sala
        // estava fechada: devolver o formulário é o único caminho de saída.
        setGuardado(null)
        setErro(falha)
        setEntrando(false)
        return
      }

      // O cookie acabou de ser emitido, e é o servidor que decide a tela: navegar
      // sem o refresh reaproveitaria a árvore renderizada antes de haver kart.
      router.replace(`/e/${codigo}/jogo`)
      router.refresh()
    },
    [codigo, router]
  )

  // A espera é um laço de intervalo fixo, e ele não pode se reiniciar a cada
  // tecla digitada no campo do nome. O que ele precisa saber do render atual
  // passa por esta referência, e não pelas dependências do efeito.
  const agora = useRef({ guardado, entrando, entrar })
  useEffect(() => {
    agora.current = { guardado, entrando, entrar }
  })

  useEffect(() => {
    if (salaAberta) return

    const relogio = setInterval(async () => {
      if (agora.current.entrando) return

      const resposta = await fetch(`/api/e/${codigo}/estado`, {
        cache: 'no-store',
      })
      if (!resposta.ok) return

      const { dados } = await resposta.json()
      if (dados.tela === 'sem-sessao') return

      // Quem já confirmou o nome entra sozinho; quem só deixou a tela aberta
      // recebe o mesmo formulário, agora valendo, com o que já tinha digitado.
      if (agora.current.guardado) {
        await agora.current.entrar(agora.current.guardado)
      } else {
        router.refresh()
      }
    }, INTERVALO_DE_ESPERA)

    return () => clearInterval(relogio)
  }, [salaAberta, codigo, router])

  async function confirmar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()

    // Sala fechada não tem sessão em que entrar, e mandar o pedido agora só
    // renderia uma recusa. O nome fica guardado esperando a largada.
    if (!salaAberta) {
      setErro(null)
      setGuardado(nome.trim())
      return
    }

    await entrar(nome)
  }

  return (
    <Moldura fundo="linear-gradient(180deg, var(--superficie) 0%, var(--tela) 55%)">
      <form className={estilos.tela} onSubmit={confirmar}>
        <header className={estilos.cabecalho}>
          <span className={`pixel ${estilos.sobretitulo}`}>
            GRAND PRIX DO CONHECIMENTO
          </span>
          <h1 className={`pixel ${estilos.titulo}`}>{quiz.titulo}</h1>
          <p className={estilos.resumo}>
            {contar(quiz.etapas, 'etapa', 'etapas')} ·{' '}
            {contar(quiz.perguntas, 'pergunta', 'perguntas')}
          </p>
        </header>

        <div className={estilos.previa}>
          <span
            className={`pixel ${estilos.kart}`}
            style={{
              background: PREVIA_DO_KART.fundo,
              color: PREVIA_DO_KART.texto,
              boxShadow: `0 6px 0 ${PREVIA_DO_KART.sombra}`,
            }}
            aria-hidden="true"
          >
            {inicialDoNome(guardado ?? nome)}
          </span>
          <span className={`pixel ${estilos.rotulo}`}>SEU KART</span>
        </div>

        {!salaAberta && !guardado ? (
          <div className={estilos.aviso} role="status">
            <span className={`pixel ${estilos.rotulo}`}>
              SALA AINDA FECHADA
            </span>
            <p className={estilos.recado}>
              Já pode escrever seu nome: a gente guarda seu lugar e você entra
              sozinho assim que o organizador abrir a sala.
            </p>
          </div>
        ) : null}

        {guardado ? (
          <div className={estilos.aguardando} role="status">
            <span className={`pixel ${estilos.rotulo}`}>LUGAR GUARDADO</span>
            <p className={estilos.recado}>
              <strong>{guardado}</strong> entra na corrida assim que a sala
              abrir. Pode deixar esta tela aberta.
            </p>
            <BotaoRelevo
              tom="neutro"
              type="button"
              disabled={entrando}
              onClick={() => setGuardado(null)}
            >
              TROCAR O NOME
            </BotaoRelevo>
          </div>
        ) : (
          <>
            <label className={estilos.campo}>
              <span className={`pixel ${estilos.rotulo}`}>SEU NOME</span>
              <input
                className={estilos.entrada}
                name="nome"
                autoComplete="name"
                autoFocus
                required
                maxLength={40}
                value={nome}
                onChange={(evento) => setNome(evento.target.value)}
              />
              <span className={estilos.dica}>
                Esse nome aparece no ranking da projeção.
              </span>
            </label>

            {erro ? (
              <p className={estilos.erro} role="alert">
                {erro}
              </p>
            ) : null}

            <div className={estilos.rodape}>
              <BotaoRelevo
                type="submit"
                largo
                disabled={entrando || nome.trim() === ''}
              >
                {rotuloDoBotao(salaAberta, entrando)}
              </BotaoRelevo>
              <p className={estilos.legenda}>
                Sem cadastro. Sem instalar nada.
              </p>
            </div>
          </>
        )}
      </form>
    </Moldura>
  )
}

function rotuloDoBotao(salaAberta: boolean, entrando: boolean): string {
  if (entrando) return 'ENTRANDO…'
  return salaAberta ? 'ENTRAR NA CORRIDA' : 'GUARDAR MEU LUGAR'
}

function contar(quantos: number, singular: string, plural: string): string {
  return `${quantos} ${quantos === 1 ? singular : plural}`
}
