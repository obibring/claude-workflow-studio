/** @format */

"use client"

import { ReactFlowProvider } from "@xyflow/react"
import { WorkflowStudio } from "@/components/workflow-studio"
import { StorageProvider } from "@/context/storage-context"
import { LocalStorageConnector } from "@/lib/storage"
import { useParams } from "next/navigation"
import { useMemo } from "react"

export default function Page() {
  const { projectPath } = useParams<{ projectPath: string }>()
  const storage = useMemo(
    () => new LocalStorageConnector(projectPath),
    [projectPath],
  )
  return (
    <StorageProvider storage={storage}>
      <ReactFlowProvider>
        <WorkflowStudio />
      </ReactFlowProvider>
    </StorageProvider>
  )
}
