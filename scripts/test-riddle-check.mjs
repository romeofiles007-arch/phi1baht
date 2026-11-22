// เทสต์โจทย์ "ทายสิ ผีอะไร?" — ภาพเงาผีไทย 1 ชนิด + คำใบ้ 1 บรรทัด + เฉลย (ลง Facebook Story)
//   node --test scripts/test-riddle-check.mjs
import assert from 'node:assert/strict'
import { test } from 'node:test'
const R = await import('../pipeline/lib/riddle.mjs')
const { sanitizeShotPrompt } = await import('../pipeline/lib/shot-safety.mjs')

const line = (s) => `=== RIDDLE ===\nriddle.png | RIDDLE | ${s}`
const GOOD = line('ANSWER: กระสือ | HINT: ตกดึกจะมีแสงลอยมาตามหาคนที่นอนหลับ | SHAPE: ผู้หญิงผมยาวลอยเหนือพื้น มีแสงเรืองใต้คอ')

test('ขอโจทย์: เป็นภาพเงาผีไทย ไม่มีของจีน/ปริศนาอักษร · คลิปภาษาอื่นไม่ขอ', () => {
  const req = R.riddleRequest('th')
  assert.match(req, /เงา/)
  assert.match(req, /ผี/)
  assert.match(req, /riddle\.png \| RIDDLE/)
  assert.match(req, /ทายสิ ผีอะไร/)
  assert.ok(!/จีน|ปริศนาธรรม|PIECES|rebus/i.test(req), req)
  assert.equal(R.riddleRequest('en'), '')
  assert.match(R.riddleRequest('th', { subject: 'กระสือ' }), /กระสือ/)
})

test('อ่านโจทย์: ANSWER + HINT + SHAPE', () => {
  const r = R.parseRiddle(GOOD)
  assert.equal(r.answer, 'กระสือ')
  assert.match(r.hint, /แสงลอย/)
  assert.match(r.shape, /ผมยาว/)
})

test('โจทย์ผิดใช้ไม่ได้: ไม่มีเฉลย / ไม่มีคำใบ้ / คำใบ้บอกชื่อผีตรงๆ / มีของรุนแรง', () => {
  assert.equal(R.parseRiddle(line('HINT: x | SHAPE: เงา')), null)
  assert.equal(R.parseRiddle(line('ANSWER: ปอบ | SHAPE: เงา')), null)
  assert.match(R.riddleProblem(R.parseRiddleDraft(line('ANSWER: ปอบ | HINT: ผีปอบกินตับ | SHAPE: เงา'))), /ชื่อผี/)
  assert.match(R.riddleProblem(R.parseRiddleDraft(line('ANSWER: ปอบ | HINT: กินเครื่องในคน | SHAPE: เงา'))), /รุนแรง/)
  assert.match(R.riddleProblem(R.parseRiddleDraft(line('ANSWER: ปอบ | HINT: ชอบแอบเข้าบ้าน | SHAPE: เงาผีถือไส้ห้อย'))), /รุนแรง/)
  assert.equal(R.riddleProblem(R.parseRiddleDraft(GOOD)), null)
})

test('prompt ภาพเงา: ผ่านตัวกรองความรุนแรงเหมือนช็อตอื่น · ไม่มีคำว่า ปก/cover · ไม่มีตัวอักษรในภาพ', () => {
  const brief = R.riddleBriefLines({ filename: R.RIDDLE_NAME, prompt: 'ภาพเงาดำ x' }).join('\n')
  assert.match(brief, /เงา/)
  assert.match(brief, /ห้ามมีตัวอักษร/)
  assert.deepEqual(sanitizeShotPrompt(brief).removed, [], 'brief เองไม่มีคำต้องห้าม')
  assert.ok(!/ปก|cover|thumbnail/i.test(brief.split('\n').slice(1).join('\n').replace('riddle.png RIDDLE', '')))
  assert.ok(!/จีน/.test(brief))
})

test('ภาพ Story: หัวข้อ "ทายสิ ผีอะไร?" + คำใบ้ + เฉลยมุมล่าง · คำใบ้ยาวถูกตัดไม่ล้นขอบ', () => {
  const r = R.parseRiddle(GOOD)
  const ass = R.riddleAss(r)
  assert.match(ass, /ทายสิ ผีอะไร\?/)
  assert.ok(!/จีน/.test(ass))
  assert.match(ass, /,Hint,,0,0,\d+,,.*แสงลอย/)
  assert.match(ass, /,Ans,,0,0,0,,เฉลย: กระสือ\n/)
  assert.match(ass, /Style: Ans,[^\n]*,3,36,36,40,222/, 'เฉลยชิดมุมขวาล่าง')
  const long = R.riddleAss({ ...r, hint: 'ก'.repeat(200) })
  const hint = long.split('\n').find((l) => l.includes(',Hint,,'))
  assert.ok([...hint.split(',,').pop().replace('คำใบ้: ', '')].length <= 49)
  assert.ok(hint.endsWith('…'))
})
