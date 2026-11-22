// แอปใช้เฉพาะแท็บที่ตัวเองเปิด — ไม่ยืมแท็บ ChatGPT/Flow ที่ผู้ใช้เปิดไว้เอง
//   node --test scripts/test-own-tabs.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('ensureTab ไม่ fallback ไปแท็บอื่นที่เปิดอยู่', () => {
  const line = read('extension/background.js').split(/\r?\n/).find((l) => /^\s*const existing =/.test(l))
  assert.ok(line, 'ไม่พบบรรทัด existing =')
  assert.ok(!line.includes('tabs.find((t) => !t.discarded) ?? tabs[0]'), 'ห้ามยืมแท็บแรกที่เจอ')
  assert.ok(line.includes('t.id === savedId'), 'ต้องใช้เฉพาะแท็บที่จำเลขไว้')
})

test('แผงข้างไม่ยืมแท็บอื่นของ ChatGPT/Flow', () => {
  const src = read('extension/sidepanel.js')
  assert.ok(!src.includes('tabs.find((t) => !t.discarded) ?? tabs[0]'), 'reuseTab ห้ามยืมแท็บแรกที่เจอ')
})
