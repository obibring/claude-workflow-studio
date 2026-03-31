/** @format */
"use client"

import { z } from "zod"
import { Folder } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Input } from "@/components/ui/input"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useProjects } from "@/context/projects-context"
import { redirect } from "next/navigation"
import { cn } from "@/lib/utils"

export function ProjectForm() {
  const { projects, setProjects } = useProjects()
  // const [name, setName] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const directory =
    file?.webkitRelativePath
      ?.split("/")
      .filter((_, i, arr) => i !== arr.length - 1)
      .join("/") ?? ""
  const name = directory
  const schema = z.object({
    name: z.string().min(1),
    path: z.string().min(1),
  })
  return (
    <form
      className="flex flex-col gap-4 h-full items-center justify-center mx-auto"
      onSubmit={() => {
        if (
          !directory ||
          !schema.safeParse({ name, path: directory }).success
        ) {
          return
        }
        if (projects.some((project) => project.name === name)) {
          setError(`Project with name ${name} exists`)
          return
        }
        if (projects.some((project) => project.path === directory)) {
          setError(`Project with path ${directory} exists`)
          return
        }
        setProjects([
          ...projects,
          {
            name,
            path: directory,
            createdAt: new Date().toISOString(),
          },
        ])
        redirect(`/project/${directory}`)
      }}
    >
      <Card className="w-160 flex-1 my-24 flex flex-col gap-6">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-2xl font-bold">
            Add Project Directory
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col gap-6">
          {/* <fieldset className="flex flex-col gap-2">
            <label>Project Name</label>
            <Input name="name" onChange={(e) => setName(e.target.value)} />
          </fieldset> */}
          <fieldset className="flex flex-col gap-3">
            <label>Choose a directory</label>
            <div>
              {name && (
                <div
                  className={cn(
                    "cursor-pointer",
                    "hover:bg-accent/40 hover:text-accent-foreground cursor-pointer transition-all duration-100",
                    "flex items-center h-12 rounded-md border-2 border-dashed px-3 border-border/60 bg-background/60 w-full py-3 gap-3",
                  )}
                >
                  <Folder className="size-6 text-primary/50" />
                  <span className="select-none text-sm">{name}</span>
                </div>
              )}
              <Input
                className={name ? "hidden" : ""}
                accept="text/*,.pdf,.md,.py,.sh,.txt,.ts,.tsx,.mts,.cts,.js,.mjs,.cjs"
                type="file"
                name="file"
                onChange={(e) => {
                  e.preventDefault()
                  setFile(e.target.files?.[0] ?? null)
                }}
              />
            </div>
          </fieldset>
          {error && <p className="text-red-500">{error}</p>}
          <Button
            disabled={!name || !directory || !file}
            type="submit"
            className="mt-12"
          >
            Create Project
          </Button>
        </CardContent>
      </Card>
    </form>
  )
}
