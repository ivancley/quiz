import { BotaoRelevo } from '@/components/BotaoRelevo'
import { Kart } from '@/components/Kart'
import { CORES_DE_KART } from '@/lib/kart'

import estilos from './estilo.module.css'

/**
 * Mostruário do tema: serve para conferir cor, relevo e tipografia num lugar só,
 * sem precisar montar uma sessão inteira.
 */
export default function Estilo() {
  const nomes = [
    'Marina Alves',
    'Rafael Costa',
    'Juliana Reis',
    'Bruno Lima',
    'Ângela Souza',
    'Carla Dias',
    'Diego Nunes',
    'Elisa Prado',
  ]

  return (
    <main className={estilos.pagina}>
      <header className={estilos.cabecalho}>
        <span className={`pixel ${estilos.sobretitulo}`}>
          GRAND PRIX DO CONHECIMENTO
        </span>
        <h1 className={`pixel ${estilos.titulo}`}>Tema da plataforma</h1>
      </header>

      <section className={estilos.secao}>
        <h2 className={`pixel ${estilos.rotulo}`}>KARTS</h2>
        <div className={estilos.linha}>
          {nomes.map((nome, i) => (
            <Kart key={nome} participanteId={`kart-${i}`} nome={nome} tamanho="grande" />
          ))}
        </div>
        <div className={estilos.linha}>
          <Kart participanteId="kart-0" nome="Marina" tamanho="pequeno" />
          <Kart participanteId="kart-1" nome="Rafael" tamanho="medio" />
          <Kart participanteId="kart-2" nome="Juliana" tamanho="grande" />
          <Kart participanteId="kart-0" nome="Campeã" tamanho="enorme" destacado />
        </div>
      </section>

      <section className={estilos.secao}>
        <h2 className={`pixel ${estilos.rotulo}`}>BOTÕES</h2>
        <div className={estilos.linha}>
          <BotaoRelevo tom="verde">ENTRAR NA CORRIDA</BotaoRelevo>
          <BotaoRelevo tom="vermelho">ENCERRAR ETAPA</BotaoRelevo>
          <BotaoRelevo tom="azul">INICIAR SESSÃO</BotaoRelevo>
          <BotaoRelevo tom="amarelo">PROJETAR QR</BotaoRelevo>
          <BotaoRelevo tom="neutro">EXPORTAR</BotaoRelevo>
          <BotaoRelevo disabled>INICIAR ETAPA 3</BotaoRelevo>
        </div>
      </section>

      <section className={estilos.secao}>
        <h2 className={`pixel ${estilos.rotulo}`}>PALETA</h2>
        <div className={estilos.linha}>
          {CORES_DE_KART.map((cor) => (
            <span
              key={cor.fundo}
              className={estilos.amostra}
              style={{ background: cor.fundo, boxShadow: `0 4px 0 ${cor.sombra}` }}
            />
          ))}
        </div>
      </section>

      <section className={estilos.secao}>
        <h2 className={`pixel ${estilos.rotulo}`}>TIPOGRAFIA</h2>
        <p className={estilos.corpo}>
          Na BNCC, o que as competências gerais descrevem? O corpo usa a fonte de
          leitura; rótulos, números e títulos curtos usam a pixel.
        </p>
        <p className={`pixel ${estilos.numero}`}>54 PTS</p>
      </section>
    </main>
  )
}
