// Task 7: เล่าแบบการ์ตูนเต็มจอ + กล่องคำบรรยายลายมือ + ปกเป็นเฟรมแรก
//   node --test scripts/test-cartoon-render.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync, execFileSync } from 'node:child_process'
import { mkdtempSync, existsSync, rmSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildAss, SUBTITLE_STYLES } from '../pipeline/lib/subtitles.mjs'
import { renderVideo, FONTS_DIR, fontsdirOption } from '../pipeline/lib/ffmpeg.mjs'
import { shipsToCustomer } from '../bridge/package-rules.js'

const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('comicbox: สไตล์ลายมือ Mali กล่องเหลืองกระดาษ', () => {
  assert.deepEqual(SUBTITLE_STYLES.comicbox, { label: 'กล่องคำบรรยายการ์ตูน', text: '1A1A1A', box: 'F3E3B0', font: 'Mali Medium', outline: '1A1A1A' })
  const ass = buildAss([{ start: 0, end: 2, text: 'คืนนั้นฝนตกหนัก' }], { style: 'comicbox' })
  assert.match(ass, /^Style: Default,Mali Medium,/m)
  assert.ok(ass.includes('&H00B0E3F3'))
  // สไตล์เดิมยังใช้ฟอนต์เดิม
  assert.ok(buildAss([{ start: 0, end: 2, text: 'สวัสดี' }], { style: 'black' }).includes('Leelawadee UI'))
})

// ตรวจจาก log ของ libass จริง (ไม่ใช่แค่ข้อความใน .ass) — ชื่อฟอนต์ผิด libass จะเงียบแล้วใช้ Arial/Leelawadee แทน
// filter เดียวกับ renderVideo: ass=<ชื่อไฟล์>:fontsdir=<assets/fonts> รันในโฟลเดอร์ของ .ass
test('libass เลือก Mali-Medium ที่แถมมาจริง (ไม่ fallback ไป Leelawadee/Arial)', { skip: !hasFfmpeg }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'cartoon-font-'))
  try {
    writeFileSync(join(dir, 's.ass'), buildAss([{ start: 0, end: 2, text: 'คืนนั้นฝนตกหนัก ไม่มีใครกล้าออกจากบ้าน' }], { style: 'comicbox' }), 'utf8')
    const r = spawnSync('ffmpeg', ['-v', 'verbose', '-f', 'lavfi', '-i', 'color=c=white:s=1080x1920:d=1',
      '-vf', `ass=s.ass:${fontsdirOption()}`, '-frames:v', '1', '-f', 'null', '-'], { cwd: dir, encoding: 'utf8' })
    assert.equal(r.status, 0, r.stderr.slice(-800))
    const picks = r.stderr.split('\n').filter((l) => /fontselect:/.test(l))
    assert.ok(picks.length > 0, 'ไม่พบบรรทัด fontselect ใน log ของ libass')
    for (const l of picks) assert.match(l, /fontselect: \(Mali Medium,.*-> Mali-Medium/, `libass เลือกฟอนต์อื่น: ${l}`)
    assert.ok(!/Glyph 0x[0-9A-F]+ not found/i.test(r.stderr), 'Mali ขาดตัวอักษรไทยบางตัว → libass ไปใช้ฟอนต์อื่นแทน')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('ffmpeg.mjs: ไม่มีกรอบช่อง/เลขหน้า (drawbox)', () => {
  assert.ok(!/drawbox/.test(read('pipeline/lib/ffmpeg.mjs')))
})

test('ค่าตั้งต้น = comicbox · ฟอนต์ถูกแถมไปกับลูกค้า', () => {
  assert.equal(JSON.parse(read('config/default.config.json')).render.subtitles.style, 'comicbox')
  assert.ok(shipsToCustomer('assets/fonts/Mali-Medium.ttf'))
  assert.ok(shipsToCustomer('assets/fonts/OFL.txt'))
  assert.ok(existsSync(join(FONTS_DIR, 'Mali-Medium.ttf')))
  assert.ok(existsSync(join(FONTS_DIR, 'OFL.txt')))
  assert.match(FONTS_DIR.replaceAll('\\', '/'), /assets\/fonts$/)
})

test('fontsdirOption: escape drive colon สำหรับ filter ของ ffmpeg', () => {
  const o = fontsdirOption('E:\\การ์ตูนไทย๑บาท\\assets\\fonts')
  assert.match(o, /^fontsdir=/)
  assert.ok(o.includes('E\\\\:/การ์ตูนไทย๑บาท/assets/fonts'))
})

test('ไม่มี cover.png → render เหมือนเดิม (ไม่มีวินาทีว่าง)', { skip: !hasFfmpeg }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cartoon-nocover-'))
  try {
    const { images, voiceover } = makeFixture(dir)
    const outFile = join(dir, 'out.mp4')
    await renderVideo({ images, voiceover, outFile, totalDuration: 3, config: { resolution: '1080x1920', fps: 30 }, resolution: '1080x1920', fit: 'cover', cover: null })
    const f0 = frameAt(outFile, 0.3, dir, 'n0')
    assert.ok(avg(f0).r > 150, 'เฟรมแรกต้องเป็นภาพ A (แดง)')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

// ภาพทดสอบสีเรียบ: A=แดง B=เขียว ปก=น้ำเงิน
function makeFixture(dir) {
  const mk = (name, color) => {
    const f = join(dir, name)
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', `color=c=${color}:s=1080x1920:d=1`, '-frames:v', '1', f])
    return f
  }
  const images = [{ name: '00-00.png', file: mk('00-00.png', 'red'), start: 0 }, { name: '00-02.png', file: mk('00-02.png', 'green'), start: 2 }]
  const cover = mk('cover.png', 'blue')
  const voiceover = join(dir, 'vo.wav')
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono', '-t', '3', voiceover])
  return { images, cover, voiceover }
}
function frameAt(video, t, dir, tag) {
  const png = join(dir, `${tag}.png`)
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', String(t), '-i', video, '-frames:v', '1', '-vf', 'scale=1:1', png])
  return png
}
function avg(png) {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', png, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'])
  return { r: raw[0], g: raw[1], b: raw[2] }
}

test('integration: ปก 1.0 วิเป็นเฟรมแรก เต็มจอ 1080x1920 ยาว ~3 วิ ซับ comicbox + fontsdir', { skip: !hasFfmpeg }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cartoon-cover-'))
  try {
    const { images, cover, voiceover } = makeFixture(dir)
    const assFile = join(dir, 'subtitles.ass')
    writeFileSync(assFile, buildAss([{ start: 0.2, end: 2.8, text: 'คืนนั้นฝนตกหนัก ไม่มีใครกล้าออกจากบ้าน' }], { width: 1080, height: 1920, style: 'comicbox' }), 'utf8')
    const outFile = join(dir, 'out.mp4')
    await renderVideo({ images, voiceover, outFile, totalDuration: 3, config: { resolution: '1080x1920', fps: 30 }, resolution: '1080x1920', fit: 'cover', cover, subtitles: { dir, name: 'subtitles.ass' } })
    const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', outFile], { encoding: 'utf8' }))
    assert.equal(probe.streams[0].width, 1080)
    assert.equal(probe.streams[0].height, 1920)
    assert.ok(Math.abs(Number(probe.format.duration) - 3) < 0.25, `duration ${probe.format.duration}`)
    const c = avg(frameAt(outFile, 0.3, dir, 'f03'))
    assert.ok(c.b > 150 && c.r < 80, `0.3s ต้องเป็นปก (น้ำเงิน): ${JSON.stringify(c)}`)
    const a = avg(frameAt(outFile, 1.5, dir, 'f15'))
    assert.ok(a.r > 150 && a.b < 80, `1.5s ต้องเป็นภาพ A (แดง): ${JSON.stringify(a)}`)
    const b = avg(frameAt(outFile, 2.5, dir, 'f25'))
    assert.ok(b.g > 90 && b.r < 80, `2.5s ต้องเป็นภาพ B (เขียว): ${JSON.stringify(b)}`)
    if (process.env.KEEP_FRAMES) { mkdirSync(process.env.KEEP_FRAMES, { recursive: true }); execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', outFile, '-c', 'copy', join(process.env.KEEP_FRAMES, 'out.mp4')]) }
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
