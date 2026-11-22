import { categoryOf } from './prompts.js'

// โทนสดใส (ผู้ใช้สั่ง 23 พ.ย. 2026 "อยากได้ธีมฉากหลังสดใส เบื่อแบบทึบแล้ว") — ใช้โทนเดียวทุกโหมดของเครื่อง
// พื้นอ่อนสีประจำหมวด การ์ดสีขาว ตัวหนังสือหมึกเข้ม สีเน้นจัดแบบปกเล่มละบาท (คอนทราสต์ ≥ 4.5:1)
const semantic = { ok:'#15663a', warn:'#7a4f00', danger:'#b3141f', 'accent-ink':'#ffffff', panel:'#ffffff', pick:'#ffe08a', gold:'#ffc21a' }
const palette = values => ({...semantic, ...values})

const ART = { day:'agents/phi-bright.png', icon:'icons/category-phi.png' }

/**
 * ธีมหน้าจอของแต่ละหมวด — โรงพิมพ์การ์ตูนผีตอนเช้าแดดจ้า
 *   ผีไทย = แดงชื่อเรื่อง · ไสยศาสตร์ = ม่วงของขลัง · นิทาน = ฟ้าปกนิทาน · ชีวิตสอนใจ = เขียวหัวเป็ด · ตลก = ส้มสด
 *   wood = แถบหัวเรื่อง/ป้ายที่มีตัวหนังสือขาวทับ จึงเป็นสีเข้มจัด
 * mix (คละหมวด) ใช้ธีมผีไทย ซึ่งเป็นหมวดหลักของแอป
 */
export const CATEGORY_THEMES = {
  ghost: { title:'ผีไทย', ...ART, light:palette({bg:'#fff0f1',ink:'#24161a',muted:'#5c4148',accent:'#c4202c',line:'#ebbcc1',wood:'#c4202c',action:'#ffc21a','action-ink':'#1d1400'}) },
  saiyasat: { title:'ไสยศาสตร์และหมอผี', ...ART, light:palette({bg:'#f4efff',ink:'#1e1736',muted:'#4f4670',accent:'#6a2fb8',line:'#cdbff0',wood:'#5a2aa0'}) },
  folk: { title:'นิทานพื้นบ้านและจักรๆ วงศ์ๆ', ...ART, light:palette({bg:'#e8f4ff',ink:'#14233a',muted:'#3f5470',accent:'#1458a8',line:'#b5cdea',wood:'#1458a8'}) },
  drama: { title:'ชีวิตสอนใจ', ...ART, light:palette({bg:'#e6f7f4',ink:'#12302e',muted:'#3c5e5a',accent:'#0b6e67',line:'#b2ddd7',wood:'#0b6e67'}) },
  comedy: { title:'ตลกบ้านทุ่ง', ...ART, light:palette({bg:'#fff3e6',ink:'#2a1a0c',muted:'#5e4630',accent:'#a03e00',line:'#f0c9a0',wood:'#a03e00'}) },
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
