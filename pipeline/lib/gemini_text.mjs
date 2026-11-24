/**
 * Gemini เขียนบท/คิดหัวข้อแทน ChatGPT — เรียก API ตรง ไม่ต้องคุมแท็บเบราว์เซอร์
 * ผู้ใช้ (21 พ.ย. 2026) ขอโหมด Gemini เขียนบทไว้เทียบกับ ChatGPT · ใช้ GEMINI_API_KEY ตัวเดียวกับเสียง Gemini
 *
 * เลือกรุ่นเอง: script.geminiModel ถ้าตั้งไว้ → ไม่งั้นรุ่น pro ใหม่สุดที่ key นี้ใช้ได้ → flash
 * โควตาของรุ่นหนึ่งหมด (429 รายวัน) → ลองรุ่นถัดไปในรายการ
 */
import { loadEnv } from './env.mjs'

const API = 'https://generativelanguage.googleapis.com/v1beta'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export const geminiKey = () => (loadEnv(), process.env.GEMINI_API_KEY?.trim() || '')

/**
 * เรียงรุ่นที่ใช้เขียนบท: pro ก่อน flash · เลขรุ่นสูงก่อน · รุ่นเสถียรก่อน preview
 * ตัดรุ่นเฉพาะทาง (tts image audio live embedding lite) ออก
 */
export function rankModels(names) {
  const rows = []
  for (const full of names) {
    const name = String(full).replace(/^models\//, '')
    const m = name.match(/^gemini-(\d+(?:\.\d+)?)-(pro|flash)(?:-(preview|exp)(?:-[\d-]+)?|-latest)?$/)
    if (!m) continue
    rows.push({ name, version: Number(m[1]), tier: m[2] === 'pro' ? 0 : 1, preview: m[3] ? 1 : 0 })
  }
  return rows
    .sort((a, b) => a.tier - b.tier || b.version - a.version || a.preview - b.preview || a.name.localeCompare(b.name))
    .map((r) => r.name)
}

let cachedModels = null
async function listModels(key) {
  if (cachedModels) return cachedModels
  const res = await fetch(`${API}/models?pageSize=200`, { headers: { 'x-goog-api-key': key }, signal: AbortSignal.timeout(30_000) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`Gemini ปฏิเสธ key: ${data.error?.message ?? `HTTP ${res.status}`}`)
  const usable = (data.models ?? []).filter((m) => m.supportedGenerationMethods?.includes('generateContent')).map((m) => m.name)
  cachedModels = rankModels(usable)
  return cachedModels
}

/** รุ่นที่จะลองตามลำดับ — รุ่นที่ตั้งไว้เองมาก่อน แล้วตามด้วยรุ่นอื่นไว้สำรองตอนโควตาหมด */
export async function modelsToTry(key, preferred) {
  const ranked = await listModels(key)
  const list = preferred ? [preferred, ...ranked.filter((m) => m !== preferred)] : ranked
  if (!list.length) throw new Error('key นี้ไม่มีรุ่น Gemini ที่เขียนข้อความได้')
  return list.slice(0, 4)
}

const textOf = (data) => (data.candidates?.[0]?.content?.parts ?? []).filter((p) => !p.thought && typeof p.text === 'string').map((p) => p.text).join('').trim()

async function generate(key, model, contents, { timeoutMs }) {
  for (let attempt = 1; ; attempt++) {
    let res, data
    try {
      res = await fetch(`${API}/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents, generationConfig: { temperature: 1, maxOutputTokens: 32768 } }),
        signal: AbortSignal.timeout(timeoutMs),
      })
      data = await res.json().catch(() => ({}))
    } catch (err) {
      if (attempt >= 3) throw new Error(`Gemini ไม่ตอบ (${err.name === 'TimeoutError' ? 'หมดเวลา' : err.message})`)
      await sleep(10_000 * attempt)
      continue
    }
    if (res.ok) {
      const text = textOf(data)
      if (text) return { text, model }
      const why = data.promptFeedback?.blockReason ?? data.candidates?.[0]?.finishReason ?? 'ไม่มีข้อความ'
      if (attempt >= 3) throw new Error(`Gemini ตอบกลับว่าง (${why})`)
      await sleep(5000)
      continue
    }
    const message = data.error?.message ?? `HTTP ${res.status}`
    if (res.status === 404) throw Object.assign(new Error(`ไม่มีรุ่น ${model}`), { nextModel: true })
    if (res.status === 400 || res.status === 401 || res.status === 403) throw new Error(`Gemini ปฏิเสธ: ${message}`)
    // 429 ต่อวัน หรือรุ่นนี้ไม่มีโควตาฟรีเลย (limit: 0) → ลองรุ่นถัดไป · 429 ต่อนาที / 5xx → รอแล้วลองใหม่
    if (res.status === 429 && (/per ?day|daily|limit: ?0\b/i.test(message) || attempt >= 4)) throw Object.assign(new Error(`โควตา ${model} หมด`), { nextModel: true })
    if (attempt >= 6) throw new Error(`Gemini ล้มเหลว: ${message}`)
    const retry = data.error?.details?.find((d) => d.retryDelay)?.retryDelay
    await sleep(retry ? Number.parseFloat(retry) * 1000 + 500 : Math.min(60_000, 5000 * attempt))
  }
}

/**
 * แชตกับ Gemini — จำบทสนทนาไว้ให้สั่งปรับต่อในแชตเดิมได้ (เหมือน newChat: false ของ ChatGPT)
 * ask(prompt, { newChat }) → ข้อความตอบ
 */
export function geminiChat({ model: preferred = '', log = console.log } = {}) {
  let history = []
  let usedModel = null
  return {
    get model() { return usedModel },
    // images = [{ type, base64 }] แนบรูปไปกับคำถามได้ (เช่น ให้เลือก/บรรยายรูปสินค้า)
    async ask(prompt, { newChat = true, timeoutMs = 10 * 60_000, images = [] } = {}) {
      const key = geminiKey()
      if (!key) throw new Error('ยังไม่ได้ใส่ Gemini API key — ใส่ในแผงข้าง (ผู้เขียนบท → Gemini) หรือในไฟล์ .env (GEMINI_API_KEY)')
      if (newChat) history = []
      const pictures = images.map((i) => ({ inline_data: { mime_type: i.type, data: i.base64 } }))
      const contents = [...history, { role: 'user', parts: [...pictures, { text: prompt }] }]
      // แชตเดิมต้องใช้รุ่นเดิม · แชตใหม่ไล่ตามลำดับรุ่น
      const models = !newChat && usedModel ? [usedModel] : await modelsToTry(key, preferred)
      let lastError
      for (const model of models) {
        try {
          const { text } = await generate(key, model, contents, { timeoutMs })
          if (usedModel !== model) log(`   Gemini รุ่น ${model}`)
          usedModel = model
          history = [...contents, { role: 'model', parts: [{ text }] }]
          return text
        } catch (err) {
          lastError = err
          if (!err.nextModel) throw err
          log(`   ${err.message} — ลองรุ่นถัดไป`)
        }
      }
      throw lastError
    },
  }
}

/**
 * ผู้เขียนบทที่เลือกไว้ — 'chatgpt' (ค่าเริ่มต้น) | 'gemini-web' แท็บ gemini.google.com | 'gemini' Gemini API
 * ลำดับใน WRITERS = ลำดับการ์ดในแผงข้าง
 */
export const WRITERS = { chatgpt: { label: 'ChatGPT' }, 'gemini-web': { label: 'Gemini เว็บ' }, gemini: { label: 'Gemini API' } }
export const writerOf = (config) => (WRITERS[config?.script?.writer] ? config.script.writer : 'chatgpt')

/**
 * ตัดส่วนกำกับภาพของ Blueprint (OUTPUT 4 ภาพปก + OUTPUT 5 ภาพ ~11,000 ตัวอักษร) ออกจาก prompt ที่ส่งให้ Gemini เว็บ
 * ช่องพิมพ์ของ Gemini เว็บรับได้ ~32,500 ตัวอักษร (เกินถูกตัดทิ้งเงียบๆ) — prompt บท 33k / หัวข้อ 37k เกินพอดี
 * ขั้นคิดหัวข้อและเขียนบทไม่ได้ใช้ส่วนภาพ ตัดแล้วเหลือ ~22k / ~26k · หาหัวข้อไม่เจอ = ส่งทั้งก้อนตามเดิม
 */
export function trimForWebWriter(prompt) {
  const text = String(prompt)
  const start = text.indexOf('### OUTPUT 4 —')
  const end = text.indexOf('## 4. สูตร Hook')
  if (start < 0 || end <= start) return text
  return `${text.slice(0, start)}(ส่วน OUTPUT 4–5 เรื่องภาพปกและภาพประกอบ ตัดออก — ขั้นนี้ไม่ใช้)\n\n---\n\n${text.slice(end)}`
}
