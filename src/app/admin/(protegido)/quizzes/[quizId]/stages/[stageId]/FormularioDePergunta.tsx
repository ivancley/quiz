'use client'

import { useState, type FormEvent } from 'react'

import { BotaoRelevo } from '@/components/BotaoRelevo'

import estilos from './etapa.module.css'

export const LETRAS = ['A', 'B', 'C', 'D'] as const
export type Letra = (typeof LETRAS)[number]

export type Rascunho = {
  texto: string
  altA: string
  altB: string
  altC: string
  altD: string
  correta: Letra
}

export const RASCUNHO_VAZIO: Rascunho = {
  texto: '',
  altA: '',
  altB: '',
  altC: '',
  altD: '',
  correta: 'A',
}

const CAMPO_DA_LETRA = {
  A: 'altA',
  B: 'altB',
  C: 'altC',
  D: 'altD',
} as const satisfies Record<Letra, keyof Rascunho>

type Props = {
  valorInicial: Rascunho
  rotuloDeEnvio: string
  ocupado: boolean
  aoEnviar: (rascunho: Rascunho) => Promise<void>
  aoCancelar?: () => void
}

export function FormularioDePergunta({
  valorInicial,
  rotuloDeEnvio,
  ocupado,
  aoEnviar,
  aoCancelar,
}: Props) {
  const [rascunho, setRascunho] = useState(valorInicial)

  function alterar(campo: keyof Rascunho, valor: string) {
    setRascunho((atual) => ({ ...atual, [campo]: valor }))
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    await aoEnviar(rascunho)
  }

  return (
    <form className={estilos.formulario} onSubmit={enviar}>
      <label className={estilos.campo}>
        <span className={`pixel ${estilos.rotulo}`}>ENUNCIADO</span>
        <textarea
          className={estilos.enunciado}
          value={rascunho.texto}
          onChange={(e) => alterar('texto', e.target.value)}
          rows={3}
          required
        />
      </label>

      <fieldset className={estilos.alternativas}>
        <legend className={`pixel ${estilos.rotulo}`}>
          ALTERNATIVAS — MARQUE A CORRETA
        </legend>

        {LETRAS.map((letra) => {
          const correta = rascunho.correta === letra
          return (
            <label
              key={letra}
              className={`${estilos.alternativa} ${correta ? estilos.correta : ''}`}
            >
              <input
                type="radio"
                name="correta"
                className={estilos.marcador}
                checked={correta}
                onChange={() => alterar('correta', letra)}
                aria-label={`Marcar a alternativa ${letra} como correta`}
              />
              <span className={`pixel ${estilos.letra}`}>{letra}</span>
              <input
                className={estilos.entrada}
                value={rascunho[CAMPO_DA_LETRA[letra]]}
                onChange={(e) => alterar(CAMPO_DA_LETRA[letra], e.target.value)}
                placeholder={`Alternativa ${letra}`}
                required
              />
            </label>
          )
        })}
      </fieldset>

      <div className={estilos.acoesDoFormulario}>
        <BotaoRelevo type="submit" tom="verde" disabled={ocupado}>
          {rotuloDeEnvio}
        </BotaoRelevo>
        {aoCancelar ? (
          <BotaoRelevo tom="neutro" onClick={aoCancelar}>
            CANCELAR
          </BotaoRelevo>
        ) : null}
      </div>
    </form>
  )
}
