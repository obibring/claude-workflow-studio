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
import { Sparkles } from "lucide-react"
import { LayoutTemplate } from "lucide-react"
import { Wand2 } from "lucide-react"
import { Save } from "lucide-react"
import { Download } from "lucide-react"
import { useProjects } from "@/context/use-projects"

export function Navbar({
  resetTemplate,
  autoLayout,
  saveLocalState,
  downloadBundle,
  generatedDownloadState,
}: {
  resetTemplate: () => void
  autoLayout: () => void
  saveLocalState: () => void
  downloadBundle: () => void
  generatedDownloadState: "idle" | "working" | "done"
}) {
  const { projects, selectedProjectPath, setSelectedProjectPath } =
    useProjects()
  return (
    <Card className="overflow-hidden border-0 bg-white/[0.04] -m-6 rounded-none">
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
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
