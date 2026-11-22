// ธีมหน้าจอของ 5 หมวดผี 1 บาท + คละหมวด — ทุกโหมดพื้นมืดนวลตา สีอ่านง่าย (คอนทราสต์ ≥ 4.5:1)
//   node scripts/test-category-themes.mjs
// Task 4: เดิมตรวจ 3 หมวดของแอปต้นแบบ → เปลี่ยนเป็น 5 หมวดเล่มละบาท · ภาพฉากยังใช้ชุดเดิมร่วมกันจนกว่างานธีม (Task 9) จะวาดชุดใหม่
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { CATEGORIES } from '../extension/prompts.js'

const { themeKey, categoryGenre, themeForGenre, CATEGORY_THEMES, categoryThemeCss } = await import('../extension/category-themes.js')
assert.deepEqual(Object.keys(CATEGORY_THEMES), ['ghost', 'saiyasat', 'folk', 'drama', 'comedy'])
for(const c of CATEGORIES) {
  assert.equal(themeKey(c.id),c.id)
  assert.equal(themeKey(c.name),c.id)
  assert.equal(categoryGenre(c.id),c.name)
  assert.equal(categoryGenre(c.name),c.name)
  assert.equal(themeForGenre(c.name),CATEGORY_THEMES[c.id])
  // ไฟล์ภาพที่ธีมอ้างต้องมีอยู่จริง (ชื่อไฟล์ใหม่ของผี 1 บาทมาพร้อมภาพใน Task 9)
  for(const f of [themeForGenre(c.id).day,themeForGenre(c.id).night,themeForGenre(c.id).icon]) assert.ok(existsSync(new URL(`../extension/${f}`, import.meta.url)),f)
}
for(const value of ['mix','',undefined,null,'unknown-category']) assert.equal(themeKey(value),'mix')
assert.equal(themeForGenre('mix'),CATEGORY_THEMES.ghost,'คละหมวดใช้ธีมผีไทย (หมวดหลัก)')
assert.match(categoryThemeCss(),/prefers-color-scheme: dark/)
for(const c of CATEGORIES) assert.ok(categoryThemeCss().includes(`html[data-category='${c.id}']`))
assert.ok(categoryThemeCss().includes(`html[data-category='mix']`))
// สีพื้นของแต่ละหมวดต่างกัน (ผู้ใช้เห็นว่าเปลี่ยนหมวดแล้ว)
assert.equal(new Set(Object.values(CATEGORY_THEMES).map(t=>t.dark.bg)).size,CATEGORIES.length)

const luminance=hex=>{const v=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);return v[0]*.2126+v[1]*.7152+v[2]*.0722}
const contrast=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05)
for(const [id,t] of Object.entries(CATEGORY_THEMES)) for(const mode of ['light','dark']) {
 const p=t[mode]
 // ไม่มีพื้นขาว — ทั้งโหมดสว่างและมืดพื้นต้องมืด
 for(const bg of ['bg','panel','pick']) assert.ok(luminance(p[bg])<0.08,`${id}/${mode}/${bg} สว่างเกินไป`)
 for(const fg of ['ink','muted','accent','ok','warn','danger']) for(const bg of ['bg','panel','pick']) assert.ok(contrast(p[fg],p[bg])>=4.5,`${id}/${mode}/${fg}/${bg}: ${contrast(p[fg],p[bg]).toFixed(2)}`)
 assert.ok(contrast(p.accent,p['accent-ink'])>=4.5,`${id}/${mode}/action`)
 if(p.action) assert.ok(contrast(p.action,p['action-ink'])>=4.5,`${id}/${mode}/gold action`)
}
console.log('PASS: 5 category IDs/names, mix falls back to ghost, existing art files, dark-only surfaces, light/dark contrast >=4.5:1.')
