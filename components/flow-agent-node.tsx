/** @format */

"use client"

import { memo } from "react"
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react"
import { Activity, Bot, FileCode2, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { AgentNodeData } from "@/lib/types"

type AgentNode = Node<AgentNodeData>

export const FlowAgentNode = memo(function FlowAgentNode({
  data,
  selected,
}: NodeProps<AgentNode>) {
  return (
    <div
      className={cn(
        "group relative w-[300px] overflow-hidden rounded-md border border-border/60 bg-card/90 p-4 shadow-[0_30px_80px_-36px_rgba(12,19,39,0.85)] backdrop-blur-xl transition duration-300",
        selected &&
          "border-primary/60 shadow-[0_34px_90px_-36px_hsl(var(--primary)/0.55)]",
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(94,234,212,0.18),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.18),transparent_32%)] opacity-90" />
      <div className="relative z-10 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Badge variant="secondary">Phase {data.phaseIndex}</Badge>
              <Badge variant="default">{data.model}</Badge>
            </div>
            <h3 className="text-base font-semibold tracking-tight text-white">
              {data.agentName}
            </h3>
            <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-slate-300">
              {data.description}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-2 text-primary shadow-inner shadow-primary/10">
            <Bot className="size-5" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-300">
          <div className="rounded-2xl border border-white/8 bg-white/5 p-2">
            <div className="mb-1 flex items-center gap-1 text-slate-400">
              <Activity className="size-3.5" /> Hooks
            </div>
            <div className="text-sm font-semibold text-white">
              {data.hookCount}
            </div>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/5 p-2">
            <div className="mb-1 flex items-center gap-1 text-slate-400">
              <FileCode2 className="size-3.5" /> Scripts
            </div>
            <div className="text-sm font-semibold text-white">
              {data.scriptCount}
            </div>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/5 p-2">
            <div className="mb-1 flex items-center gap-1 text-slate-400">
              <Sparkles className="size-3.5" /> Ready
            </div>
            <div className="text-sm font-semibold text-emerald-300">Design</div>
          </div>
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="!size-3 !border-2 !border-white !bg-primary"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!size-3 !border-2 !border-white !bg-primary"
      />
    </div>
  )
})
