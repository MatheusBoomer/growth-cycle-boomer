import * as React from "react"
import { cn } from "cn"

import { Button } from "@workspace/ui/components/button"
import { Textarea } from "@workspace/ui/components/textarea"

/** Uma pergunta: fieldset para que `disabled` desligue opções e campo de uma vez. */
function Question({ className, ...props }: React.ComponentProps<"fieldset">) {
  return <fieldset data-slot="question" className={cn("flex min-w-0 flex-col gap-2 border-0 p-0", className)} {...props} />
}

function QuestionPrompt({ className, ...props }: React.ComponentProps<"legend">) {
  return <legend data-slot="question-prompt" className={cn("mb-1 text-sm font-medium", className)} {...props} />
}

function QuestionDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="question-description" className={cn("text-xs text-muted-foreground", className)} {...props} />
}

function QuestionOptions({ className, multipla = false, ...props }: React.ComponentProps<"div"> & { multipla?: boolean }) {
  return (
    <div
      data-slot="question-options"
      role={multipla ? "group" : "radiogroup"}
      className={cn("flex flex-wrap gap-2", className)}
      {...props}
    />
  )
}

function QuestionOption({
  className,
  marcada = false,
  multipla = false,
  ...props
}: React.ComponentProps<typeof Button> & { marcada?: boolean; multipla?: boolean }) {
  return (
    <Button
      type="button"
      data-slot="question-option"
      data-marcada={marcada}
      role={multipla ? "checkbox" : "radio"}
      aria-checked={marcada}
      variant={marcada ? "default" : "outline"}
      size="sm"
      className={cn("h-auto min-h-7 max-w-full py-1 text-left whitespace-normal", className)}
      {...props}
    />
  )
}

function QuestionInput({ className, ...props }: React.ComponentProps<typeof Textarea>) {
  return <Textarea data-slot="question-input" rows={2} className={cn("min-h-0 text-sm", className)} {...props} />
}

export { Question, QuestionPrompt, QuestionDescription, QuestionOptions, QuestionOption, QuestionInput }
