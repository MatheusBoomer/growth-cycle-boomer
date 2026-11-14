import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/ui", "@workspace/core"],
  // `trash` chama um binário do macOS pelo caminho do próprio pacote: não pode ser empacotado.
  serverExternalPackages: ["trash"],
  experimental: {
    // O proxy (proxy.ts) passa adiante só os primeiros 10 MB do corpo por padrão, cortando o resto em silêncio. Um report
    // leva print + 3 imagens de 5 MB: 21 MB = LIMITE_CORPO_REPORT_BYTES de @workspace/core/reports.
    proxyClientMaxBodySize: "21mb",
  },
}

export default nextConfig
