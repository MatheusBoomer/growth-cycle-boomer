import { PainelReports } from "@/components/admin/reports/painel-reports"

// Os reports vêm da API no navegador (sem tocar em dados no servidor): a checagem de admin está no layout e nas rotas.
export default function PaginaReports() {
  return <PainelReports />
}
