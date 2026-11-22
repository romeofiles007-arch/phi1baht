#!/usr/bin/env node
/** กฎแพ็กเกจลูกค้า: ของลิขสิทธิ์/ความลับต้องไม่ถึงลูกค้า (repo จะเป็น public) · repo ของตัวอัปเดตคือ phi1baht */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT } from '../pipeline/lib/config.mjs'
import { shipsToCustomer, githubRepoUrl, installerProblems, RESET } from '../bridge/package-rules.js'

test('ไม่ส่งภาพอ้างอิงลิขสิทธิ์ ความลับ ข้อมูลผู้ใช้', () => {
  for (const f of [
    'references/onebaht/covers/x.jpg', 'references/SOURCES.md', '.env', 'native/.keys/extension.pem',
    'assets/style-kit-raw/kit-cover.png', 'assets/phi-raw/app-icon.png', '.superpowers/sdd/x.md',
    'projects/ผีบ้านนา/01_script/script.json', 'projects/selected_topic.json',
  ]) assert.equal(shipsToCustomer(f), false, f)
})

test('ส่งของที่ต้องใช้', () => {
  for (const f of ['extension/style-kit/kit.json', 'assets/fonts/Mali-Medium.ttf', 'bridge/server.js', 'config/default.config.json'])
    assert.equal(shipsToCustomer(f), true, f)
  for (const f of Object.keys(RESET)) assert.equal(shipsToCustomer(f), true, `${f} (ค่าว่างของลูกค้า)`)
})

test('ตัวอัปเดตใช้ repo phi1baht ไม่ใช่ china', () => {
  const repo = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).repository.url
  assert.equal(repo, 'https://github.com/romeofiles007-arch/phi1baht')
  assert.equal(githubRepoUrl('git@github.com:romeofiles007-arch/phi1baht.git'), repo)
})

test('zip จาก GitHub ไม่มี setup.exe (ไม่ขึ้น git) — ตัวอัปเดตต้องไม่ถือเป็นของขาด', () => {
  const files = { 'native/install.mjs': 1, 'native/host.mjs': 1, 'native/extension-id.txt': 1 }
  const read = (f) => (files[f] ? Buffer.from('x') : null)
  assert.ok(installerProblems(read).some((p) => /setup\.exe/.test(p)), 'ตอนสร้างแพ็กเกจยังต้องมี setup.exe')
  assert.ok(!installerProblems(read, { requireSetupExe: false }).some((p) => /setup\.exe/.test(p)))
})
