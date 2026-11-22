(() => {
if (globalThis.__cartoon_content_gemini) return // ฉีดซ้ำ → ไม่เพิ่ม listener ซ้ำ
globalThis.__cartoon_content_gemini = true

/**
 * ขับ Gemini เว็บ (gemini.google.com) — ผู้ใช้ (21 พ.ย. 2026): API ต้องเปิด billing ขอใช้เว็บแทน
 * งานที่รับ: { kind: 'prompt', payload: { prompt, newChat } } · ตอบกลับ: { text }
 *
 * หน้าจริง (ตรวจ 21 พ.ย. 2026, บัญชีฟรี):
 *   ช่องพิมพ์ rich-textarea .ql-editor (Quill, contenteditable) — รับข้อความได้ ~32,500 ตัวอักษร เกินถูกตัดทิ้งเงียบๆ
 *     · พิมพ์ทีละก้อนด้วย insertText ช้ามากจนหน้าค้าง → วางด้วย paste event (เร็ว)
 *     · prompt ยาวเกิน → แนบเป็นไฟล์ .txt (paste File ได้ ขึ้นเป็น uploader-file-preview) — บัญชีฟรีมีโควตาไฟล์ จึงใช้เมื่อจำเป็นเท่านั้น
 *   ปุ่มส่ง aria-label "ส่งข้อความ"/"Send message" (โผล่เมื่อมีข้อความ) · ระหว่างตอบมีปุ่ม "หยุดคำตอบ"/"Stop response"
 *   คำตอบ: model-response > message-content (.markdown) · ตอบจบ = ปุ่ม "คัดลอก"/"Copy" โผล่ใน model-response และปุ่มหยุดหาย
 *   ตาราง markdown แสดงเป็น <table> — innerText เป็นแถวคั่น tab → แปลงกลับเป็น | a | b | ให้ตัวอ่านตารางหัวข้อ
 */
const { pressEnter, toBridge, heartbeat } = bridgeHelpers

let stopped = false
const guard = () => {
  if (stopped) throw new Error('หยุดแล้ว')
}
const waitFor = (fn, opts) => bridgeHelpers.waitFor(() => (guard(), fn()), opts)
const sleep = async (ms) => {
  await bridgeHelpers.sleep(ms)
  guard()
}

const MAX_INPUT = 30_000 // เผื่อจากเพดานจริง ~32,500
const label = (b) => (b.getAttribute('aria-label') || '').trim()
const editor = () => document.querySelector('rich-textarea .ql-editor[contenteditable="true"], rich-textarea [contenteditable="true"], input-area-v2 [contenteditable="true"], [role="textbox"][contenteditable="true"]')
const buttons = (root = document) => [...root.querySelectorAll('button')].filter((b) => b.offsetParent)
const sendButton = () => buttons().find((b) => /^(ส่งข้อความ|send message)$/i.test(label(b)))
const stopButton = () => buttons().find((b) => /^(หยุดคำตอบ|stop response|หยุดสร้าง|stop generating)/i.test(label(b)))
const responses = () => [...document.querySelectorAll('model-response')]
const queries = () => [...document.querySelectorAll('user-query')]
const attachments = () => document.querySelectorAll('input-area-v2 uploader-file-preview, uploader-file-preview').length
const finished = (resp) => !!resp && buttons(resp).some((b) => /^(คัดลอก|copy)/i.test(label(b))) && !stopButton()

function tableMarkdown(table) {
  return [...table.rows]
    .map((r, i) => {
      const cells = [...r.cells]
      const line = `| ${cells.map((c) => c.innerText.replace(/\s+/g, ' ').replace(/\|/g, '/').trim()).join(' | ')} |`
      return i === 0 ? `${line}\n|${' --- |'.repeat(cells.length)}` : line
    })
    .join('\n')
}
function responseText(resp) {
  const box = resp?.querySelector('message-content') ?? resp
  let text = box?.innerText ?? ''
  for (const table of box?.querySelectorAll('table') ?? []) {
    const raw = table.innerText.trim()
    const at = raw ? text.indexOf(raw) : -1
    text = at >= 0 ? text.slice(0, at) + tableMarkdown(table) + text.slice(at + raw.length) : `${text}\n\n${tableMarkdown(table)}`
  }
  return text.trim()
}

/** Gemini ปฏิเสธ/ติดลิมิต — ข้อความสั้นทั้งก้อนเป็นคำแจ้ง ไม่ใช่เนื้อหา */
const LIMIT = /(reached your limit|limit for today|try again (later|tomorrow)|ถึงขีดจำกัด|ใช้ครบ|ลองอีกครั้งในภายหลัง|ลองใหม่อีกครั้งพรุ่งนี้)/i
const ERROR = /^(something went wrong.*|an error occurred.*|เกิดข้อผิดพลาด.*|มีบางอย่างผิดพลาด.*|ขออภัย มีบางอย่างผิดพลาด.*)$/i
function geminiError(text) {
  const t = String(text ?? '').trim()
  if (!t || t.length > 400) return null
  if (LIMIT.test(t)) return `Gemini แจ้งว่าใช้ครบโควตาแล้ว — "${t.slice(0, 120)}"`
  return t.split(/\n+/).some((l) => ERROR.test(l.trim())) ? `Gemini ตอบไม่สำเร็จ ("${t.slice(0, 80)}")` : null
}

function paste(target, data) {
  const dt = new DataTransfer()
  if (data instanceof File) dt.items.add(data)
  else dt.setData('text/plain', data)
  target.focus()
  target.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
}

async function clearComposer(ed) {
  for (let i = 0; i < 10; i++) {
    const remove = [...document.querySelectorAll('input-area-v2 button, uploader-file-preview button')].find((b) => /^(close|ลบ|นำออก|remove)\b/i.test(label(b)))
    if (!remove) break
    remove.click()
    await sleep(300)
  }
  if (ed.innerText.trim()) {
    ed.focus()
    const range = document.createRange()
    range.selectNodeContents(ed)
    getSelection().removeAllRanges()
    getSelection().addRange(range)
    document.execCommand('delete')
    await sleep(300)
  }
}

/**
 * prompt ยาวเกินช่องพิมพ์ → แยกเอกสาร Blueprint (ก่อนเส้น ═══ เส้นสุดท้าย) ไปเป็นไฟล์แนบ ส่วนคำสั่งงานพิมพ์ในช่อง
 * ไม่มีเส้นแบ่ง → แนบทั้งก้อนแล้วสั่งสั้นๆ ให้ทำตามไฟล์
 */
function splitForInput(prompt, max = MAX_INPUT) {
  if (prompt.length <= max) return { text: prompt, file: null }
  const cut = prompt.lastIndexOf('═══════')
  const head = cut > 0 ? prompt.slice(0, cut) : prompt
  const task = cut > 0 ? prompt.slice(cut) : ''
  const note = 'เอกสารคู่มือ (Blueprint) ทั้งฉบับอยู่ในไฟล์แนบ — คำว่า "เอกสารข้างบน" ในคำสั่งนี้หมายถึงไฟล์แนบ อ่านให้ครบก่อนทำ'
  if (task && task.length + note.length < max) return { text: `${note}\n\n${task}`, file: head }
  return { text: 'ไฟล์แนบคือคำสั่งงานฉบับเต็ม อ่านทั้งไฟล์แล้วทำตามคำสั่งท้ายไฟล์ ตอบเป็นข้อความในแชตตามข้อกำหนดในไฟล์ ห้ามสรุปไฟล์', file: prompt }
}

async function fillPrompt(prompt) {
  const ed = await waitFor(editor, { label: 'ช่องพิมพ์ของ Gemini', timeout: 30_000 })
  await clearComposer(ed)
  const { text, file } = splitForInput(prompt)
  if (file) {
    const before = attachments()
    paste(ed, new File([file], 'blueprint.txt', { type: 'text/plain' }))
    await waitFor(() => attachments() > before, { timeout: 30_000, label: 'Gemini รับไฟล์แนบ' })
  }
  paste(ed, text)
  const landed = await waitFor(() => ed.innerText.trim().length >= Math.min(text.length, MAX_INPUT) * 0.9, { timeout: 10_000, interval: 200, label: 'prompt ลงช่องพิมพ์' }).then(() => true, () => false)
  if (!landed) {
    // paste ไม่ลง (หน้ารุ่นอื่น) → พิมพ์ทั้งก้อนด้วย insertText (ช้ากว่าแต่ข้อความสั้นแล้ว)
    ed.focus()
    document.execCommand('insertText', false, text)
    await waitFor(() => ed.innerText.trim().length > 0, { timeout: 30_000, label: 'prompt ลงช่องพิมพ์' })
  }
}

async function startNewChat() {
  // service worker โหลดหน้า /app ให้ก่อนส่งงานแล้ว — หน้าว่างอยู่แล้วก็ไม่ต้องทำอะไร
  const empty = () => !responses().length && editor()
  // หน้า Angular ของ Gemini โหลดช่องพิมพ์ช้าได้หลายวินาทีหลังหน้า "complete"
  if (await waitFor(empty, { timeout: 25_000, label: 'แชตใหม่ของ Gemini' }).then(() => true, () => false)) return sleep(500)
  const link = [...document.querySelectorAll('a, button')].find((b) => /^(แชทใหม่|new chat)$/i.test(label(b)) && b.offsetParent)
  if (link) link.click()
  if (await waitFor(empty, { timeout: 15_000, label: 'แชตใหม่ของ Gemini' }).then(() => true, () => false)) return sleep(500)
  throw new Error(`เปิดแชตใหม่ใน Gemini ไม่สำเร็จ — ${pageState()}`)
}

/** สภาพหน้าตอนพัง — ผู้ดูแลมองไม่เห็นจอเครื่องผลิต ต้องรู้จากข้อความ error */
/**
 * ยังไม่ได้ลงชื่อเข้าใช้ — เครื่องผลิต 21 พ.ย. 2026: เปิด /app แล้วถูกพาไปหน้าแรก gemini.google.com/ (หน้าแนะนำ ไม่มีช่องพิมพ์)
 * ข้อความ error ต้องมีคำว่า "ลงชื่อเข้าใช้" — autopilot ใช้คำนี้ตัดสินว่าไม่ต้องลองซ้ำ สลับไป ChatGPT ทันที
 */
const NOT_SIGNED_IN = 'Gemini ยังไม่ได้ลงชื่อเข้าใช้ — เปิด gemini.google.com ใน Chrome ที่รันโปรแกรมแล้วลงชื่อเข้าใช้บัญชี Google ก่อน'
function signedOut() {
  if (/accounts\.google\.com/.test(location.host) || document.querySelector('a[href*="ServiceLogin"]')) return true
  if (!location.pathname.startsWith('/app') && !document.querySelector('rich-textarea')) return true
  return [...document.querySelectorAll('a, button')].some((b) => /^(sign in|ลงชื่อเข้าใช้)$/i.test((b.textContent || '').trim()) && b.offsetParent)
}

function pageState() {
  const editable = document.querySelectorAll('[contenteditable="true"]').length
  const why = signedOut() ? NOT_SIGNED_IN : !editor() ? 'หาช่องพิมพ์ไม่เจอ' : 'แชตเก่ายังค้างอยู่บนหน้า'
  return `${why} [${location.host}${location.pathname} · คำตอบเดิม ${responses().length} · ช่องพิมพ์ rich-textarea ${document.querySelectorAll('rich-textarea').length} · contenteditable ${editable} · "${document.title.slice(0, 40)}"]`
}

async function runPrompt(prompt, { newChat = true } = {}) {
  // หน้าโหลดเสร็จแล้วยังไม่ล็อกอิน → บอกเลย ไม่ต้องรอหาช่องพิมพ์ 40 วิ
  if (await waitFor(() => editor() || (document.readyState === 'complete' && signedOut() && document.querySelector('a, button')), { timeout: 20_000, label: 'หน้า Gemini' }).then(() => !editor() && signedOut(), () => signedOut())) {
    throw new Error(NOT_SIGNED_IN)
  }
  if (newChat) await startNewChat()
  await fillPrompt(prompt)
  await waitFor(() => sendButton() && !sendButton().disabled && sendButton().getAttribute('aria-disabled') !== 'true', { timeout: 60_000, label: 'ปุ่มส่งของ Gemini พร้อม' }).catch(() => null)
  guard()
  await sleep(500)

  const oldResponses = new Set(responses())
  const oldQueries = new Set(queries())
  const newResponses = () => responses().filter((r) => !oldResponses.has(r))
  const started = () => stopButton() || newResponses().length || queries().some((q) => !oldQueries.has(q))
  let sent = false
  for (let attempt = 0; attempt < 3 && !sent; attempt++) {
    const btn = sendButton()
    if (btn && attempt !== 1) btn.click()
    else await pressEnter(editor())
    sent = await waitFor(started, { timeout: 10_000, label: 'Gemini รับข้อความ' }).then(() => true, () => false)
  }
  guard()
  if (!sent) throw new Error('ส่งข้อความไป Gemini ไม่สำเร็จ — ดูที่แท็บ Gemini แล้วสั่งใหม่')

  // ตอบจบ = ปุ่มคัดลอกโผล่ + ไม่มีปุ่มหยุด + ข้อความนิ่ง 4 วิ (โหมดคิดพิมพ์เป็นช่วงๆ)
  const STABLE_MS = 4000
  let lastText = ''
  let stableSince = Date.now()
  await waitFor(() => {
    const last = newResponses().at(-1)
    const current = responseText(last)
    if (current !== lastText || stopButton()) {
      lastText = current
      stableSince = Date.now()
    }
    const failed = geminiError(current)
    if (failed && !stopButton() && Date.now() - stableSince > 6000) throw new Error(failed)
    return finished(last) && current && Date.now() - stableSince >= STABLE_MS
  }, { timeout: 20 * 60_000, interval: 1000, label: 'Gemini ตอบจบ' })

  const text = responseText(newResponses().at(-1))
  if (!text) throw new Error('ข้อความตอบกลับของ Gemini ว่าง')
  const failed = geminiError(text)
  if (failed) throw new Error(failed)
  return text
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'PING') {
    sendResponse({ ok: true, loggedIn: editor() ? true : null, url: location.href })
    return
  }
  if (msg.type === 'STOP') {
    stopped = true
    stopButton()?.click()
    sendResponse({ ok: true })
    return
  }
  if (msg.type !== 'RUN_JOB') return
  const { job } = msg
  stopped = false
  ;(async () => {
    const stopBeat = heartbeat(job.id, () => {
      stopped = true
      stopButton()?.click()
    })
    try {
      if (job.kind !== 'prompt') throw new Error(`Gemini ไม่รู้จักงาน: ${job.kind}`)
      const text = await runPrompt(job.payload.prompt, job.payload)
      await toBridge('RESULT', { id: job.id, text })
      sendResponse({ ok: true })
    } catch (err) {
      await toBridge('ERROR', { id: job.id, message: String(err.message) }).catch(() => {})
      sendResponse({ ok: true, reported: true })
    } finally {
      stopBeat()
    }
  })()
  return true
})
})()
