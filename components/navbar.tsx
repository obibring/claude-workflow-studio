/** @format */

import { Card, CardContent } from "./ui/card"
import { Button } from "./ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Sparkles, Trash } from "lucide-react"
import { Wand2 } from "lucide-react"
import { Save } from "lucide-react"
import { Download } from "lucide-react"
import { useProjects } from "@/context/projects-context"
import { redirect } from "next/navigation"
import { cn } from "@/lib/utils"

export function Navbar({
  resetTemplate,
  autoLayout,
  saveLocalState,
  downloadBundle,
  generatedDownloadState,
  className,
  showActions = true,
}:
  | {
      className?: string
      showActions: false
      resetTemplate?: () => void
      autoLayout?: () => void
      saveLocalState?: () => void
      downloadBundle?: () => void
      generatedDownloadState?: "idle" | "working" | "done"
    }
  | {
      className?: string
      resetTemplate: () => void
      autoLayout: () => void
      saveLocalState: () => void
      downloadBundle: () => void
      generatedDownloadState: "idle" | "working" | "done"
      showActions?: true
    }) {
  const { projects, selectedProjectPath, setSelectedProjectPath } =
    useProjects()
  return (
    <Card
      className={cn(
        "overflow-hidden border-0 bg-white/4 rounded-none",
        className,
      )}
    >
      <CardContent className="flex gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2 flex-1">
          <div className="mb-2 flex items-center gap-3 text-xs uppercase tracking-[0.28em] text-primary font-semibold">
            <Sparkles className="size-4" /> Claude Code Studio
          </div>
          <div className="flex flex-wrap flex-row items-center gap-3 justify-between">
            {/* <Button variant="outline" onClick={resetTemplate}>
            <LayoutTemplate className="size-4" /> Five-phase template
            </Button> */}
            <div>
              <Select
                value={selectedProjectPath ?? undefined}
                onValueChange={(path) => {
                  if (path === "new") {
                    redirect("/new")
                  }
                  const selectedProject = projects.find(
                    (project) => project.path === path,
                  )
                  setSelectedProjectPath(selectedProject?.path ?? null)
                }}
              >
                <SelectTrigger className="lg:text-base lg:min-w-60">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent className="bg-black/80">
                  <SelectItem value="new">New Project</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.path} value={project.path}>
                      {project.path}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3">
              {showActions && (
                <>
                  <Button variant="outline" onClick={resetTemplate}>
                    <Trash className="size-4" /> Reset Template
                  </Button>
                  <Button variant="outline" onClick={autoLayout}>
                    <Wand2 className="size-4" /> Auto layout
                  </Button>
                  <Button variant="outline" onClick={saveLocalState}>
                    <Save className="size-4" /> Save local state
                  </Button>
                  <Button variant="outline" onClick={downloadBundle}>
                    <Download className="size-4" />{" "}
                    {generatedDownloadState === "working"
                      ? "Bundling…"
                      : generatedDownloadState === "done"
                        ? "Downloaded"
                        : "Download zip"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
