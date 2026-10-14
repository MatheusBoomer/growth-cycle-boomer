"use client"

import dynamic from "next/dynamic"

// O layout só renderiza isto no next dev. O componente usa window e localStorage: nada de SSR.
export const CarregadorModoDev = dynamic(() => import("./modo-dev").then((m) => m.ModoDev), { ssr: false })
