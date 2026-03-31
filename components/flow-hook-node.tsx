/** @format */

"use client"

import { memo } from "react"
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react"
import { Hammer as Anchor } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { HookNodeData } from "@/lib/types"

type HookNode = Node<HookNodeData>

export const FlowHookNode = memo(function FlowHookNode({
  data,
  selected,
}: NodeProps<HookNode>) {
  return (
    <div
      className={cn(
        "group relative w-[200px] overflow-hidden rounded-md border border-amber-500/30 bg-card/90 p-3 shadow-[0_20px_50px_-24px_rgba(245,158,11,0.5)] backdrop-blur-xl transition duration-300",
        selected &&
          "border-amber-400/60 shadow-[0_24px_60px_-24px_rgba(245,158,11,0.65)]",
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.15),transparent_50%)] opacity-90" />
      <div className="relative z-10 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <Badge className="border-amber-500/30 bg-amber-500/20 text-amber-200 text-[10px] px-1.5 py-0">
                {data.event}
              </Badge>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {data.handlerType}
              </Badge>
            </div>
          </div>
          <div className="rounded border border-amber-400/20 bg-amber-500/10 p-1.5 text-amber-400 shadow-inner shadow-amber-500/10">
            <Anchor className="size-3.5" />
          </div>
        </div>

        {data.matcher ? (
          <div className="truncate text-[11px] text-slate-300">
            <span className="text-slate-500">match:</span> {data.matcher}
          </div>
        ) : null}

        {data.ifCondition ? (
          <div className="truncate text-[11px] text-slate-300">
            <span className="text-slate-500">if:</span> {data.ifCondition}
          </div>
        ) : null}
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="!size-2.5 !border-2 !border-white !bg-amber-400"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!size-2.5 !border-2 !border-white !bg-amber-400"
      />
    </div>
  )
})
