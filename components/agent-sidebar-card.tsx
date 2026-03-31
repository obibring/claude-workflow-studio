/** @format */

import {
  CardContent,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Bot, Trash2 } from "lucide-react"
import { Hammer } from "lucide-react"
import { type InspectorTab, INSPECTOR_TABS as tabs } from "@/constants"
import { HOOK_CATALOG, getPlacementForEvent, slugifyName } from "@/lib/claude"
import { Input } from "./ui/input"
import {
  AgentAsset,
  ClaudeHookEvent,
  HookBinding,
  HookCatalogItem,
  ScriptAsset,
} from "@/lib/types"
import { Textarea } from "./ui/textarea"

export function AgentSidebarCard({
  removeSelectedNode,
  selectedAgent,
  scripts,
  inspectorTab,
  updateSelectedAgent,
  setInspectorTab,
}: {
  scripts: readonly ScriptAsset[]
  selectedAgent: AgentAsset
  updateSelectedAgent: (patch: Partial<AgentAsset>) => void
  removeSelectedNode: () => void
  setInspectorTab: React.Dispatch<React.SetStateAction<InspectorTab>>
  inspectorTab: InspectorTab
}) {
  return (
    <Card className="border-white/10 bg-white/[0.04]">
      <CardHeader className="gap-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-white">
              <Bot className="size-5 text-primary" /> {selectedAgent.name}
            </CardTitle>
            <CardDescription>
              Deep-inspect the selected agent. Edit metadata, wire hooks,
              preview markdown, and edit linked scripts inline.
            </CardDescription>
          </div>
          <Button variant="danger" size="sm" onClick={removeSelectedNode}>
            <Trash2 className="size-4" /> Remove
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <Button
              key={tab}
              variant={inspectorTab === tab ? "default" : "ghost"}
              size="sm"
              onClick={() => setInspectorTab(tab)}
            >
              {tab}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 overflow-y-auto max-h-[calc(100vh-15rem)]">
        {selectedAgent && inspectorTab === "overview" ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-400">
                  Agent name
                </label>
                <Input
                  value={selectedAgent.name}
                  onChange={(event) => {
                    const raw = event.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9-]+/g, "-")
                    updateSelectedAgent({
                      name: raw,
                      fileName: `${slugifyName(raw) || "agent"}.md`,
                    })
                  }}
                />
              </div>
              <div>
                <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-400">
                  Model
                </label>
                <Input
                  value={selectedAgent.model}
                  onChange={(event) =>
                    updateSelectedAgent({
                      model: event.target.value,
                    })
                  }
                />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-400">
                Description
              </label>
              <Textarea
                value={selectedAgent.description}
                onChange={(event) =>
                  updateSelectedAgent({
                    description: event.target.value,
                  })
                }
                className="min-h-[96px]"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-400">
                Tools (comma separated)
              </label>
              <Input
                value={selectedAgent.tools.join(", ")}
                onChange={(event) =>
                  updateSelectedAgent({
                    tools: event.target.value
                      .split(",")
                      .map((item) => item.trim())
                      .filter(Boolean),
                  })
                }
              />
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-400">
                Disallowed tools (comma separated)
              </label>
              <Input
                value={selectedAgent.disallowedTools.join(", ")}
                onChange={(event) =>
                  updateSelectedAgent({
                    disallowedTools: event.target.value
                      .split(",")
                      .map((item) => item.trim())
                      .filter(Boolean),
                  })
                }
              />
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-400">
                System prompt
              </label>
              <Textarea
                value={selectedAgent.prompt}
                onChange={(event) =>
                  updateSelectedAgent({
                    prompt: event.target.value,
                  })
                }
                className="min-h-[220px] font-mono text-[12px] leading-6"
              />
            </div>
          </div>
        ) : null}

        {selectedAgent && inspectorTab === "hooks" ? (
          <div className="space-y-4">
            <Card className="border-white/8 bg-white/[0.03]">
              <CardHeader>
                <CardTitle className="text-base text-white">Add hook</CardTitle>
                <CardDescription>
                  Choose any official hook event. The studio automatically
                  routes SubagentStart and SubagentStop to project settings and
                  keeps Stop in frontmatter.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-400">
                      Event
                    </label>
                    <select
                      className="h-10 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm outline-none focus:border-primary/60"
                      value={newHookEvent}
                      onChange={(event) =>
                        setNewHookEvent(event.target.value as ClaudeHookEvent)
                      }
                    >
                      {HOOK_CATALOG.map((item) => (
                        <option key={item.event} value={item.event}>
                          {item.event}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-400">
                      Handler type
                    </label>
                    <select
                      className="h-10 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm outline-none focus:border-primary/60"
                      value={newHookType}
                      onChange={(event) =>
                        setNewHookType(
                          event.target.value as HookBinding["handlerType"],
                        )
                      }
                    >
                      <option value="command">command</option>
                      <option value="prompt">prompt</option>
                      <option value="agent">agent</option>
                      <option value="http">http</option>
                    </select>
                  </div>
                </div>
                <div className="rounded-2xl border border-primary/20 bg-primary/10 px-3 py-2 text-xs text-primary">
                  Placement: {getPlacementForEvent(newHookEvent)} ·{" "}
                  {
                    HOOK_CATALOG.find((item) => item.event === newHookEvent)
                      ?.description
                  }
                </div>
                {HOOK_CATALOG.find((item) => item.event === newHookEvent)
                  ?.supportsMatcher ? (
                  <div>
                    <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-400">
                      Matcher
                    </label>
                    <Input
                      value={newHookMatcher}
                      onChange={(event) =>
                        setNewHookMatcher(event.target.value)
                      }
                      placeholder="Bash · Edit|Write · agent-name"
                    />
                  </div>
                ) : null}

                {newHookType === "command" ? (
                  <div className="space-y-3">
                    <div>
                      <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-400">
                        Script
                      </label>
                      <select
                        className="h-10 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm outline-none focus:border-primary/60"
                        value={newHookScriptId}
                        onChange={(event) =>
                          setNewHookScriptId(event.target.value)
                        }
                      >
                        <option value="">Inline command instead of file</option>
                        {scripts.map((script) => (
                          <option key={script.id} value={script.id}>
                            {script.fileName}
                          </option>
                        ))}
                      </select>
                    </div>
                    {!newHookScriptId ? (
                      <div>
                        <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-400">
                          Command
                        </label>
                        <Textarea
                          value={newHookCommandText}
                          onChange={(event) =>
                            setNewHookCommandText(event.target.value)
                          }
                          className="min-h-[110px] font-mono text-[12px]"
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {newHookType === "prompt" || newHookType === "agent" ? (
                  <div>
                    <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-400">
                      Prompt
                    </label>
                    <Textarea
                      value={newHookPromptText}
                      onChange={(event) =>
                        setNewHookPromptText(event.target.value)
                      }
                      className="min-h-[120px]"
                    />
                  </div>
                ) : null}

                {newHookType === "http" ? (
                  <div>
                    <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-400">
                      URL
                    </label>
                    <Input
                      value={newHookUrl}
                      onChange={(event) => setNewHookUrl(event.target.value)}
                    />
                  </div>
                ) : null}

                <Button className="w-full" onClick={addHookBinding}>
                  <Plus className="size-4" /> Add hook to {selectedAgent.name}
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-3">
              {selectedBindings.length ? (
                selectedBindings.map((binding) => {
                  const script = scripts.find(
                    (item) => item.id === binding.scriptId,
                  )
                  return (
                    <div
                      key={binding.id}
                      className="rounded-[24px] border border-white/8 bg-white/[0.035] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="default">{binding.event}</Badge>
                            <Badge variant="secondary">
                              {binding.placement}
                            </Badge>
                            <Badge variant="secondary">
                              {binding.handlerType}
                            </Badge>
                          </div>
                          <div className="mt-2 text-sm font-medium text-white">
                            {script?.fileName ||
                              binding.commandText ||
                              binding.url ||
                              "Inline hook"}
                          </div>
                          <div className="mt-1 text-xs text-slate-400">
                            {binding.matcher || "No matcher"}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeHookBinding(binding.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="rounded-[24px] border border-dashed border-white/12 p-6 text-center text-sm text-slate-400">
                  No hooks attached yet. Start with PreToolUse, Stop,
                  SubagentStart, or SubagentStop to build a serious workflow
                  gate.
                </div>
              )}
            </div>
          </div>
        ) : null}

        {selectedAgent && inspectorTab === "markdown" ? (
          <div className="space-y-3">
            <div className="rounded-[28px] border border-white/8 bg-slate-950/70 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-white">
                    Generated agent markdown
                  </div>
                  <div className="text-xs text-slate-400">
                    This is exactly what will be emitted into .claude/agents/
                    {selectedAgent.fileName}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      copyFile(
                        selectedAgent.fileName,
                        generated?.files[
                          `.claude/agents/${selectedAgent.fileName}`
                        ] || "",
                      )
                    }
                  >
                    <Copy className="size-4" /> Copy
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      downloadText(
                        selectedAgent.fileName,
                        generated?.files[
                          `.claude/agents/${selectedAgent.fileName}`
                        ] || "",
                      )
                    }
                  >
                    <Download className="size-4" /> Save
                  </Button>
                </div>
              </div>
              <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap rounded-[22px] border border-white/8 bg-black/40 p-4 font-mono text-[12px] leading-6 text-slate-200">
                {generated?.files[`.claude/agents/${selectedAgent.fileName}`]}
              </pre>
            </div>
          </div>
        ) : null}

        {selectedAgent && inspectorTab === "scripts" ? (
          <div className="space-y-4">
            {selectedScripts.length ? (
              selectedScripts.map((script) => (
                <Card
                  key={script.id}
                  className="border-white/8 bg-white/[0.03]"
                >
                  <CardHeader>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-base text-white">
                          {script.fileName}
                        </CardTitle>
                        <CardDescription>
                          {commandForScript(script)}
                        </CardDescription>
                      </div>
                      <Badge variant="secondary">{script.origin}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Textarea
                      className="min-h-[220px] font-mono text-[12px] leading-6"
                      value={script.content}
                      onChange={(event) =>
                        updateScript(script.id, {
                          content: event.target.value,
                        })
                      }
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          copyFile(script.fileName, script.content)
                        }
                      >
                        <Copy className="size-4" /> Copy
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          downloadText(script.fileName, script.content)
                        }
                      >
                        <Download className="size-4" /> Save
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-white/12 p-6 text-center text-sm text-slate-400">
                This agent does not currently reference any uploaded or inline
                script assets.
              </div>
            )}
          </div>
        ) : null}

        {inspectorTab === "output" && generated ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-[24px] border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">
                <div className="mb-2 flex items-center gap-2 font-medium">
                  <CheckCircle2 className="size-4" /> Generated bundle
                </div>
                <div>
                  {Object.keys(generated.files).length} files ready for export.
                </div>
              </div>
              <div className="rounded-[24px] border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
                <div className="mb-2 flex items-center gap-2 font-medium">
                  <TriangleAlert className="size-4" /> Validation
                </div>
                <div>
                  {issues.length
                    ? `${issues.length} issue(s) detected.`
                    : "No issues detected."}
                </div>
              </div>
            </div>

            {issues.length ? (
              <div className="space-y-2">
                {issues.map((issue, index) => (
                  <div
                    key={`${issue.message}-${index}`}
                    className="rounded-[20px] border border-white/8 bg-white/[0.035] p-3 text-sm"
                  >
                    <div className="flex items-center gap-2 text-white">
                      {issue.severity === "error" ? (
                        <TriangleAlert className="size-4 text-red-300" />
                      ) : (
                        <RefreshCcw className="size-4 text-amber-200" />
                      )}
                      {issue.message}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="space-y-3">
              {Object.entries(generated.files).map(([path, content]) => (
                <Card key={path} className="border-white/8 bg-white/[0.03]">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-sm text-white">
                          {path}
                        </CardTitle>
                        <CardDescription>
                          {path.includes(".claude/hooks")
                            ? "Hook script or workflow scaffold"
                            : path.includes("agents")
                              ? "Generated subagent"
                              : "Project configuration"}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyFile(path, content)}
                        >
                          <Copy className="size-4" /> Copy
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadText(path, content)}
                        >
                          <Download className="size-4" /> Save
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <pre className="max-h-[260px] overflow-auto whitespace-pre-wrap rounded-[20px] border border-white/8 bg-black/40 p-4 font-mono text-[12px] leading-6 text-slate-200">
                      {content}
                    </pre>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
