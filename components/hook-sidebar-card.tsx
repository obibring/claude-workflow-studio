/** @format */

import {
  CardContent,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import { Hammer } from "lucide-react"
import { type InspectorTab, INSPECTOR_TABS as tabs } from "@/constants"
import { HOOK_CATALOG, getPlacementForEvent } from "@/lib/claude"
import { Input } from "./ui/input"
import {
  ClaudeHookEvent,
  HookBinding,
  HookCatalogItem,
  ScriptAsset,
} from "@/lib/types"
import { Textarea } from "./ui/textarea"

export function HookSidebarCard({
  selectedHookBinding,
  removeSelectedNode,
  selectedHookCatalogItem,
  setHookBindings,
  scripts,
}: {
  setHookBindings: React.Dispatch<React.SetStateAction<readonly HookBinding[]>>
  scripts: readonly ScriptAsset[]
  selectedHookBinding: HookBinding
  removeSelectedNode: () => void
  inspectorTab: InspectorTab
  selectedHookCatalogItem: HookCatalogItem | null
}) {
  return (
    <Card className="border-amber-500/20 bg-white/[0.04]">
      <CardHeader className="gap-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-amber-300">
              <Hammer className="size-5" /> Hook: {selectedHookBinding.event}
            </CardTitle>
            <CardDescription>
              Configure the hook binding inserted between two agents.
            </CardDescription>
          </div>
          <Button variant="danger" size="sm" onClick={removeSelectedNode}>
            <Trash2 className="size-4" /> Remove
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 overflow-y-auto max-h-[calc(100vh-15rem)]">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-400">
              Event type
            </label>
            <select
              className="h-10 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm outline-none focus:border-amber-400/60"
              value={selectedHookBinding.event}
              onChange={(event) => {
                const newEvent = event.target.value as ClaudeHookEvent
                setHookBindings((prev) =>
                  prev.map((b) =>
                    b.id === selectedHookBinding.id
                      ? {
                          ...b,
                          event: newEvent,
                          placement: getPlacementForEvent(newEvent),
                        }
                      : b,
                  ),
                )
              }}
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
              className="h-10 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm outline-none focus:border-amber-400/60"
              value={selectedHookBinding.handlerType}
              onChange={(event) => {
                setHookBindings((prev) =>
                  prev.map((b) =>
                    b.id === selectedHookBinding.id
                      ? {
                          ...b,
                          handlerType: event.target
                            .value as HookBinding["handlerType"],
                        }
                      : b,
                  ),
                )
              }}
            >
              <option value="command">command</option>
              <option value="prompt">prompt</option>
              <option value="agent">agent</option>
              <option value="http">http</option>
            </select>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Placement: {selectedHookBinding.placement} ·{" "}
          {selectedHookCatalogItem?.description || "Unknown event"}
        </div>

        {selectedHookCatalogItem?.supportsMatcher ? (
          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-400">
              Matcher
            </label>
            <Input
              value={selectedHookBinding.matcher || ""}
              onChange={(event) =>
                setHookBindings((prev) =>
                  prev.map((b) =>
                    b.id === selectedHookBinding.id
                      ? {
                          ...b,
                          matcher: event.target.value || undefined,
                        }
                      : b,
                  ),
                )
              }
              placeholder="Bash · Edit|Write · agent-name"
            />
          </div>
        ) : null}

        <div>
          <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-400">
            If condition
          </label>
          <Input
            value={selectedHookBinding.ifCondition || ""}
            onChange={(event) =>
              setHookBindings((prev) =>
                prev.map((b) =>
                  b.id === selectedHookBinding.id
                    ? {
                        ...b,
                        ifCondition: event.target.value || undefined,
                      }
                    : b,
                ),
              )
            }
            placeholder="$event.tool_name == 'Bash'"
          />
        </div>

        {selectedHookBinding.handlerType === "command" ? (
          <div className="space-y-3">
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-400">
                Script
              </label>
              <select
                className="h-10 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm outline-none focus:border-amber-400/60"
                value={selectedHookBinding.scriptId || ""}
                onChange={(event) =>
                  setHookBindings((prev) =>
                    prev.map((b) =>
                      b.id === selectedHookBinding.id
                        ? {
                            ...b,
                            scriptId: event.target.value || undefined,
                          }
                        : b,
                    ),
                  )
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
            {!selectedHookBinding.scriptId ? (
              <div>
                <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-400">
                  Command
                </label>
                <Textarea
                  value={selectedHookBinding.commandText || ""}
                  onChange={(event) =>
                    setHookBindings((prev) =>
                      prev.map((b) =>
                        b.id === selectedHookBinding.id
                          ? {
                              ...b,
                              commandText: event.target.value || undefined,
                            }
                          : b,
                      ),
                    )
                  }
                  className="min-h-[110px] font-mono text-[12px]"
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {selectedHookBinding.handlerType === "prompt" ||
        selectedHookBinding.handlerType === "agent" ? (
          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-400">
              Prompt
            </label>
            <Textarea
              value={selectedHookBinding.promptText || ""}
              onChange={(event) =>
                setHookBindings((prev) =>
                  prev.map((b) =>
                    b.id === selectedHookBinding.id
                      ? {
                          ...b,
                          promptText: event.target.value || undefined,
                        }
                      : b,
                  ),
                )
              }
              className="min-h-[120px]"
            />
          </div>
        ) : null}

        {selectedHookBinding.handlerType === "http" ? (
          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-400">
              URL
            </label>
            <Input
              value={selectedHookBinding.url || ""}
              onChange={(event) =>
                setHookBindings((prev) =>
                  prev.map((b) =>
                    b.id === selectedHookBinding.id
                      ? {
                          ...b,
                          url: event.target.value || undefined,
                        }
                      : b,
                  ),
                )
              }
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
