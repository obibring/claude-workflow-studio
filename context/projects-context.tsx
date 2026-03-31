/** @format */
"use client"

import {
  use,
  createContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from "react"
import type { Project } from "@/lib/types"
import { useStorage } from "./storage-context"

export const ProjectsContext = createContext<{
  readonly selectedProjectPath: string | null
  readonly setSelectedProjectPath: React.Dispatch<
    React.SetStateAction<string | null>
  >
  readonly setProjects: React.Dispatch<
    React.SetStateAction<ReadonlyArray<Project>>
  >
  readonly projects: ReadonlyArray<Project>
  readonly installationPath?: string | null
}>({
  installationPath: null,
  projects: [],
  setProjects: () => {},
  selectedProjectPath: null,
  setSelectedProjectPath: () => {},
})

export function ProjectsProvider({
  children,
  selectedProjectPath,
  setSelectedProjectPath,
  installationPath,
}: {
  installationPath?: string | null
  selectedProjectPath: string | null
  setSelectedProjectPath?:
    | undefined
    | React.Dispatch<React.SetStateAction<string | null>>
  children: React.ReactNode
}) {
  const [projects, _setProjects] = useState<ReadonlyArray<Project>>([])
  const storage = useStorage()
  const setProjects = useCallback(
    (
      projects:
        | ReadonlyArray<Project>
        | ((prevProjects: ReadonlyArray<Project>) => ReadonlyArray<Project>),
    ) => {
      if (typeof projects === "function") {
        _setProjects((prevProjects) => {
          const newProjects = projects(prevProjects)
          storage?.setItem("projects", JSON.stringify(newProjects))
          return newProjects
        })
      } else {
        _setProjects(projects)
        storage?.setItem("projects", JSON.stringify(projects))
      }
    },
    [storage],
  )
  useEffect(() => {
    if (selectedProjectPath) {
      setProjects((prevProjects) => {
        if (
          prevProjects.some((project) => project.path === selectedProjectPath)
        ) {
          return prevProjects
        }
        return [
          ...prevProjects,
          {
            path: selectedProjectPath,
            name: selectedProjectPath,
            createdAt: new Date().toISOString(),
          },
        ]
      })
    }
  }, [selectedProjectPath])

  return (
    <ProjectsContext.Provider
      value={{
        installationPath,
        projects,
        setProjects,
        selectedProjectPath,
        setSelectedProjectPath: setSelectedProjectPath ?? (() => {}),
      }}
    >
      {children}
    </ProjectsContext.Provider>
  )
}
export function useProjects() {
  return use(ProjectsContext)
}
