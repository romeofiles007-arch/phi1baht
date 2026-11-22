import assert from 'node:assert/strict'
import { test } from 'node:test'
let F
try { F = await import('../extension/flow-navigation.js') } catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error }
const api = () => { assert.ok(F, 'Flow account routing is missing'); return F }
test('only the remembered Flow tab is used; a Flow tab the user opened is never borrowed', () => {
  const tabs = [{ id: 1, url: 'https://flow.google.com/project/old', lastAccessed: 10 }, { id: 2, url: 'https://flow.google.com/?authuser=1', active: true, lastAccessed: 20 }]
  assert.equal(api().preferredFlowTab(tabs, 1).id, 1)
  assert.equal(api().preferredFlowTab(tabs, 3), null)
})
test('Flow home keeps account routing query parameters and path prefixes', () => {
  const F = api()
  assert.equal(F.flowHomeUrl('https://flow.google.com/project/old?authuser=1&hl=th'), 'https://flow.google.com/?authuser=1&hl=en')
  assert.equal(F.flowHomeUrl('https://flow.google.com/u/2/project/old?authuser=person%40example.com'), 'https://flow.google.com/u/2/?authuser=person%40example.com&hl=en')
  assert.equal(F.flowHomeUrl('https://other.example/project/old?authuser=1'), 'https://flow.google.com/?hl=en')
})
test('resuming a clip cannot navigate the selected account back to its old project', () => {
  const F = api()
  const current = 'https://flow.google.com/?authuser=1'
  assert.equal(F.flowJobNavigation(current, { projectUrl: 'https://flow.google.com/project/old?authuser=0' }).navigate, false)
  const differentProject = F.flowJobNavigation('https://flow.google.com/project/new?authuser=1', { projectUrl: 'https://flow.google.com/project/old' })
  assert.equal(differentProject.navigate, false)
  assert.ok(differentProject.error, 'another clip project must not be reused as this clip')
  assert.equal(F.flowJobNavigation('https://flow.google.com/project/old?authuser=1', { projectUrl: 'https://flow.google.com/project/old' }).navigate, false)
})
test('a new clip still gets a new project without switching to the default account', () => {
  const result = api().flowJobNavigation('https://flow.google.com/project/previous?authuser=1', { newProject: true })
  assert.equal(result.navigate, true)
  assert.equal(result.url, 'https://flow.google.com/?authuser=1&hl=en')
  assert.equal(api().flowJobNavigation('https://flow.google.com/?authuser=1', { newProject: true }).navigate, false)
})
