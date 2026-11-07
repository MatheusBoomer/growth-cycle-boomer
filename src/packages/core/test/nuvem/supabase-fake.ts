import type { SupabaseClient } from "@supabase/supabase-js"

/** Cliente falso do supabase-js, com as mesmas formas de chamada usadas pelo código (compartilhado entre os testes). */
export type Resposta = { data: unknown; error: { message: string; code?: string; status?: number } | null }

export interface Consulta {
  tabela: string
  /** Operações encadeadas, na ordem: [metodo, ...argumentos]. */
  ops: Array<[string, ...unknown[]]>
}

export const op = (c: Consulta, metodo: string) => c.ops.find(([m]) => m === metodo)

/** Query builder mínimo, com as mesmas formas de chamada do supabase-js usadas pelo código. */
export function criarFake(responder: (c: Consulta) => Resposta) {
  const consultas: Consulta[] = []
  const armazenamento: Array<{ bucket: string; metodo: string; args: unknown[] }> = []
  const respostasStorage: Record<string, (args: unknown[], bucket: string) => Resposta> = {}

  function builder(tabela: string) {
    const consulta: Consulta = { tabela, ops: [] }
    consultas.push(consulta)
    const b: Record<string, unknown> = {}
    for (const m of [
      "select", "insert", "update", "upsert", "delete", "eq", "is", "not", "like", "order", "range", "maybeSingle", "single",
    ]) {
      b[m] = (...args: unknown[]) => {
        consulta.ops.push([m, ...args])
        return b
      }
    }
    b.then = (ok: (r: Resposta) => unknown, falha?: (e: unknown) => unknown) =>
      Promise.resolve(responder(consulta)).then(ok, falha)
    return b
  }

  const cliente = {
    from: builder,
    rpc: (funcao: string, args: unknown) => {
      const consulta: Consulta = { tabela: `rpc:${funcao}`, ops: [["rpc", args]] }
      consultas.push(consulta)
      return Promise.resolve(responder(consulta))
    },
    storage: {
      from: (bucket: string) => ({
        upload: async (...args: unknown[]) => {
          armazenamento.push({ bucket, metodo: "upload", args })
          return respostasStorage.upload?.(args, bucket) ?? { data: {}, error: null }
        },
        download: async (...args: unknown[]) => {
          armazenamento.push({ bucket, metodo: "download", args })
          return respostasStorage.download?.(args, bucket) ?? { data: null, error: { message: "Object not found" } }
        },
        list: async (...args: unknown[]) => {
          armazenamento.push({ bucket, metodo: "list", args })
          return respostasStorage.list?.(args, bucket) ?? { data: [], error: null }
        },
        remove: async (...args: unknown[]) => {
          armazenamento.push({ bucket, metodo: "remove", args })
          return respostasStorage.remove?.(args, bucket) ?? { data: [], error: null }
        },
      }),
    },
  }
  return { cliente: cliente as unknown as SupabaseClient, consultas, armazenamento, respostasStorage }
}

export const ok = (data: unknown): Resposta => ({ data, error: null })
