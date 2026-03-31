# Claude Workflow Studio

A local-first Next.js 16 app for designing Claude Code subagent workflows with a visually guided React Flow canvas.

## What it does

- Upload agent markdown files and persist them in localStorage.
- Upload or author hook scripts locally and bind them to hook events.
- Design phase transitions visually with React Flow.
- Attach hooks to agents with automatic placement rules:
  - `Stop` stays in frontmatter.
  - `SubagentStart` and `SubagentStop` generate in `.claude/settings.json` with agent matchers.
- Preview generated agent markdown, settings, and hook scripts side-by-side.
- Export a zip containing:
  - `.claude/agents/*.md`
  - `.claude/settings.json`
  - `.claude/workflows/<workflow>.json`
  - `.claude/hooks/*.ts`

## Run locally

```bash
pnpm install
pnpm dev
```

Then open `http://localhost:3000`.

## Notes

This app is deliberately local-first. Assets are stored in `localStorage`, not on a server.

The generated workflow bundle includes a generic transition guard and lifecycle scaffolds. They are intended as a solid starting point for enforcing custom multi-agent phase flows.
