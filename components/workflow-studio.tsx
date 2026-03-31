"use client"

import "@xyflow/react/dist/style.css"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import JSZip from "jszip"
import {
  addEdge,
  Background,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
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
  X,
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
import type { AgentAsset, AgentNodeData, AppState, ClaudeHookEvent, HookBinding, ScriptAsset, WorkflowSettings } from "@/lib/types"

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

function buildNodeData(
  agentId: string,
  agents: AgentAsset[],
  hookBindings: HookBinding[],
  phaseIndex: number,
): AgentNodeData {
  const agent = agents.find((item) => item.id === agentId)
  const hookCount = hookBindings.filter((binding) => binding.agentId === agentId).length
  const scriptCount = new Set(
    hookBindings.filter((binding) => binding.agentId === agentId).map((binding) => binding.scriptId).filter(Boolean),
  ).size
  return {
    agentId,
    agentName: agent?.name || "missing-agent",
    description: agent?.description || "Missing agent",
    phaseIndex: phaseIndex + 1,
    hookCount,
    scriptCount,
    model: agent?.model || "inherit",
  }
}

const DEFAULT_SETTINGS: WorkflowSettings = {
  workflowName: "my-workflow",
  autoGenerateWorkflowGuard: true,
  includeLifecycleScaffolds: true,
}

export function WorkflowStudio() {
  // Domain state (no nodes/edges)
  const [agents, setAgents] = useState<AgentAsset[]>([])
  const [scripts, setScripts] = useState<ScriptAsset[]>([])
  const [hookBindings, setHookBindings] = useState<HookBinding[]>([])
  const [settings, setSettings] = useState<WorkflowSettings>(DEFAULT_SETTINGS)

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<AgentNodeData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  const { screenToFlowPosition } = useReactFlow()

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
  const [loaded, setLoaded] = useState(false)

  const agentInputRef = useRef<HTMLInputElement | null>(null)
  const scriptInputRef = useRef<HTMLInputElement | null>(null)
  const dragDataRef = useRef<{ agentId: string } | null>(null)

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as AppState
        setAgents(parsed.agents || [])
        setScripts(parsed.scripts || [])
        setHookBindings(parsed.hookBindings || [])
        setSettings(parsed.settings || DEFAULT_SETTINGS)
        if (parsed.nodes?.length) {
          setNodes(
            parsed.nodes.map((node, index) => ({
              id: node.id,
              type: "agent" as const,
              position: node.position,
              data: buildNodeData(node.agentId, parsed.agents || [], parsed.hookBindings || [], index),
            })),
          )
          setSelectedNodeId(parsed.nodes[0]?.id || null)
        }
        if (parsed.edges?.length) {
          setEdges(
            parsed.edges.map((e) => ({
              id: e.id,
              source: e.source,
              target: e.target,
              label: e.label,
              animated: true,
              style: { strokeWidth: 2 },
            })),
          )
        }
        setLoaded(true)
        return
      }
    } catch {
      // ignore corrupted state and fall back to blank
    }
    setLoaded(true)
    setSelectedNodeId(null)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Save to localStorage
  useEffect(() => {
    if (!loaded) return
    const state: AppState = {
      version: 1,
      agents,
      scripts,
      hookBindings,
      nodes: nodes.map((n) => ({
        id: n.id,
        agentId: (n.data as AgentNodeData).agentId,
        position: n.position,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label as string | undefined,
      })),
      settings,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [agents, scripts, hookBindings, settings, nodes, edges, loaded])

  // Reconstruct AppState for generateBundle and validation
  const appState = useMemo<AppState | null>(() => {
    if (!loaded) return null
    return {
      version: 1,
      agents,
      scripts,
      hookBindings,
      nodes: nodes.map((n) => ({
        id: n.id,
        agentId: (n.data as AgentNodeData).agentId,
        position: n.position,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label as string | undefined,
      })),
      settings,
    }
  }, [loaded, agents, scripts, hookBindings, nodes, edges, settings])

  const generated = useMemo(() => (appState ? generateBundle(appState) : null), [appState])
  const issues = generated?.issues || []

  // Derive selected agent from selected node
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) || null
  const selectedAgentId = selectedNode ? (selectedNode.data as AgentNodeData).agentId : null
  const selectedAgent = selectedAgentId ? agents.find((item) => item.id === selectedAgentId) || null : null
  const selectedBindings = selectedAgent ? hookBindings.filter((binding) => binding.agentId === selectedAgent.id) : []
  const selectedScripts = selectedAgent
    ? scripts.filter((script) => selectedBindings.some((binding) => binding.scriptId === script.id))
    : []

  // Sync node data when agents or hookBindings change
  useEffect(() => {
    if (!loaded) return
    setNodes((prevNodes) =>
      prevNodes.map((node, index) => {
        const agentId = (node.data as AgentNodeData).agentId
        const newData = buildNodeData(agentId, agents, hookBindings, index)
        const oldData = node.data as AgentNodeData
        // Only update if data actually changed to avoid unnecessary re-renders
        if (
          oldData.agentName === newData.agentName &&
          oldData.description === newData.description &&
          oldData.hookCount === newData.hookCount &&
          oldData.scriptCount === newData.scriptCount &&
          oldData.model === newData.model
        ) {
          return node
        }
        return { ...node, data: newData }
      }),
    )
  }, [agents, hookBindings, loaded, setNodes])

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return
      setEdges((eds) => addEdge({ ...connection, id: makeId("edge"), animated: true, style: { strokeWidth: 2 } }, eds))
    },
    [setEdges],
  )

  const resetTemplate = () => {
    const template = createFivePhaseTemplate()
    setAgents(template.agents)
    setScripts(template.scripts)
    setHookBindings(template.hookBindings)
    setSettings(template.settings)
    setNodes(
      template.nodes.map((node, index) => ({
        id: node.id,
        type: "agent" as const,
        position: node.position,
        data: buildNodeData(node.agentId, template.agents, template.hookBindings, index),
      })),
    )
    setEdges(
      template.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        animated: true,
        style: { strokeWidth: 2 },
      })),
    )
    setSelectedNodeId(template.nodes[0]?.id || null)
  }

  const autoLayout = () => {
    setNodes((prevNodes) =>
      prevNodes.map((node, index) => ({
        ...node,
        position: { x: 120 + index * 320, y: 180 + (index % 2) * 36 },
      })),
    )
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

      setNodes((prev) => {
        const newNode: Node<AgentNodeData> = {
          id: makeId("node"),
          type: "agent",
          position,
          data: buildNodeData(data.agentId, agents, hookBindings, prev.length),
        }
        return [...prev, newNode]
      })

      dragDataRef.current = null
    },
    [screenToFlowPosition, setNodes, agents, hookBindings],
  )

  const handleAgentUpload = async (fileList: FileList | null) => {
    if (!fileList?.length) return
    const contents = await readTextFiles(fileList)
    const newAgents: AgentAsset[] = []
    const newBindings: HookBinding[] = []
    for (const file of contents) {
      const { agent, bindings } = parseAgentMarkdown(file.content, file.name)
      newAgents.push(agent)
      newBindings.push(...bindings)
    }
    setAgents((prev) => [...prev, ...newAgents])
    setHookBindings((prev) => [...prev, ...newBindings])
  }

  const handleScriptUpload = async (fileList: FileList | null) => {
    if (!fileList?.length) return
    const contents = await readTextFiles(fileList)
    setScripts((prev) => [
      ...prev,
      ...contents.map((file) => ({
        id: makeId("script"),
        name: sanitizeFileName(file.name).replace(/\.[^.]+$/, ""),
        fileName: sanitizeFileName(file.name),
        language: inferLanguage(file.name),
        content: file.content,
        origin: "upload" as const,
        createdAt: new Date().toISOString(),
      })),
    ])
  }

  const createAgent = useCallback(() => {
    setAgents((prev) => {
      const agent = createAgentAsset(`agent-${prev.length + 1}`)
      return [...prev, agent]
    })
  }, [])

  const createScript = () => {
    setScripts((prev) => [...prev, createScriptAsset(`hook-${prev.length + 1}.ts`)])
  }

  const updateSelectedAgent = (patch: Partial<AgentAsset>) => {
    if (!selectedAgent) return
    setAgents((prev) => prev.map((agent) => (agent.id === selectedAgent.id ? { ...agent, ...patch } : agent)))
  }

  const updateScript = (scriptId: string, patch: Partial<ScriptAsset>) => {
    setScripts((prev) => prev.map((script) => (script.id === scriptId ? { ...script, ...patch } : script)))
  }

  const addHookBinding = () => {
    if (!selectedAgent) return
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
    setHookBindings((prev) => [...prev, binding])
  }

  const removeHookBinding = (bindingId: string) => {
    setHookBindings((prev) => prev.filter((binding) => binding.id !== bindingId))
  }

  const removeAgentClass = useCallback(
    (agentId: string) => {
      // Find node IDs to remove
      const nodeIdsToRemove = new Set(
        nodes.filter((n) => (n.data as AgentNodeData).agentId === agentId).map((n) => n.id),
      )
      setAgents((prev) => prev.filter((a) => a.id !== agentId))
      setHookBindings((prev) => prev.filter((b) => b.agentId !== agentId))
      setNodes((prev) => prev.filter((n) => (n.data as AgentNodeData).agentId !== agentId))
      setEdges((prev) => prev.filter((e) => !nodeIdsToRemove.has(e.source) && !nodeIdsToRemove.has(e.target)))
      setSelectedNodeId(null)
    },
    [nodes, setNodes, setEdges],
  )

  const removeSelectedNode = useCallback(() => {
    if (!selectedNode) return
    setNodes((prev) => prev.filter((n) => n.id !== selectedNode.id))
    setEdges((prev) => prev.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id))
    setSelectedNodeId(null)
  }, [selectedNode, setNodes, setEdges])

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
    anchor.download = `${slugifyName(settings.workflowName || "claude-workflow")}.zip`
    anchor.click()
    URL.revokeObjectURL(url)
    setGeneratedDownloadState("done")
    setTimeout(() => setGeneratedDownloadState("idle"), 1200)
  }

  // Save state to localStorage (explicit button)
  const saveLocalState = () => {
    if (!appState) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState))
  }

  if (!loaded) {
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
              <Button variant="outline" onClick={saveLocalState}>
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
                    <Badge variant="secondary">{agents.length}</Badge>
                  </div>
                  <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
                    {agents.map((agent) => (
                      <div
                        key={agent.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "move"
                          dragDataRef.current = { agentId: agent.id }
                        }}
                        onClick={() => {
                          const node = nodes.find((item) => (item.data as AgentNodeData).agentId === agent.id)
                          if (node) {
                            setSelectedNodeId(node.id)
                            setInspectorTab("overview")
                          }
                        }}
                        className="cursor-grab active:cursor-grabbing rounded-[22px] border border-white/8 bg-white/[0.045] p-3 text-left transition hover:border-primary/40 hover:bg-white/[0.07]"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-medium text-white">{agent.name}</div>
                            <div className="mt-1 text-xs text-slate-400">{agent.fileName}</div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="default">{agent.model}</Badge>
                            <button
                              className="rounded-full p-0.5 text-slate-400 hover:bg-white/10 hover:text-red-400 transition"
                              onClick={(e) => {
                                e.stopPropagation()
                                removeAgentClass(agent.id)
                              }}
                            >
                              <X className="size-3.5" />
                            </button>
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
                    <Badge variant="secondary">{scripts.length}</Badge>
                  </div>
                  <div className="max-h-[220px] space-y-2 overflow-y-auto pr-1">
                    {scripts.map((script) => (
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
                <CardDescription>Validation keeps the generated bundle aligned with Claude Code's hook and subagent shapes.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                {metricCard("agents", agents.length, "Custom subagents in memory")}
                {metricCard("hooks", hookBindings.length, "Frontmatter + project bindings")}
                {metricCard("scripts", scripts.length, "Uploaded or inline hook scripts")}
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
                  <Badge variant="secondary">{settings.workflowName}</Badge>
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
                  setNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === node.id })))
                }}
                onPaneClick={() => {
                  setSelectedNodeId(null)
                  setNodes((nds) => nds.map((n) => ({ ...n, selected: false })))
                }}
                onDragOver={onDragOver}
                onDrop={onDrop}
                multiSelectionKeyCode={null}
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
              key={selectedAgent?.id || "empty-panel"}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              className="flex min-h-0 flex-col gap-4"
            >
              {selectedAgent ? (
              <Card className="border-white/10 bg-white/[0.04]">
                <CardHeader className="gap-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-white">
                        <Bot className="size-5 text-primary" /> {selectedAgent.name}
                      </CardTitle>
                      <CardDescription>
                        Deep-inspect the selected agent. Edit metadata, wire hooks, preview markdown, and edit linked scripts inline.
                      </CardDescription>
                    </div>
                    <Button variant="danger" size="sm" onClick={removeSelectedNode}>
                      <Trash2 className="size-4" /> Remove
                    </Button>
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
                                  {scripts.map((script) => (
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
                            const script = scripts.find((item) => item.id === binding.scriptId)
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

                  {inspectorTab === "output" && generated ? (
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
              ) : (
                <Card className="border-white/10 bg-white/[0.04]">
                  <CardContent className="flex items-center justify-center h-full min-h-[200px] text-muted-foreground">
                    <p>Select a node on the canvas to inspect it</p>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
