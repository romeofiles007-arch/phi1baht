// แท็บที่แอปใช้
//   node --test scripts/test-own-tabs.mjs
// 23 พ.ย. 2026 ผู้ใช้สั่ง: "อย่าเปิดแถบ ChatGPT ไปเรื่อย ... ถ้ามีก็ไม่ต้องเปิดใหม่"
//   → ChatGPT: แท็บที่จำไว้ → แท็บ ChatGPT ที่เปิดอยู่แล้ว → ไม่มีจริงๆ ค่อยเปิดใหม่
//   (เดิมใช้เฉพาะแท็บที่แอปเปิดเอง แต่เลขแท็บหายทุกครั้งที่ส่วนขยายรีโหลด จึงเปิดแท็บใหม่เพิ่มเรื่อยๆ)
//   Flow / TikTok ยังใช้เฉพาะแท็บที่แอปเปิดเอง (บัญชี Flow และร่างโพสต์ TikTok ของผู้ใช้)
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { preferredChatTab } from '../extension/chat-tabs.js'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const tab = (id, url, extra = {}) => ({ id, url, discarded: false, lastAccessed: id, ...extra })

test('ChatGPT: ใช้แท็บที่จำเลขไว้ก่อน', () => {
  const tabs = [tab(1, 'https://chatgpt.com/'), tab(2, 'https://chatgpt.com/c/abc')]
  assert.equal(preferredChatTab(tabs, 1)?.id, 1)
})

test('ChatGPT: ไม่มีเลขที่จำไว้ (ส่วนขยายเพิ่งรีโหลด) → ใช้แท็บ ChatGPT ที่เปิดอยู่ ไม่เปิดใหม่', () => {
  const tabs = [tab(5, 'https://chatgpt.com/', { lastAccessed: 100 }), tab(7, 'https://chatgpt.com/c/x', { lastAccessed: 300 })]
  assert.equal(preferredChatTab(tabs, undefined)?.id, 7, 'เลือกแท็บที่ใช้ล่าสุด')
  assert.equal(preferredChatTab(tabs, 999)?.id, 7, 'เลขที่จำไว้ถูกปิดไปแล้ว')
  assert.equal(preferredChatTab([tab(3, 'https://chat.openai.com/')], undefined)?.id, 3)
})

test('ChatGPT: แท็บที่ถูกพักหน่วยความจำใช้ได้เมื่อไม่มีแท็บอื่น · ไม่มีแท็บเลย → null (เปิดใหม่)', () => {
  const live = tab(4, 'https://chatgpt.com/', { lastAccessed: 1 })
  const sleeping = tab(9, 'https://chatgpt.com/', { discarded: true, lastAccessed: 50 })
  assert.equal(preferredChatTab([sleeping, live], undefined)?.id, 4)
  assert.equal(preferredChatTab([sleeping], undefined)?.id, 9)
  assert.equal(preferredChatTab([], undefined), null)
  assert.equal(preferredChatTab([tab(2, 'https://example.com/')], undefined), null)
})

test('ensureTab ของ ChatGPT ใช้ preferredChatTab · TikTok ยังใช้เฉพาะแท็บที่จำไว้', () => {
  const line = read('extension/background.js').split(/\r?\n/).find((l) => /^\s*const existing =/.test(l))
  assert.ok(line, 'ไม่พบบรรทัด existing =')
  assert.match(line, /preferredChatTab\(tabs, savedId\)/)
  assert.ok(!line.includes('tabs.find((t) => !t.discarded) ?? tabs[0]'), 'ห้ามยืมแท็บแรกที่เจอแบบไม่เลือก')
  assert.ok(line.includes('t.id === savedId'), 'เว็บอื่นยังใช้เฉพาะแท็บที่จำเลขไว้')
})

test('แผงข้างใช้แท็บ ChatGPT ที่เปิดอยู่แล้วเหมือนกัน', () => {
  const src = read('extension/sidepanel.js')
  assert.match(src, /preferredChatTab\(/)
  assert.ok(!src.includes('tabs.find((t) => !t.discarded) ?? tabs[0]'))
})
