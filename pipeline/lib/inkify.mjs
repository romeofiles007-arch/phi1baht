/**
 * inkify — แปลงภาพจาก Flow ให้ดูเป็นงานพิมพ์การ์ตูนเล่มละบาท (สเปกข้อ 5.4 ชั้น 3)
 *
 * ทำในเครื่องด้วย ffmpeg ล้วน (ไม่มี AI ไม่มี dependency) ผลลัพธ์คงที่ทุกครั้ง · ภาพยังเป็นภาพสีเต็มกรอบ ขนาดเท่าเดิม
 *   0) ขาวเป็นกลาง + สีสด   colorchannelmixer เดียว = (ปรับสมดุลขาวจากพื้นกระดาษ) × (เพิ่มความสด)
 *      ผู้ใช้ตัดสิน 22 พ.ย.: "อย่าให้ภาพออกเหลืองเอาสีสดใส" — Flow ชอบวาดบนกระดาษเหลืองเองแม้ไม่ได้สั่ง
 *      (แอปต้นแบบเจอแบบเดียวกัน แก้ด้วย paper-tone — ย้ายมาเป็น paperGains ที่นี่ ทำก่อนแปลงทุกขั้น)
 *   1) เส้นหมึกดำสนิทและคม   edgedetect คูณทับเฉพาะแนวเส้น
 *   2) ดึงสีเข้าชุดสีหมวดเบา ๆ   paletteuse + ชุดสีที่สร้างในกราฟจาก hex (4%)
 *   3) หมึกซึม   gblur เบามาก
 *   4) สีเหลื่อม 1–2px   rgbashift
 *   5) เกรนกระดาษขาวเป็นกลาง   ขาว + noise สีเทา ผสมแบบ multiply เบา ๆ (ไม่มีสีครีม ไม่มีขอบหมอง ไม่มีขอบกระดาษ)
 * เก็บต้นฉบับที่ 05_images/_original/ · ไฟล์ที่มีต้นฉบับแล้วไม่ทำซ้ำ
 */
import { existsSync, mkdirSync, copyFileSync, renameSync, rmSync, readdirSync, statSync, utimesSync } from 'node:fs'
import { join, dirname, basename, extname } from 'node:path'
import { execFile } from 'node:child_process'
import { run, probeSize } from './ffmpeg.mjs'
import { CATEGORIES } from '../../extension/prompts.js'

const FALLBACK_CATEGORY = 'folk' // หมวดไม่รู้จัก = ชุดสีปกเล่มละบาททั่วไป
const PULL = 0.04 // แรงดึงสีเข้าชุดสีหมวด (0–1) — ต่ำ = ยังเป็นสีของภาพ Flow
const HEX = /^#?([0-9a-f]{6})$/i

/**
 * ความสดของสี (คูณระยะห่างจากสีเทาที่ความสว่างเดียวกัน) — 1.15
 *   ต่ำกว่า 1.1 แทบไม่เห็นต่าง · 1.2 ขึ้นไป ผิวเริ่มออกส้ม และแดง/เหลืองสดของปกชนเพดาน 255 (เสียรายละเอียด)
 *   ผิว #e8b796 → #eeb58f (แดง +6 เขียว −2 ฟ้า −7 ฮิวขยับ <1°) ยังเป็นผิว · สีเทา/ขาวไม่เปลี่ยนเลย
 * ทำใน RGB ด้วยเมทริกซ์ (ไม่ใช้ eq=saturation) — ไม่ต้องแปลงไป YUV แล้วกลับ จึงไม่มีสีเลอะที่ขอบเส้นและค่าคงที่ทุกเครื่อง
 */
export const SATURATION = 1.15
const LUMA = [0.299, 0.587, 0.114] // น้ำหนักความสว่าง (Rec.601) — สีเทาที่ความสว่างเดียวกันเป็นแกนของความสด

// ── ขาวเป็นกลาง (port จาก paper-tone ของแอปต้นแบบ — ค่าเดิมที่ผ่านภาพจริงมาแล้ว) ──
const BRIGHT = 165 // ความสว่างขั้นต่ำของ "พื้นกระดาษ"
const PALE = 0.3 // (max-min)/max — กระดาษสีอ่อน · เปลวตะเกียง เสื้อเหลือง ท้องฟ้าเหลืองจัด สีจัดเกินนี้ = ไม่ใช่กระดาษ
const MIN_SHARE = 0.03 // พื้นกระดาษต้องมีอย่างน้อย 3% ของภาพ (ฉากกลางคืนไม่มี → ไม่แตะ)
const MIN_CAST = 0.04 // แดงมากกว่าฟ้าเกิน 4% ถึงนับว่าเหลือง
const MAX_GAIN = 1.35 // ยกช่องสีได้มากสุด — เหลืองจัดมากก็ปรับแค่พอดี ไม่ให้สีอื่นเพี้ยน

/**
 * ตัวคูณช่องสี { r, g, b } ที่ทำให้พื้นกระดาษ (ส่วนที่สว่างและสีอ่อน) เป็นขาวกลาง — ไม่ต้องปรับ = null
 *   ยกเขียว/ฟ้าขึ้นหาแดงเท่านั้น ไม่ลดช่องใด (ภาพจึงไม่มืดลง) · ไม่มีพื้นกระดาษ (ฉากกลางคืน) หรือพื้นเป็นกลาง/อมฟ้าอยู่แล้ว = null
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
  const gain = (c) => Math.round(Math.min(MAX_GAIN, Math.max(1, r / c)) * 1000) / 1000
  return { r: 1, g: gain(g), b: gain(b) }
}

/** อ่านภาพย่อ (กว้าง 160px) เป็น rgb24 แล้วหา paperGains — ใช้ทั้งตอนแปลงจริงและในเทสต์ */
export function paperGainsOf(file) {
  return new Promise((resolve, reject) => {
    execFile('ffmpeg', ['-v', 'error', '-i', file, '-vf', 'scale=160:-1:flags=area,format=rgb24', '-frames:v', '1', '-f', 'rawvideo', 'pipe:1'],
      { encoding: 'buffer', maxBuffer: 1 << 24, windowsHide: true },
      (err, stdout, stderr) => (err ? reject(new Error(`ffmpeg อ่านภาพย่อไม่ได้: ${String(stderr || err.message).trim().split('\n').slice(-1)[0]}`)) : resolve(paperGains(stdout))))
  })
}

/**
 * เมทริกซ์สี 3×3 (เรียงแถว rr rg rb gr gg gb br bg bb) = ความสด × ตัวคูณสมดุลขาว
 *   ปรับขาวก่อน แล้วค่อยเพิ่มความสด (ความเหลืองที่เหลือจึงไม่ถูกขยาย) · ทุกแถวรวมกันได้ 1 → สีเทา/ขาวคงเดิม
 */
export function colorMatrix(gains, saturation = SATURATION) {
  const G = [gains?.r ?? 1, gains?.g ?? 1, gains?.b ?? 1]
  const m = []
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) m.push(Math.round(((1 - saturation) * LUMA[j] + (i === j ? saturation : 0)) * G[j] * 1e4) / 1e4)
  return m
}

export const paletteOf = (categoryId) => (CATEGORIES.find((c) => c.id === categoryId) ?? CATEGORIES.find((c) => c.id === FALLBACK_CATEGORY)).palette

/**
 * filtergraph (ใช้กับ -filter_complex อ่านภาพจาก [0:v] ส่งออก [out])
 * @param {{ palette: string[], width: number, height: number, seed: number, gains?: {r:number,g:number,b:number}|null }} o
 */
export function inkifyFilter({ palette, width, height, seed, gains = null }) {
  let colors = (palette ?? []).map((h) => HEX.exec(String(h))?.[1]).filter(Boolean)
  if (colors.length < 2) colors = paletteOf(FALLBACK_CATEGORY).map((h) => HEX.exec(h)[1])
  const swatches = colors.map((c, i) => `color=c=0x${c}:s=1x1:r=1:d=1,format=rgb32[p${i}]`)
  const pal = `${colors.map((_, i) => `[p${i}]`).join('')}hstack=inputs=${colors.length},format=rgb32,pad=256:1:0:0:color=0x${colors.at(-1)}[pal]` // paletteuse ต้องการจานสี 256 ช่องพอดี → เติมซ้ำสีสุดท้าย
  const seed32 = Math.abs(Math.trunc(Number(seed) || 0)) % 0x7fffffff
  const [rr, rg, rb, gr, gg, gb, br, bg, bb] = colorMatrix(gains)
  const mixer = `colorchannelmixer=rr=${rr}:rg=${rg}:rb=${rb}:gr=${gr}:gg=${gg}:gb=${gb}:br=${br}:bg=${bg}:bb=${bb}`
  return [
    ...swatches,
    pal,
    // 0) ขาวเป็นกลาง + สีสด ก่อนทุกขั้น — เส้นหมึกและการดึงสีจึงทำบนภาพที่ไม่เหลืองแล้ว
    `[0:v]${mixer},format=gbrp,split=3[o1][o2][o3]`,
    // 2) ดึงสีเข้าชุดสีหมวดเพียงเบา ๆ (4%) — ไม่แทนที่สีเดิม ผิวหน้า/ท้องฟ้า/ขาวจึงยังเป็นสีธรรมชาติ
    '[o1]format=rgb32[src]',
    '[src][pal]paletteuse=dither=none[q]',
    `[q]format=gbrp[qg];[o2][qg]blend=all_mode=normal:all_opacity=${(1 - PULL).toFixed(2)}[soft]`,
    // จุดดำเบา ๆ + สีเหลื่อม 1–2px (ชั้นสีเหลื่อมจากเส้น เหมือนพิมพ์ผิดตำแหน่ง)
    "[soft]colorlevels=rimin=0.03:gimin=0.03:bimin=0.03,rgbashift=rh=-1:bh=2:bv=1,format=gbrp[col]",
    // 1) เส้นหมึก: จับขอบจากภาพ → เส้นดำ (หมึกซึมเล็กน้อย) คูณทับเฉพาะแนวเส้น
    '[o3]format=gray,edgedetect=low=0.1:high=0.3:mode=wires,negate,gblur=sigma=0.5,format=gbrp[lines]',
    '[col][lines]blend=all_mode=multiply:all_opacity=0.65[inked]',
    // 5) เกรนกระดาษขาวเป็นกลาง: ขาว + noise บนภาพเทา (ทุกช่องสีเท่ากัน = ไม่อมเหลือง) · คูณแบบเบา ๆ ไม่มีขอบหมอง เต็มเฟรม
    `color=c=0xffffff:s=${width}x${height}:r=1:d=1,format=gray,noise=alls=5:allf=u:all_seed=${seed32},format=gbrp[paper]`,
    '[inked][paper]blend=all_mode=multiply:all_opacity=0.35,format=rgb24[out]',
  ].join(';')
}

/** เลข seed คงที่จากชื่อไฟล์ — ไฟล์เดิมได้เกรนเดิมเสมอ */
const seedOf = (name) => [...name].reduce((h, ch) => (Math.imul(h, 31) + ch.codePointAt(0)) >>> 0, 7) % 1_000_000

/**
 * แปลงภาพไฟล์เดียว (แก้ไฟล์เดิม) · คืน true ถ้าแปลงแล้ว, false ถ้ามีต้นฉบับใน _original อยู่แล้ว (ทำแล้ว)
 * ffmpeg ล้มเหลว = ไฟล์เดิมไม่ถูกแตะ แล้วโยนข้อผิดพลาด
 */
export async function inkify(file, { categoryId, seed } = {}) {
  const keep = join(dirname(file), '_original', basename(file))
  // ทำแล้ว = มีต้นฉบับ และไฟล์ยังเป็นไฟล์ที่เราเขียนไว้ (เวลาแก้ไขตรงกับต้นฉบับ) · ถ้าไฟล์ใหม่กว่า = Flow โหลดภาพดิบใหม่ทับ → แปลงใหม่ และใช้ภาพดิบใหม่เป็นต้นฉบับ
  if (existsSync(keep) && statSync(file).mtimeMs <= statSync(keep).mtimeMs + 2) return false
  const { width, height } = await probeSize(file)
  if (!width || !height) throw new Error(`อ่านขนาดภาพไม่ได้: ${file}`)
  const gains = await paperGainsOf(file) // วัดจากภาพดิบของ Flow ทุกครั้ง (พื้นเหลือง → ขาวกลาง · ไม่มีพื้นกระดาษ = null)
  const graph = inkifyFilter({ palette: paletteOf(categoryId), width, height, seed: seed ?? seedOf(basename(file)), gains })
  const tmp = `${file}.ink${extname(file)}`
  try {
    const lossy = /\.jpe?g$/i.test(file) ? ['-q:v', '2'] : []
    await run('ffmpeg', ['-y', '-v', 'error', '-i', file, '-filter_complex', graph, '-map', '[out]', '-frames:v', '1', '-update', '1', ...lossy, tmp])
    mkdirSync(dirname(keep), { recursive: true })
    copyFileSync(file, keep) // ภาพดิบจริงของไฟล์นี้ตอนนี้ (ไม่เคยเป็นภาพที่แปลงแล้ว) · เขียนทับต้นฉบับเก่าที่ล้าสมัยเท่านั้นหลังแปลงสำเร็จ
    renameSync(tmp, file)
    const t = new Date()
    utimesSync(file, t, t)
    utimesSync(keep, t, t)
  } catch (error) {
    rmSync(tmp, { force: true })
    throw error
  }
  return true
}

const IMAGE = /\.(png|jpe?g|webp)$/i
const SKIP = /^riddle\./i // ภาพปริศนา = ภาพเงาสำหรับ Story ไม่แปลง

/**
 * แปลงทุกภาพในโฟลเดอร์ 05_images (ช็อตทั้งหมด + ปก ยกเว้น riddle) · ภาพที่พังไม่ทำให้ทั้งขั้นล้ม — เตือนแล้วเก็บต้นฉบับ
 * คืนจำนวนภาพที่แปลงรอบนี้
 */
export async function inkifyAll(dir, { categoryId, log = console.warn } = {}) {
  let done = 0
  for (const name of readdirSync(dir).filter((n) => IMAGE.test(n) && !SKIP.test(n)).sort()) {
    try {
      if (await inkify(join(dir, name), { categoryId })) done++
    } catch (err) {
      log(`เตือน: แปลงภาพ ${name} เป็นงานพิมพ์ไม่สำเร็จ ใช้ภาพต้นฉบับแทน — ${String(err.message).split('\n').filter(Boolean).slice(-1)[0]}`)
    }
  }
  return done
}

/** เปิดแปลงหรือไม่ ตอนรันขั้นภาพ: สวิตช์ในแผงข้าง (config.render.inkify, อ่านตอนรันจริง) และโปรไฟล์คลิปต้องไม่ปิดไว้ (profile.inkify === false = ปิดเฉพาะคลิปนี้) */
export const inkifyEnabled = (config, profile) => config?.render?.inkify !== false && profile?.inkify !== false
