// สร้างภาพ Style Kit ที่ส่งไปกับแอป (extension/style-kit/kit-*.jpg) จากต้นฉบับ PNG ใน assets/style-kit-raw/
//   node scripts/build-style-kit.mjs
// ผู้ใช้ตัดสิน 22 พ.ย.: ภาพต้องไม่ออกเหลือง เอาสีสดใส — ต้นฉบับจาก ChatGPT ออกโทนกระดาษเหลือง/ซีเปีย
//   จึงผ่านตัวแก้สีเดียวกับ inkify (ปรับขาวให้เป็นกลาง + ความสด 1.15) แต่ไม่ใส่ชั้นงานพิมพ์ (เส้นหมึก/เกรน/สีเหลื่อม)
//   เพราะ kit เป็นแบบเทคนิคลายเส้น ต้องคงเส้นเดิมไว้
// ขนาด 768x1152 · JPEG -q:v 7 (ไม่เกิน 400 KB ต่อใบ) · ต้นฉบับใน assets/style-kit-raw ไม่ถูกแก้
import { readdirSync, existsSync, statSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { correctColour } from '../pipeline/lib/inkify.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const RAW = join(ROOT, 'assets', 'style-kit-raw')
const OUT = join(ROOT, 'extension', 'style-kit')
const MAX_BYTES = 400 * 1024
// พื้นกระดาษขั้นต่ำ 1% (inkify ใช้ 3% กันฉากกลางคืนของ Flow) — ภาพ kit ทุกใบตรวจด้วยตาแล้ว · kit-saiyasat-forest เป็นฉากกลางคืน
// ที่มีส่วนสว่างสีอ่อน (ผ้าคาดเอว เปลือกไม้) 1.9% และอมเหลืองชัด (R−B 45) ถ้าใช้ 3% จะไม่ถูกแก้
const KIT_MIN_SHARE = 0.01 // ค่าเดียวกับ scripts/test-style-kit.mjs

if (!existsSync(RAW)) {
  console.error(`ไม่มีต้นฉบับ ${RAW} — สคริปต์นี้ใช้ในเครื่องนักพัฒนาเท่านั้น`)
  process.exit(1)
}
let failed = false
for (const name of readdirSync(RAW).filter((n) => /^kit-.*\.png$/i.test(n)).sort()) {
  const out = join(OUT, `${basename(name, '.png')}.jpg`)
  // ใหญ่เกิน 400 KB → ลดคุณภาพทีละขั้น
  for (const q of [7, 8, 9, 10]) {
    const gains = await correctColour(join(RAW, name), out, { vf: 'scale=768:1152:flags=lanczos', args: ['-q:v', String(q)], minShare: KIT_MIN_SHARE })
    const bytes = statSync(out).size
    if (bytes < MAX_BYTES || q === 10) {
      console.log(`${basename(out)}  ${(bytes / 1024).toFixed(0)} KB  q:v ${q}  gains ${gains ? `g ${gains.g} b ${gains.b}` : 'none'}`)
      if (bytes >= MAX_BYTES) failed = true
      break
    }
  }
}
if (failed) {
  console.error('มีภาพใหญ่เกิน 400 KB')
  process.exit(1)
}
