// คลังตัวละคร 48 ตัว — ผู้ใช้ 23 พ.ย. 2026: "ตัวละครมันมั่วสลับไปสลับมา ก็เลยทำให้ Google Flow งง
// เพราะฉะนั้นทำตัวละครเผื่อไว้ทั้งหมด แล้วก็ไปสร้างใน ChatGPT Web ... เพื่อที่จะแนบไปสร้างภาพได้"
//
// Character Bible เขียนละเอียดอยู่แล้ว (ถึงขั้นกำหนดปอยผม) แต่เป็นตัวหนังสือ — Flow ไม่เคยเห็นหน้าใคร
// คำบรรยายล็อกหน้าไม่ได้ รูปล็อกได้ · คลังนี้คือรูปที่วาดไว้ล่วงหน้าแล้วแนบให้ Flow เป็นแบบของคนคนนั้น
//   node --test scripts/test-cast-library.mjs
import './helpers/temp-stores.mjs' // ต้องมาก่อน import อื่น — คลังของเทสต์อยู่ในโฟลเดอร์ชั่วคราว ไม่แตะคลังจริง
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync, cpSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT } from '../pipeline/lib/config.mjs'
import { CAST, CAST_GROUPS, castById, castOfGroup, castSheetPrompt, castingRule, parseCasting } from '../extension/prompts.js'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=='

/** คลังของเทสต์อยู่ในโฟลเดอร์ชั่วคราว (helpers/temp-stores.mjs) — ล้างก่อนและหลังทุกเทสต์ · ห้ามเป็นคลังจริง */
async function withCast(fn) {
  const mod = await import('../pipeline/lib/cast.mjs')
  assert.ok(!/characters[\\/](product|cast)$/.test(mod.CAST_DIR), `เทสต์กำลังจะใช้คลังจริง: ${mod.CAST_DIR}`)
  mod.clearCast()
  try {
    return await fn(mod)
  } finally {
    mod.clearCast()
  }
}

test('บัญชีตัวละครครบ 48 ตัว · id ไม่ซ้ำ · ทุกตัวมีกลุ่มและคำบรรยายหน้าตา', () => {
  assert.equal(CAST.length, 48, 'ผู้ใช้ตัดสินว่าเอาทั้ง 48 ตัว')
  assert.equal(new Set(CAST.map((c) => c.id)).size, 48, 'id ซ้ำ = แนบรูปผิดตัว')
  for (const c of CAST) {
    assert.match(c.id, /^[a-z][a-z0-9_]*$/, `${c.id}: id ต้องเป็น a-z0-9_ เพราะใช้เขียนในคำสั่ง [CAST:id]`)
    assert.ok(c.name?.trim(), `${c.id}: ไม่มีชื่อ`)
    assert.ok(CAST_GROUPS.some((g) => g.id === c.group), `${c.id}: กลุ่ม "${c.group}" ไม่มีจริง`)
    assert.ok(c.look && c.look.length >= 40, `${c.id}: คำบรรยายหน้าตาสั้นเกินจะล็อกหน้าได้`)
  }
})

test('ครอบคลุมบทบาทที่ 5 คลิปแรกใช้จริง · ตัวที่ผู้ใช้ขอมาเอง · ผี 10 ชนิดตรงกับกฎหน้าผี · ครบทั้ง 5 หมวด', () => {
  // 5 คลิปแรกใช้ @hero @ghost @patient @neighbor @landlady @villager @attendant @police @father @mother @elder
  for (const id of ['man_young', 'woman_young', 'old_man', 'old_woman', 'man_mid', 'woman_mid', 'patient', 'nurse', 'police', 'monk']) {
    assert.ok(castById(id), `ขาด ${id} — เป็นบทบาทที่คลิปจริงใช้ไปแล้ว`)
  }
  // ผู้ใช้ขอมาเอง: เด็กหนุ่ม คนแก่ คนท้อง เด็กทารก กุมารทอง
  for (const id of ['teen_boy', 'old_man', 'pregnant', 'baby', 'kumarnthong']) {
    assert.ok(castById(id), `ขาด ${id} ที่ผู้ใช้ขอมาเอง`)
  }
  // ผีในคลังกับผีในกฎหน้าผีต้องเป็นชุดเดียวกัน ไม่ใช่คิดชนิดใหม่
  const ghosts = castOfGroup('ghost')
  assert.equal(ghosts.length, 10)
  const ghostRule = read('extension/prompts.js').split('GHOST_LOOK_RULE')[1].slice(0, 2000)
  for (const g of ghosts) {
    const word = g.name.split(' / ')[0]
    assert.ok(ghostRule.includes(word), `${g.id}: "${word}" ไม่อยู่ในกฎหน้าผี`)
  }
  // หมวดนิทานกับหมวดตลกใช้ชุดคนธรรมดาแทนไม่ได้ ต้องมีของตัวเอง
  assert.ok(castOfGroup('folk').length >= 8, 'หมวดนิทานต้องมียักษ์ นางฟ้า เจ้าชาย ฤๅษี พญานาค ฯลฯ')
  assert.ok(castOfGroup('comedy').length >= 3)
  assert.ok(castOfGroup('people').length >= 12, 'ตารางอายุ×เพศต้องครบ ไม่งั้นบทต้องคิดคนใหม่')
})

test('คำสั่งวาดแผ่นแบบ: ตัวเดียว 3 ท่า พื้นขาว ห้ามตัวหนังสือ ห้ามคนอื่น', () => {
  const p = castSheetPrompt('g_krasue')
  assert.match(p, /ตัวละครตัวนี้คนเดียว/, 'มีคนอื่นติดมา Flow จะลอกคนผิดตัว')
  assert.match(p, /3 ท่าเรียงกันในภาพเดียว/)
  assert.match(p, /พื้นหลังสีขาวเรียบล้วน/, 'มีฉากติดมา Flow จะลอกฉากไปใส่ในภาพของเรื่อง')
  assert.match(p, /ห้ามมีตัวหนังสือ ตัวเลข ป้ายชื่อ/, 'กฎ 7 ของ Blueprint ห้ามตัวหนังสือในภาพ')
  assert.ok(p.includes(castById('g_krasue').look), 'ต้องส่งคำบรรยายหน้าตาไปด้วย')
  assert.match(p, /ลายเส้น: การ์ตูนเล่มละบาท/, 'แผ่นแบบต้องเป็นลายเส้นเดียวกับคลิป')
  // ตัวที่ไม่มีในบัญชี = ไม่มีคำสั่ง (ดีกว่าสั่งวาดคนที่ไม่รู้ว่าหน้าตาอย่างไร)
  assert.equal(castSheetPrompt('ไม่มีจริง'), '')
  assert.equal(castSheetPrompt(null), '')
})

test('กฎเลือกตัวละครจากคลัง: ส่งเฉพาะตัวที่วาดแล้ว · ยังไม่มีรูปเลย = ไม่มีกฎนี้', () => {
  assert.equal(castingRule([]), '', 'ยังไม่ได้วาดเลย = คลังเป็นของเสริม ไม่ไปรบกวนคำสั่งเดิม')
  const r = castingRule([castById('man_young'), castById('g_krasue')])
  assert.match(r, /\[CAST:man_young\]/, 'ต้องมีตัวอย่างวิธีเขียนรหัส')
  assert.ok(r.includes('CAST:man_young = ชายหนุ่ม 20–30'))
  assert.ok(r.includes(castById('g_krasue').look), 'ต้องบอกหน้าตาให้เขียน Character Bible ตามได้')
  assert.ok(!r.includes('CAST:monk'), 'ห้ามเสนอตัวที่ยังไม่มีรูป — เราแนบไม่ได้')
  assert.match(r, /ห้ามเปลี่ยนทรงผม สีเสื้อ หรือสีผ้านุ่ง/)
  assert.match(r, /สองรหัสที่ต่างกัน/, 'กันสองตัวละครใช้รูปเดียวกันแล้วหน้าเหมือนกัน')
})

test('อ่านรหัสคลังจาก Character Bible: เรียงตามที่โผล่ ไม่ซ้ำ ข้ามรหัสที่ไม่มีจริง', () => {
  const bible = [
    '@hero = ทิดเอก [CAST:man_young]',
    '@ghost = กระสือ [CAST:g_krasue]',
    '@extra = คนอื่น [CAST:ไม่มีจริง]',
    '@again [CAST:man_young]',
  ].join('\n')
  assert.deepEqual(parseCasting(bible), ['man_young', 'g_krasue'])
  assert.deepEqual(parseCasting('CAST: monk'), ['monk'], 'เว้นวรรคหลัง : ก็ต้องอ่านได้')
  assert.deepEqual(parseCasting('cast:MONK'), ['monk'], 'ตัวพิมพ์ใหญ่ก็ต้องอ่านได้')
  assert.deepEqual(parseCasting('ไม่มีรหัสเลย'), [])
  assert.deepEqual(parseCasting(null), [])
})

test('ที่เก็บคลัง: บันทึก · วาดทับตัวเดิมแล้วลบไฟล์เก่า · ลบ · นับที่ขาด', async () => {
  await withCast((cast) => {
    // เทสต์ใช้โฟลเดอร์ชั่วคราว — ค่าตั้งต้นของจริงต้องอยู่ใต้ characters/ ซึ่ง .gitignore ครอบไว้แล้ว
    assert.match(read('pipeline/lib/cast.mjs'), /process\.env\.PHI_CAST_DIR \|\| join\(ROOT, 'characters', 'cast'\)/)
    assert.equal(cast.castStatus().done, 0)
    assert.equal(cast.missingCast().length, 48)
    cast.addCastSheet({ id: 'man_young', type: 'image/png', base64: PNG })
    assert.equal(cast.castStatus().done, 1)
    assert.equal(cast.missingCast().length, 47)
    const first = cast.readCast().sheets.man_young.file
    cast.addCastSheet({ id: 'man_young', type: 'image/png', base64: PNG })
    const second = cast.readCast().sheets.man_young.file
    assert.notEqual(first, second, 'วาดใหม่ = ไฟล์ใหม่')
    assert.ok(!existsSync(join(cast.CAST_DIR, first)), 'ไฟล์เก่าต้องถูกลบ ไม่ให้คลังบวมด้วยรูปที่ไม่มีใครอ้างถึง')
    assert.equal(cast.castStatus().done, 1, 'วาดทับไม่ใช่เพิ่มตัวใหม่')
    cast.removeCastSheet('man_young')
    assert.equal(cast.castStatus().done, 0)
    assert.throws(() => cast.addCastSheet({ id: 'ไม่มีจริง', type: 'image/png', base64: PNG }), /ไม่รู้จักตัวละคร/)
    assert.throws(() => cast.addCastSheet({ id: 'monk', type: 'image/gif', base64: PNG }), /PNG \/ JPG \/ WEBP/)
    assert.throws(() => cast.addCastSheet({ id: 'monk', type: 'image/png', base64: '' }), /ว่าง/)
  })
})

test('แนบให้ Flow: เฉพาะตัวที่มีรูป · ไม่เกิน 3 ตัว · รูปร่าง name+type+base64 (กัน atob พัง)', async () => {
  await withCast((cast) => {
    for (const id of ['man_young', 'woman_young', 'old_man', 'monk']) cast.addCastSheet({ id, type: 'image/png', base64: PNG })
    const got = cast.castAttachments(['man_young', 'ไม่มีจริง', 'g_krasue', 'woman_young'])
    assert.deepEqual(got.map((a) => a.castId), ['man_young', 'woman_young'], 'ตัวที่ไม่มีรูปหรือไม่มีจริงต้องถูกข้าม')
    for (const a of got) {
      assert.ok(a.name && a.type && typeof a.base64 === 'string' && a.base64.length, `${a.castId}: รูปร่างไม่ครบ`)
      assert.ok(a.castName, 'ต้องส่งชื่อตัวละครมาด้วย เพื่อผูกรูปกับ @TAG ในคำสั่ง Flow')
    }
    assert.equal(cast.castAttachments(['man_young', 'woman_young', 'old_man', 'monk']).length, 3, 'แนบรูปเยอะคือสาเหตุที่ Flow สับสนตั้งแต่แรก')
    assert.deepEqual(cast.castAttachments([]), [])
  })
})

test('ครบเส้น: Bible กำกับรหัส → แนบแผ่นแบบ → คำสั่ง Flow ผูกรูปกับตัวละคร · สินค้ายังอยู่ท้ายสุด', async () => {
  await withCast(async (cast) => {
    const prompts = await import('../pipeline/lib/prompts.mjs')
    cast.addCastSheet({ id: 'man_young', type: 'image/png', base64: PNG })
    cast.addCastSheet({ id: 'g_krasue', type: 'image/png', base64: PNG })
    const slug = `_test_cast_${process.pid}_${Math.random().toString(36).slice(2, 7)}`
    const dir = join(ROOT, 'projects', slug)
    try {
      mkdirSync(join(dir, '04_shotlist', 'rounds'), { recursive: true })
      mkdirSync(join(dir, '00_ref'), { recursive: true })
      writeFileSync(join(dir, '00_ref', 'profile.json'), JSON.stringify({ category: 'ghost', artStyle: 'lemlabaht' }))
      writeFileSync(join(dir, '04_shotlist', 'rounds', '01.txt'), [
        '=== STYLE BIBLE ===',
        'ลายเส้นเล่มละบาท',
        '=== 5.2 CHARACTER BIBLE ===',
        '@hero = ทิดเอก [CAST:man_young]',
        '@ghost = กระสือเฝ้าศาล [CAST:g_krasue]',
        '@neighbor = เพื่อนบ้าน (ไม่มีในคลัง)',
        '=== SHOT LIST ===',
        '00_00_00.png SHOT 01 | Chars: @hero | Env: หอพัก | Action: เดิน | Frame: wide',
      ].join('\n'))

      const parts = prompts.flowAttachmentParts(slug)
      assert.deepEqual(parts.cast.map((a) => a.castId), ['man_young', 'g_krasue'])
      // ผู้ใช้ 23 พ.ย. 2026: "ใช้ 2 คนนี้ แนบไปตลอด เลยมีในทุกเรื่อง" — ภาพ Style Kit มีคนอยู่ในฉาก Flow เอาไปใส่ทุกเรื่อง
      // มีแผ่นแบบแล้ว = ไม่แนบ kit และคำสั่งต้องไม่พูดถึงภาพ kit
      assert.deepEqual(parts.kit, [], 'มีแผ่นแบบจากคลังแล้วห้ามแนบภาพ Style Kit (คนในฉากจะโผล่ทุกเรื่อง)')
      // ลำดับที่ส่งออกไปต้องตรงกับที่คำสั่งบอก agent: ตัวละคร → kit → คลัง → สินค้า
      const all = prompts.flowAttachments(slug)
      assert.deepEqual(all.map((a) => a.name), [...parts.character, ...parts.kit, ...parts.cast, ...parts.product].map((a) => a.name))
      const before = parts.character.length + parts.kit.length
      const fp = prompts.flowPrompt('(brief)', undefined, slug)
      assert.ok(fp.includes(`รูปลำดับที่ ${before + 1} = ชายหนุ่ม 20–30`), 'คำสั่งต้องผูกรูปกับชื่อตัวละคร')
      assert.ok(fp.includes(`รูปลำดับที่ ${before + 2} = กระสือ`))
      assert.match(fp, /ห้ามสลับหน้าระหว่างตัวละคร/)
      assert.ok(!/Style Kit|kit-ghost/.test(fp), 'ไม่ได้แนบ kit = คำสั่งห้ามพูดถึงภาพ kit')
      assert.match(fp, /ใช้เป็นแบบเส้นหมึก การแรเงา และการลงสีของทั้งเรื่องด้วย/, 'ไม่มี kit แล้ว แผ่นแบบต้องบอกลายเส้นแทน')
      assert.match(fp, /ห้ามลอกพื้นขาว/, 'ไม่งั้น Flow วาดภาพของเรื่องบนพื้นขาวตามแผ่นแบบ')
      // สินค้า (ถ้าเครื่องนี้ตั้งไว้) ต้องถูกเลื่อนไปท้ายสุดหลังแผ่นแบบ ไม่ใช่ทับลำดับกัน
      if (parts.product.length) {
        assert.ok(fp.includes(`รูปที่แนบลำดับที่ ${before + parts.cast.length + 1} (ท้ายสุด)`), 'ลำดับสินค้าต้องนับรวมแผ่นแบบด้วย')
      }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

test('ยังไม่ได้วาดแผ่นแบบเลย = ทุกอย่างทำงานเหมือนเดิม (คลังเป็นของเสริม)', async () => {
  await withCast(async (cast) => {
    const prompts = await import('../pipeline/lib/prompts.mjs')
    assert.equal(cast.castStatus().done, 0)
    assert.deepEqual(prompts.flowAttachmentParts(null).cast, [])
    assert.equal(prompts.castFlowNote([], 2), '', 'ไม่มีแผ่นแบบ = ไม่พูดถึงรูปที่ไม่ได้แนบ')
    assert.deepEqual(prompts.clipCastAttachments(null), [])
    assert.deepEqual(prompts.clipCastAttachments('_ไม่มีคลิปนี้'), [])
  })
})

test('ส่วนขยาย: ดึงรูปที่ ChatGPT วาดกลับมาได้ (เดิมดึงได้แต่ข้อความ) และแผงข้างมีปุ่มให้กด', () => {
  const chat = read('extension/content-chatgpt.js')
  assert.match(chat, /msg\.type === 'ASK_IMAGE'/, 'ต้องมีช่องทางสั่งวาดรูป')
  assert.match(chat, /async function imageAsPngBase64/)
  assert.match(chat, /ChatGPT วาดรูป/, 'ต้องรอจน ChatGPT วาดเสร็จ ไม่ใช่คว้าภาพเบลอ')
  assert.match(chat, /Math\.max\(img\.naturalWidth \|\| 0, img\.naturalHeight \|\| 0\) < 1000/, 'ต้องข้ามไอคอน รูปโปรไฟล์ และภาพร่าง 768px')

  const panel = read('extension/sidepanel.js')
  assert.match(panel, /ASK_IMAGE/)
  assert.match(panel, /'\/api\/cast\/image'/, 'ได้รูปแล้วต้องบันทึกเข้าโปรแกรมในเครื่องทันที')
  assert.match(panel, /castDrawMissing/)
  // บันทึกทีละตัว ไม่รอครบชุด — 48 ตัวใช้เวลานาน ล้มกลางทางต้องไม่เสียทั้งหมด
  assert.ok(panel.indexOf("castCall('/api/cast/image'") < panel.indexOf('วาดเสร็จ'), 'ต้องบันทึกก่อนสรุปผล')

  const html = read('extension/sidepanel.html')
  for (const id of ['castGroups', 'castCount', 'castHint', 'castDrawMissing', 'castClear']) {
    assert.ok(html.includes(`id="${id}"`), `แผงข้างไม่มี ${id} — ผู้ใช้จะหาปุ่มไม่เจอ`)
  }
})

test('โปรแกรมในเครื่อง: มีช่องอ่านคลัง สั่งวาด บันทึก ลบ ล้าง และ Shot List ใช้คลังจริง', () => {
  const ui = read('bridge/ui.js')
  for (const route of ['/api/cast', '/api/cast/todo', '/api/cast/image', '/api/cast/image/delete', '/api/cast/clear']) {
    assert.ok(ui.includes(`path === '${route}'`), `ไม่มี ${route}`)
  }
  const section = ui.slice(ui.indexOf("path === '/api/cast'"))
  assert.match(section, /castSheetJob/, '/api/cast/todo ต้องส่งคำสั่งวาด (พร้อมภาพอ้างอิง) ไปให้แผงข้าง')
  assert.match(section, /missingCast\(\)/, 'ต้องวาดเฉพาะตัวที่ขาด ไม่วาดซ้ำตัวที่มีแล้ว')
  // Shot List รอบแรกต้องมีกฎเลือกตัวละครจากคลัง ไม่งั้นคลังไม่มีผลกับงานจริง
  const shotlist = read('pipeline/lib/shotlist.mjs')
  assert.match(shotlist, /castingRule\(availableCast\(\)\)/)
  assert.match(shotlist, /Object\.keys\(readCast\(\)\.sheets\)/, 'ต้องเสนอเฉพาะตัวที่วาดแล้ว')
})

// ── สิ่งที่เจอระหว่างวาดคลังจริง 48 ตัวผ่าน ChatGPT (23 พ.ย. 2026) ──

test('แนบภาพอ้างอิงลายเส้นไปด้วย ตามกลุ่มตัวละคร (ผู้ใช้: "แนบสไตล์ที่เราต้องการไปด้วย")', async () => {
  const { castSheetJob, castStyleCategory } = await import('../pipeline/lib/cast.mjs')
  assert.equal(castStyleCategory('man_young'), 'drama')
  assert.equal(castStyleCategory('g_krasue'), 'ghost')
  assert.equal(castStyleCategory('kumarnthong'), 'saiyasat')
  assert.equal(castStyleCategory('yak'), 'folk')
  assert.equal(castStyleCategory('thid'), 'comedy')
  for (const id of ['man_young', 'g_krasue', 'yak', 'thid']) {
    const job = castSheetJob(id)
    assert.ok(job.attachments.length >= 1, `${id}: ต้องแนบภาพอ้างอิงอย่างน้อย 1 รูป`)
    for (const a of job.attachments) {
      assert.ok(a.name && a.type && typeof a.base64 === 'string' && a.base64.length, `${id}: รูปอ้างอิงต้องวางได้ (กัน atob พัง)`)
      assert.ok(job.prompt.includes(a.name), `${id}: คำสั่งต้องบอกชื่อรูปที่แนบจริง`)
    }
    assert.match(job.prompt, /ภาพอ้างอิงลายเส้นเท่านั้น/)
    assert.match(job.prompt, /ห้ามลอกตัวละคร ฉาก หรือองค์ประกอบใดๆ จากภาพอ้างอิง/)
    assert.match(job.prompt, /ห้ามเลียนสีพื้นหรือโทนกระดาษของภาพอ้างอิง/)
  }
  // ไม่แนบภาพอ้างอิง = ไม่พูดถึงรูปที่ไม่ได้แนบ
  assert.ok(!castSheetPrompt('man_young').includes('รูปที่แนบมา'))
})

test('คำสั่งแผ่นแบบไม่สั่งให้วาดฉาก (เคยเอาข้อความลายเส้นของ Flow มาทั้งก้อน ซึ่งสั่ง "ฉากไทย เต็มเฟรม")', () => {
  for (const c of CAST) {
    const p = castSheetPrompt(c)
    assert.ok(!p.includes('ฉากไทย'), `${c.id}: คำสั่งแผ่นแบบยังสั่งให้วาดฉากไทย — ขัดกับพื้นขาว`)
    assert.ok(!p.includes('เต็มเฟรมจรดขอบ'), `${c.id}: คำสั่งแผ่นแบบยังสั่งเต็มเฟรม — ขัดกับพื้นขาว`)
  }
})

test('คำบรรยายตัวละครไม่พาฉากหรือตัวหนังสือติดเข้าแผ่นแบบ · ตัวที่ยืนไม่ได้มีท่าแทน', () => {
  // ทารกเคยมี "นอนในเปลผ้าแขวนใต้ถุนเรือน" = ฉาก
  assert.ok(!castById('baby').look.includes('ใต้ถุนเรือน'))
  // หุ่นพยนต์เคยมี "ผ้ายันต์เขียนอักขระ" = ตัวหนังสือในภาพ (ผิดกฎ 7)
  assert.match(castById('hunphayon').look, /ไม่ใช่ตัวอักษรที่อ่านได้/)
  // ฤๅษีเคยมี "นั่งขัดสมาธิบนแท่นหิน" = ฉาก
  assert.match(castById('ruesi').look, /ไม่ต้องวาดแท่นหิน/)
  // ไม่มีขา/ไม่มีลำตัว ยืน 3 ท่าแบบคนไม่ได้ → ต้องบอกท่าแทน
  for (const id of ['g_krasue', 'phaya_nak', 'mermaid', 'baby']) assert.match(castById(id).look, /แทนท่ายืน|นั่งหางพับ/, `${id}: ต้องบอกท่าแทนท่ายืน`)
  // ผีกองกอยเคยออกมาสองขาและหน้าเหมือนผีโพง → ต้องย้ำขาเดียวและเครื่องนุ่งที่ต่างกัน
  assert.match(castById('g_kongkoi').look, /ขาเพียงข้างเดียว/)
  assert.match(castById('g_kongkoi').look, /ไม่มีขาข้างที่สอง/)
  assert.match(castById('g_kongkoi').look, /ใบตองแห้ง/)
})

test('ส่วนขยาย: หารูปที่วาดจาก "ตำแหน่งคำสั่ง" ไม่ใช่จากกล่องคำตอบ (หน้า ChatGPT รุ่นนี้ไม่มีตัวบอกผู้พูดแล้ว)', () => {
  const chat = read('extension/content-chatgpt.js')
  const fn = chat.slice(chat.indexOf('const answerImages'), chat.indexOf('async function runImagePrompt'))
  assert.ok(!fn.includes('assistantTurns()'), 'ห้ามพึ่ง assistantTurns — หน้าปัจจุบันไม่มี data-message-author-role')
  assert.match(fn, /promptAnchor\(marker\)/)
  assert.match(fn, /DOCUMENT_POSITION_FOLLOWING/, 'รูปต้องอยู่หลังคำสั่งล่าสุด — รูปเก่าที่ถูกโหลดกลับมาด้วย blob ใหม่จึงไม่ถูกนับ')
  assert.match(fn, /< 1000/, 'ต้องข้ามภาพร่าง 768px')
  assert.match(fn, /startsWith\('data:'\)/)
  const run = chat.slice(chat.indexOf('async function runImagePrompt'), chat.indexOf('chrome.runtime.onMessage.addListener'))
  assert.match(run, /pasteFiles\(input, attachments\)/, 'ต้องแนบภาพอ้างอิงลายเส้นก่อนพิมพ์')
  assert.match(run, /ChatGPT อัปโหลดภาพอ้างอิงลายเส้น/)
  assert.match(run, /nowSrc === src/, 'ต้องรอให้ภาพเดิมนิ่งก่อนคว้า')
  // ตัวหาตำแหน่งคำสั่งต้องหาได้จริงจากหน้าตาคำสั่งที่เราส่ง
  const p = castSheetPrompt('nurse')
  assert.ok(p.split(/\r?\n/).some((l) => l.startsWith('ตัวละคร: พยาบาล')), 'คำสั่งต้องมีบรรทัด "ตัวละคร: <ชื่อ>" ให้ใช้เป็นจุดยึด')
})

test('แผงข้างและโปรแกรมในเครื่องส่งภาพอ้างอิงต่อไปจนถึงหน้า ChatGPT', () => {
  const panel = read('extension/sidepanel.js')
  assert.match(panel, /askChatGPTImage\(job\.prompt, job\.attachments \?\? \[\]\)/)
  assert.match(panel, /type: 'ASK_IMAGE', prompt, newChat: false, attachments/)
  const chat = read('extension/content-chatgpt.js')
  assert.match(chat, /attachments: msg\.attachments \?\? \[\]/)
  const ui = read('bridge/ui.js')
  assert.match(ui, /missingCast\(\)\.slice\(0, limit\)\.map\(castSheetJob\)/, '/api/cast/todo ต้องส่งภาพอ้างอิงไปกับคำสั่ง')
})

// ── กระสือแบบดั้งเดิม — ผู้ใช้ 23 พ.ย. 2026 ส่งรูปอ้างอิงจากละคร + "กระสือ แบบนี้นะ" ──
// เดิมใช้แสงเรืองแทนอวัยวะเพราะ spec ข้อ 2 · ข้อยกเว้นนี้ต้องตรงกัน 3 ที่ ไม่งั้นแผ่นแบบมีอวัยวะ
// แต่ Character Bible เขียนว่าไม่มี แล้ว Flow สับสนว่าจะเชื่ออันไหน
test('กระสือมีอวัยวะห้อยตรงกัน 3 ที่: บัญชีตัวละคร · กฎหน้าผี · กฎความสยอง', async () => {
  const { GHOST_LOOK_RULE, scareRule } = await import('../extension/prompts.js')
  const organs = /ปอด[^\n]*หัวใจ[^\n]*ตับ/
  assert.match(castById('g_krasue').look, organs, 'บัญชีตัวละครต้องบรรยายอวัยวะให้ตรงกับแผ่นแบบในคลัง')
  const ghostLine = GHOST_LOOK_RULE.split('\n').find((l) => l.includes('· กระสือ —'))
  assert.match(ghostLine, organs, 'กฎหน้าผีต้องพูดตรงกับแผ่นแบบ')
  assert.ok(!/ห้ามวาดอวัยวะภายใน/.test(ghostLine), 'กฎหน้าผีห้ามขัดกับแผ่นแบบ')
  const limits = scareRule('strong', 'ghost', 'image')
  assert.match(limits, /ยกเว้นกระสือ/, 'กฎความสยองต้องยกเว้นให้กระสือ')
  assert.ok(!limits.includes('มีแสงเรืองใต้คอแทนอวัยวะ'), 'กฎเก่าที่ขัดกันต้องหายไปแล้ว')
  // ยังเป็นลายเส้นการ์ตูนไม่มีเลือด ทั้งในบัญชีและในกฎ
  for (const text of [castById('g_krasue').look, ghostLine, limits]) {
    assert.match(text, /ไม่มีเลือด/)
    assert.match(text, /ไม่ใช่ภาพผ่าตัด/)
  }
})

test('ข้อยกเว้นอวัยวะใช้กับกระสือตัวเดียว — ผีตัวอื่นและกฎทั่วไปยังห้ามไส้', async () => {
  const { scareRule } = await import('../extension/prompts.js')
  for (const g of castOfGroup('ghost').filter((c) => c.id !== 'g_krasue')) {
    assert.ok(!/ปอด|หัวใจ|ตับ|ไส้|อวัยวะ/.test(g.look), `${g.id}: ผีตัวอื่นห้ามมีอวัยวะ`)
  }
  assert.match(scareRule('strong', 'ghost', 'image'), /ห้ามไส้ทะลักจากร่างคน/, 'กฎทั่วไปยังห้ามไส้')
})

test('คำบรรยายกระสือผ่านตัวกรองคำรุนแรงได้ครบ — Character Bible ที่คัดจากบัญชีจะไม่ถูกตัดจนอ่านไม่รู้เรื่อง', async () => {
  const { sanitizeShotPrompt } = await import('../pipeline/lib/shot-safety.mjs')
  const look = castById('g_krasue').look
  const r = sanitizeShotPrompt(look)
  assert.equal(typeof r === 'string' ? r : r.text ?? r.prompt, look, 'ตัวกรองไม่ควรตัดคำไหนออกจากคำบรรยายกระสือ')
  // ตัวกรองยังทำงานกับคำต้องห้ามตามเดิม — ข้อยกเว้นไม่ได้ทำให้ตัวกรองหลวมลง
  const bad = sanitizeShotPrompt('ไส้ทะลักออกมาจากท้อง')
  assert.notEqual(typeof bad === 'string' ? bad : bad.text ?? bad.prompt, 'ไส้ทะลักออกมาจากท้อง')
})
