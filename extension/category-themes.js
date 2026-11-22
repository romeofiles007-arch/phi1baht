import { categoryOf } from './prompts.js'

// มืดแต่สดใส (ผู้ใช้ 23 พ.ย. 2026: "อยากได้เป็นทีมมืดแต่สดใส ถ้าสว่างแบบนี้มันแสบตา") — โทนเดียวทุกโหมดของเครื่อง
// พื้นมืดอมสีประจำหมวด (ไม่ใช่น้ำตาลทึบ) ตัวหนังสือสว่าง สีเน้นจัดแบบปกเล่มละบาท (คอนทราสต์ ≥ 4.5:1)
const semantic = { ok:'#5fe0a0', warn:'#ffd24d', danger:'#ff8a94', 'accent-ink':'#1a0710', gold:'#ffc21a' }
const palette = values => ({...semantic, ...values})

const ART = { day:'agents/phi-night-vivid.png', icon:'icons/category-phi.png' }

/**
 * ธีมหน้าจอของแต่ละหมวด — โรงพิมพ์การ์ตูนผียามค่ำ แสงจันทร์และตะเกียง
 *   ผีไทย = แดงปะการังบนม่วงเลือด · ไสยศาสตร์ = ม่วงลาเวนเดอร์ · นิทาน = เหลืองทานตะวันบนน้ำเงิน · ชีวิตสอนใจ = ฟ้าเทอร์ควอยซ์ · ตลก = ส้มสด
 *   wood = แถบหัวเรื่องที่มีตัวหนังสือขาวทับ จึงเป็นสีเข้มอิ่ม
 * mix (คละหมวด) ใช้ธีมผีไทย ซึ่งเป็นหมวดหลักของแอป
 */
export const CATEGORY_THEMES = {
  ghost: { title:'ผีไทย', ...ART, light:palette({bg:'#1c0f24',panel:'#2a1634',pick:'#3d1f49',ink:'#fff0f4',muted:'#e7bfd0',accent:'#ff5a6e',line:'#7a3f6b',wood:'#4a1030',action:'#ffc21a','action-ink':'#1d1400'}) },
  saiyasat: { title:'ไสยศาสตร์และหมอผี', ...ART, light:palette({bg:'#17112e',panel:'#221a42',pick:'#30255c',ink:'#f3eeff',muted:'#cbbff0',accent:'#c79bff',line:'#5f4f9a',wood:'#2d1660'}) },
  folk: { title:'นิทานพื้นบ้านและจักรๆ วงศ์ๆ', ...ART, light:palette({bg:'#0f1733',panel:'#182349',pick:'#22305f',ink:'#f2f6ff',muted:'#c0ccec',accent:'#ffd24d',line:'#4d5f9c',wood:'#14286a'}) },
  drama: { title:'ชีวิตสอนใจ', ...ART, light:palette({bg:'#0b1d26',panel:'#122a36',pick:'#1a3a49',ink:'#eefbff',muted:'#b5dbe6',accent:'#4fe0d2',line:'#3f7486',wood:'#0b3f4e'}) },
  comedy: { title:'ตลกบ้านทุ่ง', ...ART, light:palette({bg:'#1f1426',panel:'#2c1c33',pick:'#3e2747',ink:'#fff5ec',muted:'#ecc9b0',accent:'#ff9d4d',line:'#7a5470',wood:'#5a2a12'}) },
}

export const themeKey = value => categoryOf(value)?.id ?? 'mix'
export const categoryGenre = value => categoryOf(value)?.name ?? 'mix'
export const themeForGenre = value => CATEGORY_THEMES[themeKey(value)] ?? CATEGORY_THEMES.ghost

export function categoryThemeCss() {
  const rule = (id,theme,mode) => {
    const p=theme[mode]
    const selector=`html[data-category='${id}']`
    const colors=Object.entries(p).flatMap(([name,color])=>[`--${name}:${color}`,`--category-${name}:${color}`])
    // แต่ละแผนกเก็บสีประจำตัวไว้ (ตั้งใน temple.css)
    const departments=[]
    return `${selector}{${colors.concat(departments,[`--world-image:url('${theme.day}')`,`--temple-wood:${p.wood}`,`--temple-gold:${p.gold}`,`--hero-edge:${p.gold}`,`--temple-surface:${p.pick}`,`--sea-top:${p.pick}`,`--sand-deep:${p.gold}`]).join(';')}}`
  }
  // "คละทุกหมวด" (mix) ต้องมีสีด้วย — เดิมไม่มี html[data-category='mix'] ตัวแปร --category-* จึงว่าง
  // หน้าโพสต์อัตโนมัติ (#posting) ใช้ตัวแปรชุดนี้เป็นพื้นหลัง → พื้นโปร่งใส ซ้อนทับหน้าหลักจนอ่านไม่ได้
  const all=[...Object.entries(CATEGORY_THEMES),['mix',themeForGenre('mix')]]
  return all.map(([id,t])=>rule(id,t,'light')).join('\n')
}

export function applyCategoryTheme(genre, doc=document) {
  const key=themeKey(genre),theme=themeForGenre(genre)
  let style=doc.getElementById('category-theme-tokens')
  if(!style) {
    style=doc.createElement('style')
    style.id='category-theme-tokens'
    style.textContent=categoryThemeCss()
    doc.head.append(style)
  }
  doc.documentElement.dataset.category=key
  doc.querySelectorAll('.brand-icon, .stickyLogo img').forEach(image=>{ if(image.getAttribute('src')!==theme.icon) image.setAttribute('src',theme.icon) })
  const favicon=doc.querySelector('link[rel="icon"]')
  if(favicon) favicon.setAttribute('href',theme.icon)
  return key
}
