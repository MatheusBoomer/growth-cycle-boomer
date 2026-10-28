import { describe, expect, it } from "vitest"
import { GET, HEAD } from "./route"

describe("GET /api/saude", () => {
  it("responde 200 com o corpo exato, sem cache", async () => {
    const r = await GET()
    expect(r.status).toBe(200)
    expect(r.headers.get("cache-control")).toBe("no-store")
    expect(await r.text()).toBe('{"ok":true}')
  })

  it("HEAD responde 200 sem corpo e sem cache", async () => {
    const r = await HEAD()
    expect(r.status).toBe(200)
    expect(r.headers.get("cache-control")).toBe("no-store")
    expect(await r.text()).toBe("")
  })

  it("não exporta nenhum outro método", async () => {
    const modulo = await import("./route")
    for (const metodo of ["POST", "PUT", "PATCH", "DELETE"]) expect(modulo).not.toHaveProperty(metodo)
  })
})
