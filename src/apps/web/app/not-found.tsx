import Link from "next/link"
import { Button } from "@workspace/ui/components/button"
import { PaginaErro } from "@/components/sistema/pagina-erro"

export default function NaoEncontrada() {
  return (
    <PaginaErro
      codigo="404"
      titulo="Esta página"
      destaque="não existe"
      acoes={
        <Button render={<Link href="/" />} nativeButton={false}>
          Voltar aos prospects
        </Button>
      }
    >
      O endereço pode ter mudado ou o prospect foi excluído.
    </PaginaErro>
  )
}
