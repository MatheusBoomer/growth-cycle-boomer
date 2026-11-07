import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// O desligamento de verdade instalaria ouvintes de sinal no processo do Vitest.
const { instalarDesligamento } = vi.hoisted(() => ({ instalarDesligamento: vi.fn() }))
vi.mock("./lib/desligamento", () => ({ instalarDesligamento, servidorJaCriado: () => undefined }))

const { register } = await import("./instrumentation")

const AVISO_FS = "[planejamento] login ligado com dados em disco (PLANEJAMENTO_DADOS=fs): útil só para testar o login."

describe("instrumentation register()", () => {
  let aviso: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs")
    vi.stubEnv("PLANEJAMENTO_AUTH", "google")
    vi.stubEnv("SUPABASE_URL", "https://projeto.supabase.co")
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_teste")
    vi.stubEnv("PLANEJAMENTO_DADOS", "supabase")
    vi.stubEnv("PLANEJAMENTO_APP_URL", "https://planejamento.exemplo.com")
    aviso = vi.spyOn(console, "warn").mockImplementation(() => {})
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    aviso.mockRestore()
  })

  it("carrega o .env da raiz antes de conferir a configuração", async () => {
    const { loadEnvConfig } = await import("@next/env")
    const registro = globalThis as { __planejamentoAmbiente?: unknown }
    delete registro.__planejamentoAmbiente
    vi.mocked(loadEnvConfig).mockClear()
    vi.resetModules()
    const { register: registerNovo } = await import("./instrumentation")
    await registerNovo()
    expect(loadEnvConfig).toHaveBeenCalledTimes(1)
  })

  it("PLANEJAMENTO_AUTH inválido falha na subida", async () => {
    vi.stubEnv("PLANEJAMENTO_AUTH", "Google")
    await expect(register()).rejects.toThrow('PLANEJAMENTO_AUTH inválido: "Google" (use off ou google).')
  })

  it("google sem a chave publicável falha na subida", async () => {
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "")
    await expect(register()).rejects.toThrow("PLANEJAMENTO_AUTH=google exige SUPABASE_PUBLISHABLE_KEY no .env da raiz.")
  })

  it("google com dados em disco (fs ou vazio) avisa uma vez, sem valores", async () => {
    for (const dados of ["fs", "", " fs "]) {
      aviso.mockClear()
      vi.stubEnv("PLANEJAMENTO_DADOS", dados)
      await register()
      expect(aviso).toHaveBeenCalledTimes(1)
      expect(aviso).toHaveBeenCalledWith(AVISO_FS)
    }
  })

  it("google com supabase e URL pública boa não avisa nada", async () => {
    await register()
    expect(aviso).not.toHaveBeenCalled()
  })

  it("google com PLANEJAMENTO_APP_URL malformada avisa uma vez, sem imprimir o valor", async () => {
    vi.stubEnv("PLANEJAMENTO_APP_URL", "ftp://segredo.exemplo.com")
    await register()
    expect(aviso).toHaveBeenCalledTimes(1)
    const texto = String(aviso.mock.calls[0]?.[0])
    expect(texto).toContain("PLANEJAMENTO_APP_URL")
    expect(texto).not.toContain("segredo")
  })

  it("modo off não avisa, mesmo com dados em disco e URL malformada", async () => {
    vi.stubEnv("PLANEJAMENTO_AUTH", "")
    vi.stubEnv("PLANEJAMENTO_DADOS", "fs")
    vi.stubEnv("PLANEJAMENTO_APP_URL", "nada")
    await register()
    expect(aviso).not.toHaveBeenCalled()
  })

  describe("desligamento seguro", () => {
    beforeEach(() => {
      instalarDesligamento.mockClear()
    })

    it("com NEXT_MANUAL_SIG_HANDLE=true, register() instala o desligamento", async () => {
      vi.stubEnv("NEXT_MANUAL_SIG_HANDLE", "true")
      await register()
      expect(instalarDesligamento).toHaveBeenCalledTimes(1)
      const d = instalarDesligamento.mock.calls[0]![0] as { env: unknown; servidor: unknown; sair: unknown }
      expect(d.env).toBe(process.env)
      expect(typeof d.servidor).toBe("function")
      expect(typeof d.sair).toBe("function")
    })

    it("com NEXT_MANUAL_SIG_HANDLE=true e o modo off, instala também", async () => {
      vi.stubEnv("NEXT_MANUAL_SIG_HANDLE", "true")
      vi.stubEnv("PLANEJAMENTO_AUTH", "")
      await register()
      expect(instalarDesligamento).toHaveBeenCalledTimes(1)
    })

    it("com qualquer valor não vazio (true, 1), instala: o Next também desliga o tratamento dele", async () => {
      for (const valor of ["true", "1"]) {
        instalarDesligamento.mockClear()
        vi.stubEnv("NEXT_MANUAL_SIG_HANDLE", valor)
        await register()
        expect(instalarDesligamento).toHaveBeenCalledTimes(1)
      }
    })

    it("vazia ou ausente, não instala: o Next trata os sinais", async () => {
      vi.stubEnv("NEXT_MANUAL_SIG_HANDLE", "")
      await register()
      vi.stubEnv("NEXT_MANUAL_SIG_HANDLE", undefined)
      await register()
      expect(instalarDesligamento).not.toHaveBeenCalled()
    })

    it("fora do runtime nodejs não instala", async () => {
      vi.stubEnv("NEXT_MANUAL_SIG_HANDLE", "true")
      vi.stubEnv("NEXT_RUNTIME", "edge")
      await register()
      expect(instalarDesligamento).not.toHaveBeenCalled()
    })
  })

  it("fora do runtime nodejs não faz nada (nem confere a configuração)", async () => {
    vi.stubEnv("NEXT_RUNTIME", "edge")
    vi.stubEnv("PLANEJAMENTO_AUTH", "invalido")
    await expect(register()).resolves.toBeUndefined()
  })
})
