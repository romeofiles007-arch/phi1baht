/**
 * ลายเส้นจีนโบราณ: Google Flow ชอบวาดบนกระดาษสาเก่าสีเหลืองนวล แม้ prompt จะห้ามแล้วก็ตาม
 * ผู้ใช้ (20 พ.ย. 2026) ส่งภาพจากคลิปจริงมา 4 ภาพ: "อยากได้โหมดลายเส้นจีนโบราณแบบนี้แต่ไม่เหลือง"
 *
 * วิธีแก้แบบแน่นอน: หาสีของพื้นกระดาษ (ส่วนที่สว่างและสีอ่อน) แล้วปรับสมดุลสีให้พื้นเป็นขาวกลาง
 * - ยกช่องสีที่ขาด (ฟ้า/เขียว) ขึ้นเท่านั้น ไม่ลดแดง — ภาพจึงไม่มืดลง
 * - ไม่มีพื้นกระดาษให้วัด (ฉากกลางคืน จุดสว่างเป็นเปลวโคมสีจัด) → ไม่แตะ
 * - เก็บภาพต้นฉบับไว้ที่ 05_images/_original/ · ภาพที่ปรับแล้วไม่ปรับซ้ำ
 */
import { existsSync, mkdirSync, copyFileSync, renameSync, rmSync } from 'node:fs'
import { join, dirname, basename, extname } from 'node:path'
import { spawn } from 'node:child_process'

const BRIGHT = 165 // ความสว่างขั้นต่ำของ "พื้นกระดาษ"
const PALE = 0.3 // (max-min)/max — กระดาษสีอ่อน · เปลวโคม/ธงแดงสีจัดเกินนี้
const MIN_SHARE = 0.03 // พื้นกระดาษต้องมีอย่างน้อย 3% ของภาพ
const MIN_CAST = 0.04 // แดงมากกว่าฟ้าเกิน 4% ถึงนับว่าเหลือง
const MAX_GAIN = 1.35

/**
 * ตัวคูณช่องสี { r, g, b } ที่ทำให้พื้นกระดาษเป็นขาวกลาง — ไม่ต้องปรับ = null
 * @param {Buffer|Uint8Array} rgb พิกเซล rgb24 ต่อกัน (ภาพย่อก็พอ)
 */
export function paperGains(rgb) {
  let n = 0
  let sr = 0
  let sg = 0
  let sb = 0
  const total = Math.floor(rgb.length / 3)
  for (let i = 0; i + 2 < rgb.length; i += 3) {
    const r = rgb[i]
    const g = rgb[i + 1]
    const b = rgb[i + 2]
    const max = Math.max(r, g, b)
    if (max < BRIGHT || (max - Math.min(r, g, b)) / max > PALE) continue
    n++
    sr += r
    sg += g
    sb += b
  }
  if (!total || n / total < MIN_SHARE) return null
  const [r, g, b] = [sr / n, sg / n, sb / n]
  // เหลือง/ส้ม = แดงนำ ฟ้าตาม · พื้นเป็นกลางหรืออมฟ้าอยู่แล้วไม่ต้องแตะ
  if (r < b || (r - b) / r < MIN_CAST) return null
  const top = Math.max(r, g, b)
  const gain = (c) => Math.round(Math.min(MAX_GAIN, top / c) * 1000) / 1000
  return { r: gain(r), g: gain(g), b: gain(b) }
}

function ffmpeg(args, { capture = false } = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args], { windowsHide: true })
    const out = []
    let err = ''
    proc.stdout.on('data', (d) => capture && out.push(d))
    proc.stderr.on('data', (d) => (err += d))
    proc.on('error', reject)
    proc.on('close', (code) => (code === 0 ? resolve(Buffer.concat(out)) : reject(new Error(`ffmpeg: ${err.trim().slice(-300)}`))))
  })
}

/**
 * ปรับพื้นกระดาษของภาพให้เป็นขาวกลาง (แก้ไฟล์เดิม) · คืน gains ที่ใช้ หรือ null ถ้าไม่ต้องปรับ
 * ปรับแล้ว (มีต้นฉบับใน _original) = ข้าม
 */
export async function neutralizePaper(file) {
  const keep = join(dirname(file), '_original', basename(file))
  if (existsSync(keep)) return null
  const small = await ffmpeg(['-i', file, '-vf', 'scale=160:-1:flags=area,format=rgb24', '-frames:v', '1', '-f', 'rawvideo', 'pipe:1'], { capture: true })
  const g = paperGains(small)
  if (!g) return null
  mkdirSync(dirname(keep), { recursive: true })
  copyFileSync(file, keep)
  const tmp = `${file}.paper${extname(file)}`
  try {
    await ffmpeg(['-y', '-i', file, '-vf', `colorchannelmixer=rr=${g.r}:gg=${g.g}:bb=${g.b}`, '-frames:v', '1', tmp])
    renameSync(tmp, file)
  } catch (error) {
    rmSync(tmp, { force: true })
    rmSync(keep, { force: true })
    throw error
  }
  return g
}
