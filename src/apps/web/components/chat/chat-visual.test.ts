import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

// Conferência contra o protótipo aprovado (3-tela-de-trabalho.html / 4-modo-claro.html).
const ler = (f: string) => readFileSync(path.resolve(import.meta.dirname, f), "utf-8")
const chat = ler("chat-etapa.tsx")
const compositor = ler("compositor.tsx")

describe("chat como no protótipo", () => {
  it("o desfoque das bordas usa a cor do painel, não a da página (sem faixa cinza)", () => {
    expect(chat).not.toMatch(/data-slot="desfoque-chat"[^>]*from-background/)
    expect(chat.match(/data-slot="desfoque-chat"[^>]*from-\(--vidro-[12]\)/g)).toHaveLength(2)
  })
  it("o fim da conversa tem respiro maior que o degradê de baixo, para a última linha não ficar sob a sombra", () => {
    expect(chat).toMatch(/<MessageScrollerContent\s+className="[^"]*\bpb-14\b/)
  })
  it("mensagem da pessoa em bolha clara com borda, não laranja", () => expect(ler("item-conversa.tsx")).toMatch(/<Bubble variant="outline" align="end">/))
  it("resposta do agente em 15 px (passado ao Markdown, que impõe text-sm)", () => {
    expect(ler("resposta-agente.tsx")).toMatch(/<Markdown className="text-\[15px\]">/)
    expect(chat).toMatch(/<Markdown className="text-\[15px\]">\{delta\}<\/Markdown>/)
  })
  it("compositor: sem alça de redimensionar, Anexar e Mencionar no menu do +, e enviar redondo escuro", () => {
    expect(compositor).toContain("resize-none")
    expect(compositor).toContain('aria-label="Anexar ou mencionar"')
    expect(compositor).toMatch(/<PaperclipIcon[^>]*\/> Anexar arquivo/)
    expect(compositor).toMatch(/<AtSignIcon[^>]*\/> Mencionar arquivo do prospect/)
    const enviar = /aria-label="Enviar"[^>]*className="([^"]*)"/.exec(compositor)![1]!
    expect(enviar).toContain("rounded-full")
    expect(enviar).toContain("bg-foreground")
  })
  it("título da etapa e do entregável em serifada itálica", () => {
    expect(ler("../trabalho/cabecalho-etapa.tsx")).toMatch(/<h1 className="[^"]*font-serif[^"]*italic/)
    expect(ler("../cards/card-entregavel.tsx")).toMatch(/<CardTitle className="[^"]*font-serif[^"]*italic/)
  })
  it("ações do entregável sem a faixa cinza do rodapé", () => expect(ler("../cards/card-entregavel.tsx")).toMatch(/<CardFooter className="[^"]*border-0 bg-transparent/))
})

describe("verde dos gráficos de progresso", () => {
  it("anel e barrinhas usam o verde de gráfico (mais vivo), não o verde de texto", () => {
    expect(ler("../home/anel-ciclo.tsx")).toContain('"var(--chart-3)"')
    expect(ler("../home/barra-etapas.tsx")).toContain('estado === "concluida" && "bg-chart-3"')
  })
})
