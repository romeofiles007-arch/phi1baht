// Flow บล็อก (กันบอต) ระหว่างผลิตต่อเนื่อง → พัก 2 ชม. แล้วทำคลิปเดิมต่อเอง · บล็อกซ้ำติดกันค่อยหยุดจริง
//   node --test scripts/test-production-block.mjs
// ผู้ใช้ (20 พ.ย. 2026): "ถ้ามันบล็อกจะทำยังไง" → เลือกให้พักแล้วทำต่อเอง ไม่ต้องคอยกดเอง
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { onFlowBlocked, BLOCK_PAUSE_MS, MAX_BLOCKS_IN_ROW, productionError } from '../bridge/production.js'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const NOW = Date.UTC(2026, 10, 20, 6, 0, 0)

test('บล็อกครั้งแรก → พัก 2 ชม. แล้วทำต่อ ไม่หยุดชุด', () => {
  assert.equal(BLOCK_PAUSE_MS, 2 * 60 * 60_000)
  assert.equal(MAX_BLOCKS_IN_ROW, 2)
  assert.deepEqual(onFlowBlocked(0, NOW), { blocksInRow: 1, stop: false, nextAt: NOW + BLOCK_PAUSE_MS })
})

test('บล็อกซ้ำติดกัน (พักแล้วก็ยังโดน) → หยุดจริง ให้คนเปิด Flow ดูเอง', () => {
  assert.deepEqual(onFlowBlocked(1, NOW), { blocksInRow: 2, stop: true, nextAt: null })
  assert.equal(onFlowBlocked(undefined, NOW).stop, false, 'ชุดเก่าที่ยังไม่มีตัวนับ = เริ่มนับ 0')
})

test('ข้อความ error ของคลิปเก็บบรรทัด FLOW_BLOCKED ไว้ (ไม่ใช่คำแนะนำท้าย log)', () => {
  const lines = ['ภาพ 9/26', '❌ หยุดที่แผนกวาดภาพ — FLOW_BLOCKED: Flow ไม่รับคำสั่ง — unusual activity', '   กดทำคลิปอัตโนมัติอีกครั้งด้วยหัวข้อเดิม']
  assert.match(productionError(lines), /FLOW_BLOCKED/)
})

test('ผลิตต่อเนื่องใช้ตัวตัดสินนี้: ทำคลิปเดิมต่อ · ไม่นับเป็นคลิปล้ม · สำเร็จแล้วล้างตัวนับ', () => {
  const src = read('bridge/production.js')
  const finish = src.slice(src.indexOf('function finishRun('), src.indexOf('function completeBatch('))
  assert.match(finish, /const blocked = !result\.ok && \/FLOW_BLOCKED\/\.test\(result\.error \?\? ''\)/)
  assert.match(finish, /onFlowBlocked\(state\.blocksInRow, now\)/)
  // ทำต่อคลิปที่ค้าง ไม่ใช่เริ่มหัวข้อใหม่ (ภาพที่ได้แล้วยังอยู่ สั่งเฉพาะช็อตที่ขาด)
  assert.match(finish, /state\.resume = unfinishedClip\(\)/)
  // บล็อกไม่ใช่ความผิดของคลิป — ไม่นับเข้า "ล้มติดกัน 3 ครั้ง"
  assert.match(finish, /else if \(!blocked\) \{\n\s+state\.failed\+\+\n\s+state\.failsInRow\+\+/)
  assert.match(finish, /if \(!blocked\) state\.blocksInRow = 0/)
  // หยุด/ทำต่อเอง/เริ่มชุดใหม่ ล้างสถานะพัก
  assert.match(src, /const blankState = \(\) => \(\{[^\n]*blocksInRow: 0, blockPause: null/)
  for (const fn of ['function resume(', 'function stop(', 'function launch(']) {
    const body = src.slice(src.indexOf(fn), src.indexOf('\n  }\n', src.indexOf(fn)))
    assert.match(body, /state\.blockPause = null/, fn)
  }
})

test('แผงข้างบอกว่ากำลังพักเพราะ Flow บล็อก และจะทำต่อกี่โมง', () => {
  const panel = read('extension/sidepanel.js')
  const next = panel.slice(panel.indexOf('function renderProdNext()'), panel.indexOf("$('prodNext')?.addEventListener"))
  assert.match(next, /st\.active && st\.blockPause/)
  assert.match(next, /Flow บล็อกชั่วคราว — ทำต่อ \$\{prodTime\(st\.nextAt\)\} น\./)
})
