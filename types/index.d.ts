export type TaskEntry = {
  id: string
  session: string
  desc: string
  step: number
  total: number
  machine: string
  status: 'running' | 'done' | 'failed'
  startedAt: number
  updatedAt: number
  staleAfterSec: number
}

export type Snapshot = { tasks: TaskEntry[]; now: number; error?: string }

declare module 'claude-code' {
  interface PluginState {
    'tasks-panel': { snapshot: Shaped<Snapshot>; isBandExpanded: boolean }
  }
}
