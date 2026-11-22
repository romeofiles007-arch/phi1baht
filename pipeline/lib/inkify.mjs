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
import { existsSync, mkdirSync, copyFileSync, renameSync, rmSync, readdirSync, statSync, utimesSync } from 'node:fs'
import { join, dirname, basename, extname } from 'node:path'
import { run, probeSize } from './ffmpeg.mjs'
import { CATEGORIES } from '../../extension/prompts.js'

const FALLBACK_CATEGORY = 'folk' // หมวดไม่รู้จัก = ชุดสีปกเล่มละบาททั่วไป
const PULL = 0.04 // แรงดึงสีเข้าชุดสีหมวด (0–1) — ต่ำ = ยังเป็นสีของภาพ Flow
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
  const seed32 = Math.abs(Math.trunc(Number(seed) || 0)) % 0x7fffffff
  return [
    ...swatches,
    pal,
    '[0:v]format=gbrp,split=3[o1][o2][o3]',
    // 2) ดึงสีเข้าชุดสีหมวดเพียงเบา ๆ (4%) — ไม่แทนที่สีเดิม ผิวหน้า/ท้องฟ้า/ขาวจึงยังเป็นสีธรรมชาติ
    '[o1]format=rgb32[src]',
    '[src][pal]paletteuse=dither=none[q]',
    `[q]format=gbrp[qg];[o2][qg]blend=all_mode=normal:all_opacity=${(1 - PULL).toFixed(2)}[soft]`,
    // จุดดำเบา ๆ + สีเหลื่อม 1–2px (ชั้นสีเหลื่อมจากเส้น เหมือนพิมพ์ผิดตำแหน่ง)
    "[soft]colorlevels=rimin=0.03:gimin=0.03:bimin=0.03,rgbashift=rh=-1:bh=2:bv=1,format=gbrp[col]",
    // 1) เส้นหมึก: จับขอบจากภาพต้นฉบับ → เส้นดำ (หมึกซึมเล็กน้อย) คูณทับเฉพาะแนวเส้น
    '[o3]format=gray,edgedetect=low=0.1:high=0.3:mode=wires,negate,gblur=sigma=0.5,format=gbrp[lines]',
    '[col][lines]blend=all_mode=multiply:all_opacity=0.65[inked]',
    // 5) ผิวกระดาษเหลืองนวลอ่อน: สีพื้น + เกรนเบา + ขอบหมองนิดเดียว — เต็มเฟรม ไม่มีขอบกระดาษ · คูณแบบครึ่งแรงเพื่อไม่ให้ภาพมืด
    `color=c=0xfffaf0:s=${width}x${height}:r=1:d=1,format=gbrp,noise=alls=5:allf=u:all_seed=${seed32},vignette=angle=PI/16:eval=init[paper]`,
    '[inked][paper]blend=all_mode=multiply:all_opacity=0.6,format=rgb24[out]',
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
  const graph = inkifyFilter({ palette: paletteOf(categoryId), width, height, seed: seed ?? seedOf(basename(file)) })
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
