"use client"

import "@xyflow/react/dist/style.css"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import JSZip from "jszip"
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react"
import { AnimatePresence, motion } from "framer-motion"
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  CircuitBoard,
  Copy,
  Download,
  FileUp,
  FolderCode,
  GitBranch,
  GripVertical,
  LayoutTemplate,
  Plus,
  RefreshCcw,
  Save,
  Sparkles,
  Trash2,
  TriangleAlert,
  Wand2,
} from "lucide-react"
import { FlowAgentNode } from "@/components/flow-node"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import {
  HOOK_CATALOG,
  STORAGE_KEY,
  commandForScript,
  createAgentAsset,
  createBlankAppState,
  createFivePhaseTemplate,
  createScriptAsset,
  generateBundle,
  getPlacementForEvent,
  inferLanguage,
  makeId,
  parseAgentMarkdown,
  sanitizeFileName,
  slugifyName,
} from "@/lib/claude"
import type { AgentAsset, AgentNodeData, AppState, ClaudeHookEvent, FlowNodeRecord, HookBinding, ScriptAsset } from "@/lib/types"

const nodeTypes = { agent: FlowAgentNode }
const tabs = ["overview", "hooks", "markdown", "scripts", "output"] as const

type InspectorTab = (typeof tabs)[number]

function readTextFiles(fileList: FileList) {
  return Promise.all(
    Array.from(fileList).map(
      (file) =>
        new Promise<{ name: string; content: string }>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve({ name: file.name, content: String(reader.result || "") })
          reader.onerror = reject
          reader.readAsText(file)
        }),
    ),
  )
}

function metricCard(title: string, value: number | string, hint: string) {
  return (
    <div className="rounded-[28px] border border-white/8 bg-white/5 p-4 shadow-inner shadow-white/5 backdrop-blur-sm">
      <div className="text-xs uppercase tracking-[0.24em] text-slate-400">{title}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
      <div className="mt-1 text-xs text-slate-400">{hint}</div>
    </div>
  )
}

function downloadText(path: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = path.split("/").pop() || "file.txt"
  anchor.click()
  URL.revokeObjectURL(url)
}

export function WorkflowStudio() {
  const [state, setState] = useState<AppState | null>(null)
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("overview")
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [newHookEvent, setNewHookEvent] = useState<ClaudeHookEvent>("PreToolUse")
  const [newHookType, setNewHookType] = useState<HookBinding["handlerType"]>("command")
  const [newHookMatcher, setNewHookMatcher] = useState("")
  const [newHookScriptId, setNewHookScriptId] = useState<string>("")
  const [newHookCommandText, setNewHookCommandText] = useState("")
  const [newHookPromptText, setNewHookPromptText] = useState("Evaluate $ARGUMENTS and return valid JSON.")
  const [newHookUrl, setNewHookUrl] = useState("http://localhost:3001/hooks")
  const [generatedDownloadState, setGeneratedDownloadState] = useState<"idle" | "working" | "done">("idle")

  const { screenToFlowPosition } = useReactFlow()
  const agentInputRef = useRef<HTMLInputElement | null>(null)
  const scriptInputRef = useRef<HTMLInputElement | null>(null)
  const dragDataRef = useRef<{ agentId: string } | null>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as AppState
        setState(parsed)
        setSelectedNodeId(parsed.nodes[0]?.id || null)
        return
      }
    } catch {
      // ignore corrupted state and fall back to blank
    }
    setState(createBlankAppState())
    setSelectedNodeId(null)
  }, [])

  useEffect(() => {
    if (!state) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const generated = useMemo(() => (state ? generateBundle(state) : null), [state])
  const issues = generated?.issues || []

  const nodes = useMemo<Node<AgentNodeData>[]>(() => {
    if (!state) return []
    return state.nodes.map((node, index) => {
      const agent = state.agents.find((item) => item.id === node.agentId)
      const hookCount = state.hookBindings.filter((binding) => binding.agentId === node.agentId).length
      const scriptCount = new Set(
        state.hookBindings.filter((binding) => binding.agentId === node.agentId).map((binding) => binding.scriptId).filter(Boolean),
      ).size
      return {
        id: node.id,
        type: "agent",
        position: node.position,
        selected: node.selected,
        data: {
          agentName: agent?.name || "missing-agent",
          description: agent?.description || "Missing agent",
          phaseIndex: index + 1,
          hookCount,
          scriptCount,
          model: agent?.model || "inherit",
        },
      }
    })
  }, [state])

  const edges = useMemo<Edge[]>(() => {
    if (!state) return []
    return state.edges.map((edge) => ({ ...edge, animated: true, style: { strokeWidth: 2 } }))
  }, [state])

  const selectedNode = state?.nodes.find((node) => node.id === selectedNodeId) || null
  const selectedAgent = selectedNode ? state?.agents.find((item) => item.id === selectedNode.agentId) || null : null
  const selectedBindings = selectedAgent ? state?.hookBindings.filter((binding) => binding.agentId === selectedAgent.id) || [] : []
  const selectedScripts = selectedAgent
    ? state?.scripts.filter((script) => selectedBindings.some((binding) => binding.scriptId === script.id)) || []
    : []

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setState((current) => {
        if (!current) return current
        const nextNodes = applyNodeChanges(
          changes,
          current.nodes.map((node) => ({ id: node.id, position: node.position, selected: node.selected, data: {}, type: "agent" })),
        )
        return {
          ...current,
          nodes: current.nodes.map((node) => {
            const updated = nextNodes.find((item) => item.id === node.id)
            return updated
              ? { ...node, position: updated.position, selected: updated.selected }
              : node
          }),
        }
      })
    },
    [setState],
  )

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setState((current) => {
        if (!current) return current
        const nextEdges = applyEdgeChanges(changes, current.edges as Edge[]) as Edge[]
        return {
          ...current,
          edges: nextEdges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, label: edge.label as string | undefined, selected: edge.selected })),
        }
      })
    },
    [setState],
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      setState((current) => {
        if (!current || !connection.source || !connection.target) return current
        const next = addEdge({ ...connection, id: makeId("edge") }, current.edges as Edge[])
        return {
          ...current,
          edges: next.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, label: edge.label as string | undefined, selected: edge.selected })),
        }
      })
    },
    [setState],
  )

  const resetTemplate = () => {
    const template = createFivePhaseTemplate()
    setState(template)
    setSelectedNodeId(template.nodes[0]?.id || null)
  }

  const autoLayout = () => {
    setState((current) => {
      if (!current) return current
      return {
        ...current,
        nodes: current.nodes.map((node, index) => ({
          ...node,
          position: { x: 120 + index * 320, y: 180 + (index % 2) * 36 },
        })),
      }
    })
  }

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const data = dragDataRef.current
      if (!data) return

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      setState((s) => {
        if (!s) return s
        const newNode: FlowNodeRecord = {
          id: makeId("node"),
          agentId: data.agentId,
          position,
        }
        return { ...s, nodes: [...s.nodes, newNode] }
      })

      dragDataRef.current = null
    },
    [screenToFlowPosition],
  )

  const handleAgentUpload = async (fileList: FileList | null) => {
    if (!fileList?.length) return
    const contents = await readTextFiles(fileList)
    setState((current) => {
      if (!current) return current
      const next = structuredClone(current)
      for (const file of contents) {
        const { agent, bindings } = parseAgentMarkdown(file.content, file.name)
        next.agents.push(agent)
        next.hookBindings.push(...bindings)
      }
      return next
    })
  }

  const handleScriptUpload = async (fileList: FileList | null) => {
    if (!fileList?.length) return
    const contents = await readTextFiles(fileList)
    setState((current) => {
      if (!current) return current
      return {
        ...current,
        scripts: [
          ...current.scripts,
          ...contents.map((file) => ({
            id: makeId("script"),
            name: sanitizeFileName(file.name).replace(/\.[^.]+$/, ""),
            fileName: sanitizeFileName(file.name),
            language: inferLanguage(file.name),
            content: file.content,
            origin: "upload" as const,
            createdAt: new Date().toISOString(),
          })),
        ],
      }
    })
  }

  const createAgent = useCallback(() => {
    setState((s) => {
      if (!s) return s
      const agent = createAgentAsset(`agent-${s.agents.length + 1}`)
      return { ...s, agents: [...s.agents, agent] }
    })
  }, [])

  const createScript = () => {
    setState((current) => {
      if (!current) return current
      return { ...current, scripts: [...current.scripts, createScriptAsset(`hook-${current.scripts.length + 1}.ts`)] }
    })
  }

  const updateSelectedAgent = (patch: Partial<AgentAsset>) => {
    if (!selectedAgent) return
    setState((current) => {
      if (!current) return current
      return {
        ...current,
        agents: current.agents.map((agent) => (agent.id === selectedAgent.id ? { ...agent, ...patch } : agent)),
      }
    })
  }

  const updateScript = (scriptId: string, patch: Partial<ScriptAsset>) => {
    setState((current) => {
      if (!current) return current
      return {
        ...current,
        scripts: current.scripts.map((script) => (script.id === scriptId ? { ...script, ...patch } : script)),
      }
    })
  }

  const addHookBinding = () => {
    if (!selectedAgent || !state) return
    const placement = getPlacementForEvent(newHookEvent)
    const binding: HookBinding = {
      id: makeId("binding"),
      agentId: selectedAgent.id,
      event: newHookEvent,
      handlerType: newHookType,
      placement,
      matcher: newHookMatcher || undefined,
      scriptId: newHookType === "command" ? newHookScriptId || undefined : undefined,
      commandText: newHookType === "command" && !newHookScriptId ? newHookCommandText || undefined : undefined,
      promptText: newHookType === "prompt" || newHookType === "agent" ? newHookPromptText : undefined,
      url: newHookType === "http" ? newHookUrl : undefined,
    }

    setState((current) => {
      if (!current) return current
      return { ...current, hookBindings: [...current.hookBindings, binding] }
    })
  }

  const removeHookBinding = (bindingId: string) => {
    setState((current) => {
      if (!current) return current
      return { ...current, hookBindings: current.hookBindings.filter((binding) => binding.id !== bindingId) }
    })
  }

  const removeSelectedAgent = () => {
    if (!selectedAgent || !selectedNode) return
    setState((current) => {
      if (!current) return current
      return {
        ...current,
        agents: current.agents.filter((agent) => agent.id !== selectedAgent.id),
        hookBindings: current.hookBindings.filter((binding) => binding.agentId !== selectedAgent.id),
        nodes: current.nodes.filter((node) => node.id !== selectedNode.id),
        edges: current.edges.filter((edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id),
      }
    })
    setSelectedNodeId(null)
  }

  const copyFile = async (path: string, content: string) => {
    await navigator.clipboard.writeText(content)
    void path
  }

  const downloadBundle = async () => {
    if (!generated) return
    setGeneratedDownloadState("working")
    const zip = new JSZip()
    Object.entries(generated.files).forEach(([path, content]) => zip.file(path, content))
    const blob = await zip.generateAsync({ type: "blob" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `${slugifyName(state?.settings.workflowName || "claude-workflow")}.zip`
    anchor.click()
    URL.revokeObjectURL(url)
    setGeneratedDownloadState("done")
    setTimeout(() => setGeneratedDownloadState("idle"), 1200)
  }

  if (!state) {
    return <div className="grid min-h-screen place-items-center bg-slate-950 text-slate-200">Loading workflow studio…</div>
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.16),transparent_24%),radial-gradient(circle_at_left,rgba(168,85,247,0.16),transparent_24%),linear-gradient(180deg,#030712_0%,#020617_100%)] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] bg-[size:36px_36px] opacity-20" />
      <div className="relative z-10 flex min-h-screen flex-col gap-4 p-5 lg:p-6">
        <Card className="overflow-hidden border-white/10 bg-white/[0.04]">
          <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-primary">
                <Sparkles className="size-4" /> Claude Workflow Studio
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-white">Design subagent workflows that generate valid Claude Code hooks.</h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">
                Local-first Next.js 16 + shadcn workflow builder. Upload agent markdown, attach hooks visually, inspect scripts side-by-side,
                and export a clean .claude bundle with agent frontmatter, settings.json, workflow manifest, and scaffolding scripts.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" onClick={resetTemplate}>
                <LayoutTemplate className="size-4" /> Five-phase template
              </Button>
              <Button variant="outline" onClick={autoLayout}>
                <Wand2 className="size-4" /> Auto layout
              </Button>
              <Button variant="outline" onClick={() => localStorage.setItem(STORAGE_KEY, JSON.stringify(state))}>
                <Save className="size-4" /> Save local state
              </Button>
              <Button onClick={downloadBundle}>
                <Download className="size-4" /> {generatedDownloadState === "working" ? "Bundling…" : generatedDownloadState === "done" ? "Downloaded" : "Download zip"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid min-h-[calc(100vh-10rem)] grid-cols-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)_420px]">
          <div className="space-y-4">
            <Card className="border-white/10 bg-white/[0.04]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <FolderCode className="size-5 text-primary" /> Asset library
                </CardTitle>
                <CardDescription>Agents and hook scripts live in localStorage and can be reused across sessions.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Button className="w-full" variant="secondary" onClick={() => agentInputRef.current?.click()}>
                    <FileUp className="size-4" /> Upload agents
                  </Button>
                  <Button className="w-full" variant="secondary" onClick={() => scriptInputRef.current?.click()}>
                    <FileUp className="size-4" /> Upload scripts
                  </Button>
                  <Button className="w-full" variant="outline" onClick={createAgent}>
                    <Plus className="size-4" /> New agent
                  </Button>
                  <Button className="w-full" variant="outline" onClick={createScript}>
                    <Plus className="size-4" /> New script
                  </Button>
                </div>
                <input ref={agentInputRef} hidden multiple type="file" accept=".md,.markdown,.txt" onChange={(event) => handleAgentUpload(event.target.files)} />
                <input ref={scriptInputRef} hidden multiple type="file" accept=".ts,.tsx,.mts,.cts,.js,.mjs,.cjs,.py,.sh,.txt" onChange={(event) => handleScriptUpload(event.target.files)} />
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-400">
                    <span>Agents</span>
                    <Badge variant="secondary">{state.agents.length}</Badge>
                  </div>
                  <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
                    {state.agents.map((agent) => (
                      <div
                        key={agent.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "move"
                          dragDataRef.current = { agentId: agent.id }
                        }}
                        onClick={() => {
                          const node = state.nodes.find((item) => item.agentId === agent.id)
                          if (node) {
                            setSelectedNodeId(node.id)
                            setInspectorTab("overview")
                          }
                        }}
                        className="cursor-grab active:cursor-grabbing rounded-[22px] border border-white/8 bg-white/[0.045] p-3 text-left transition hover:border-primary/40 hover:bg-white/[0.07]"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="font-medium text-white">{agent.name}</div>
                            <div className="mt-1 text-xs text-slate-400">{agent.fileName}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="default">{agent.model}</Badge>
                            <GripVertical className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </div>
                        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-300">{agent.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-400">
                    <span>Scripts</span>
                    <Badge variant="secondary">{state.scripts.length}</Badge>
                  </div>
                  <div className="max-h-[220px] space-y-2 overflow-y-auto pr-1">
                    {state.scripts.map((script) => (
                      <div key={script.id} className="rounded-[20px] border border-white/8 bg-white/[0.04] p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-white">{script.fileName}</div>
                            <div className="text-xs text-slate-400">{script.origin}</div>
                          </div>
                          <Badge variant="secondary">{script.language}</Badge>
                        </div>
                        <div className="mt-2 text-[11px] text-slate-400">{commandForScript(script)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-white/[0.04]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <CircuitBoard className="size-5 text-primary" /> Health
                </CardTitle>
                <CardDescription>Validation keeps the generated bundle aligned with Claude Code’s hook and subagent shapes.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                {metricCard("agents", state.agents.length, "Custom subagents in memory")}
                {metricCard("hooks", state.hookBindings.length, "Frontmatter + project bindings")}
                {metricCard("scripts", state.scripts.length, "Uploaded or inline hook scripts")}
                {metricCard("issues", issues.length, issues.some((issue) => issue.severity === "error") ? "Generation blocked until fixed" : "Ready to export")}
              </CardContent>
            </Card>
          </div>

          <Card className="relative overflow-hidden border-white/10 bg-white/[0.04]">
            <CardHeader className="border-b border-white/8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <GitBranch className="size-5 text-primary" /> React Flow workflow canvas
                  </CardTitle>
                  <CardDescription>Arrange phase agents, wire next-step transitions, and click any node to inspect generated markdown and hooks.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={issues.some((issue) => issue.severity === "error") ? "danger" : "success"}>
                    {issues.some((issue) => issue.severity === "error") ? "Needs fixes" : "Ready to generate"}
                  </Badge>
                  <Badge variant="secondary">{state.settings.workflowName}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="h-[calc(100vh-16rem)] p-0">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={(_, node) => {
                  setSelectedNodeId(node.id)
                  setInspectorTab("overview")
                }}
                onDragOver={onDragOver}
                onDrop={onDrop}
                fitView
                nodeTypes={nodeTypes}
                className="workflow-flow"
              >
                <Background color="rgba(148,163,184,0.18)" gap={26} />
                <MiniMap className="!rounded-3xl !border !border-white/8 !bg-slate-950/70 !backdrop-blur" pannable zoomable />
                <Controls className="!rounded-2xl !border !border-white/8 !bg-slate-950/70 !text-slate-200 !shadow-xl !backdrop-blur" />
                <Panel position="top-left">
                  <div className="flex items-center gap-2 rounded-full border border-white/8 bg-slate-950/70 px-3 py-2 text-xs text-slate-300 backdrop-blur">
                    <ArrowRight className="size-3.5 text-primary" /> Connect nodes to define the allowed next phase(s).
                  </div>
                </Panel>
              </ReactFlow>
            </CardContent>
          </Card>

          <AnimatePresence mode="wait">
            <motion.div
              key={selectedAgent?.id || "output-panel"}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              className="flex min-h-0 flex-col gap-4"
            >
              <Card className="border-white/10 bg-white/[0.04]">
                <CardHeader className="gap-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-white">
                        <Bot className="size-5 text-primary" /> {selectedAgent ? selectedAgent.name : "Generated outputs"}
                      </CardTitle>
                      <CardDescription>
                        {selectedAgent
                          ? "Deep-inspect the selected agent. Edit metadata, wire hooks, preview markdown, and edit linked scripts inline."
                          : "Review the generated file bundle and copy or download individual outputs."}
                      </CardDescription>
                    </div>
                    {selectedAgent ? (
                      <Button variant="danger" size="sm" onClick={removeSelectedAgent}>
                        <Trash2 className="size-4" /> Remove
                      </Button>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {tabs.map((tab) => (
                      <Button key={tab} variant={inspectorTab === tab ? "default" : "ghost"} size="sm" onClick={() => setInspectorTab(tab)}>
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
                          <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-400">Agent name</label>
                          <Input
                            value={selectedAgent.name}
                            onChange={(event) =>
                              updateSelectedAgent({
                                name: slugifyName(event.target.value),
                                fileName: `${slugifyName(event.target.value) || "agent"}.md`,
                              })
                            }
                          />
                        </div>
                        <div>
                          <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-400">Model</label>
                          <Input value={selectedAgent.model} onChange={(event) => updateSelectedAgent({ model: event.target.value })} />
                        </div>
                      </div>
                      <div>
                        <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-400">Description</label>
                        <Textarea value={selectedAgent.description} onChange={(event) => updateSelectedAgent({ description: event.target.value })} className="min-h-[96px]" />
                      </div>
                      <div>
                        <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-400">Tools (comma separated)</label>
                        <Input value={selectedAgent.tools.join(", ")} onChange={(event) => updateSelectedAgent({ tools: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} />
                      </div>
                      <div>
                        <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-400">Disallowed tools (comma separated)</label>
                        <Input
                          value={selectedAgent.disallowedTools.join(", ")}
                          onChange={(event) => updateSelectedAgent({ disallowedTools: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })}
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-400">System prompt</label>
                        <Textarea value={selectedAgent.prompt} onChange={(event) => updateSelectedAgent({ prompt: event.target.value })} className="min-h-[220px] font-mono text-[12px] leading-6" />
                      </div>
                    </div>
                  ) : null}

                  {selectedAgent && inspectorTab === "hooks" ? (
                    <div className="space-y-4">
                      <Card className="border-white/8 bg-white/[0.03]">
                        <CardHeader>
                          <CardTitle className="text-base text-white">Add hook</CardTitle>
                          <CardDescription>Choose any official hook event. The studio automatically routes SubagentStart and SubagentStop to project settings and keeps Stop in frontmatter.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-400">Event</label>
                              <select
                                className="h-10 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm outline-none focus:border-primary/60"
                                value={newHookEvent}
                                onChange={(event) => setNewHookEvent(event.target.value as ClaudeHookEvent)}
                              >
                                {HOOK_CATALOG.map((item) => (
                                  <option key={item.event} value={item.event}>
                                    {item.event}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-400">Handler type</label>
                              <select
                                className="h-10 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm outline-none focus:border-primary/60"
                                value={newHookType}
                                onChange={(event) => setNewHookType(event.target.value as HookBinding["handlerType"])}
                              >
                                <option value="command">command</option>
                                <option value="prompt">prompt</option>
                                <option value="agent">agent</option>
                                <option value="http">http</option>
                              </select>
                            </div>
                          </div>
                          <div className="rounded-2xl border border-primary/20 bg-primary/10 px-3 py-2 text-xs text-primary">
                            Placement: {getPlacementForEvent(newHookEvent)} · {HOOK_CATALOG.find((item) => item.event === newHookEvent)?.description}
                          </div>
                          {HOOK_CATALOG.find((item) => item.event === newHookEvent)?.supportsMatcher ? (
                            <div>
                              <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-400">Matcher</label>
                              <Input value={newHookMatcher} onChange={(event) => setNewHookMatcher(event.target.value)} placeholder="Bash · Edit|Write · agent-name" />
                            </div>
                          ) : null}

                          {newHookType === "command" ? (
                            <div className="space-y-3">
                              <div>
                                <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-400">Script</label>
                                <select
                                  className="h-10 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm outline-none focus:border-primary/60"
                                  value={newHookScriptId}
                                  onChange={(event) => setNewHookScriptId(event.target.value)}
                                >
                                  <option value="">Inline command instead of file</option>
                                  {state.scripts.map((script) => (
                                    <option key={script.id} value={script.id}>
                                      {script.fileName}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              {!newHookScriptId ? (
                                <div>
                                  <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-400">Command</label>
                                  <Textarea value={newHookCommandText} onChange={(event) => setNewHookCommandText(event.target.value)} className="min-h-[110px] font-mono text-[12px]" />
                                </div>
                              ) : null}
                            </div>
                          ) : null}

                          {newHookType === "prompt" || newHookType === "agent" ? (
                            <div>
                              <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-400">Prompt</label>
                              <Textarea value={newHookPromptText} onChange={(event) => setNewHookPromptText(event.target.value)} className="min-h-[120px]" />
                            </div>
                          ) : null}

                          {newHookType === "http" ? (
                            <div>
                              <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-400">URL</label>
                              <Input value={newHookUrl} onChange={(event) => setNewHookUrl(event.target.value)} />
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
                            const script = state.scripts.find((item) => item.id === binding.scriptId)
                            return (
                              <div key={binding.id} className="rounded-[24px] border border-white/8 bg-white/[0.035] p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Badge variant="default">{binding.event}</Badge>
                                      <Badge variant="secondary">{binding.placement}</Badge>
                                      <Badge variant="secondary">{binding.handlerType}</Badge>
                                    </div>
                                    <div className="mt-2 text-sm font-medium text-white">{script?.fileName || binding.commandText || binding.url || "Inline hook"}</div>
                                    <div className="mt-1 text-xs text-slate-400">{binding.matcher || "No matcher"}</div>
                                  </div>
                                  <Button size="sm" variant="ghost" onClick={() => removeHookBinding(binding.id)}>
                                    <Trash2 className="size-4" />
                                  </Button>
                                </div>
                              </div>
                            )
                          })
                        ) : (
                          <div className="rounded-[24px] border border-dashed border-white/12 p-6 text-center text-sm text-slate-400">
                            No hooks attached yet. Start with PreToolUse, Stop, SubagentStart, or SubagentStop to build a serious workflow gate.
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
                            <div className="text-sm font-semibold text-white">Generated agent markdown</div>
                            <div className="text-xs text-slate-400">This is exactly what will be emitted into .claude/agents/{selectedAgent.fileName}</div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => copyFile(selectedAgent.fileName, generated?.files[`.claude/agents/${selectedAgent.fileName}`] || "") }>
                              <Copy className="size-4" /> Copy
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => downloadText(selectedAgent.fileName, generated?.files[`.claude/agents/${selectedAgent.fileName}`] || "") }>
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
                          <Card key={script.id} className="border-white/8 bg-white/[0.03]">
                            <CardHeader>
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <CardTitle className="text-base text-white">{script.fileName}</CardTitle>
                                  <CardDescription>{commandForScript(script)}</CardDescription>
                                </div>
                                <Badge variant="secondary">{script.origin}</Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <Textarea className="min-h-[220px] font-mono text-[12px] leading-6" value={script.content} onChange={(event) => updateScript(script.id, { content: event.target.value })} />
                              <div className="flex justify-end gap-2">
                                <Button size="sm" variant="outline" onClick={() => copyFile(script.fileName, script.content)}>
                                  <Copy className="size-4" /> Copy
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => downloadText(script.fileName, script.content)}>
                                  <Download className="size-4" /> Save
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      ) : (
                        <div className="rounded-[24px] border border-dashed border-white/12 p-6 text-center text-sm text-slate-400">
                          This agent does not currently reference any uploaded or inline script assets.
                        </div>
                      )}
                    </div>
                  ) : null}

                  {(!selectedAgent || inspectorTab === "output") && generated ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="rounded-[24px] border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">
                          <div className="mb-2 flex items-center gap-2 font-medium"><CheckCircle2 className="size-4" /> Generated bundle</div>
                          <div>{Object.keys(generated.files).length} files ready for export.</div>
                        </div>
                        <div className="rounded-[24px] border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
                          <div className="mb-2 flex items-center gap-2 font-medium"><TriangleAlert className="size-4" /> Validation</div>
                          <div>{issues.length ? `${issues.length} issue(s) detected.` : "No issues detected."}</div>
                        </div>
                      </div>

                      {issues.length ? (
                        <div className="space-y-2">
                          {issues.map((issue, index) => (
                            <div key={`${issue.message}-${index}`} className="rounded-[20px] border border-white/8 bg-white/[0.035] p-3 text-sm">
                              <div className="flex items-center gap-2 text-white">
                                {issue.severity === "error" ? <TriangleAlert className="size-4 text-red-300" /> : <RefreshCcw className="size-4 text-amber-200" />}
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
                                  <CardTitle className="text-sm text-white">{path}</CardTitle>
                                  <CardDescription>{path.includes(".claude/hooks") ? "Hook script or workflow scaffold" : path.includes("agents") ? "Generated subagent" : "Project configuration"}</CardDescription>
                                </div>
                                <div className="flex gap-2">
                                  <Button size="sm" variant="outline" onClick={() => copyFile(path, content)}>
                                    <Copy className="size-4" /> Copy
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => downloadText(path, content)}>
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
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
