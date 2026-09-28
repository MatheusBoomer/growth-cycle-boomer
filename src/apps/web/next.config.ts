import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/ui", "@workspace/core"],
  // `trash` chama um binário do macOS pelo caminho do próprio pacote: não pode ser empacotado.
  serverExternalPackages: ["trash"],
}

export default nextConfig
