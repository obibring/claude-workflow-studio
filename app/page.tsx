import { ReactFlowProvider } from "@xyflow/react"
import { WorkflowStudio } from "@/components/workflow-studio"

export default function Page() {
  return (
    <ReactFlowProvider>
      <WorkflowStudio />
    </ReactFlowProvider>
  )
}
