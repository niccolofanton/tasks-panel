import { expect, test } from 'claude-code/testing'

const NOW = Date.UTC(2026, 10, 16, 12, 0, 0)
const FILE = {
  tasks: {
    live: { session: 's1', desc: 'Render live sequence', step: 10, total: 40, machine: 'mac', status: 'running', startedAt: NOW - 100_000, updatedAt: NOW - 5_000, staleAfterSec: 60 },
    shipped: { session: 's1', desc: 'Ship release notes', step: 5, total: 5, machine: 'mac', status: 'done', startedAt: NOW - 300_000, updatedAt: NOW - 60_000, staleAfterSec: 60 },
    foreign: { session: 's2', desc: 'Other session task', step: 1, total: 2, machine: 'mac', status: 'running', startedAt: NOW - 10_000, updatedAt: NOW - 1_000, staleAfterSec: 60 },
    stuck: { session: 's1', desc: 'Upload frames', step: 3, total: 40, machine: 'gpu-box', status: 'running', startedAt: NOW - 200_000, updatedAt: NOW - 90_000, staleAfterSec: 60 },
  },
}

const PANE = {
  plugin: 'tasks-panel',
  component: 'Pane',
  requestId: 'tasks-panel',
  props: { title: 'Tasks', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

test('rows show percent, time left and stalled state', async ($, on) => {
  on('command.register', () => ({ value: { command: 'tasks-panel' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('env.get', () => ({ value: '/home/test' }))
  on('fs.read', () => ({ value: JSON.stringify(FILE) }))
  on('clock.now', () => ({ value: NOW }))
  on('clock.every', () => ({ value: undefined }))
  on('session.id', () => ({ value: 's1' }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /^25%$/ }))?.text).toBe('25%')
    expect((await ui.find({ type: 'Text', text: /4m 40s left/ }))?.text).toMatch(/^4m 40s left · ends \d\d:\d\d$/)
    expect((await ui.find({ type: 'Text', text: /^stalled$/ }))?.text).toBe('stalled')
    expect((await ui.find({ type: 'Text', text: /^running$/ }))?.text).toBe('running')
    expect((await ui.find({ type: 'Text', text: /^DONE$/ }))?.text).toBe('DONE')
    expect(await ui.find({ type: 'Text', text: /Other session/ })).toBeUndefined()
    expect((await ui.find({ type: 'Text', text: /^step 10\/40 · started/ }))?.text).toMatch(/updated 5s ago · mac · id live$/)
    await ui.unmount()
  }
})

test('the band sums up active tasks', async ($, on) => {
  on('ui.panes', () => ({ value: [] }))
  on('command.register', () => ({ value: { command: 'tasks-panel' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('env.get', () => ({ value: '/home/test' }))
  on('fs.read', () => ({ value: JSON.stringify(FILE) }))
  on('clock.now', () => ({ value: NOW }))
  on('clock.every', () => ({ value: undefined }))
  on('session.id', () => ({ value: 's1' }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({ plugin: 'tasks-panel', component: 'AbovePrompt', props: { hasSurvey: false, isCollapsed: false, isWorking: false, maxRows: 3, bodyColumns: 100, scroll: { offset: 0, bodyRows: 3 }, view: {} }, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /Render live/ }))?.text).toBe('Render live sequence')
  expect((await ui.find({ type: 'Text', text: /Open/ }))?.text).toBe('Open ↗')
  expect((await ui.find({ type: 'Text', text: /^\d\d:\d\d$/ }))?.text).toMatch(/^\d\d:\d\d$/)
  expect((await ui.find({ type: 'Text', text: /^Stalled$/ }))?.text).toBe('Stalled')
  expect((await ui.find({ type: 'Text', text: /active/ }))?.text).toBe('2 active')
  await ui.unmount()
})
