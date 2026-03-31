/** @format */

"use client"

import { useMemo } from "react"
import { ReactFlowProvider } from "@xyflow/react"
import { WorkflowStudio } from "@/components/workflow-studio"
import { StorageProvider } from "@/context/storage-context"
import { LocalStorageConnector } from "@/lib/storage"

export default function Page() {
  const storage = useMemo(() => new LocalStorageConnector(""), [])

  return (
    <StorageProvider storage={storage}>
      <ReactFlowProvider>
        <WorkflowStudio />
      </ReactFlowProvider>
    </StorageProvider>
  )
}
