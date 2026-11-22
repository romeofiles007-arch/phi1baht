// ตัวตนของแอป "ผี 1 บาท" — ไฟล์ที่ส่งถึงลูกค้าต้องไม่มีชื่อ/พอร์ต/repo ของแอปเดิมหลงเหลือ
//   PHI_IDENTITY_ONLY=1 node --test scripts/test-identity.mjs   → ตรวจเฉพาะกลุ่มชื่อ/พอร์ต/host/repo (ใช้ระหว่างงานเนื้อหายังไม่เสร็จ)
//   node --test scripts/test-identity.mjs                        → ตรวจเต็ม รวมคำเนื้อหาเดิม (ผ่านหลังงานเนื้อหาเสร็จ)
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { shipsToCustomer } from '../bridge/package-rules.js'

const ROOT = new URL('..', import.meta.url)
const IDENTITY = /Dhamma ?Auto|ตำนานจีน|China ?Auto|china[_-]auto|ChinaAuto|romeofiles007-arch\/china\b|\b8786\b/i
// คำเนื้อหาเดิม: ธรรมะ/ปริศนาธรรม (ทุกคำที่มี "ธรรม" ยกเว้น ธรรมชาติ ธรรมดา ธรรมเนียม ยุติธรรม คุณธรรม และ regex "คุณ(?!ธรรม" ใน prompts.js) · ม้าน้ำ (มาสคอตธีมทะเล) · เวทีทอง · สามก๊ก/ขงเบ้ง · พระเกจิ/พระของฉัน
const FULL = /จีน|ตำนานจีน|China ?Auto|china[_-]auto|ChinaAuto|romeofiles007-arch\/china\b|\b8786\b|ธรรมะ|dhamma|(?<!ยุติ|คุณ|คุณ\(\?!)ธรรม(?!ชาติ|ดา|เนียม)|ม้าน้ำ|เวทีทอง|สามก๊ก|ขงเบ้ง|พระเกจิ|พระของฉัน/i
const RULE = process.env.PHI_IDENTITY_ONLY === '1' ? IDENTITY : FULL
const BINARY = /\.(png|jpe?g|gif|webp|ico|exe|dll|woff2?|ttf|otf|mp3|wav|ogg|m4a|mp4|webm|zip|pdf)$/i

const read = (p) => readFileSync(new URL(p, ROOT), 'utf8')
const files = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 })
  .split('\0').filter((f) => f && !f.startsWith('docs/') && !BINARY.test(f) && shipsToCustomer(f))

test('ไฟล์ที่ส่งถึงลูกค้าไม่มีชื่อ/พอร์ต/repo ของแอปเดิม', () => {
  const hits = []
  for (const f of files) {
    if (RULE.test(f)) hits.push(`${f} (ชื่อไฟล์)`)
    let text
    try { text = read(f) } catch { continue }
    // .bat: ข้อความใน base64 (MessageBox) ถอดรหัสก่อนตรวจ เพื่อให้เห็นข้อความจริง
    if (f.endsWith('.bat')) for (const m of text.matchAll(/FromBase64String\('([^']+)'\)/g)) text += '\n' + Buffer.from(m[1], 'base64').toString('utf8')
    text.split(/\r?\n/).forEach((line, i) => { if (RULE.test(line)) hits.push(`${f}:${i + 1}: ${line.trim().slice(0, 100)}`) })
  }
  assert.deepEqual(hits, [], `พบคำต้องห้าม ${hits.length} จุด`)
})

test('manifest และ package.json เป็นของผี 1 บาท', () => {
  assert.equal(JSON.parse(read('extension/manifest.json')).name, 'ผี 1 บาท')
  assert.match(JSON.parse(read('package.json')).repository.url, /\/phi1baht$/)
})

test('ข้อความที่มองเห็นใน sidepanel.html มี "ผี 1 บาท" และไม่มี "ตำนานจีน"', () => {
  const visible = read('extension/sidepanel.html').replace(/<(?:script|style)[\s\S]*?<\/(?:script|style)>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
  assert.ok(visible.includes('ผี 1 บาท'))
  assert.ok(!visible.includes('ตำนานจีน'), 'ยังมี "ตำนานจีน" ในข้อความที่ผู้ใช้เห็น')
})

test('regex เนื้อหาเดิมจับคำที่เคยหลุด (final review I4) และไม่จับคำไทยปกติ', () => {
  for (const bad of ['ลง Story ภาพปริศนาธรรม', 'ปริศนาจีน', 'ตั้งค่าม้าน้ำ', 'ปริศนาแบบเวทีทอง', 'หลักธรรม', 'พระเกจิ']) assert.match(bad, FULL, bad)
  for (const ok of ['ธรรมชาติ', 'ธรรมดา', 'ธรรมเนียม', 'ความยุติธรรม', 'คุณธรรม', 'ทายสิ ผีอะไร?']) assert.doesNotMatch(ok, FULL, ok)
})

// final review I5: .env.example ส่งถึงลูกค้า — ห้ามมีพอร์ตของแอปพี่น้องบนเครื่องเดียวกัน (native host จะไปปิด bridge ของแอปนั้น)
test('.env.example และไฟล์ที่ส่งลูกค้าไม่ใช้พอร์ตของแอปอื่น (8765 8766 8775 8785 8786) · BRIDGE_PORT = 8787 หรือไม่ระบุ', () => {
  const port = /^\s*BRIDGE_PORT\s*=\s*(\d+)/m.exec(read('.env.example'))
  if (port) assert.equal(port[1], '8787')
  const SIBLING = /\b(?:8765|8766|8775|8785|8786)\b/
  const hits = []
  for (const f of files) {
    let text
    try { text = read(f) } catch { continue }
    text.split(/\r?\n/).forEach((line, i) => { if (SIBLING.test(line)) hits.push(`${f}:${i + 1}: ${line.trim().slice(0, 100)}`) })
  }
  assert.deepEqual(hits, [])
})

test('.gitignore: .env และ .env.* ถูกกัน แต่ .env.example (ไฟล์ตัวอย่างที่ส่งลูกค้า) ไม่ถูกกลืน', () => {
  const ignored = (p) => { try { execFileSync('git', ['check-ignore', '--no-index', '-q', p], { cwd: ROOT }); return true } catch { return false } }
  assert.equal(ignored('.env'), true)
  assert.equal(ignored('.env.local'), true)
  assert.equal(ignored('.env.example'), false)
})
