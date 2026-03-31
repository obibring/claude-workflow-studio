/** @format */
"use client"

import { redirect, useParams } from "next/navigation"
import { ReactFlowProvider } from "@xyflow/react"
import { ProjectsProvider } from "@/context/projects-context"
import { Navbar } from "@/components/navbar"
import { ProjectForm } from "@/components/project-form"

export default function ProjectPage() {
  const { projectPath } = useParams<{ projectPath: string }>()

  return (
    <ReactFlowProvider>
      <ProjectsProvider
        selectedProjectPath={projectPath}
        setSelectedProjectPath={(path) => {
          redirect(`/project/${path}`)
        }}
      >
        <Navbar showActions={false} />
        <ProjectForm />
      </ProjectsProvider>
    </ReactFlowProvider>
  )
}
