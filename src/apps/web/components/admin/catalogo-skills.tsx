"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { ID_VISAO_GERAL } from "@workspace/core/catalogo-skills-tipos"
import type { NotaSkill } from "@workspace/core/notas-skills"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@workspace/ui/components/sheet"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import { Markdown } from "@/components/markdown"
import { api, mensagemDeErro, type CatalogoSkills as DadosCatalogo, type DetalheItemSkill, type ItemSkill } from "@/lib/api"
import { agruparPorGrupo, semFrontmatter } from "@/lib/catalogo-skills-tela"
import { Fluxograma } from "./fluxograma"
import { NotasSkill } from "./notas-skill"

const LEGENDA = "Laranja: aprovação do analista · Azul: subagente · Verde: entrega"

/** Subagentes e SKILL.md de etapa começam com um bloco YAML, que não deve aparecer no texto. */
function textoParaExibir(detalhe: DetalheItemSkill): string | null {
  return detalhe.texto === null ? null : semFrontmatter(detalhe.texto)
}

function ListaItens({ itens, selecionado, escolher }: { itens: ItemSkill[]; selecionado: string; escolher: (id: string) => void }) {
  return (
    <nav aria-label="Itens do catálogo" className="flex flex-col gap-4">
      {agruparPorGrupo(itens).map(({ grupo, itens: doGrupo }) => (
        <div key={grupo} className="flex flex-col gap-1">
          <h2 className="text-muted-foreground px-2 text-[11px] font-medium tracking-[0.14em] uppercase">{grupo}</h2>
          {doGrupo.map((i) => (
            <button
              key={i.id}
              type="button"
              aria-current={i.id === selecionado ? "true" : undefined}
              onClick={() => escolher(i.id)}
              className={cn(
                "focus-visible:ring-ring/50 flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm outline-none focus-visible:ring-3",
                i.id === selecionado ? "bg-accent text-foreground font-medium" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
            >
              <span className="min-w-0 truncate">{i.titulo}</span>
              {i.notasAbertas > 0 && (
                <span aria-label={`${i.notasAbertas} notas abertas`} className="bg-aviso-fundo text-aviso shrink-0 rounded-md px-1.5 text-xs font-semibold tabular-nums">
                  {i.notasAbertas}
                </span>
              )}
            </button>
          ))}
        </div>
      ))}
    </nav>
  )
}

/** Aba "Skills": lista do catálogo, fluxograma e texto de cada item, e as notas de melhoria. */
export function CatalogoSkills() {
  const [catalogo, setCatalogo] = useState<DadosCatalogo | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [selecionado, setSelecionado] = useState(ID_VISAO_GERAL)
  const [detalhe, setDetalhe] = useState<DetalheItemSkill | null>(null)
  const [erroDetalhe, setErroDetalhe] = useState<string | null>(null)
  const [textoAberto, setTextoAberto] = useState(false)
  // Verdadeiro quando uma escrita voltou com o 400 do modo fs (rede de segurança além do `notasDisponiveis` do servidor).
  const [semNuvemNaEscrita, setSemNuvemNaEscrita] = useState(false)

  const carregarCatalogo = useCallback(async () => {
    try {
      setCatalogo(await api.itensSkills())
      setErro(null)
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }, [])

  useEffect(() => {
    void carregarCatalogo()
  }, [carregarCatalogo])

  useEffect(() => {
    let cancelado = false
    api
      .itemSkill(selecionado)
      .then((d) => {
        if (!cancelado) setDetalhe(d)
      })
      .catch((e: unknown) => {
        if (!cancelado) setErroDetalhe(mensagemDeErro(e))
      })
    return () => {
      cancelado = true
    }
  }, [selecionado])

  function escolher(id: string) {
    if (id === selecionado) return
    setDetalhe(null)
    setErroDetalhe(null)
    setSelecionado(id)
  }

  function copiarNotas() {
    if (!catalogo) return
    // Síncrono dentro do clique: o Safari recusa a escrita na área de transferência depois de um await (perde a ativação
    // do usuário). O catálogo já é recarregado a cada nota criada, resolvida ou reaberta, então o texto está em dia.
    try {
      navigator.clipboard.writeText(catalogo.textoExportacao).then(
        () => toast.success("Notas copiadas."),
        () => toast.error("Não foi possível copiar."),
      )
    } catch {
      toast.error("Não foi possível copiar.")
    }
    // Atualiza em segundo plano, para o próximo clique pegar notas que outras pessoas tenham mexido.
    void carregarCatalogo()
  }

  function notaCriada(nota: NotaSkill) {
    setDetalhe((d) => (d === null ? d : { ...d, notas: [nota, ...d.notas] }))
    void carregarCatalogo()
  }

  function notaAtualizada(nota: NotaSkill) {
    setDetalhe((d) => (d === null ? d : { ...d, notas: d.notas.map((n) => (n.id === nota.id ? nota : n)) }))
    void carregarCatalogo()
  }

  if (erro && !catalogo) {
    return (
      <Alert>
        <AlertDescription>{erro}</AlertDescription>
      </Alert>
    )
  }
  if (!catalogo) return <Skeleton className="h-96 w-full" />

  const itemAtual = catalogo.itens.find((i) => i.id === selecionado)
  const texto = detalhe ? textoParaExibir(detalhe) : null

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">Fluxo e texto de cada etapa, subagente e regra. As notas anotam o que melhorar.</p>
        <Button variant="outline" size="sm" onClick={copiarNotas}>
          Copiar notas abertas
        </Button>
      </div>
      {erro && (
        <Alert>
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[14rem_minmax(0,1fr)_18rem]">
        <aside>
          <div className="lg:hidden">
            <Select
              value={selecionado}
              onValueChange={(v) => v && escolher(v)}
              items={catalogo.itens.map((i) => ({ value: i.id, label: i.titulo }))}
            >
              <SelectTrigger className="w-full min-w-0" aria-label="Item do catálogo">
                <SelectValue className="min-w-0 truncate" />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {agruparPorGrupo(catalogo.itens).flatMap((g) =>
                  g.itens.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      <span className="truncate">
                        {i.titulo}
                        {i.notasAbertas > 0 && <span className="text-muted-foreground"> ({i.notasAbertas})</span>}
                      </span>
                    </SelectItem>
                  )),
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="hidden lg:block">
            <ListaItens itens={catalogo.itens} selecionado={selecionado} escolher={escolher} />
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-4">
          {erroDetalhe ? (
            <Alert>
              <AlertDescription>{erroDetalhe}</AlertDescription>
            </Alert>
          ) : detalhe === null ? (
            <Skeleton className="h-72 w-full" />
          ) : (
            <>
              <header className="flex flex-col gap-1">
                <h2 className="text-texto-forte font-heading text-lg font-semibold">{detalhe.titulo}</h2>
                <p className="text-muted-foreground text-sm">{detalhe.resumo}</p>
              </header>
              {itemAtual?.temFluxo ? (
                <>
                  {detalhe.fluxo !== null && (
                    <>
                      <Fluxograma key={detalhe.id} codigo={detalhe.fluxo} />
                      <p className="text-muted-foreground text-xs">{LEGENDA}</p>
                    </>
                  )}
                  {texto !== null && (
                    <Button className="self-start" variant="outline" size="sm" onClick={() => setTextoAberto(true)}>
                      Ver texto completo
                    </Button>
                  )}
                </>
              ) : texto !== null ? (
                <Markdown>{texto}</Markdown>
              ) : (
                <p className="text-muted-foreground text-sm">Texto indisponível.</p>
              )}
            </>
          )}
        </div>

        <aside>
          {detalhe && !erroDetalhe && (
            <NotasSkill
              key={detalhe.id}
              itemId={detalhe.id}
              notas={detalhe.notas}
              semNuvem={semNuvemNaEscrita || !detalhe.notasDisponiveis}
              aoSemNuvem={() => setSemNuvemNaEscrita(true)}
              aoCriar={notaCriada}
              aoAtualizar={notaAtualizada}
            />
          )}
        </aside>
      </div>

      <Sheet open={textoAberto} onOpenChange={setTextoAberto}>
        <SheetContent className="overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>{detalhe?.titulo}</SheetTitle>
            <SheetDescription>{detalhe?.resumo}</SheetDescription>
          </SheetHeader>
          {texto !== null && (
            <div className="px-4 pb-4">
              <Markdown>{texto}</Markdown>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </section>
  )
}
