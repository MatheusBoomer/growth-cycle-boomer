import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { buttonVariants } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"
import { LogoBoomer } from "@/components/marca/logo-boomer"

/** Tela de entrada: o botão é um link comum (não `next/link`, que pré-carregaria a rota de login) para /auth/entrar. */
export function CartaoLogin({ href, mensagemDeErro }: { href: string; mensagemDeErro: string | null }) {
  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <LogoBoomer className="mb-2 h-6" />
          <CardTitle className="text-texto-forte">Planejamento estratégico</CardTitle>
          <CardDescription>Entre com a conta Google da Boomer para continuar.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {mensagemDeErro && (
            <Alert variant="destructive">
              <AlertDescription>{mensagemDeErro}</AlertDescription>
            </Alert>
          )}
          <a href={href} className={cn(buttonVariants({ size: "lg" }), "w-full")}>
            Entrar com Google
          </a>
        </CardContent>
      </Card>
    </main>
  )
}
