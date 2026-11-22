/**
 * โปรไฟล์ของคลิป — หมวดเนื้อหา + ข้อมูลบุคคล + ภาพอ้างอิง
 *
 * เก็บที่ projects/<slug>/00_ref/
 *   profile.json   { category, figure?: { name, wiki, wikiTitle, url, summary, images: [{ file, source, page }] } }
 *   figure_*.jpg   ภาพวาด/รูปปั้นโบราณของบุคคลนั้นจาก Wikimedia Commons (แนบให้ ChatGPT/Flow วาดตัวละครให้ตรงกัน)
 *   ภาพอ้างอิงเป็นงานศิลป์โบราณที่หมดลิขสิทธิ์ ไม่ใช่ภาพนักแสดงหรือภาพนิ่งจากภาพยนตร์
 *
 * หมวดมาจาก: แนวที่เลือก/คอลัมน์ Genre ของหัวข้อ → ถ้าไม่รู้ ดูจากชื่อเรื่อง
 * ดึงข้อมูลจากวิกิพีเดียภาษาไทยผ่าน API สาธารณะ (ไม่ต้องใช้ key) — ล้มเหลวก็ทำคลิปต่อได้ แค่ไม่มีภาพอ้างอิง
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, rmSync } from 'node:fs'
import { join, extname } from 'node:path'
import { createHash } from 'node:crypto'
import { ROOT, loadConfig } from './config.mjs'
import { categoryOf, figureInTitle, figuresOf, ART_STYLES, RETIRED_ART_STYLES, NARRATIONS, resolveMood } from '../../extension/prompts.js'
import { readSelfNarrator, selfNarratorReady, SELF_NOT_READY } from './self_narrator.mjs'

const UA = { 'user-agent': 'Phi1Baht/1.0 (personal storytelling video tool; Wikimedia API)' }
const WIKI_API = 'https://th.wikipedia.org/w/api.php'
const MAX_REF_IMAGES = 3

export const refDir = (slug) => join(ROOT, 'projects', slug, '00_ref')
const profileFile = (slug) => join(refDir(slug), 'profile.json')

/**
 * โปรไฟล์คลิปยุคธรรมะ (ก่อน พ.ย. 2026) — หมวดเก่า รูปพระ และวิธีเล่าแบบเก่า
 * อ่านแล้วแปลงเป็นของใหม่ทันที และทิ้งรูปอ้างอิงเก่าเสมอ
 */
const LEGACY_CATEGORY = { buddha: 'sanguo', monk: 'sage', dhamma: 'tale' }
const LEGACY_NARRATION = { teach: 'novel', story: 'history' }
export function migrateProfile(profile) {
  if (!profile) return profile
  if (LEGACY_CATEGORY[profile.category]) profile.category = LEGACY_CATEGORY[profile.category]
  if (LEGACY_NARRATION[profile.narration]) profile.narration = LEGACY_NARRATION[profile.narration]
  delete profile.monk
  delete profile.buddha
  return profile
}

export function readProfile(slug) {
  if (!slug) return null
  try {
    const profile = migrateProfile(existsSync(profileFile(slug)) ? JSON.parse(readFileSync(profileFile(slug), 'utf8')) : null)
    // ลายเส้นที่เลิกใช้แล้ว (ภาพวาดจีน) → อ่านเป็นลายเส้นที่มาแทน ไม่แก้ไฟล์ของคลิป
    if (profile && RETIRED_ART_STYLES[profile.artStyle]) profile.artStyle = RETIRED_ART_STYLES[profile.artStyle]
    return profile
  } catch {
    return null
  }
}

function saveProfile(slug, profile) {
  mkdirSync(refDir(slug), { recursive: true })
  writeFileSync(profileFile(slug), JSON.stringify(profile, null, 2))
  return profile
}

// คำจับหมวด 1 — ครอบคลุมวรรณกรรมจีนคลาสสิกทุกเรื่องที่ใช้ได้ ไม่ใช่แค่สามก๊ก
const SANGUO_WORDS = /สามก๊ก|ขงเบ้ง|จูกัดเหลียง|กวนอู|เล่าปี่|เตียวหุย|โจโฉ|ซุนกวน|ซุนเซ็ก|จูล่ง|สุมาอี้|จิวยี่|ลิโป้|ลกซุน|เกียงอุย|ฮวาโต๋|ม้าเฉียว|ตั๋งโต๊ะ|อ้วนเสี้ยว|เตียวเสียน|ผาแดง|เกงจิ๋ว|ไซอิ๋ว|เห้งเจีย|ซุนหงอคง|ซัมจั๋ง|เสวียนจั้ง|ตือโป๊ยก่าย|ซัวเจ๋ง|ซ้องกั๋ง|เหลียงซาน|บู๊สง|ลิมชอง|หลินชง|โลจิซิม|ห้องสิน|เกียงจูแหย|จื่อหยา|นาจา|หอแดง|เปาบุ้นจิ้น|ฌ้อปาอ๋อง|เซี่ยงหยี่|หลิวปัง|ฮั่นเกาจู่|หันสิน|เตียวเหลียง|ชอหาน|เลียดก๊ก|ตระกูลหยาง|มู่กุ้ยอิง|งักฮุย|มู่หลาน|เซฺว เหรินกุ้ย|จิ๋นซี|บูเช็กเทียน|ซือหม่า เชียน|ซือหม่าเชียน|หลี่ ไป๋|หลี่ไป๋|ไซซี|กุ้ยเฟย|ขุนศึก|แม่ทัพ|ราชวงศ์|ฮ่องเต้|จ๊กก๊ก|วุยก๊ก|ง่อก๊ก/
const SAGE_WORDS = /ขงจื๊อ|เล่าจื๊อ|จวงจื่อ|จวงจื๊อ|เม่งจื๊อ|ซุนวู|ม่อจื๊อ|ฮั่นเฟย|พิชัยสงคราม|เต้าเต๋อ|หลุนหยฺวี่|ปรัชญาจีน|เต๋า|ขงจื่อ/

// ชื่อเรื่องแบบเหตุการณ์ → เล่าตามวรรณกรรม · แบบสารคดี/ประวัติศาสตร์ → ย้อนรอยประวัติศาสตร์ (ใช้ตอนตั้ง "สุ่ม")
const HISTORY_TITLE = /ประวัติศาสตร์|จดหมายเหตุ|บันทึก|ความจริง|ที่จริงแล้ว|หลักฐาน|พงศาวดาร/
const NOVEL_TITLE = /ใคร|ทำไม|คืน|วันที่|ครั้ง|เมื่อ|ก่อน|หลัง|เรื่อง|เหตุการณ์|กลยุทธ์|กลศึก|ศึก|สาบาน|ไซอิ๋ว|ซ้องกั๋ง|ห้องสิน|วรรณกรรม|\?/

/**
 * ลายเส้น + วิธีเล่าของคลิป ตามตั้งค่าคลิปตอนเริ่มทำ ("สุ่ม" = เลือกตอนนี้แล้วจำไว้กับคลิป ทุกขั้นใช้แบบเดียวกัน)
 */
function clipStyle(category, title) {
  const config = loadConfig()
  const pick = (list) => list[Math.floor(Math.random() * list.length)]
  // ผลิตต่อเนื่องส่ง CLIP_ART_STYLE / CLIP_NARRATION มาแทนตั้งค่าคลิป (สุ่มต่อคลิปโดยไม่แก้ค่าของผู้ใช้)
  // โหมดผู้เล่าเรื่อง: การ์ตูนหน้าเหมือนเจ้าของช่องเสมอ
  if (category === 'self') return { artStyle: 'doodle' }
  const chosen = process.env.CLIP_ART_STYLE || config.art?.style
  const art = RETIRED_ART_STYLES[chosen] ?? chosen
  const artStyle =ART_STYLES[art] && art !== 'random' ? art : art === 'random' ? pick(Object.keys(ART_STYLES).filter((k) => k !== 'random')) : 'doodle'
  if (category !== 'sanguo') return { artStyle }
  const want = process.env.CLIP_NARRATION || config.script?.narration
  const t = String(title ?? '')
  const narration = NARRATIONS[want] && want !== 'random' ? want
    : want === 'random' ? (HISTORY_TITLE.test(t) ? 'history' : NOVEL_TITLE.test(t) ? 'novel' : pick(['novel', 'history']))
    : 'novel'
  return { artStyle, narration }
}

/** เดาหมวดจากชื่อเรื่อง */
export function detectCategory(title) {
  const t = String(title ?? '')
  const figure = figureInTitle(t)
  if (figure) return figure.cat
  if (SAGE_WORDS.test(t)) return 'sage'
  if (SANGUO_WORDS.test(t)) return 'sanguo'
  return 'tale'
}

/** บุคคลหลักของคลิป: หาจากรายชื่อของหมวดนั้นก่อน แล้วค่อยหาจากรายชื่อทั้งหมด */
function figureFromTitle(title, category) {
  const found = figureInTitle(title, category) ?? figureInTitle(title)
  return found ? { name: found.name, wiki: found.wiki, aka: found.aka } : null
}

async function wikiQuery(params) {
  const url = new URL(WIKI_API)
  for (const [k, v] of Object.entries({ action: 'query', format: 'json', redirects: '1', ...params })) url.searchParams.set(k, v)
  // วิกิพีเดียจำกัดความถี่ (429) — รอแล้วลองใหม่ 2 ครั้ง
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20_000) })
    if (res.status === 429 && attempt < 2) {
      await new Promise((r) => setTimeout(r, 15_000 * (attempt + 1)))
      continue
    }
    if (!res.ok) throw new Error(`วิกิพีเดียตอบ ${res.status}`)
    return res.json()
  }
}

/** หน้าวิกิพีเดียของบุคคล: ชื่อหน้า ลิงก์ ประวัติย่อ ภาพหลัก และรายชื่อไฟล์ภาพในหน้า */
async function findWikiPage(query) {
  const j = await wikiQuery({
    generator: 'search', gsrsearch: query, gsrlimit: '1',
    prop: 'extracts|pageimages|images|info', exintro: '1', explaintext: '1', exchars: '2500',
    piprop: 'thumbnail|name', pithumbsize: '1024', imlimit: '30', inprop: 'url',
  })
  const page = Object.values(j.query?.pages ?? {})[0]
  if (!page) return null
  return {
    title: page.title,
    url: page.fullurl,
    summary: String(page.extract ?? '').trim(),
    mainImage: page.thumbnail?.source ?? null,
    mainName: page.pageimage ? `File:${page.pageimage}` : null,
    files: (page.images ?? []).map((i) => i.title),
  }
}

/** ลิงก์ภาพขนาดไม่เกิน 1024px ของไฟล์ใน Commons — ข้ามไอคอน/โลโก้/แผนที่/svg */
async function fileThumbs(files) {
  const wanted = files.filter((f) => /\.(jpe?g|png)$/i.test(f) && !/icon|logo|flag|map|seal|ตรา|แผนที่|ธง|symbol/i.test(f))
  if (!wanted.length) return []
  const j = await wikiQuery({ titles: wanted.slice(0, 20).join('|'), prop: 'imageinfo', iiprop: 'url|size', iiurlwidth: '1024' })
  return Object.values(j.query?.pages ?? {})
    .map((p) => ({ name: p.title, info: p.imageinfo?.[0] }))
    .filter((p) => p.info?.thumburl && p.info.width >= 300 && p.info.height >= 300)
    .map((p) => ({ name: p.name, url: p.info.thumburl, page: p.info.descriptionurl }))
}

/** โหลดภาพ — seen = ลายนิ้วมือของภาพที่ได้แล้ว (ภาพหลักของหน้ามักซ้ำกับในรายการไฟล์ภายใต้ชื่อ namespace อื่น) */
async function download(url, file, seen) {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30_000) })
  if (!res.ok) throw new Error(`โหลดภาพไม่ได้ (${res.status})`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 5_000 || buf.length > 6 * 1024 * 1024) throw new Error('ขนาดภาพไม่เหมาะ')
  const hash = createHash('sha1').update(buf).digest('hex')
  if (seen.has(hash)) throw new Error('ภาพซ้ำ')
  seen.add(hash)
  writeFileSync(file, buf)
}

/** ดึงประวัติ + ภาพอ้างอิงของบุคคลจากวิกิพีเดีย/Commons → เก็บใน 00_ref/ */
async function fetchFigure(slug, figure, log) {
  let page = await findWikiPage(figure.wiki || figure.name)
  if (!page && figure.wiki && figure.wiki !== figure.name) page = await findWikiPage(figure.name)
  if (!page) {
    log(`   ไม่พบหน้าวิกิพีเดียของ ${figure.name} — ทำต่อโดยไม่มีภาพอ้างอิง`)
    return { ...figure, fetchedAt: Date.now(), images: [] }
  }
  const candidates = []
  if (page.mainImage) candidates.push({ name: page.mainName, url: page.mainImage, page: page.mainName ? `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.mainName)}` : page.url })
  // ภาพอื่นในหน้ามักเป็นแผนที่ วัง สุสาน หรือภาพหมู่ — ใช้เฉพาะไฟล์ที่ชื่อมีชื่อบุคคล (ไม่งั้น Flow วาดผิดคน)
  const names = [figure.name, ...(figure.aka ?? [])].map((n) => n.split(/[\s(]/)[0]).filter((n) => n.length >= 2)
  const own = (f) => names.some((n) => f.includes(n))
  for (const t of await fileThumbs(page.files.filter(own)).catch(() => [])) if (!candidates.some((c) => c.name === t.name)) candidates.push(t)
  const images = []
  const seen = new Set()
  for (const c of candidates) {
    if (images.length >= MAX_REF_IMAGES) break
    const ext = (extname(new URL(c.url).pathname).toLowerCase().match(/\.(jpe?g|png)$/)?.[0] ?? '.jpg').replace('.jpeg', '.jpg')
    const file = `figure_${images.length + 1}${ext}`
    try {
      await download(c.url, join(refDir(slug), file), seen)
      images.push({ file, source: c.url, page: c.page })
    } catch {}
  }
  log(`   ${figure.name}: ${page.title} · ภาพอ้างอิง ${images.length} รูป (Wikimedia Commons)`)
  return { ...figure, wikiTitle: page.title, url: page.url, summary: page.summary, fetchedAt: Date.now(), images }
}

/**
 * โปรไฟล์ของคลิป — สร้างครั้งแรกแล้วเก็บไว้ (เรียกซ้ำได้ ไม่ดึงซ้ำ)
 * genre = แนวที่ผู้ใช้เลือก หรือคอลัมน์ Genre ของหัวข้อที่ ChatGPT เสนอ
 */
export async function ensureProfile(slug, { title, genre, log = console.log } = {}) {
  let profile = readProfile(slug)
  if (!profile) {
    const category = categoryOf(genre)?.id ?? detectCategory(title)
    // โหมดผู้เล่าเรื่องต้องมีรูปหน้าผู้เล่าก่อน
    if (category === 'self' && !selfNarratorReady()) throw new Error(SELF_NOT_READY)
    // แนวเนื้อหา: autopilot สุ่มไว้แล้วตอนคิดหัวข้อ (CLIP_MOOD) → หัวข้อกับบทเป็นแนวเดียวกัน
    profile = { category, title, ...clipStyle(category, title), mood: resolveMood(process.env.CLIP_MOOD || loadConfig().script?.mood) }
    if (category === 'self') profile.self = { name: readSelfNarrator().name }
    // หมวดที่มีบุคคลจริง — ไม่มีชื่อใครในชื่อเรื่องก็ทำต่อได้ แค่ไม่มีภาพอ้างอิง
    if (figuresOf(category).length) {
      const figure = figureFromTitle(title, category)
      if (figure) profile.figure = figure
    }
    saveProfile(slug, profile)
    log(`   หมวดของคลิป: ${profile.category}${profile.figure ? ` · ${profile.figure.name}` : ''}${profile.narration ? ` · วิธีเล่า ${profile.narration}` : ''} · ลายเส้น ${profile.artStyle}`)
  }
  // ยังไม่เคยดึงสำเร็จ (เช่น เน็ตหลุดรอบก่อน) → ลองใหม่
  if (profile.figure && !profile.figure.fetchedAt) {
    mkdirSync(refDir(slug), { recursive: true })
    try {
      profile.figure = await fetchFigure(slug, profile.figure, log)
      saveProfile(slug, profile)
    } catch (err) {
      log(`   ดึงข้อมูล${profile.figure.name}จากวิกิพีเดียไม่ได้ (${err.message}) — ทำต่อโดยไม่มีภาพอ้างอิง จะลองใหม่รอบหน้า`)
    }
  }
  return profile
}

/** ภาพอ้างอิงของคลิป (path เต็ม) — ภาพวาด/รูปปั้นโบราณของบุคคลหลักในคลิป */
export function profileImages(profile, slug) {
  const list = profile?.figure?.images ?? []
  return list.map((i) => join(refDir(slug), i.file)).filter((f) => existsSync(f))
}
