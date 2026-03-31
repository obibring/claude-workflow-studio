/** @format */

"use client"

/** @format */

import { createContext, useContext } from "react"
import type { StorageConnector } from "@/lib/storage"

const StorageContext = createContext<StorageConnector | null>(null)

export function StorageProvider({
  storage,
  children,
}: {
  storage: StorageConnector
  children: React.ReactNode
}) {
  return (
    <StorageContext.Provider value={storage}>
      {children}
    </StorageContext.Provider>
  )
}

export function useStorage(): StorageConnector | null {
  const ctx = useContext(StorageContext)
  return ctx
}
