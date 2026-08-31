import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Saída autônoma: a imagem de produção roda `node server.js` sem node_modules completo.
  output: 'standalone',

  // A bateria ponta a ponta sobe uma segunda aplicação enquanto o `next dev` do
  // dia a dia continua no ar. Dois servidores de desenvolvimento compartilhando
  // `.next` apagam o diretório um do outro e passam a reiniciar em laço, então
  // a bateria recebe o seu próprio via NEXT_DIST_DIR.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
}

export default nextConfig
