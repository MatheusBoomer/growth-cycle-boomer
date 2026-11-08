import { TabelaModelos } from "@/components/admin/tabela-modelos"

// A configuração vem da API no navegador (sem tocar em dados no servidor): a checagem de admin está no layout e na rota.
export default function PaginaModelos() {
  return <TabelaModelos />
}
