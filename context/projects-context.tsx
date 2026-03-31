/** @format */
"use client"

import { use, createContext, useState } from "react"
import type { Project } from "@/lib/types"

export const ProjectsContext = createContext<{
  readonly selectedProjectPath: string | null
  readonly setSelectedProjectPath: React.Dispatch<
    React.SetStateAction<string | null>
  >
  readonly setProjects: React.Dispatch<
    React.SetStateAction<ReadonlyArray<Project>>
  >
  readonly projects: ReadonlyArray<Project>
}>({
  projects: [],
  setProjects: () => {},
  selectedProjectPath: null,
  setSelectedProjectPath: () => {},
})

export function ProjectsProvider({
  children,
  selectedProjectPath,
  setSelectedProjectPath,
}: {
  selectedProjectPath: string | null
  setSelectedProjectPath: React.Dispatch<React.SetStateAction<string | null>>
  children: React.ReactNode
}) {
  const [projects, setProjects] = useState<ReadonlyArray<Project>>([])
  return (
    <ProjectsContext.Provider
      value={{
        projects,
        setProjects,
        selectedProjectPath,
        setSelectedProjectPath,
      }}
    >
      {children}
    </ProjectsContext.Provider>
  )
}
export function useProjects() {
  return use(ProjectsContext)
}
