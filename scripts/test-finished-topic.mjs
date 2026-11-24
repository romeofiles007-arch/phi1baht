// กด ▶ แล้วต้องได้คลิปใหม่ ไม่ใช่วิ่งกลับไปคลิปที่ทำเสร็จแล้ว
// ผู้ใช้ 23 พ.ย. 2026: "กดสร้างแล้ววิ่งไปที่คลิปที่เสร็จแล้ว"
//
// ต้นเหตุ: แผงข้างจำชื่อเรื่องที่เลือกจากรายการ AI เสนอไว้ข้ามรอบ (S.autoTitle + S.scoredTopics)
// เรื่องนั้นทำเสร็จไปแล้วแต่ชื่อยังค้าง · ตัวเตือนเรื่องซ้ำยกเว้นหัวข้อจากรายการที่เสนอ จึงไม่เตือน
// กด ▶ → โปรแกรม "ทำต่อ" คลิปเดิมที่ไม่มีงานเหลือ → จบใน 0.2 วิ แล้วเปิดคลิปเก่าให้ดู (bridge.log 12:11:25 และ 12:11:35)
//   node --test scripts/test-finished-topic.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createServer } from 'node:http'
import { ROOT, slugify } from '../pipeline/lib/config.mjs'
import { createUi } from '../bridge/ui.js'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const SELECTED = join(ROOT, 'projects', 'selected_topic.json')

/** เปิดเส้นทางของแผงข้างบนพอร์ตชั่วคราว (token ทดสอบ ไม่แตะโปรแกรมตัวจริงที่พอร์ต 8787) */
async function withUi(fn) {
  const port = 18000 + (process.pid % 1000)
  const json = (res, status, body) => {
    res.writeHead(status, { 'content-type': 'application/json' })
    res.end(JSON.stringify(body))
  }
  const readBody = async (req) => {
    const chunks = []
    for await (const c of req) chunks.push(c)
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
  }
  // halt เปิดไว้เสมอ = runner ปฏิเสธการเริ่มงานทุกอย่าง → เทสต์นี้เริ่ม autopilot จริงไม่ได้แม้ด่านจะพัง
  // (23 พ.ย. 2026: ตอนพิสูจน์ว่าเทสต์จับบั๊กได้ ถอดด่านออกแล้ว autopilot ตัวจริงวิ่งไปส่งคำสั่งให้แท็บ Gemini
  //  และเขียนทับ selected_topic.json — จึงต้องกันไว้ที่นี่ ไม่ใช่หวังว่าด่านจะไม่พัง)
  const ui = createUi({ jobs: new Map(), enqueue() {}, lastPoll: {}, token: 'test-only', port, json, readBody, log() {}, scheduler: false, halt: { on: () => true } })
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`)
    try {
      if (!(await ui.handle(req, res, url))) {
        res.writeHead(404)
        res.end()
      }
    } catch (err) {
      json(res, 500, { error: String(err.message) })
    }
  })
  await new Promise((r) => server.listen(port, '127.0.0.1', r))
  const post = async (path, body) => {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-bridge-token': 'test-only' },
      body: JSON.stringify(body),
    })
    return { status: res.status, body: await res.json().catch(() => ({})) }
  }
  try {
    return await fn(post)
  } finally {
    await new Promise((r) => server.close(r))
  }
}

test('โปรแกรมในเครื่องไม่ยอม "ทำต่อ" คลิปที่ทำเสร็จแล้ว — ตอบ 409 พร้อม done: true และไม่เริ่มงาน', async () => {
  const title = `ทดสอบคลิปที่เสร็จแล้ว ${process.pid}`
  const slug = slugify(title)
  const dir = join(ROOT, 'projects', slug)
  const LAST = join(ROOT, 'projects', '_autopilot_last.json')
  const selectedBefore = existsSync(SELECTED) ? readFileSync(SELECTED, 'utf8') : null
  const lastBefore = existsSync(LAST) ? readFileSync(LAST, 'utf8') : null
  try {
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'autopilot.json'), JSON.stringify({ slug, title, status: 'done', departments: { edit: { status: 'done' } } }))
    await withUi(async (post) => {
      const r = await post('/api/autopilot', { title })
      assert.equal(r.status, 409, 'คลิปที่เสร็จแล้วต้องถูกปฏิเสธ ไม่ใช่เริ่ม autopilot แล้วจบทันที')
      assert.equal(r.body.done, true, 'ต้องบอกแผงข้างว่าเหตุผลคือ "เสร็จแล้ว" แผงข้างจะได้ล้างช่องหัวข้อ')
      assert.equal(r.body.slug, slug)
      assert.match(r.body.error, /ทำเสร็จไปแล้ว/)
      assert.match(r.body.error, /เริ่มใหม่ตั้งแต่แผนก/, 'ต้องบอกทางไปต่อถ้าตั้งใจจะทำเรื่องนี้ใหม่จริง')
    })
    // ปฏิเสธแล้วต้องไม่ไปเปลี่ยน "หัวข้อที่เลือก" ของแผงข้าง
    const selectedAfter = existsSync(SELECTED) ? readFileSync(SELECTED, 'utf8') : null
    assert.equal(selectedAfter, selectedBefore, 'ปฏิเสธแล้วต้องไม่เขียนทับ selected_topic.json')
  } finally {
    rmSync(dir, { recursive: true, force: true })
    // ด่านที่สอง: คืนไฟล์สถานะของแผงข้างเสมอ ไม่ว่าเทสต์จะผ่านหรือล้ม
    if (selectedBefore !== null) writeFileSync(SELECTED, selectedBefore)
    if (lastBefore !== null) writeFileSync(LAST, lastBefore)
  }
})

test('ด่านคลิปเสร็จแล้วอยู่ก่อนเช็ก Kie และก่อนเริ่มงาน — เรื่องที่เสร็จแล้วต้องไม่ได้ error เรื่องอื่นที่ไม่เกี่ยว', () => {
  const ui = read('bridge/ui.js')
  const route = ui.slice(ui.indexOf("path === '/api/autopilot') {"), ui.indexOf("path === '/api/topics/scored'"))
  const guard = route.indexOf("?.status === 'done'")
  assert.ok(guard > 0, 'ต้องมีด่านเช็กคลิปที่เสร็จแล้ว')
  assert.ok(guard < route.indexOf("hasKey('KIE_API_KEY')"), 'ต้องเช็กก่อน Kie')
  assert.ok(guard < route.indexOf("runner.start('autopilot'"), 'ต้องเช็กก่อนเริ่มงาน')
  assert.ok(guard < route.indexOf('writeFileSync(SELECTED_FILE'), 'ต้องเช็กก่อนเปลี่ยนหัวข้อที่เลือก')
  // สั่งเริ่มใหม่ตั้งแต่แผนกไหน (restartFrom) ยังทำได้กับคลิปที่เสร็จแล้ว — เป็นทางทำเรื่องเดิมใหม่ที่ตั้งใจจริง
  assert.match(route.slice(0, guard + 40), /!restartFrom &&/)
})

test('แผงข้างลืมเรื่องที่เสร็จแล้วทั้ง 3 จังหวะ: ถูกปฏิเสธตอนกด ▶ · ทำเสร็จ · เปิดแผงมาเจอเรื่องที่เสร็จค้างอยู่', () => {
  const panel = read('extension/sidepanel.js')
  const fn = panel.slice(panel.indexOf('async function forgetFinishedTitle'), panel.indexOf('async function startAutopilot'))
  assert.match(fn, /\$\('autoTitle'\)\.value = ''/, 'ต้องล้างช่องหัวข้อ')
  assert.match(fn, /S\.autoTitle = ''/, 'ต้องล้างชื่อที่จำไว้ข้ามรอบ')
  assert.match(fn, /S\.scoredTopics = S\.scoredTopics\.filter/, 'ต้องเอาออกจากรายการที่ AI เสนอ — ไม่งั้นตัวเตือนเรื่องซ้ำยังถือว่าผ่านการตรวจแล้ว')
  assert.match(fn, /await save\(\)/, 'ต้องบันทึก ไม่งั้นเปิดแผงใหม่ชื่อเดิมกลับมา')

  const start = panel.slice(panel.indexOf('async function startAutopilot'), panel.indexOf('// ── ปุ่มเดียว: ระหว่างทำ'))
  assert.match(start, /if \(err\.data\?\.done\)[\s\S]*forgetFinishedTitle\(title\)/, '① ถูกปฏิเสธเพราะเสร็จแล้ว → ล้าง')
  const run = panel.slice(panel.indexOf('async function runAuto'), panel.indexOf('/** เรื่องที่ทำไปแล้วซึ่งชื่อ'))
  assert.ok(run.indexOf('forgetFinishedTitle(st.title)') > 0, '② ทำเสร็จ → ล้าง')
  assert.ok(run.indexOf('forgetFinishedTitle(st.title)') < run.indexOf("'ทำคลิปเสร็จแล้ว'"), 'ต้องล้างก่อนโชว์คลิปที่เสร็จ')
  const resume = panel.slice(panel.indexOf('async function resumeAuto'))
  assert.match(resume.slice(0, 1500), /a\.status\.status === 'done'\) await forgetFinishedTitle\(a\.status\.title\)/, '③ เปิดแผงมาเจอชื่อค้าง → ล้าง')
})

test('ตัวเรียกโปรแกรมในเครื่องส่ง done ต่อมาถึงผู้เรียก ไม่ใช่เหลือแค่ข้อความ', () => {
  const panel = read('extension/sidepanel.js')
  const api = panel.slice(panel.indexOf('async function api(app, path, body)'), panel.indexOf('async function connectApp'))
  assert.match(api, /Object\.assign\(new Error\([^)]*\), \{ status: res\.status, data \}\)/)
})
