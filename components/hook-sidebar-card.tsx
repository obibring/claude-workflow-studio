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
import { type InspectorTab } from "@/constants"
import { getPlacementForEvent } from "@/lib/claude"
import { hookFormBuilder } from "@obibring/claude-hooks-cli/browser"
import { HookFieldInput } from "@/components/hook-field-input"
import { ClaudeHookEvent, HookBinding, HookCatalogItem } from "@/lib/types"
import { Select, SelectContent, SelectItem, SelectTrigger } from "./ui/select"

export function HookSidebarCard({
  selectedHookBinding,
  removeSelectedNode,
  selectedHookCatalogItem,
  setHookBindings,
}: {
  setHookBindings: React.Dispatch<React.SetStateAction<readonly HookBinding[]>>
  selectedHookBinding: HookBinding
  removeSelectedNode: () => void
  inspectorTab: InspectorTab
  selectedHookCatalogItem: HookCatalogItem | null
}) {
  const hookDef =
    hookFormBuilder.getHookDefinition(selectedHookBinding.event) || {}
  const handlerDef = hookDef[selectedHookBinding.handlerType]
  const settingsFields = handlerDef?.settings

  return (
    <Card className="border-amber-500/20 bg-white/4">
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
            <Select
              value={selectedHookBinding.event}
              onValueChange={(event) => {
                const newEvent = event as ClaudeHookEvent
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
              <SelectTrigger className="h-10 w-full rounded-md border border-border/60 bg-background/60 px-3 text-sm outline-none focus:border-amber-400/60">
                {selectedHookBinding.event}
              </SelectTrigger>
              <SelectContent className="bg-black/90">
                {hookFormBuilder.getHookNames().map((event) => (
                  <SelectItem key={event} value={event}>
                    {event}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-400">
              Handler type
            </label>
            <Select
              disabled={!selectedHookBinding.event}
              value={selectedHookBinding.handlerType}
              onValueChange={(event) => {
                setHookBindings((prev) =>
                  prev.map((b) =>
                    b.id === selectedHookBinding.id
                      ? {
                          ...b,
                          handlerType: event as HookBinding["handlerType"],
                        }
                      : b,
                  ),
                )
              }}
            >
              <SelectTrigger className="h-10 w-full rounded-md border border-border/60 bg-background/60 px-3 text-sm outline-none focus:border-amber-400/60">
                {selectedHookBinding.handlerType}
              </SelectTrigger>
              <SelectContent className="bg-black/90">
                {Object.keys(hookDef).map((handlerType) => (
                  <SelectItem key={handlerType} value={handlerType}>
                    {handlerType}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-md border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Placement: {selectedHookBinding.placement} ·{" "}
          {selectedHookCatalogItem?.description || "Unknown event"}
        </div>

        {settingsFields &&
          Object.entries(settingsFields).map(([fieldName, fieldDef]) => (
            <HookFieldInput
              key={fieldName}
              name={fieldName}
              field={fieldDef}
              value={
                (selectedHookBinding as Record<string, unknown>)[fieldName]
              }
              onChange={(newValue) =>
                setHookBindings((prev) =>
                  prev.map((b) =>
                    b.id === selectedHookBinding.id
                      ? { ...b, [fieldName]: newValue }
                      : b,
                  ),
                )
              }
            />
          ))}
      </CardContent>
    </Card>
  )
}
