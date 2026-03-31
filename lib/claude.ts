import YAML from "yaml"
import type {
  AgentAsset,
  AppState,
  ClaudeHookEvent,
  FlowEdgeRecord,
  GeneratedBundle,
  HookBinding,
  HookCatalogItem,
  HookPlacement,
  ScriptAsset,
  ValidationIssue,
} from "@/lib/types"

const ISO = () => new Date().toISOString()

export const STORAGE_KEY = "claude-workflow-studio/v1"

export const HOOK_CATALOG: HookCatalogItem[] = [
  { event: "SessionStart", category: "Session", description: "Runs when a session begins or resumes.", supportsMatcher: true, recommendedPlacement: "frontmatter" },
  { event: "InstructionsLoaded", category: "Session", description: "Fires when CLAUDE.md or rules files load into context.", supportsMatcher: true, recommendedPlacement: "frontmatter" },
  { event: "UserPromptSubmit", category: "Input", description: "Intercepts the user prompt before Claude processes it.", supportsMatcher: false, recommendedPlacement: "frontmatter" },
  { event: "PreToolUse", category: "Tools", description: "Runs before a tool executes. Ideal for validation and enforcement.", supportsMatcher: true, recommendedPlacement: "frontmatter", workflowHint: "Use a project-level Agent matcher to enforce next-step transitions." },
  { event: "PermissionRequest", category: "Tools", description: "Responds when Claude asks for tool permission.", supportsMatcher: true, recommendedPlacement: "frontmatter" },
  { event: "PostToolUse", category: "Tools", description: "Runs after a tool succeeds.", supportsMatcher: true, recommendedPlacement: "frontmatter" },
  { event: "PostToolUseFailure", category: "Tools", description: "Runs after a tool fails.", supportsMatcher: true, recommendedPlacement: "frontmatter" },
  { event: "Notification", category: "Session", description: "Triggered when Claude sends a notification.", supportsMatcher: true, recommendedPlacement: "frontmatter" },
  { event: "SubagentStart", category: "Subagents", description: "Project-level hook when a subagent begins execution.", supportsMatcher: true, recommendedPlacement: "project", workflowHint: "Best for transition bookkeeping and context injection." },
  { event: "SubagentStop", category: "Subagents", description: "Project-level hook when a subagent finishes.", supportsMatcher: true, recommendedPlacement: "project", workflowHint: "Best for phase completion gates." },
  { event: "TaskCreated", category: "Tasks", description: "Fires when a task is created through Agent Teams.", supportsMatcher: false, recommendedPlacement: "frontmatter" },
  { event: "TaskCompleted", category: "Tasks", description: "Fires when a task is marked complete through Agent Teams.", supportsMatcher: false, recommendedPlacement: "frontmatter" },
  { event: "Stop", category: "Subagents", description: "Frontmatter stop hook for a subagent; converts to SubagentStop at runtime.", supportsMatcher: false, recommendedPlacement: "frontmatter", workflowHint: "Use on the agent file when you want agent-local completion logic." },
  { event: "StopFailure", category: "Session", description: "Fires when a turn ends due to an API error.", supportsMatcher: false, recommendedPlacement: "frontmatter" },
  { event: "TeammateIdle", category: "Tasks", description: "Runs when an agent-team teammate is about to go idle.", supportsMatcher: false, recommendedPlacement: "frontmatter" },
  { event: "ConfigChange", category: "Environment", description: "Observes configuration changes during the session.", supportsMatcher: true, recommendedPlacement: "frontmatter" },
  { event: "CwdChanged", category: "Environment", description: "Runs when the working directory changes.", supportsMatcher: false, recommendedPlacement: "frontmatter" },
  { event: "FileChanged", category: "Environment", description: "Watches named files on disk and reacts when they change.", supportsMatcher: true, recommendedPlacement: "frontmatter" },
  { event: "WorktreeCreate", category: "Environment", description: "Runs when a worktree is being created.", supportsMatcher: false, recommendedPlacement: "frontmatter" },
  { event: "WorktreeRemove", category: "Environment", description: "Runs when a worktree is removed.", supportsMatcher: false, recommendedPlacement: "frontmatter" },
  { event: "PreCompact", category: "Session", description: "Runs before context compaction.", supportsMatcher: true, recommendedPlacement: "frontmatter" },
  { event: "PostCompact", category: "Session", description: "Runs after context compaction completes.", supportsMatcher: true, recommendedPlacement: "frontmatter" },
  { event: "SessionEnd", category: "Session", description: "Runs when a session terminates.", supportsMatcher: true, recommendedPlacement: "frontmatter" },
  { event: "Elicitation", category: "MCP", description: "Intercepts an MCP server request for user input.", supportsMatcher: false, recommendedPlacement: "frontmatter" },
  { event: "ElicitationResult", category: "MCP", description: "Observes the user response to an MCP elicitation.", supportsMatcher: false, recommendedPlacement: "frontmatter" },
]

export function slugifyName(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
}

export function makeId(prefix: string) {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)
  return `${prefix}-${random}`
}

export function getHookMeta(event: ClaudeHookEvent) {
  return HOOK_CATALOG.find((item) => item.event === event)
}

export function getPlacementForEvent(event: ClaudeHookEvent): HookPlacement {
  return event === "SubagentStart" || event === "SubagentStop" ? "project" : "frontmatter"
}

function parseCsvTools(value: unknown) {
  if (!value) return [] as string[]
  if (Array.isArray(value)) return value.map((item) => String(item)).map((item) => item.trim()).filter(Boolean)
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

function splitFrontmatter(markdown: string) {
  const match = markdown.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/)
  if (!match) {
    return { frontmatter: {}, body: markdown.trim() }
  }

  return {
    frontmatter: (YAML.parse(match[1]) ?? {}) as Record<string, unknown>,
    body: match[2].trim(),
  }
}

export function parseAgentMarkdown(markdown: string, fileName: string) {
  const { frontmatter, body } = splitFrontmatter(markdown)
  const stem = fileName.replace(/\.[^.]+$/, "")
  const name = slugifyName(String(frontmatter.name ?? (stem || "agent"))) || "agent"
  const agentId = makeId("agent")

  const agent: AgentAsset = {
    id: agentId,
    fileName,
    name,
    description: String(frontmatter.description ?? "Describe when Claude should delegate to this agent."),
    tools: parseCsvTools(frontmatter.tools),
    disallowedTools: parseCsvTools(frontmatter.disallowedTools),
    model: String(frontmatter.model ?? "inherit"),
    prompt: body || "You are a specialized workflow agent. Do your phase thoroughly and leave crisp artifacts for the next phase.",
    sourceMarkdown: markdown,
    createdAt: ISO(),
  }

  const bindings: HookBinding[] = []
  const frontmatterHooks = frontmatter.hooks
  if (frontmatterHooks && typeof frontmatterHooks === "object") {
    for (const [eventName, groups] of Object.entries(frontmatterHooks as Record<string, unknown>)) {
      if (!Array.isArray(groups)) continue
      for (const group of groups) {
        if (!group || typeof group !== "object") continue
        const matcher = typeof (group as { matcher?: unknown }).matcher === "string" ? String((group as { matcher?: unknown }).matcher) : undefined
        const handlers = Array.isArray((group as { hooks?: unknown }).hooks) ? ((group as { hooks?: unknown }).hooks as Array<Record<string, unknown>>) : []
        for (const handler of handlers) {
          const type = String(handler.type ?? "command") as HookBinding["handlerType"]
          bindings.push({
            id: makeId("binding"),
            agentId,
            event: eventName as ClaudeHookEvent,
            handlerType: type,
            placement: getPlacementForEvent(eventName as ClaudeHookEvent),
            matcher,
            ifCondition: typeof handler.if === "string" ? handler.if : undefined,
            commandText: typeof handler.command === "string" ? handler.command : undefined,
            promptText: typeof handler.prompt === "string" ? handler.prompt : undefined,
            url: typeof handler.url === "string" ? handler.url : undefined,
            model: typeof handler.model === "string" ? handler.model : undefined,
            timeout: typeof handler.timeout === "number" ? handler.timeout : undefined,
            async: typeof handler.async === "boolean" ? handler.async : undefined,
            once: typeof handler.once === "boolean" ? handler.once : undefined,
            statusMessage: typeof handler.statusMessage === "string" ? handler.statusMessage : undefined,
          })
        }
      }
    }
  }

  return { agent, bindings }
}

export function createScriptAsset(name = "workflow-hook.ts"): ScriptAsset {
  const fileName = sanitizeFileName(name.endsWith(".ts") ? name : `${slugifyName(name) || "workflow-hook"}.ts`)
  return {
    id: makeId("script"),
    name: fileName.replace(/\.[^.]+$/, ""),
    fileName,
    language: fileName.split(".").pop() || "ts",
    content: defaultScriptTemplate(fileName),
    origin: "inline",
    createdAt: ISO(),
  }
}

export function createAgentAsset(title = "workflow-agent"): AgentAsset {
  const name = slugifyName(title) || "workflow-agent"
  return {
    id: makeId("agent"),
    fileName: `${name}.md`,
    name,
    description: "Specialized workflow phase agent. Use proactively when this exact phase is needed.",
    tools: [],
    disallowedTools: [],
    model: "inherit",
    prompt: "You own this workflow phase. Produce durable outputs for the next phase and clearly state pass/fail criteria.",
    createdAt: ISO(),
  }
}

export function createBlankAppState(): AppState {
  return {
    version: 1,
    agents: [],
    scripts: [],
    hookBindings: [],
    nodes: [],
    edges: [],
    settings: {
      workflowName: "my-workflow",
      autoGenerateWorkflowGuard: true,
      includeLifecycleScaffolds: true,
    },
  }
}

export function createFivePhaseTemplate(): AppState {
  const titles = [
    ["wf-specify", "Write the task spec first. Capture scope, acceptance criteria, and artifacts required for downstream steps."],
    ["wf-implement", "Implement directly from the approved spec. Avoid drifting beyond defined scope."],
    ["wf-verify", "Review work in a separate session, validate protocol compliance, and call out regressions or omissions."],
    ["wf-test", "Author and run comprehensive automated tests before integration."],
    ["wf-integrate", "Merge validated work into the mainline only after verify and test pass."],
  ] as const

  const agents = titles.map(([name, description]) => ({
    ...createAgentAsset(name),
    name,
    fileName: `${name}.md`,
    description,
    prompt: `You are the ${name.replace(/^wf-/, "").toUpperCase()} phase agent in a strict five-phase build loop.\n\nResponsibilities:\n- Complete only this phase.\n- Surface anything missing from previous phases.\n- Produce outputs that make the next phase unambiguous.\n- Never silently skip gates.`,
  }))

  const nodes = agents.map((agent, index) => ({
    id: `node-${index + 1}`,
    agentId: agent.id,
    position: { x: 120 + index * 320, y: 160 + (index % 2) * 40 },
  }))

  const edges: FlowEdgeRecord[] = nodes.slice(0, -1).map((node, index) => ({
    id: `edge-${index + 1}`,
    source: node.id,
    target: nodes[index + 1].id,
  }))

  return {
    version: 1,
    agents,
    scripts: [createScriptAsset("workflow-guard.ts")],
    hookBindings: [],
    nodes,
    edges,
    settings: {
      workflowName: "five-phase-build-loop",
      autoGenerateWorkflowGuard: true,
      includeLifecycleScaffolds: true,
    },
  }
}

export function sanitizeFileName(input: string) {
  const cleaned = input.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-{2,}/g, "-")
  return cleaned || "hook.ts"
}

export function inferLanguage(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() || "txt"
}

export function defaultScriptTemplate(fileName: string) {
  const extension = inferLanguage(fileName)
  if (extension === "py") {
    return "import json\nimport sys\n\ninput_data = json.load(sys.stdin)\nprint(json.dumps({\"ok\": True}))\n"
  }
  if (extension === "sh" || extension === "bash") {
    return "#!/usr/bin/env bash\nset -euo pipefail\ninput=$(cat)\necho \"$input\" >/dev/null\nexit 0\n"
  }
  return `type HookInput = Record<string, unknown>\n\nconst input = JSON.parse(await new Response(process.stdin as any).text()) as HookInput\nvoid input\n\nprocess.stdout.write(JSON.stringify({ ok: true }, null, 2))\n`
}

export function addAgentNode(state: AppState, agentId: string) {
  const nextIndex = state.nodes.length
  state.nodes.push({
    id: makeId("node"),
    agentId,
    position: { x: 140 + nextIndex * 140, y: 180 + (nextIndex % 3) * 120 },
  })
}

function bindingHandlerObject(binding: HookBinding, scripts: ScriptAsset[]) {
  const base: Record<string, unknown> = { type: binding.handlerType }
  if (binding.ifCondition) base.if = binding.ifCondition
  if (typeof binding.timeout === "number") base.timeout = binding.timeout
  if (typeof binding.async === "boolean") base.async = binding.async
  if (typeof binding.once === "boolean") base.once = binding.once
  if (binding.statusMessage) base.statusMessage = binding.statusMessage
  if (binding.model) base.model = binding.model

  if (binding.handlerType === "command") {
    const script = scripts.find((item) => item.id === binding.scriptId)
    base.command = script ? commandForScript(script) : binding.commandText || "echo 'TODO: configure command hook'"
  } else if (binding.handlerType === "http") {
    base.url = binding.url || "http://localhost:3001/hooks"
  } else {
    base.prompt = binding.promptText || "Evaluate the hook input in $ARGUMENTS and return valid JSON."
  }

  return base
}

export function commandForScript(script: ScriptAsset) {
  const safeName = sanitizeFileName(script.fileName)
  const quotedPath = `\"$CLAUDE_PROJECT_DIR/.claude/hooks/${safeName}\"`
  const ext = inferLanguage(safeName)

  if (["ts", "tsx", "mts", "cts"].includes(ext)) return `npx -y tsx ${quotedPath}`
  if (["js", "mjs", "cjs"].includes(ext)) return `node ${quotedPath}`
  if (ext === "py") return `python3 ${quotedPath}`
  if (["sh", "bash"].includes(ext)) return `bash ${quotedPath}`
  return quotedPath
}

export function buildAgentMarkdown(agent: AgentAsset, bindings: HookBinding[], scripts: ScriptAsset[]) {
  const frontmatter: Record<string, unknown> = {
    name: agent.name,
    description: agent.description,
  }
  if (agent.tools.length) frontmatter.tools = agent.tools.join(", ")
  if (agent.disallowedTools.length) frontmatter.disallowedTools = agent.disallowedTools.join(", ")
  if (agent.model && agent.model !== "inherit") frontmatter.model = agent.model

  const frontmatterBindings = bindings.filter((binding) => binding.placement === "frontmatter")
  if (frontmatterBindings.length) {
    const hooks: Record<string, unknown[]> = {}
    for (const binding of frontmatterBindings) {
      hooks[binding.event] ||= []
      ;(hooks[binding.event] as unknown[]).push({
        ...(binding.matcher && getHookMeta(binding.event)?.supportsMatcher ? { matcher: binding.matcher } : {}),
        hooks: [bindingHandlerObject(binding, scripts)],
      })
    }
    frontmatter.hooks = hooks
  }

  const yaml = YAML.stringify(frontmatter).trim()
  const prompt = agent.prompt.trim() || "You are a workflow subagent."
  return `---\n${yaml}\n---\n\n${prompt}\n`
}

function incomingTargets(edges: FlowEdgeRecord[]) {
  const incoming = new Set(edges.map((edge) => edge.target))
  return incoming
}

function agentRegex(agents: AgentAsset[]) {
  return agents.map((agent) => agent.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")
}

function projectHookGroups(state: AppState) {
  const groups: Record<string, Array<Record<string, unknown>>> = {}
  const addGroup = (event: string, group: Record<string, unknown>) => {
    groups[event] ||= []
    groups[event].push(group)
  }

  for (const binding of state.hookBindings.filter((item) => item.placement === "project")) {
    const agent = state.agents.find((candidate) => candidate.id === binding.agentId)
    addGroup(binding.event, {
      ...(getHookMeta(binding.event)?.supportsMatcher ? { matcher: binding.matcher || agent?.name || "" } : {}),
      hooks: [bindingHandlerObject(binding, state.scripts)],
    })
  }

  if (state.settings.autoGenerateWorkflowGuard) {
    addGroup("PreToolUse", {
      matcher: "Agent",
      hooks: [{ type: "command", command: 'npx -y tsx "$CLAUDE_PROJECT_DIR/.claude/hooks/workflow-guard.ts"' }],
    })
  }

  if (state.settings.includeLifecycleScaffolds && state.agents.length) {
    const matcher = agentRegex(state.agents)
    addGroup("SubagentStart", {
      matcher,
      hooks: [{ type: "command", command: 'npx -y tsx "$CLAUDE_PROJECT_DIR/.claude/hooks/workflow-subagent-start.ts"' }],
    })
    addGroup("SubagentStop", {
      matcher,
      hooks: [{ type: "command", command: 'npx -y tsx "$CLAUDE_PROJECT_DIR/.claude/hooks/workflow-subagent-stop.ts"' }],
    })
  }

  return groups
}

function buildSettingsJson(state: AppState) {
  const hooks = projectHookGroups(state)
  return JSON.stringify({ hooks }, null, 2)
}

function buildManifest(state: AppState) {
  const nodesById = new Map(state.nodes.map((node) => [node.id, node]))
  const incoming = incomingTargets(state.edges)
  const startNodes = state.nodes.filter((node) => !incoming.has(node.id))
  const phases = state.nodes.map((node, index) => {
    const agent = state.agents.find((candidate) => candidate.id === node.agentId)
    return {
      order: index + 1,
      nodeId: node.id,
      agentId: agent?.id,
      agentName: agent?.name,
      description: agent?.description,
      next: state.edges
        .filter((edge) => edge.source === node.id)
        .map((edge) => nodesById.get(edge.target))
        .map((nextNode) => state.agents.find((candidate) => candidate.id === nextNode?.agentId)?.name)
        .filter(Boolean),
    }
  })

  return JSON.stringify(
    {
      workflowName: state.settings.workflowName,
      createdAt: ISO(),
      startAgents: startNodes
        .map((node) => state.agents.find((candidate) => candidate.id === node.agentId)?.name)
        .filter(Boolean),
      phases,
    },
    null,
    2,
  )
}

function buildWorkflowEngine(state: AppState) {
  return `import fs from "node:fs"
import path from "node:path"

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd()
const manifestPath = path.join(projectDir, ".claude/workflows/${sanitizeFileName(state.settings.workflowName)}.json")
const stateDir = path.join(projectDir, ".claude/workflows/.state")

type Manifest = {
  workflowName: string
  startAgents: string[]
  phases: Array<{ agentName: string; next: string[] }>
}

type SessionState = {
  sessionId: string
  activeAgent?: string
  completed: string[]
  history: Array<{ event: string; agent: string; at: string }>
}

export function readManifest(): Manifest {
  return JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Manifest
}

export function getStatePath(sessionId: string) {
  fs.mkdirSync(stateDir, { recursive: true })
  return path.join(stateDir, sessionId + ".json")
}

export function readState(sessionId: string): SessionState {
  const filePath = getStatePath(sessionId)
  if (!fs.existsSync(filePath)) {
    return { sessionId, completed: [], history: [] }
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as SessionState
}

export function writeState(sessionId: string, state: SessionState) {
  fs.mkdirSync(stateDir, { recursive: true })
  fs.writeFileSync(getStatePath(sessionId), JSON.stringify(state, null, 2))
}

export function allowedNextAgents(sessionId: string) {
  const manifest = readManifest()
  const state = readState(sessionId)
  if (!state.completed.length) return manifest.startAgents

  const lastCompleted = state.completed[state.completed.length - 1]
  const phase = manifest.phases.find((item) => item.agentName === lastCompleted)
  return phase?.next || []
}
`
}

function buildWorkflowGuard() {
  return `import { allowedNextAgents, readState } from "./workflow-engine"

type AgentInput = {
  session_id: string
  tool_name: string
  tool_input?: {
    subagent_type?: string
    agent_type?: string
  }
}

const raw = await new Response(process.stdin as any).text()
const input = JSON.parse(raw) as AgentInput
const requested = input.tool_input?.subagent_type || input.tool_input?.agent_type

if (!requested) {
  process.exit(0)
}

const allowed = allowedNextAgents(input.session_id)
const currentState = readState(input.session_id)

if (!allowed.length || allowed.includes(requested)) {
  process.exit(0)
}

process.stdout.write(
  JSON.stringify(
    {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason:
          "Workflow guard blocked " +
          requested +
          ". Next allowed agent(s): " +
          allowed.join(", ") +
          ". Completed phases: " +
          (currentState.completed.join(", ") || "none") +
          ".",
      },
    },
    null,
    2,
  ),
)
`
}

function buildLifecycleStart() {
  return `import { readState, writeState } from "./workflow-engine"

type Input = { session_id: string; agent_type: string }
const raw = await new Response(process.stdin as any).text()
const input = JSON.parse(raw) as Input
const state = readState(input.session_id)
state.activeAgent = input.agent_type
state.history.push({ event: "SubagentStart", agent: input.agent_type, at: new Date().toISOString() })
writeState(input.session_id, state)
`
}

function buildLifecycleStop() {
  return `import { readState, writeState } from "./workflow-engine"

type Input = { session_id: string; agent_type: string }
const raw = await new Response(process.stdin as any).text()
const input = JSON.parse(raw) as Input
const state = readState(input.session_id)
state.activeAgent = undefined
if (!state.completed.includes(input.agent_type)) {
  state.completed.push(input.agent_type)
}
state.history.push({ event: "SubagentStop", agent: input.agent_type, at: new Date().toISOString() })
writeState(input.session_id, state)
`
}

export function validateState(state: AppState): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  if (!state.agents.length) {
    issues.push({ severity: "error", message: "Add at least one agent markdown file before generating outputs." })
  }
  if (!state.nodes.length) {
    issues.push({ severity: "error", message: "Place at least one agent node on the canvas." })
  }

  const names = new Map<string, number>()
  for (const agent of state.agents) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(agent.name)) {
      issues.push({ severity: "error", message: `${agent.name}: agent names must use lowercase letters, numbers, and hyphens.` })
    }
    if (!agent.description.trim()) {
      issues.push({ severity: "error", message: `${agent.name}: description is required.` })
    }
    names.set(agent.name, (names.get(agent.name) || 0) + 1)
  }

  for (const [name, count] of names.entries()) {
    if (count > 1) {
      issues.push({ severity: "error", message: `Agent name \"${name}\" appears more than once. Names must be unique.` })
    }
  }

  for (const binding of state.hookBindings) {
    if (binding.handlerType === "command" && !binding.scriptId && !binding.commandText) {
      const agent = state.agents.find((item) => item.id === binding.agentId)
      issues.push({ severity: "error", message: `${agent?.name || "Agent"}: ${binding.event} command hook has no script or command configured.` })
    }
    if ((binding.event === "SubagentStart" || binding.event === "SubagentStop") && binding.placement !== "project") {
      issues.push({ severity: "warning", message: `${binding.event} is generated as a project-level hook, not frontmatter.` })
    }
  }

  if (!state.edges.length && state.nodes.length > 1) {
    issues.push({ severity: "warning", message: "The workflow has multiple nodes but no transitions between them." })
  }

  return issues
}

export function generateBundle(state: AppState): GeneratedBundle {
  const issues = validateState(state)
  const files: Record<string, string> = {}

  for (const agent of state.agents) {
    const bindings = state.hookBindings.filter((binding) => binding.agentId === agent.id)
    files[`.claude/agents/${sanitizeFileName(agent.fileName)}`] = buildAgentMarkdown(agent, bindings, state.scripts)
  }

  files[`.claude/settings.json`] = buildSettingsJson(state)
  files[`.claude/workflows/${sanitizeFileName(state.settings.workflowName)}.json`] = buildManifest(state)

  for (const script of state.scripts) {
    files[`.claude/hooks/${sanitizeFileName(script.fileName)}`] = script.content
  }

  if (state.settings.autoGenerateWorkflowGuard || state.settings.includeLifecycleScaffolds) {
    files[`.claude/hooks/workflow-engine.ts`] = buildWorkflowEngine(state)
  }
  if (state.settings.autoGenerateWorkflowGuard) {
    files[`.claude/hooks/workflow-guard.ts`] = buildWorkflowGuard()
  }
  if (state.settings.includeLifecycleScaffolds) {
    files[`.claude/hooks/workflow-subagent-start.ts`] = buildLifecycleStart()
    files[`.claude/hooks/workflow-subagent-stop.ts`] = buildLifecycleStop()
  }

  files[`README.generated.md`] = `# ${state.settings.workflowName}\n\nGenerated by Claude Workflow Studio.\n\n## Included artifacts\n- Agent markdown files in .claude/agents\n- Project settings in .claude/settings.json\n- Workflow manifest in .claude/workflows\n- Hook scripts in .claude/hooks\n`

  return { files, issues }
}
