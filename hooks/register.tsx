import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Snapshot, TaskEntry } from '../types'

const PANE = 'tasks-panel'
const TITLE = 'Tasks'
const POLL_MS = 2000
const BAR = 12
const BAND_BAR = 10
const BAND_MAX = 3
const BAR_PX = 88
const STATE_HEX = { running: '#4C8DF6', stalled: '#E5A33B', done: '#3FB950', failed: '#F85149' } as const
const snapshot = atom({ plugin: 'tasks-panel', key: 'snapshot' } as const, { tasks: [], now: 0 }, {
  shape: 'snapshot-2',
})
const isBandExpanded = atom({ plugin: 'tasks-panel', key: 'isBandExpanded' } as const, false)

type Row = {
  id: string
  desc: string
  percent: string
  remaining: string
  endsAt: string
  machine: string
  ratio: number
  state: 'running' | 'stalled' | 'done' | 'failed'
  detail: string
}

const pad = (n: number) => String(n).padStart(2, '0')

const formatDuration = (ms: number) => {
  const sec = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return h > 0 ? `${h}h ${pad(m)}m` : m > 0 ? `${m}m ${pad(s)}s` : `${s}s`
}

const formatClock = (ms: number) => {
  const d = new Date(ms)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const toRow = (task: TaskEntry, now: number): Row => {
  const isStalled = task.status === 'running' && now - task.updatedAt > task.staleAfterSec * 1000
  const state: Row['state'] = isStalled ? 'stalled' : task.status
  const ratio = task.total > 0 ? Math.min(1, task.step / task.total) : 0
  const elapsed = task.updatedAt - task.startedAt
  const steps = task.total > 0 ? `step ${task.step}/${task.total}` : `step ${task.step}`
  const detail = `${steps} · started ${formatClock(task.startedAt)} · updated ${formatDuration(now - task.updatedAt)} ago · ${task.machine} · id ${task.id}`
  const row: Row = { id: task.id, desc: task.desc, machine: task.machine, state, ratio, detail, percent: task.total > 0 ? `${Math.round(ratio * 100)}%` : '–', remaining: '–', endsAt: '–' }

  if (task.status !== 'running') return { ...row, remaining: '0s', endsAt: formatClock(task.updatedAt) }
  if (task.step <= 0 || elapsed <= 0 || task.total <= 0) return row

  const endsAt = task.updatedAt + (elapsed / task.step) * (task.total - task.step)
  return { ...row, remaining: isStalled ? '–' : formatDuration(endsAt - now), endsAt: formatClock(endsAt) }
}

const loadSnapshot = async ($: EngineInterface, file: string, session: string): Promise<Snapshot> => {
  const now = await $.clock.now()
  try {
    const data = JSON.parse(await $.fs.read(file)) as { tasks?: Record<string, Omit<TaskEntry, 'id'> & { id?: string }> }
    const tasks = Object.entries(data.tasks ?? {})
      .map(([key, task]) => ({ ...task, id: task.id ?? key }))
      .filter(task => task.session === session)
    tasks.sort((a, b) => b.startedAt - a.startedAt || a.id.localeCompare(b.id))
    return { tasks, now }
  } catch (err) {
    const missing = err instanceof Error && /ENOENT|not found|missing/i.test(err.message)
    return { tasks: [], now, error: missing ? undefined : `Cannot read ${file}` }
  }
}

const STATE_COLOR = { running: 'suggestion', stalled: 'warning', done: 'success', failed: 'error' } as const

type Elements = ReturnType<EngineInterface['ui']['resolve']>

const tooltip = ({ Box, Text }: Elements, row: Row, top: number) => (
  <Box
    position="absolute"
    top={top}
    left={0}
    right={0}
    display="none"
    hover={{ display: 'flex' }}
    flexDirection="column"
    paddingX={1}
    borderStyle="round"
    borderColor="#3a3a3a"
    backgroundColor="#1d1d1f"
  >
    <Text size="footnote" color="#f2f2f2">{row.desc}</Text>
    <Text size="footnote" color="#a0a0a0">{row.detail}</Text>
  </Box>
)

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const home = await $.env.get('HOME')
    const file = (await $.env.get('TASKS_PANEL_FILE')) ?? `${home}/.claude/tasks-panel/tasks.json`
    const session = await $.session.id()
    const refresh = async () => {
      const fresh = await loadSnapshot($, file, session)
      await update($, snapshot, () => fresh)
    }

    await $.command.register({ name: 'tasks-panel', description: 'Show the running tasks pane' })
    await refresh()
    $.clock.every(POLL_MS, () => void refresh())
    void $.ui.open({ id: PANE, title: TITLE })

    return next(e)
  })

  on('command.run', { command: 'tasks-panel' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })
    return { text: 'Tasks pane opened.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const elements = $.ui.resolve(e)
    const { Box, Text } = elements
    const { tasks, now, error } = await read($, snapshot)
    const rows = tasks.map(task => toRow(task, now))
    const done = rows.filter(row => row.state === 'done')
    const active = rows.filter(row => row.state !== 'done')
    const paneRow = (row: Row) => (
      <Box key={`pane-${row.id}`} position="relative" flexDirection="column" marginBottom={1}>
        <Box flexDirection="row" justifyContent="space-between" gap={1}>
          <Box flexShrink={1}>
            <Text size="footnote" weight="semibold" dimColor={row.state === 'done'}>{row.desc}</Text>
          </Box>
          <Box flexShrink={0}>
            <Text size="caption" color={STATE_COLOR[row.state]} weight="medium">{row.state}</Text>
          </Box>
        </Box>
        <Box flexDirection="row" justifyContent="space-between" gap={1}>
          <Box flexDirection="row" gap={1}>
            <Box flexDirection="row">
              <Text size="caption" mono color={STATE_COLOR[row.state]}>{'█'.repeat(Math.round(row.ratio * BAR))}</Text>
              <Text size="caption" mono dimColor>{'░'.repeat(BAR - Math.round(row.ratio * BAR))}</Text>
            </Box>
            <Text size="caption" mono>{row.percent}</Text>
            <Text size="caption" dimColor>{timing(row)}</Text>
          </Box>
          <Text size="caption" dimColor>{row.machine}</Text>
        </Box>
        {tooltip(elements, row, 2)}
      </Box>
    )
    const timing = (row: Row) =>
      row.state === 'done' || row.state === 'failed'
        ? `finished ${row.endsAt}`
        : row.remaining === '–' ? 'ETA unknown' : `${row.remaining} left · ends ${row.endsAt}`

    return (
      <Box flexDirection="column">
        {error && <Text color="error">{error}</Text>}
        {rows.length === 0 && !error && (
          <Text size="footnote" dimColor>No tasks. Add one with: tasks-panel set &lt;id&gt; --desc … --step N --total M</Text>
        )}
        {active.map(paneRow)}
        {done.length > 0 && (
          <Box flexDirection="row" gap={1} marginTop={active.length > 0 ? 1 : 0} marginBottom={1}>
            <Text size="caption" weight="semibold" dimColor>DONE</Text>
            <Text size="caption" dimColor>{done.length}</Text>
          </Box>
        )}
        {done.map(paneRow)}
      </Box>
    )
  })

  on('ui.close', async ($, e, next) => {
    const closed = await next(e)
    if (e.id === PANE) $.ui.invalidate('ui.render')
    return closed
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const { tasks, now } = await read($, snapshot)
    const active = tasks.map(task => toRow(task, now)).filter(row => row.state === 'running' || row.state === 'stalled')
    if (e.props.hasSurvey || active.length === 0) return next(e)

    const elements = $.ui.resolve(e)
    const { Box, Button, Text } = elements
    const Svg = 'Svg' in elements ? elements.Svg : undefined
    const isExpanded = await read($, isBandExpanded)
    const shown = active.slice(0, isExpanded ? Math.max(1, e.props.maxRows - 1) : BAND_MAX)
    const hidden = active.length - shown.length

    const isToggleable = active.length > BAND_MAX
    const isPaneOpen = (await $.ui.panes()).some(pane => pane.id === PANE && pane.isShown)
    const togglePane = async () => {
      await (isPaneOpen ? $.ui.close({ id: PANE }) : $.ui.open({ id: PANE, title: TITLE }))
      $.ui.invalidate('ui.render')
    }
    const spacer = Svg
      ? <Svg alt="spacer" width={8} height={8} source='<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="transparent"/></svg>' />
      : <Text size="footnote"> </Text>

    const dot = (row: Row) => {
      if (!Svg) return <Text size="footnote" color={STATE_COLOR[row.state]}>{row.state === 'stalled' ? '○' : '●'}</Text>
      const shape = row.state === 'stalled'
        ? `<circle cx="4" cy="4" r="3" fill="none" stroke="${STATE_HEX.stalled}" stroke-width="2"/>`
        : `<circle cx="4" cy="4" r="4" fill="${STATE_HEX[row.state]}"/>`
      return (
        <Svg
          alt={row.state}
          width={8}
          height={8}
          source={`<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 8 8">${shape}</svg>`}
        />
      )
    }

    const bar = (row: Row) => {
      if (!Svg) {
        const filled = Math.round(row.ratio * BAND_BAR)
        return (
          <Box flexDirection="row" flexShrink={0}>
            <Text size="footnote" mono color={STATE_COLOR[row.state]}>{'█'.repeat(filled)}</Text>
            <Text size="footnote" mono dimColor>{'░'.repeat(BAND_BAR - filled)}</Text>
          </Box>
        )
      }
      const fill = row.ratio > 0 ? Math.max(4, Math.round(row.ratio * BAR_PX)) : 0
      return (
        <Svg
          alt={`${row.percent} complete`}
          width={BAR_PX}
          height={4}
          source={`<svg xmlns="http://www.w3.org/2000/svg" width="${BAR_PX}" height="4" viewBox="0 0 ${BAR_PX} 4"><rect width="${BAR_PX}" height="4" rx="2" fill="rgba(127,127,127,0.28)"/><rect width="${fill}" height="4" rx="2" fill="${STATE_HEX[row.state]}"/></svg>`}
        />
      )
    }

    return (
      <Box flexDirection="column" rowGap="xs">
        {shown.map(row => (
          <Box key={`band-${row.id}`} position="relative" flexDirection="row" alignItems="center" columnGap={2} paddingRight={1}>
            <Box flexDirection="row" alignItems="center" columnGap={1} flexGrow={1} flexShrink={1} minWidth={0}>
              {dot(row)}
              <Text size="footnote" wrap="truncate-end">{row.desc}</Text>
            </Box>
            <Box flexShrink={0}>{bar(row)}</Box>
            <Box width={5} flexShrink={0} justifyContent="flex-end">
              <Text size="footnote" tabular>{row.percent}</Text>
            </Box>
            <Box width={7} flexShrink={0}>
              {row.state === 'stalled'
                ? <Text size="footnote" color="warning">Stalled</Text>
                : <Text size="footnote" tabular dimColor>{row.endsAt}</Text>}
            </Box>
            <Box width={10} flexShrink={0} justifyContent="flex-end">
              <Text size="footnote" dimColor wrap="truncate-end">{row.machine}</Text>
            </Box>
            {tooltip(elements, row, 0)}
          </Box>
        ))}
        <Box flexDirection="row" alignItems="center" columnGap={2}>
          <Box flexDirection="row" alignItems="center" columnGap={1} flexGrow={1} flexShrink={1} minWidth={0}>
            {!isToggleable && spacer}
            {isToggleable ? (
              <Button key="toggle" plain dimColor onPress={() => void update($, isBandExpanded, value => !value)}>
                <Text size="footnote">{isExpanded ? '▾ Compact' : `▴ +${hidden} more ${hidden === 1 ? 'task' : 'tasks'}`}</Text>
              </Button>
            ) : (
              <Text size="footnote" dimColor>{active.length} active</Text>
            )}
          </Box>
          <Box flexDirection="row" alignItems="center" columnGap={1} flexShrink={0}>
            <Button key="open" plain dimColor onPress={() => void togglePane()}>
              <Text size="footnote">{isPaneOpen ? 'Close ✕' : 'Open ↗'}</Text>
            </Button>
          </Box>
        </Box>
      </Box>
    )
  })
}
