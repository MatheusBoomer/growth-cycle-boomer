// Tema do app: escuro (padrão Boomer) ou claro. A chave própria descarta o "system" gravado antes.
export const CONFIG_TEMA = {
  defaultTheme: "dark",
  enableSystem: false,
  themes: ["dark", "light"],
  storageKey: "tema-boomer",
} as const satisfies { defaultTheme: string; enableSystem: boolean; themes: readonly string[]; storageKey: string }

export function proximoTema(atual: string | undefined): "dark" | "light" {
  return atual === "light" ? "dark" : "light"
}
