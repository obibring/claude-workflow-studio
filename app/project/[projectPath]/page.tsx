"use client"

import { useParams } from "next/navigation"
import { ReactFlowProvider } from "@xyflow/react"
import { WorkflowStudio } from "@/components/workflow-studio"

export default function ProjectPage() {
  const params = useParams<{ projectPath: string }>()
  const decodedPath = decodeURIComponent(params.projectPath)

  return (
    <ReactFlowProvider>
      <WorkflowStudio projectPath={decodedPath} />
    </ReactFlowProvider>
  )
}
