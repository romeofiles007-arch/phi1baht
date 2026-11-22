// ตัวตนของแอป "ผี 1 บาท" — ไฟล์ที่ส่งถึงลูกค้าต้องไม่มีชื่อ/พอร์ต/repo ของแอปเดิมหลงเหลือ
//   PHI_IDENTITY_ONLY=1 node --test scripts/test-identity.mjs   → ตรวจเฉพาะกลุ่มชื่อ/พอร์ต/host/repo (ใช้ระหว่างงานเนื้อหายังไม่เสร็จ)
//   node --test scripts/test-identity.mjs                        → ตรวจเต็ม รวมคำเนื้อหาเดิม (ผ่านหลังงานเนื้อหาเสร็จ)
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { shipsToCustomer } from '../bridge/package-rules.js'

const ROOT = new URL('..', import.meta.url)
const IDENTITY = /China ?Auto|china[_-]auto|ChinaAuto|romeofiles007-arch\/china\b|\b8786\b/i
const FULL = /จีน|ตำนานจีน|China ?Auto|china[_-]auto|ChinaAuto|romeofiles007-arch\/china\b|\b8786\b|ธรรมะ|dhamma/i
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
    text.split(/\r?\n/).forEach((line, i) => { if (RULE.test(line)) hits.push(`${f}:${i + 1}: ${line.trim().slice(0, 100)}`) })
  }
  assert.deepEqual(hits, [], `พบคำต้องห้าม ${hits.length} จุด`)
})

test('manifest และ package.json เป็นของผี 1 บาท', () => {
  assert.equal(JSON.parse(read('extension/manifest.json')).name, 'ผี 1 บาท')
  assert.match(JSON.parse(read('package.json')).repository.url, /\/phi1baht$/)
})
