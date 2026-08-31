import estilos from './admin.module.css'

export default function Inicio() {
  return (
    <section className={estilos.abertura}>
      <h1 className={`pixel ${estilos.titulo}`}>Seus quizzes</h1>
      <p className={estilos.explicacao}>
        Aqui ficam os quizzes que você monta e as sessões que conduz com cada
        turma.
      </p>
    </section>
  )
}
