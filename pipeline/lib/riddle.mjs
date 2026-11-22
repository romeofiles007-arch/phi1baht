/**
 * "ทายสิ ผีอะไร?" — ภาพเงาผีไทย 1 ชนิดสำหรับ Facebook Story (spec 5.8)
 *
 *   ChatGPT: ออกแบบโจทย์มาพร้อม Shot List รอบแรก (บรรทัด riddle.png | RIDDLE | ...) → 04_shotlist/riddle.json
 *   Flow:    วาดเฉพาะภาพเงาดำของผี (ไม่มีตัวอักษร ไม่มีของรุนแรง) ต่อท้ายภาพปก → 05_images/riddle.png
 *   ระบบ:    เขียนหัวข้อ คำใบ้ 1 บรรทัด และเฉลยลงภาพเอง (ffmpeg + ASS ฟอนต์ไทยวางสระถูก) ตอนจะลง Story
 *
 * ภาพนี้ไม่ผ่าน inkify (ข้าม riddle.png) · ทำเฉพาะคลิปพากย์ไทย
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { projectDir } from './config.mjs'
import { run } from './ffmpeg.mjs'
import { sanitizeShotPrompt } from './shot-safety.mjs'

export const RIDDLE_NAME = 'riddle.png'
export const riddlePath = (slug) => join(projectDir(slug, 'images'), RIDDLE_NAME)
const riddleFile = (slug) => join(projectDir(slug, 'shotlist'), 'riddle.json')

export const RIDDLE_TITLE = 'ทายสิ ผีอะไร?'
/** ผีไทยที่ทำเป็นภาพเงาแล้วทายได้ — ตัวอย่างให้ ChatGPT เลือก ไม่บังคับ */
export const RIDDLE_GHOSTS = ['กระสือ', 'กระหัง', 'ปอบ', 'ผีตะเคียน', 'แม่นาคพระโขนง', 'นางตานี', 'ผีโพง', 'ผีกองกอย', 'ผีเปรต', 'ผีแม่ซื้อ', 'นางไม้']

/** กฎสำหรับ ChatGPT รอบแรก — ขอโจทย์ "ทายสิ ผีอะไร?" ต่อท้ายปก (คลิปไทยเท่านั้น) */
export function riddleRequest(language = 'th', theme = null) {
  if (language !== 'th') return ''
  return `- ต่อท้ายอีกบรรทัด "=== RIDDLE ===" ตามด้วยโจทย์ "${RIDDLE_TITLE}" 1 บรรทัด สำหรับลง Facebook Story เป็นภาพเงาผีไทย 1 ชนิดให้คนทาย:
  riddle.png | RIDDLE | ANSWER: <ชื่อผีที่เป็นเฉลย> | HINT: <คำใบ้ 1 บรรทัด ไม่เกิน 45 ตัวอักษร> | SHAPE: <ลักษณะเงาที่ให้วาด 1 ประโยค เช่น รูปร่าง ท่าทาง ผม ของที่ถือ>
  · เลือกผีไทย 1 ชนิดที่รูปร่างเงาโดดเด่นจนเดาได้ เช่น ${RIDDLE_GHOSTS.join(' · ')}${theme?.subject ? ` (ตัวหลักของคลิป: ${theme.subject} — ใช้ตัวนี้ถ้าทำเป็นเงาได้)` : ''}
  · คำใบ้บอกนิสัยหรือที่อยู่ของผีให้พอเดาได้ แต่ห้ามมีชื่อผีเฉลยอยู่ในคำใบ้
  · ภาพเป็นเงาดำสนิทของผีตัวเดียวกลางภาพ ห้ามมีตัวอักษรหรือคำใดๆ ในภาพ
  · ห้ามมีความรุนแรงในคำใบ้และ SHAPE: ไม่มีเลือดสาด ไส้ ศพ บาดแผล ไม่เปลือย (เงาผีน่าขนลุกแต่ไม่โหด)`
}

/** ดึงโจทย์จากคำตอบของ ChatGPT ตามที่เขียนมา (ยังไม่ตรวจว่าถูก) → { answer, hint, shape } */
export function parseRiddleDraft(text) {
  const line = /^(?:[ \t>*•-]+)?\**riddle\.png\**[ \t:|]*(.+)$/im.exec(String(text ?? ''))?.[1]
  if (!line) return null
  const field = (key) => new RegExp(`${key}\\s*[:：]\\s*([^|]+)`, 'i').exec(line)?.[1]?.trim().replace(/^["“”']+|["“”']+$/g, '') ?? ''
  return { answer: field('ANSWER'), hint: field('HINT'), shape: field('SHAPE') }
}

/** ชื่อผีที่ตัดคำนำหน้า "ผี"/"นาง"/"แม่" ออก — ใช้เช็กว่าคำใบ้บอกชื่อตรงๆ หรือไม่ */
const ghostCore = (name) => String(name ?? '').replace(/\s+/g, '').replace(/^(?:ผี|นาง|แม่)/, '')

/**
 * โจทย์ผิดตรงไหน (null = ใช้ได้) — โค้ดตรวจเอง ไม่เชื่อ ChatGPT
 *   ต้องมีเฉลยกับคำใบ้ · คำใบ้ห้ามบอกชื่อผีตรงๆ · ห้ามมีคำรุนแรง (ใช้ตัวกรองเดียวกับช็อตที่ส่ง Flow)
 */
export function riddleProblem(r) {
  if (!r?.answer) return 'ไม่มีเฉลย (ANSWER)'
  if (!r.hint) return 'ไม่มีคำใบ้ (HINT)'
  const core = ghostCore(r.answer)
  if (core.length >= 2 && r.hint.replace(/\s+/g, '').includes(core)) return `คำใบ้บอกชื่อผี "${r.answer}" ตรงๆ — ทายไม่สนุก`
  const { removed } = sanitizeShotPrompt([r.answer, r.hint, r.shape].filter(Boolean).join(' | '))
  if (removed.length) return `มีคำรุนแรง (${removed.join(', ')}) — Story ต้องไม่โหด`
  return null
}

/** โจทย์ที่ผ่านการตรวจ — โจทย์ผิด = null (ไม่วาด ไม่ลง Story) */
export function parseRiddle(text) {
  const r = parseRiddleDraft(text)
  return r && !riddleProblem(r) ? r : null
}

export function saveRiddle(slug, riddle) {
  if (riddle) writeFileSync(riddleFile(slug), JSON.stringify(riddle, null, 2), 'utf8')
}

export function readRiddle(slug) {
  try { return existsSync(riddleFile(slug)) ? JSON.parse(readFileSync(riddleFile(slug), 'utf8')) : null } catch { return null }
}

export const hasRiddleImage = (slug) => existsSync(riddlePath(slug))

/** prompt ภาพเงา — ต้องมีคำว่า riddle/ปริศนา (Flow agent จับคู่ riddle.png จากคำใน prompt) และห้ามมี ปก/cover */
export const riddlePrompt = (riddle) => `ภาพปริศนาเงาผีไทยให้ทาย (ghost silhouette riddle) — เงาดำสนิทของผีตัวเดียวกลางภาพ: ${riddle.shape || riddle.answer}`

/** "ช็อต" ภาพเงาสำหรับส่งให้ Flow — ไม่มีโจทย์ = null (คลิปเก่า/คลิปภาษาอื่น ไม่ทำ) */
export function riddleShot(slug) {
  const riddle = readRiddle(slug)
  if (!riddle || riddleProblem(riddle)) return null // โจทย์ผิด (เช่นโจทย์ปริศนาของเก่า) ไม่ต้องเสียเวลาวาด
  return {
    filename: RIDDLE_NAME,
    shot: 'RIDDLE',
    // ห้ามมีคำว่า ปก/cover/thumbnail — extension จับคู่ภาพพิเศษจากคำใน prompt · ไม่ใส่ชื่อผีในภาพ (เงาเท่านั้น)
    prompt: riddlePrompt(riddle),
  }
}

/** ส่วนท้ายของ brief ที่ส่งให้ Flow — ภาพเงาแบบของตัวเองแทน Style Bible ของคลิป */
export function riddleBriefLines(shot) {
  return [
    '=== RIDDLE (สร้างต่อจากภาพปก เป็นภาพสุดท้าย) ===',
    `${shot.filename} ${shot.prompt} | ภาพนี้ใช้สไตล์ของตัวเองแทน Style Bible ของคลิป: ภาพเงา (silhouette) ผีไทยตัวเดียว เงาดำสนิททึบ ไม่เห็นรายละเอียดข้างใน ขอบเงาคมชัด วางกลางภาพ บนพื้นหลังไล่สีม่วงเข้ม-น้ำเงินเข้มยามค่ำคืน มีดวงจันทร์ซีดนวลและหมอกบางๆ ด้านหลัง ให้ขนลุกแบบเรื่องผีเล่มละบาทแต่ไม่โหด · จัดเงาไว้ช่วงกลางภาพ (ระหว่าง 25% ถึง 85% ของความสูง) ด้านบนและล่างเป็นพื้นหลังเรียบๆ · ภาพสุภาพ ไม่โหด ไม่สยดสยอง · ห้ามมีตัวอักษร ตัวเลข หรือคำใดๆ ในภาพเด็ดขาด · ตั้งชื่อภาพ "riddle.png RIDDLE" (ชื่อไฟล์ไม่ต้องเขียนลงในภาพ)`,
  ]
}

// ── ภาพ Story: เขียนหัวข้อ คำใบ้ และเฉลยลงบนภาพเงา ──

const assText = (s) => String(s ?? '').replace(/[{}\\]/g, '').replace(/\r?\n/g, '\\N').trim()

/** คำใบ้บรรทัดเดียว (ไม่ตัดคำ WrapStyle 2) — ยาวเกินตัดที่ช่องว่างแล้วใส่ … ไม่ล้นขอบภาพ */
export function shortHint(text, max = 48) {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim()
  if ([...s].length <= max) return s
  const cut = [...s].slice(0, max).join('')
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trim()}…`
}

/** ข้อความบนภาพ (ASS 1080×1920) — หัวข้อบน คำใบ้ล่าง เฉลยตัวเล็กที่มุมขวาล่างแบบเวทีทอง */
export function riddleAss(riddle) {
  const font = 'Leelawadee UI'
  const line = (style, text) => `Dialogue: 0,0:00:00.00,0:00:05.00,${style},,0,0,0,,${assText(text)}`
  return `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Head,${font},104,&H00FFFFFF,&H00FFFFFF,&H00573A1E,&H00573A1E,-1,0,0,0,100,100,2,0,3,22,0,8,60,60,120,222
Style: Ask,${font},56,&H00FFFFFF,&H00FFFFFF,&H30573A1E,&H30573A1E,-1,0,0,0,100,100,0,0,3,14,0,8,70,70,300,222
Style: Hint,${font},40,&H00FFFFFF,&H00FFFFFF,&H30573A1E,&H30573A1E,-1,0,0,0,100,100,0,0,3,12,0,2,50,50,250,222
Style: Cta,${font},46,&H00FFFFFF,&H00FFFFFF,&H30573A1E,&H30573A1E,-1,0,0,0,100,100,0,0,3,14,0,2,70,70,150,222
Style: Ans,${font},30,&H00FFFFFF,&H00FFFFFF,&H40000000,&H40000000,0,0,0,0,100,100,0,0,3,10,0,3,36,36,40,222

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${line('Head', RIDDLE_TITLE)}
${line('Ask', 'เงานี้คือผีอะไร?')}
${line('Hint', `คำใบ้: ${shortHint(riddle.hint)}`)}
${line('Cta', 'ทายแล้วตอบกลับ Story นี้ได้เลย')}
${line('Ans', `เฉลย: ${riddle.answer}`)}
`
}

/**
 * ภาพ Story พร้อมลง (JPG 1080×1920) ไว้ในโฟลเดอร์ชั่วคราวของ posting — คืน { file, riddle, remove }
 * ไม่มีโจทย์หรือภาพเงา = null (ข้าม Story รอบนี้)
 */
export async function prepareRiddleStory(slug, postingDir) {
  const riddle = readRiddle(slug)
  const image = riddlePath(slug)
  if (!riddle || riddleProblem(riddle) || !existsSync(image)) return null // โจทย์ผิด = ไม่ลง Story (ไม่นับรอบ)
  const dir = join(postingDir, 'staging', `riddle-${randomUUID()}`)
  mkdirSync(dir, { recursive: true })
  const remove = async () => rmSync(dir, { recursive: true, force: true })
  try {
    writeFileSync(join(dir, 'riddle.ass'), riddleAss(riddle), 'utf8')
    // ffmpeg บน Windows escape path ใน filter ยาก → รันในโฟลเดอร์ของไฟล์ .ass แล้วอ้างชื่อไฟล์เปล่าๆ
    await run('ffmpeg', ['-y', '-v', 'error', '-i', image,
      '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,subtitles=riddle.ass',
      '-frames:v', '1', '-q:v', '3', 'story.jpg'], { cwd: dir })
    return { file: join(dir, 'story.jpg'), riddle, remove }
  } catch (error) {
    await remove()
    throw error
  }
}
