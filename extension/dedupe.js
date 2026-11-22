/**
 * ตัวกันทำเรื่องซ้ำ — ส่วนที่คิดล้วนๆ ไม่แตะไฟล์ ไม่แตะเครือข่าย
 * ใช้ร่วมกันทั้ง 2 ทาง: แผงข้าง (ปุ่ม "เสนอหัวข้อ") และ pipeline (ผลิตต่อเนื่อง / autopilot)
 * ฝั่งอ่านไฟล์ว่าทำเรื่องอะไรไปแล้ว อยู่ที่ pipeline/lib/topic-guard.mjs (recentTopics)
 *
 * ทำไมต้องมี: ขอหัวข้อทุกครั้ง ChatGPT เปิดแชตใหม่ จำไม่ได้ว่าช่องนี้เคยทำเรื่องอะไร
 * ฝากไว้ใน prompt ว่า "ห้ามซ้ำ" อย่างเดียวไม่พอ — เรื่องเดียวกันที่ตั้งชื่อใหม่หลุดมาได้เรื่อยๆ
 * เช่น "กระสือกับหมอตำแย" กับ "คืนที่กระสือตามกลิ่นเรือนคนคลอด" คือคลิปเดียวกัน
 * จึงให้โค้ดเป็นคนบังคับ ตรวจ 2 ชั้น:
 *   1) ในเครื่อง — ชื่อเหมือน/เกือบเหมือน หรือแก่นเรื่อง (key) เดียวกันกับที่ทำไปแล้ว → ตัดทิ้งทันที
 *   2) ChatGPT ตัดสิน "เนื้อเรื่อง" — เทียบหัวข้อที่เสนอกับเรื่องที่ทำไปแล้ว N เรื่องล่าสุดทีละข้อ
 *      ซ้ำ = หมวด + ชนิดผีหรือตัวละครหลัก + พล็อตหลัก เดียวกัน แม้ตั้งชื่อต่างกัน
 * ทุกหัวข้อที่ผ่านได้ key (แก่นเรื่องสั้นๆ) เก็บไว้กับคลิป ให้รอบถัดไปเทียบได้แม่นขึ้น
 *
 * ChatGPT ตรวจไม่สำเร็จ (ตอบอ่านไม่ออก 2 รอบ) → ใช้ผลชั้นที่ 1 อย่างเดียวและเตือนไว้
 * ไม่หยุดการผลิตเพราะตัวตรวจล่ม
 */

/** เทียบกับกี่เรื่องล่าสุด */
export const GUARD_WINDOW = 100

// ── ชั้นที่ 1: ตรวจในเครื่อง ──────────────────────────────────────

/** ตัดช่องว่างและวรรคตอนออก — ใช้เทียบเท่านั้น (สะกดต่างกันเล็กน้อย เช่น ตะเคียน / นางตะเคียน ให้ similarity จับ) */
export const squash = (s) => String(s ?? '').toLowerCase().normalize('NFC').replace(/[\s"'“”‘’!?？.,:;()\[\]{}…·—–\-\/]/g, '')

function grams(text, n = 3) {
  const t = squash(text)
  const set = new Set()
  for (let i = 0; i + n <= t.length; i++) set.add(t.slice(i, i + n))
  return set
}

/** สัดส่วนชิ้นตัวอักษร 3 ตัวที่ร่วมกัน (Jaccard) — 1 = เหมือนกันทุกตัว */
export function similarity(a, b) {
  const x = grams(a), y = grams(b)
  if (!x.size || !y.size) return squash(a) === squash(b) && !!squash(a) ? 1 : 0
  let both = 0
  for (const g of x) if (y.has(g)) both++
  return both / (x.size + y.size - both)
}

/** ชื่อเดียวกันหรือเกือบเหมือน (แก้คำไม่กี่คำ) — เกณฑ์ 0.7: ชื่อคนละเรื่องจริงในคลังคล้ายกันสูงสุดราว 0.4 */
export const NEAR_SAME = 0.7
export const nearSame = (a, b) => !!squash(a) && (squash(a) === squash(b) || similarity(a, b) >= NEAR_SAME)

/** เรื่องที่ทำไปแล้วซึ่งซ้ำกับหัวข้อนี้แบบเห็นได้จากตัวหนังสือ (ชื่อ หรือแก่นเรื่อง) — ไม่มี = null */
export function localDuplicate(topic, recent) {
  const title = typeof topic === 'string' ? topic : topic?.title
  const key = typeof topic === 'string' ? null : topic?.key
  for (const r of recent) {
    if (nearSame(title, r.title)) return r
    if (key && r.key && nearSame(key, r.key)) return r
  }
  return null
}

// ── ชั้นที่ 2: ChatGPT ตัดสินเนื้อเรื่อง ───────────────────────────

/** prompt ตรวจเรื่องซ้ำ — candidates = [{ title }] · recent = ผลของ recentTopics() */
export function dedupePrompt(candidates, recent) {
  const done = recent.map((r, i) => `${i + 1}. ${r.title}${r.key ? ` 〔แก่นเรื่อง: ${r.key}〕` : ''}`).join('\n')
  const fresh = candidates.map((c, i) => `${i + 1}. ${c.title}`).join('\n')
  return `คุณคือบรรณาธิการช่องคลิปการ์ตูนเล่มละบาท "ผี 1 บาท" (ผีไทย ไสยศาสตร์ นิทานพื้นบ้าน ชีวิตสอนใจ ตลกบ้านทุ่ง)
งานนี้มีอย่างเดียวคือ "ตรวจเรื่องซ้ำ" ก่อนผลิตคลิป — ไม่ต้องให้คะแนน ไม่ต้องแก้ชื่อ

รายการ A — เรื่องที่ทำคลิปไปแล้ว ${recent.length} เรื่องล่าสุด:
${done || '(ยังไม่มี)'}

รายการ B — หัวข้อใหม่ที่เสนอ:
${fresh}

═══════════════════════════════════════
ตัดสินทีละข้อของรายการ B ว่า "ซ้ำ" กับข้อใดในรายการ A หรือไม่ — ดูจาก 3 อย่างรวมกัน: หมวด + ชนิดผีหรือตัวละครหลัก + พล็อตหลัก
ถือว่าซ้ำเมื่อเข้าข้อใดข้อหนึ่ง:
- หมวดเดียวกัน ชนิดผีหรือตัวละครหลักเดียวกัน และพล็อตหลักเดียวกัน แม้ตั้งชื่อต่างกันคนละแบบ
  (เช่น "กระสือกับหมอตำแย" = "คืนที่กระสือตามกลิ่นเรือนคนคลอด" · "ตะกรุดที่ห้ามถอดตอนอาบน้ำ" = "หนุ่มที่ถอดตะกรุดผิดเวลา")
- ผีหรือตัวละครหลักเดียวกันแม้เรียกต่างกัน ในพล็อตเดียวกัน
  (นางตะเคียน = ผีต้นตะเคียน · ผีพราย = ผีน้ำ · ศรีธนญชัย = เซียงเมี่ยง · ผีรถเมล์ = ผีป้ายรถเมล์ ถ้าเป็นเหตุการณ์เดียวกัน)
- นิทานเรื่องเดียวกันตอนเดียวกัน (สังข์ทองถอดรูปเงาะ · ปลาบู่ทองถูกแม่เลี้ยงฆ่า) แม้เล่าจากมุมตัวละครอื่น
- ปมกรรมและผลกรรมเหมือนกันจนคนดูจะรู้สึกว่า "เคยดูคลิปนี้แล้ว" (โลภทองในหลุมศพแล้วผีเจ้าของตามทวง · ลูกอกตัญญูไล่แม่แล้วตกอับ)
- มุกตลกเดียวกัน (ขี้โม้ว่าไม่กลัวผีแล้วต้องนอนป่าช้า) แม้เปลี่ยนตัวละคร

ไม่ถือว่าซ้ำ:
- แค่ใช้รูปประโยคตั้งชื่อเหมือนกัน (เช่น "คืนที่…" "ห้าม…หลังเที่ยงคืน" "ใครอยู่ใน…")
- ผีชนิดเดียวกันแต่พล็อตต่างกันชัดเจน (กระสือหาของสดกินกลางทุ่ง กับ กระสือตกหลุมรักหนุ่มบ้านนา = คนละเรื่อง)
- พล็อตคล้ายกันแต่ผีหรือตัวละครหลักต่างกัน และฉากต่างกัน (ลบหลู่ศาลเจ้าที่แล้วเจอปอบ กับ ลบหลู่ต้นตะเคียนแล้วเจอนางตะเคียน = คนละเรื่อง)
- คนละหมวด แม้มีของบางอย่างเหมือนกัน (หมอผีปราบปอบ ในหมวดไสยศาสตร์ กับ หมอผีปลอม ในหมวดตลก)

ตัดสินเข้มไว้ก่อน: ถ้าลังเลว่าคนดูจะรู้สึกว่าซ้ำไหม ให้ถือว่าซ้ำ

ตอบเป็น JSON array ก้อนเดียวเท่านั้น ไม่มีคำนำหรือคำอธิบาย มีครบทุกข้อของรายการ B เรียงตามลำดับ รูปแบบนี้เป๊ะๆ:
[{"n": 1, "dup": false, "same": null, "key": "แก่นเรื่องสั้นๆ", "why": ""}, {"n": 2, "dup": true, "same": 17, "key": "แก่นเรื่องสั้นๆ", "why": "เหตุผล 1 ประโยค"}]
- n = เลขข้อในรายการ B
- dup = true เมื่อซ้ำ · same = เลขข้อในรายการ A ที่ซ้ำด้วย (ไม่ซ้ำ = null)
- key = แก่นเรื่องของข้อนั้น ไม่เกิน 12 คำ ภาษาไทย รูปแบบ "หมวด · ชนิดผีหรือตัวละครหลัก · พล็อตหลัก"
  (เช่น "ผีไทย · กระสือ · หมอตำแยถูกตามกินของสด", "ตลกบ้านทุ่ง · ทิดจ่อย · ขี้โม้จนต้องนอนป่าช้า")
- why = เหตุผลสั้นๆ เมื่อซ้ำ (ไม่ซ้ำ = "")`
}

/**
 * อ่านผลตรวจ — คืน [{ title, dup, sameAs, key, why }] เรียงตาม candidates · อ่านไม่ออก/ไม่ครบทุกข้อ = throw
 * dup แต่ระบุเลขข้อผิด → ยังนับว่าซ้ำ (sameAs = null) เพราะตัดสินเข้มไว้ก่อน
 */
export function parseDedupe(text, candidates, recent) {
  const raw = String(text ?? '')
  const start = raw.indexOf('[')
  const end = raw.lastIndexOf(']')
  if (start === -1 || end <= start) throw new Error('อ่านผลตรวจเรื่องซ้ำจากคำตอบของ ChatGPT ไม่ออก')
  let rows
  try {
    rows = JSON.parse(raw.slice(start, end + 1).replace(/\r?\n/g, ' '))
  } catch {
    throw new Error('ผลตรวจเรื่องซ้ำจาก ChatGPT ไม่ใช่ JSON ที่ถูกต้อง')
  }
  if (!Array.isArray(rows)) throw new Error('ผลตรวจเรื่องซ้ำจาก ChatGPT ไม่ใช่รายการ')
  const byN = new Map(rows.filter((r) => r && typeof r === 'object').map((r) => [Number(r.n), r]))
  return candidates.map((c, i) => {
    const r = byN.get(i + 1)
    if (!r) throw new Error(`ผลตรวจเรื่องซ้ำไม่มีข้อ ${i + 1}`)
    const dup = r.dup === true || r.dup === 'true'
    const same = Number(r.same)
    return {
      title: c.title,
      dup,
      sameAs: dup && Number.isInteger(same) && same >= 1 && same <= recent.length ? recent[same - 1] : null,
      key: String(r.key ?? '').trim().slice(0, 120) || null,
      why: String(r.why ?? '').trim().slice(0, 200),
    }
  })
}

/**
 * คัดหัวข้อที่เสนอ: ตัดเรื่องที่ซ้ำกับ recent ออก
 *   ask(prompt) → ข้อความตอบของ ChatGPT (แผงข้างถามเองในแท็บ · autopilot ส่งงานเข้า bridge) · ไม่ส่ง ask = ตรวจในเครื่องอย่างเดียว
 * คืน { fresh: หัวข้อที่ผ่าน (ลำดับเดิม + key), rejected: [{ title, sameAs, why, by: 'local' | 'ai' }], judged: ChatGPT ตรวจสำเร็จไหม, error }
 */
export async function screenTopics(candidates, recent, ask, { tries = 2 } = {}) {
  const rejected = []
  let pool = []
  for (const c of candidates) {
    const hit = localDuplicate(c, recent)
    if (hit) rejected.push({ title: c.title, sameAs: hit, why: 'ชื่อเรื่องเหมือนหรือเกือบเหมือนเรื่องที่ทำไปแล้ว', by: 'local' })
    else pool.push(c)
  }
  if (!pool.length || !recent.length || !ask) return { fresh: pool, rejected, judged: false, error: null }
  let verdicts = null
  let error = null
  for (let attempt = 1; attempt <= tries && !verdicts; attempt++) {
    try {
      verdicts = parseDedupe(await ask(dedupePrompt(pool, recent)), pool, recent)
    } catch (err) {
      error = err
    }
  }
  if (!verdicts) return { fresh: pool, rejected, judged: false, error }
  const fresh = []
  pool.forEach((c, i) => {
    const v = verdicts[i]
    if (v.dup) rejected.push({ title: c.title, sameAs: v.sameAs, why: v.why, by: 'ai' })
    else fresh.push(v.key ? { ...c, key: v.key } : c)
  })
  return { fresh, rejected, judged: true, error: null }
}
