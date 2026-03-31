/** @format */

export type ClaudeHookEvent =
  | "SessionStart"
  | "InstructionsLoaded"
  | "UserPromptSubmit"
  | "PreToolUse"
  | "PermissionRequest"
  | "PostToolUse"
  | "PostToolUseFailure"
  | "Notification"
  | "SubagentStart"
  | "SubagentStop"
  | "TaskCreated"
  | "TaskCompleted"
  | "Stop"
  | "StopFailure"
  | "TeammateIdle"
  | "ConfigChange"
  | "CwdChanged"
  | "FileChanged"
  | "WorktreeCreate"
  | "WorktreeRemove"
  | "PreCompact"
  | "PostCompact"
  | "SessionEnd"
  | "Elicitation"
  | "ElicitationResult"

export type HookHandlerType = "command" | "prompt" | "agent" | "http"
export type HookPlacement = "frontmatter" | "project"

export type HookCatalogItem = {
  event: ClaudeHookEvent
  category: string
  description: string
  supportsMatcher: boolean
  recommendedPlacement: HookPlacement
  workflowHint?: string
}

export type ScriptAsset = {
  id: string
  name: string
  fileName: string
  language: string
  content: string
  origin: "upload" | "inline" | "generated"
  createdAt: string
}

export type AgentAsset = {
  id: string
  fileName: string
  name: string
  description: string
  tools: string[]
  disallowedTools: string[]
  model: string
  prompt: string
  sourceMarkdown?: string
  createdAt: string
}

export type HookBinding = {
  id: string
  agentId: string
  event: ClaudeHookEvent
  handlerType: HookHandlerType
  placement: HookPlacement
  matcher?: string
  ifCondition?: string
  scriptId?: string
  commandText?: string
  promptText?: string
  url?: string
  model?: string
  timeout?: number
  async?: boolean
  once?: boolean
  statusMessage?: string
}

export type FlowNodeRecord = {
  id: string
  agentId: string
  type?: "agent" | "hook"
  hookBindingId?: string
  position: { x: number; y: number }
  selected?: boolean
}

export type FlowEdgeRecord = {
  id: string
  source: string
  target: string
  label?: string
  style?: Record<string, unknown>
  animated?: boolean
  labelStyle?: Record<string, unknown>
  selected?: boolean
}

export type WorkflowSettings = {
  workflowName: string
  autoGenerateWorkflowGuard: boolean
  includeLifecycleScaffolds: boolean
}

export type ValidationIssue = {
  severity: "error" | "warning"
  message: string
}

export type GeneratedBundle = {
  files: Record<string, string>
  issues: ValidationIssue[]
}

export type AppState = {
  readonly version: number
  readonly agents: readonly AgentAsset[]
  readonly scripts: readonly ScriptAsset[]
  readonly hookBindings: readonly HookBinding[]
  readonly nodes: readonly FlowNodeRecord[]
  readonly edges: readonly FlowEdgeRecord[]
  readonly settings: WorkflowSettings
}

export type AgentNodeData = {
  agentId: string
  agentName: string
  description: string
  phaseIndex: number
  hookCount: number
  scriptCount: number
  model: string
}

export type HookNodeData = {
  hookBindingId: string
  event: string
  matcher?: string
  ifCondition?: string
  handlerType: string
  [key: string]: unknown
}
