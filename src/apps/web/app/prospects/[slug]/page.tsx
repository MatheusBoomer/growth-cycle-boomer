import { AreaDeTrabalho } from "@/components/trabalho/area-de-trabalho"

export const dynamic = "force-dynamic"

export default async function Pagina(props: PageProps<"/prospects/[slug]">) {
  const { slug } = await props.params
  return <AreaDeTrabalho slug={slug} />
}
