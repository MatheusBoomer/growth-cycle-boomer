"use client"

import { MessageCircleQuestionIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import type { ConjuntoPerguntas, RespostaPergunta } from "@workspace/core/tipos"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Question,
  QuestionDescription,
  QuestionInput,
  QuestionOption,
  QuestionOptions,
  QuestionPrompt,
} from "@workspace/ui/components/question"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"
import { api, mensagemDeErro } from "@/lib/api"

const vazia = (): RespostaPergunta => ({ selecionadas: [], outra: null })

export function CardPerguntas({
  slug,
  conjunto,
  bloqueado,
}: {
  slug: string
  conjunto: ConjuntoPerguntas
  bloqueado: string | null
}) {
  const [respostas, setRespostas] = useState<RespostaPergunta[]>(() => conjunto.perguntas.map(vazia))
  const [outraAberta, setOutraAberta] = useState<boolean[]>(() => conjunto.perguntas.map(() => false))
  const [enviando, setEnviando] = useState(false)

  const respondida = conjunto.status === "respondida"
  const substituida = conjunto.status === "sem_resposta"
  const editavel = conjunto.status === "pendente" && bloqueado === null
  const mostradas = respondida && conjunto.respostas ? conjunto.respostas : respostas
  const completo = respostas.every((r) => r.selecionadas.length > 0 || (r.outra ?? "").trim() !== "")

  function mudar(i: number, f: (r: RespostaPergunta) => RespostaPergunta) {
    setRespostas((rs) => rs.map((r, j) => (j === i ? f(r) : r)))
  }

  function alternar(i: number, rotulo: string) {
    const multipla = conjunto.perguntas[i]!.multipla
    mudar(i, (r) => {
      if (multipla) {
        const tem = r.selecionadas.includes(rotulo)
        return { ...r, selecionadas: tem ? r.selecionadas.filter((s) => s !== rotulo) : [...r.selecionadas, rotulo] }
      }
      return { selecionadas: r.selecionadas[0] === rotulo ? [] : [rotulo], outra: null }
    })
    if (!multipla) setOutraAberta((a) => a.map((v, j) => (j === i ? false : v)))
  }

  function abrirOutra(i: number) {
    setOutraAberta((a) => a.map((v, j) => (j === i ? true : v)))
    if (!conjunto.perguntas[i]!.multipla) mudar(i, (r) => ({ ...r, selecionadas: [] }))
  }

  async function enviar() {
    setEnviando(true)
    try {
      await api.responderPerguntas(
        slug,
        conjunto.id,
        respostas.map((r) => ({ selecionadas: r.selecionadas, outra: r.outra?.trim() || null })),
      )
    } catch (e) {
      toast.error(mensagemDeErro(e))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className={cn("bg-card max-w-xl rounded-xl border p-4", substituida && "opacity-60")}>
      <div className="mb-3 flex items-center gap-2">
        <MessageCircleQuestionIcon className="text-muted-foreground size-4" />
        <span className="text-sm font-medium">{conjunto.perguntas.length === 1 ? "Pergunta do agente" : "Perguntas do agente"}</span>
        {respondida && <Badge variant="secondary" className="ml-auto">Respondida</Badge>}
        {substituida && <Badge variant="outline" className="ml-auto">Substituída por uma pergunta mais recente</Badge>}
      </div>
      <div className="flex flex-col gap-5">
        {conjunto.perguntas.map((p, i) => {
          const r = mostradas[i] ?? vazia()
          const outraVisivel = respondida ? r.outra !== null : outraAberta[i]
          return (
            <Question key={i} disabled={!editavel || enviando}>
              <QuestionPrompt>
                {conjunto.perguntas.length > 1 && <span className="text-muted-foreground mr-1">{i + 1}.</span>}
                {p.enunciado}
              </QuestionPrompt>
              {p.descricao && <QuestionDescription>{p.descricao}</QuestionDescription>}
              <QuestionOptions multipla={p.multipla} aria-label={p.enunciado}>
                {p.opcoes.map((o) => {
                  const marcada = r.selecionadas.includes(o.rotulo)
                  return (
                    <QuestionOption
                      key={o.rotulo}
                      marcada={marcada}
                      multipla={p.multipla}
                      title={o.descricao ?? undefined}
                      className={cn(respondida && !marcada && "opacity-50")}
                      onClick={() => alternar(i, o.rotulo)}
                    >
                      {o.rotulo}
                    </QuestionOption>
                  )
                })}
                {editavel && !outraAberta[i] && (
                  <QuestionOption marcada={false} multipla={p.multipla} onClick={() => abrirOutra(i)}>
                    Outra…
                  </QuestionOption>
                )}
              </QuestionOptions>
              {outraVisivel &&
                (respondida ? (
                  <p className="text-sm italic">Outra: {r.outra}</p>
                ) : (
                  <QuestionInput
                    autoFocus
                    placeholder="Escreva sua resposta"
                    value={r.outra ?? ""}
                    onChange={(e) => mudar(i, (atual) => ({ ...atual, outra: e.target.value }))}
                  />
                ))}
            </Question>
          )
        })}
      </div>
      {conjunto.status === "pendente" && (
        <div className="mt-4 flex items-center gap-3">
          {bloqueado && <p className="text-muted-foreground text-xs">{bloqueado}</p>}
          <Button className="ml-auto" disabled={!editavel || !completo || enviando} onClick={() => void enviar()}>
            {enviando && <Spinner />} Enviar respostas
          </Button>
        </div>
      )}
    </div>
  )
}
