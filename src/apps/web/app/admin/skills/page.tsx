import { CatalogoSkills } from "@/components/admin/catalogo-skills"

// O catálogo vem da API no navegador (sem tocar em dados no servidor): a checagem de admin está no layout e na rota.
export default function PaginaSkills() {
  return <CatalogoSkills />
}
