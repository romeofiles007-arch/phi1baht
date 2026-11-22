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
 * เก็บต้นฉบับที่ 05_images/_original/ · ภาพที่แปลงแล้ว (จำด้วย sha1 ใน _original/_inkified.json) ไม่ทำซ้ำ แม้ถูกคัดลอก/เปลี่ยนชื่อ
 */
import { existsSync, mkdirSync, copyFileSync, renameSync, rmSync, readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
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

/** พิกเซล "พื้นกระดาษ" = สว่างและสีอ่อน — เกณฑ์เดียวที่ใช้ทั้งตัวแก้และเทสต์ */
export function isPaper(r, g, b) {
  const max = Math.max(r, g, b)
  return max >= BRIGHT && (max - Math.min(r, g, b)) / max <= PALE
}

/**
 * ตัวคูณช่องสี { r, g, b } ที่ทำให้พื้นกระดาษ (ส่วนที่สว่างและสีอ่อน) เป็นขาวกลาง — ไม่ต้องปรับ = null
 *   ยกเขียว/ฟ้าขึ้นหาแดงเท่านั้น ไม่ลดช่องใด (ภาพจึงไม่มืดลง) · ไม่มีพื้นกระดาษ (ฉากกลางคืน) หรือพื้นเป็นกลาง/อมฟ้าอยู่แล้ว = null
 * @param {Buffer|Uint8Array} rgb พิกเซล rgb24 ต่อกัน (ภาพย่อก็พอ)
 * @param {{ minShare?: number }} [o] สัดส่วนพื้นกระดาษขั้นต่ำ (ค่าตั้งต้น 3% — กันฉากกลางคืนของ Flow)
 */
export function paperGains(rgb, { minShare = MIN_SHARE } = {}) {
  let n = 0
  let sr = 0
  let sg = 0
  let sb = 0
  const total = Math.floor(rgb.length / 3)
  for (let i = 0; i + 2 < rgb.length; i += 3) {
    const r = rgb[i]
    const g = rgb[i + 1]
    const b = rgb[i + 2]
    if (!isPaper(r, g, b)) continue
    n++
    sr += r
    sg += g
    sb += b
  }
  if (!total || !n || n / total < minShare) return null
  const [r, g, b] = [sr / n, sg / n, sb / n]
  // เหลือง/ส้ม = แดงนำ ฟ้าตาม · พื้นเป็นกลางหรืออมฟ้าอยู่แล้วไม่ต้องแตะ
  if (r < b || (r - b) / r < MIN_CAST) return null
  const gain = (c) => Math.round(Math.min(MAX_GAIN, Math.max(1, r / c)) * 1000) / 1000
  return { r: 1, g: gain(g), b: gain(b) }
}

/** ภาพย่อ (กว้าง 160px) เป็น rgb24 — พอสำหรับวัดพื้นกระดาษ */
export function thumbRgb(file) {
  return new Promise((resolve, reject) => {
    execFile('ffmpeg', ['-v', 'error', '-i', file, '-vf', 'scale=160:-1:flags=area,format=rgb24', '-frames:v', '1', '-f', 'rawvideo', 'pipe:1'],
      { encoding: 'buffer', maxBuffer: 1 << 24, windowsHide: true },
      (err, stdout, stderr) => (err ? reject(new Error(`ffmpeg อ่านภาพย่อไม่ได้: ${String(stderr || err.message).trim().split('\n').slice(-1)[0]}`)) : resolve(stdout)))
  })
}

/**
 * ตัวคูณสมดุลขาวของไฟล์ภาพ (วัดจากภาพย่อ รอบเดียว) — null = ไม่ต้องปรับ
 *   รอบเดียวพอ: ทำให้พื้นกระดาษเดิมเป็นขาวกลางพอดี · เคยลองวัดซ้ำบนผลลัพธ์จนไม่เหลือให้แก้ — ผิว ฟาง ดินที่สว่างขึ้นหลังแก้
 *   ถูกนับเป็นกระดาษ แล้วดันทั้งภาพไปฟ้า (ผ้าขาวกลายเป็นฟ้า พื้นกระดาษสังเคราะห์ R 235 B 249) จึงไม่ทำ
 */
export const paperGainsOf = async (file, options) => paperGains(await thumbRgb(file), options)

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

/** ตัวแก้สี (ขาวกลาง × ความสด) เป็น filter ffmpeg ตัวเดียว — ใช้ทั้งใน inkify และตอนสร้างภาพ Style Kit */
export function colorCorrectFilter(gains, saturation = SATURATION) {
  const [rr, rg, rb, gr, gg, gb, br, bg, bb] = colorMatrix(gains, saturation)
  return `colorchannelmixer=rr=${rr}:rg=${rg}:rb=${rb}:gr=${gr}:gg=${gg}:gb=${gb}:br=${br}:bg=${bg}:bb=${bb}`
}

/**
 * แก้สีอย่างเดียว (ไม่มีชั้นงานพิมพ์: ไม่มีเส้นหมึก เกรน สีเหลื่อม) จาก input เขียนเป็น output — input ไม่ถูกแตะ
 *   vf = filter ต่อท้ายหลังแก้สี (เช่นย่อขนาด) · args = ตัวเลือก encoder (เช่น -q:v) · minShare = ส่งต่อให้ paperGains
 *   คืนตัวคูณที่ใช้ (null = แค่เพิ่มความสด)
 *   ใช้กับ Style Kit (scripts/build-style-kit.mjs): ภาพอ้างอิงเทคนิคเส้น จึงไม่ใส่ชั้นงานพิมพ์ทับเส้นเดิม
 */
export async function correctColour(input, output, { vf = '', args = [], minShare } = {}) {
  const gains = await paperGainsOf(input, { minShare })
  const chain = [colorCorrectFilter(gains), vf].filter(Boolean).join(',')
  await run('ffmpeg', ['-y', '-v', 'error', '-i', input, '-vf', chain, '-frames:v', '1', '-update', '1', ...args, output])
  return gains
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
  const mixer = colorCorrectFilter(gains)
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

// ── สถานะ "แปลงแล้ว" จำจากเนื้อไฟล์ (sha1 ของภาพที่แปลงเสร็จ) ไม่ใช่เวลาแก้ไข ──
// 05_images/_original/_inkified.json = { "<ชื่อไฟล์>": "<sha1 ของภาพที่แปลงแล้ว>" }
//   เนื้อไฟล์ตรงกับที่จดไว้ = แปลงแล้ว (แตะไฟล์/คัดลอกเวลาเปลี่ยนก็ไม่ทำซ้ำ)
//   เนื้อไฟล์ตรงกับภาพแปลงแล้วของอีกชื่อ = สำเนา (autopilot เติมช็อตที่ขาดด้วยภาพข้างเคียง) → ไม่แปลงซ้ำ จดชื่อใหม่ + ต้นฉบับของภาพต้นทาง
//   ไม่ตรงอะไรเลย = ภาพดิบ (ใหม่ หรือ Flow โหลดทับ) → แปลง และภาพดิบนี้เป็นต้นฉบับ
export const INKIFIED = '_inkified.json'
const sha1 = (file) => createHash('sha1').update(readFileSync(file)).digest('hex')
const manifestOf = (dir) => join(dir, '_original', INKIFIED)

/** { ชื่อไฟล์: sha1 } ของภาพที่แปลงแล้วในโฟลเดอร์ · โฟลเดอร์รุ่นก่อนมีบันทึกนี้ → อนุมานจากต้นฉบับ + เวลาแก้ไขครั้งเดียว */
export function readInkified(dir) {
  try {
    const m = JSON.parse(readFileSync(manifestOf(dir), 'utf8'))
    if (m && typeof m === 'object' && !Array.isArray(m)) return m
  } catch {}
  // ไม่มีบันทึก (หรือไฟล์เสีย): ภาพที่มีต้นฉบับและไม่ใหม่กว่าต้นฉบับ = แปลงแล้ว (กติกาเดิม) — จดเป็น hash ตั้งแต่ครั้งถัดไป
  const legacy = {}
  if (!existsSync(join(dir, '_original'))) return legacy
  for (const name of readdirSync(dir).filter((n) => IMAGE.test(n) && !SKIP.test(n))) {
    const keep = join(dir, '_original', name)
    if (existsSync(keep) && statSync(join(dir, name)).mtimeMs <= statSync(keep).mtimeMs + 2) legacy[name] = sha1(join(dir, name))
  }
  return legacy
}

function writeInkified(dir, map) {
  const file = manifestOf(dir)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(`${file}.tmp`, JSON.stringify(map, null, 2))
  renameSync(`${file}.tmp`, file)
}

/**
 * ภาพในโฟลเดอร์ถูกเปลี่ยนชื่อ (retime_audio ย้ายเวลาช็อต) → เปลี่ยนชื่อต้นฉบับใน _original และบันทึก hash ตามไปด้วย
 * เรียกก่อนเปลี่ยนชื่อภาพ (โฟลเดอร์รุ่นเก่าที่ยังไม่มีบันทึกต้องอนุมานจากชื่อเดิม) · คืนจำนวนต้นฉบับที่เปลี่ยนชื่อ
 * @param {Map<string,string>} rename ชื่อเดิม → ชื่อใหม่
 */
export function renameInkified(dir, rename) {
  const orig = join(dir, '_original')
  if (!existsSync(orig)) return 0
  const done = readInkified(dir)
  const files = readdirSync(orig).filter((f) => rename.has(f) && rename.get(f) !== f)
  // สองจังหวะ: ชื่อใหม่อาจชนกับชื่อเก่าของช็อตอื่น
  for (const f of files) renameSync(join(orig, f), join(orig, `__retime__${f}`))
  for (const f of files) renameSync(join(orig, `__retime__${f}`), join(orig, rename.get(f)))
  const next = {}
  for (const [n, h] of Object.entries(done)) if (!rename.has(n)) next[n] = h
  for (const [n, h] of Object.entries(done)) if (rename.has(n)) next[rename.get(n)] = h
  writeInkified(dir, next)
  return files.length
}

/**
 * แปลงภาพไฟล์เดียว (แก้ไฟล์เดิม) · คืน true ถ้าแปลงแล้ว, false ถ้าเป็นภาพที่แปลงแล้ว (หรือสำเนาของภาพที่แปลงแล้ว)
 * ffmpeg ล้มเหลว = ไฟล์เดิมไม่ถูกแตะ แล้วโยนข้อผิดพลาด
 */
export async function inkify(file, { categoryId, seed } = {}) {
  const dir = dirname(file)
  const name = basename(file)
  const keep = join(dir, '_original', name)
  const done = readInkified(dir)
  const hash = sha1(file)
  if (done[name] === hash) return false
  const twin = Object.keys(done).find((n) => n !== name && done[n] === hash)
  if (twin) {
    const twinKeep = join(dir, '_original', twin)
    if (existsSync(twinKeep)) copyFileSync(twinKeep, keep) // ต้นฉบับของสำเนา = ต้นฉบับของภาพต้นทาง (ไม่ใช่ภาพที่แปลงแล้ว)
    writeInkified(dir, { ...done, [name]: hash })
    return false
  }
  const { width, height } = await probeSize(file)
  if (!width || !height) throw new Error(`อ่านขนาดภาพไม่ได้: ${file}`)
  const gains = await paperGainsOf(file) // วัดจากภาพดิบของ Flow ทุกครั้ง (พื้นเหลือง → ขาวกลาง · ไม่มีพื้นกระดาษ = null)
  const graph = inkifyFilter({ palette: paletteOf(categoryId), width, height, seed: seed ?? seedOf(name), gains })
  const tmp = `${file}.ink${extname(file)}`
  try {
    const lossy = /\.jpe?g$/i.test(file) ? ['-q:v', '2'] : []
    await run('ffmpeg', ['-y', '-v', 'error', '-i', file, '-filter_complex', graph, '-map', '[out]', '-frames:v', '1', '-update', '1', ...lossy, tmp])
    mkdirSync(dirname(keep), { recursive: true })
    copyFileSync(file, keep) // ภาพดิบจริงของไฟล์นี้ตอนนี้ (ไม่เคยเป็นภาพที่แปลงแล้ว) · เขียนทับต้นฉบับเก่าที่ล้าสมัยเท่านั้นหลังแปลงสำเร็จ
    // จด hash ก่อนย้ายไฟล์: ดับกลางทาง = ไฟล์ยังเป็นภาพดิบ hash ไม่ตรง → รอบหน้าแปลงใหม่ถูกต้อง · ย้ายแล้ว = hash ตรง ไม่ทำซ้ำ
    writeInkified(dir, { ...done, [name]: sha1(tmp) })
    renameSync(tmp, file)
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
  // โฟลเดอร์รุ่นก่อนมีบันทึก hash → จดสิ่งที่อนุมานได้ไว้ก่อนแตะไฟล์ใด (หลังจากนี้ไม่พึ่งเวลาแก้ไขอีก)
  if (existsSync(join(dir, '_original')) && !existsSync(manifestOf(dir))) writeInkified(dir, readInkified(dir))
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

// ── ตัดขอบกระดาษ/กรอบสีขาว (ผู้ใช้ 23 พ.ย. 2026: "ไม่เอาขอบ") ──
// คำสั่งภาพบอก full-bleed แล้ว แต่ Flow ยังวาดเป็น "ภาพบนแผ่นกระดาษ" บางใบ (คลิปแรก 10 จาก 29 ช็อต)
// ขอบ = แถบสว่าง สีจืด (ขาว ครีม เทาอ่อน) และเรียบ ติดขอบภาพ · ท้องฟ้าสีฟ้าสดเกินเกณฑ์สี จึงไม่นับ
const EDGE_BRIGHT = 150 // กระดาษในเงายังสว่างอย่างน้อยเท่านี้
const EDGE_PALE = 0.2 // (max-min)/max — ขาว/ครีม/เทา · ฟ้า (150,200,240) = .375 ไม่นับ
const EDGE_SHARE = 0.9 // แถว/คอลัมน์ต้องเป็นพิกเซลกระดาษอย่างน้อย 90%
const EDGE_FLAT = 22 // ส่วนเบี่ยงเบนความสว่างในแถว — กระดาษเรียบ เนื้อภาพไม่เรียบ
const EDGE_MIN = 0.01 // แถบบางกว่า 1% ไม่นับ
const EDGE_MAX = 0.4 // ด้านไหนกินเกิน 40% = ฉากสว่าง (หมอก หิมะ) ไม่ใช่ขอบ → ไม่ตัดทั้งภาพ
const EDGE_INSET = 0.012 // ตัดเผื่ออีกนิด กันมุมมนและขอบจางที่เหลือ

/**
 * กรอบเนื้อภาพเมื่อมีขอบกระดาษ — { top, bottom, left, right } เป็นสัดส่วนที่ต้องตัดแต่ละด้าน · ไม่มีขอบ = null
 * @param {Buffer|Uint8Array} rgb พิกเซล rgb24 (ภาพย่อก็พอ) · w, h ขนาดภาพย่อ
 */
export function borderBox(rgb, w, h) {
  const at = (x, y) => (y * w + x) * 3
  const edgeLine = (points) => {
    let paper = 0
    let sum = 0
    let sq = 0
    for (const [x, y] of points) {
      const i = at(x, y)
      const r = rgb[i], g = rgb[i + 1], b = rgb[i + 2]
      const max = Math.max(r, g, b)
      if (max >= EDGE_BRIGHT && (max - Math.min(r, g, b)) / max <= EDGE_PALE) paper++
      const l = LUMA[0] * r + LUMA[1] * g + LUMA[2] * b
      sum += l
      sq += l * l
    }
    const n = points.length
    const sd = Math.sqrt(Math.max(0, sq / n - (sum / n) ** 2))
    return paper / n >= EDGE_SHARE && sd <= EDGE_FLAT
  }
  const row = (y) => edgeLine(Array.from({ length: w }, (_, x) => [x, y]))
  const col = (x) => edgeLine(Array.from({ length: h }, (_, y) => [x, y]))
  const scan = (count, test) => { let n = 0; while (n < count && test(n)) n++; return n }
  const sides = {
    top: scan(h, (n) => row(n)) / h,
    bottom: scan(h, (n) => row(h - 1 - n)) / h,
    left: scan(w, (n) => col(n)) / w,
    right: scan(w, (n) => col(w - 1 - n)) / w,
  }
  if (Object.values(sides).some((v) => v > EDGE_MAX)) return null
  for (const k of Object.keys(sides)) sides[k] = sides[k] < EDGE_MIN ? 0 : Math.min(EDGE_MAX, sides[k] + EDGE_INSET)
  return Object.values(sides).some(Boolean) ? sides : null
}

/** ขนาดภาพย่อที่ thumbRgb ส่งมา (กว้าง 160) */
const thumbSize = (rgb) => ({ w: 160, h: Math.round(rgb.length / 3 / 160) })

/**
 * ตัดขอบกระดาษของภาพไฟล์เดียว (แก้ไฟล์เดิม ขนาดเท่าเดิม: ตัดแล้วขยายเต็มเฟรม ตัดส่วนเกินตรงกลาง)
 * เก็บภาพก่อนตัดที่ _original/_bordered/ · ภาพที่บันทึกว่าแปลงเป็นงานพิมพ์แล้ว ยังนับว่าแปลงแล้ว (ไม่แปลงซ้ำ)
 * คืน true ถ้าตัด, false ถ้าไม่มีขอบ
 */
export async function trimBorder(file) {
  const rgb = await thumbRgb(file)
  const { w, h } = thumbSize(rgb)
  const box = borderBox(rgb, w, h)
  if (!box) return false
  const { width, height } = await probeSize(file)
  if (!width || !height) throw new Error(`อ่านขนาดภาพไม่ได้: ${file}`)
  const dir = dirname(file)
  const name = basename(file)
  const done = readInkified(dir)
  const wasInkified = done[name] === sha1(file)
  const keepW = (1 - box.left - box.right).toFixed(4)
  const keepH = (1 - box.top - box.bottom).toFixed(4)
  const vf = `crop=iw*${keepW}:ih*${keepH}:iw*${box.left.toFixed(4)}:ih*${box.top.toFixed(4)},scale=${width}:${height}:force_original_aspect_ratio=increase:flags=lanczos,crop=${width}:${height}`
  const tmp = `${file}.trim${extname(file)}`
  try {
    const lossy = /\.jpe?g$/i.test(file) ? ['-q:v', '2'] : []
    await run('ffmpeg', ['-y', '-v', 'error', '-i', file, '-vf', vf, '-frames:v', '1', '-update', '1', ...lossy, tmp])
    const keep = join(dir, '_original', '_bordered', name)
    mkdirSync(dirname(keep), { recursive: true })
    copyFileSync(file, keep)
    if (wasInkified) writeInkified(dir, { ...done, [name]: sha1(tmp) })
    renameSync(tmp, file)
  } catch (error) {
    rmSync(tmp, { force: true })
    throw error
  }
  return true
}

/** ตัดขอบทุกภาพในโฟลเดอร์ 05_images (ยกเว้น riddle) — ภาพที่พังเตือนแล้วข้าม · คืนจำนวนภาพที่ตัด */
export async function trimBordersAll(dir, { log = console.warn } = {}) {
  let n = 0
  for (const name of readdirSync(dir).filter((f) => IMAGE.test(f) && !SKIP.test(f)).sort()) {
    try {
      if (await trimBorder(join(dir, name))) n++
    } catch (err) {
      log(`เตือน: ตัดขอบภาพ ${name} ไม่สำเร็จ ใช้ภาพเดิม — ${String(err.message).split('\n').filter(Boolean).slice(-1)[0]}`)
    }
  }
  return n
}
