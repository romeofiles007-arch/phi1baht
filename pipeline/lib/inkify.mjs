/**
 * inkify — แปลงภาพจาก Flow ให้ดูเป็นงานพิมพ์การ์ตูนเล่มละบาทยุค 80 (สเปกข้อ 5.4 ชั้น 3)
 *
 * ทำในเครื่องด้วย ffmpeg ล้วน (ไม่มี AI ไม่มี dependency) ผลลัพธ์คงที่ทุกครั้ง · ภาพยังเป็นภาพสีเต็มกรอบ ขนาดเท่าเดิม
 *   1) เส้นหมึกดำสนิทและคม   curves ดันโทนมืดเป็นดำ (ก่อนและหลังลดสี)
 *   2) ลดสีให้อยู่ในชุดสีของหมวด   paletteuse + ชุดสีที่สร้างในกราฟจาก hex (dither bayer เบา ๆ = เม็ดสกรีนจาง ๆ)
 *   3) หมึกซึม   gblur เบามาก
 *   4) สีเหลื่อม 1–2px   rgbashift
 *   5) ผิวกระดาษเหลืองนวล   color + noise + vignette ผสมแบบ multiply (สร้างเอง ไม่ใช้ไฟล์ภาพ ไม่มีขอบกระดาษ)
 * เก็บต้นฉบับที่ 05_images/_original/ · ไฟล์ที่มีต้นฉบับแล้วไม่ทำซ้ำ
 */
import { existsSync, mkdirSync, copyFileSync, renameSync, rmSync, readdirSync } from 'node:fs'
import { join, dirname, basename, extname } from 'node:path'
import { run, probeSize } from './ffmpeg.mjs'
import { CATEGORIES } from '../../extension/prompts.js'

const FALLBACK_CATEGORY = 'folk' // หมวดไม่รู้จัก = ชุดสีปกเล่มละบาททั่วไป
const HEX = /^#?([0-9a-f]{6})$/i

export const paletteOf = (categoryId) => (CATEGORIES.find((c) => c.id === categoryId) ?? CATEGORIES.find((c) => c.id === FALLBACK_CATEGORY)).palette

/**
 * filtergraph (ใช้กับ -filter_complex อ่านภาพจาก [0:v] ส่งออก [out])
 * @param {{ palette: string[], width: number, height: number, seed: number }} o
 */
export function inkifyFilter({ palette, width, height, seed }) {
  let colors = (palette ?? []).map((h) => HEX.exec(String(h))?.[1]).filter(Boolean)
  if (colors.length < 2) colors = paletteOf(FALLBACK_CATEGORY).map((h) => HEX.exec(h)[1])
  const swatches = colors.map((c, i) => `color=c=0x${c}:s=1x1:r=1:d=1,format=rgb32[p${i}]`)
  const pal = `${colors.map((_, i) => `[p${i}]`).join('')}hstack=inputs=${colors.length},format=rgb32,pad=256:1:0:0:color=0x${colors.at(-1)}[pal]` // paletteuse ต้องการจานสี 256 ช่องพอดี → เติมซ้ำสีสุดท้าย
  const s = Math.abs(Math.trunc(Number(seed) || 0)) % 0x7fffffff
  return [
    ...swatches,
    pal,
    // 1) เส้นหมึกดำคม: ดันโทนมืดเป็นดำสนิทก่อนลดสี (เพิ่มคอนทราสต์นิดหน่อยให้สีฉูดฉาดแบบหมึกถูก)
    `[0:v]format=rgb32,eq=contrast=1.05:saturation=1.1,curves=all='0/0 0.1/0 1/1',format=rgb32[src]`,
    // 2) ลดสีตามชุดสีหมวด · dither แบบตาราง = เม็ดสกรีนจาง ๆ
    `[src][pal]paletteuse=dither=bayer:bayer_scale=5[q]`,
    // ดำที่เหลือ (สีเข้มสุดของชุดสี) กดเป็นดำสนิท → หมึกซึมเบามาก → สีเหลื่อม 1–2px
    `[q]format=rgb24,curves=all='0/0 0.11/0 1/1',gblur=sigma=0.5,rgbashift=rh=-1:bh=2:bv=1[ink]`,
    // 5) ผิวกระดาษเหลืองนวล: สีพื้น + เกรนกระดาษ + ขอบหมองเล็กน้อย — เต็มเฟรม ภาพไม่มีขอบกระดาษ
    `color=c=0xf3e6c3:s=${width}x${height}:r=1:d=1,format=rgb24,noise=alls=14:allf=u:all_seed=${s},vignette=angle=PI/8:eval=init[paper]`,
    `[ink][paper]blend=all_mode=multiply[out]`,
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
  if (existsSync(keep)) return false
  const { width, height } = await probeSize(file)
  if (!width || !height) throw new Error(`อ่านขนาดภาพไม่ได้: ${file}`)
  const graph = inkifyFilter({ palette: paletteOf(categoryId), width, height, seed: seed ?? seedOf(basename(file)) })
  const tmp = `${file}.ink${extname(file)}`
  try {
    const lossy = /\.jpe?g$/i.test(file) ? ['-q:v', '2'] : []
    await run('ffmpeg', ['-y', '-v', 'error', '-i', file, '-filter_complex', graph, '-map', '[out]', '-frames:v', '1', '-update', '1', ...lossy, tmp])
    mkdirSync(dirname(keep), { recursive: true })
    copyFileSync(file, keep)
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
  for (const name of readdirSync(dir).filter((n) => IMAGE.test(n) && !SKIP.test(n)).sort()) {
    try {
      if (await inkify(join(dir, name), { categoryId })) done++
    } catch (err) {
      log(`เตือน: แปลงภาพ ${name} เป็นงานพิมพ์ไม่สำเร็จ ใช้ภาพต้นฉบับแทน — ${String(err.message).split('\n').filter(Boolean).slice(-1)[0]}`)
    }
  }
  return done
}
