import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Saída autônoma: a imagem de produção roda `node server.js` sem node_modules completo.
  output: 'standalone',
}

export default nextConfig
