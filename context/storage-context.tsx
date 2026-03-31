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
    <StorageContext.Provider value={storage}>{children}</StorageContext.Provider>
  )
}

export function useStorage(): StorageConnector {
  const ctx = useContext(StorageContext)
  if (!ctx) {
    throw new Error("useStorage must be used within a <StorageProvider>")
  }
  return ctx
}
