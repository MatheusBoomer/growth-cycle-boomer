"use client"

import { ArrowLeftIcon, ArrowRightIcon, MessageCircleQuestionIcon, PencilIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import type { ConjuntoPerguntas, Pergunta, RespostaPergunta } from "@workspace/core/tipos"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Question,
  QuestionInput,
  QuestionOption,
  QuestionOptions,
  QuestionPrompt,
} from "@workspace/ui/components/question"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"
import { Markdown } from "@/components/markdown"
import { api, mensagemDeErro } from "@/lib/api"
import { formatarDescricao } from "@/lib/descricao-pergunta"

const vazia = (): RespostaPergunta => ({ selecionadas: [], outra: null })
const aberta = (p: Pergunta) => p.opcoes.length === 0
const respondeu = (r: RespostaPergunta) => r.selecionadas.length > 0 || (r.outra ?? "").trim() !== ""

/** Resposta em uma linha, para a revisão antes de enviar. */
function resumoResposta(p: Pergunta, r: RespostaPergunta): string {
  const escrita = r.outra?.trim()
  return [...r.selecionadas, ...(escrita ? [aberta(p) ? escrita : `Outra: ${escrita}`] : [])].join("; ")
}

/**
 * Card da ferramenta fazer_perguntas. Pendente e com mais de uma pergunta, mostra uma por vez
 * (Voltar/Próxima) e, no fim, uma revisão em que cada resposta pode ser editada antes de enviar.
 * Pergunta sem opções é aberta: só a resposta escrita.
 */
export function CardPerguntas({
  slug,
  conjunto,
  bloqueado,
}: {
  slug: string
  conjunto: ConjuntoPerguntas
  bloqueado: string | null
}) {
  const total = conjunto.perguntas.length
  const [respostas, setRespostas] = useState<RespostaPergunta[]>(() => conjunto.perguntas.map(vazia))
  const [outraAberta, setOutraAberta] = useState<boolean[]>(() => conjunto.perguntas.map(() => false))
  // 0..total-1 = pergunta da vez; total = revisão.
  const [passo, setPasso] = useState(0)
  const [enviando, setEnviando] = useState(false)

  const respondida = conjunto.status === "respondida"
  const substituida = conjunto.status === "sem_resposta"
  const editavel = conjunto.status === "pendente" && bloqueado === null
  const sequencial = editavel && total > 1
  const mostradas = respondida && conjunto.respostas ? conjunto.respostas : respostas
  const completo = respostas.every(respondeu)

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
      // Sucesso: mantém `enviando` até o estado atualizado virar "respondida" (o botão some), para não reenviar.
    } catch (e) {
      toast.error(mensagemDeErro(e))
      setEnviando(false)
    }
  }

  function renderPergunta(i: number, numerada: boolean) {
    const p = conjunto.perguntas[i]!
    const r = mostradas[i] ?? vazia()
    const escritaVisivel = aberta(p) || (respondida ? r.outra !== null : outraAberta[i])
    return (
      <Question key={i} disabled={!editavel || enviando}>
        <QuestionPrompt>
          {numerada && <span className="text-muted-foreground mr-1">{i + 1}.</span>}
          {p.enunciado}
        </QuestionPrompt>
        {p.descricao && (
          // Markdown com quebra de linha preservada: contexto longo vira lista legível, não um bloco de texto.
          <Markdown className="text-muted-foreground [&_li]:my-0.5 [&_p]:whitespace-pre-line">{formatarDescricao(p.descricao)}</Markdown>
        )}
        {!aberta(p) && (
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
        )}
        {escritaVisivel &&
          (respondida ? (
            <p className="text-sm italic">{aberta(p) ? r.outra : `Outra: ${r.outra}`}</p>
          ) : (
            <QuestionInput
              autoFocus={!aberta(p) || sequencial}
              placeholder="Escreva sua resposta"
              aria-label={aberta(p) ? p.enunciado : undefined}
              value={r.outra ?? ""}
              onChange={(e) => mudar(i, (atual) => ({ ...atual, outra: e.target.value }))}
            />
          ))}
      </Question>
    )
  }

  const titulo = total === 1 ? "Pergunta do agente" : "Perguntas do agente"
  const naRevisao = sequencial && passo >= total

  return (
    <div className={cn("bg-card max-w-xl rounded-xl border p-4", substituida && "opacity-60")}>
      <div className="mb-3 flex items-center gap-2">
        <MessageCircleQuestionIcon className="text-muted-foreground size-4" />
        <span className="text-sm font-medium">{titulo}</span>
        {sequencial && (
          <span className="text-muted-foreground ml-auto text-xs">{naRevisao ? "Revisão" : `Pergunta ${passo + 1} de ${total}`}</span>
        )}
        {respondida && <Badge variant="secondary" className="ml-auto">Respondida</Badge>}
        {substituida && <Badge variant="outline" className="ml-auto">Substituída por uma pergunta mais recente</Badge>}
      </div>

      {!sequencial && <div className="flex flex-col gap-5">{conjunto.perguntas.map((_, i) => renderPergunta(i, total > 1))}</div>}

      {sequencial && !naRevisao && (
        <>
          {renderPergunta(passo, false)}
          <div className="mt-4 flex items-center gap-2">
            <Button variant="outline" disabled={passo === 0 || enviando} onClick={() => setPasso(passo - 1)}>
              <ArrowLeftIcon /> Voltar
            </Button>
            <Button className="ml-auto" disabled={!respondeu(respostas[passo]!) || enviando} onClick={() => setPasso(passo + 1)}>
              {passo === total - 1 ? "Revisar respostas" : "Próxima"} <ArrowRightIcon />
            </Button>
          </div>
        </>
      )}

      {naRevisao && (
        <>
          <ol className="flex flex-col gap-3">
            {conjunto.perguntas.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="text-muted-foreground">{i + 1}.</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{p.enunciado}</p>
                  <p className={cn("text-muted-foreground whitespace-pre-wrap", !respondeu(respostas[i]!) && "text-destructive")}>
                    {respondeu(respostas[i]!) ? resumoResposta(p, respostas[i]!) : "Sem resposta"}
                  </p>
                </div>
                <Button variant="ghost" size="icon-sm" aria-label={`Editar a resposta ${i + 1}`} disabled={enviando} onClick={() => setPasso(i)}>
                  <PencilIcon />
                </Button>
              </li>
            ))}
          </ol>
          <div className="mt-4 flex items-center gap-2">
            <Button variant="outline" disabled={enviando} onClick={() => setPasso(total - 1)}>
              <ArrowLeftIcon /> Voltar
            </Button>
            <Button className="ml-auto" disabled={!completo || enviando} onClick={() => void enviar()}>
              {enviando && <Spinner />} Enviar para a IA
            </Button>
          </div>
        </>
      )}

      {conjunto.status === "pendente" && !sequencial && (
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
