import { categoryOf } from './prompts.js'

// ทั้งสองโหมดเป็นโทนมืดนวลตา — ไม่ใช้พื้นขาว
const semantic = {
  light: { ok:'#8fd3ad', warn:'#ecc763', danger:'#ff9f93', 'accent-ink':'#141b24' },
  dark: { ok:'#8fd3ad', warn:'#ecc763', danger:'#ff9f93', 'accent-ink':'#141a22' },
}
const palette = (mode, values) => ({...semantic[mode], ...values})

// ภาพฉากและไอคอนยังเป็นชุดเดิมของแอปต้นแบบทุกหมวด — งานธีม (Task 9) จะวาดชุดของผี 1 บาทแล้วเปลี่ยนชื่อไฟล์ที่นี่
const ART = { day:'agents/china-day.png', night:'agents/china-night.png', icon:'icons/category-sanguo.png' }

/**
 * ธีมหน้าจอของแต่ละหมวด — โรงพิมพ์การ์ตูนผียุค 2520 ยามดึก ทุกหมวดเป็นพื้นมืดนวลตา (ไม่มีพื้นขาว)
 *   ผีไทย = แดงเลือด · ไสยศาสตร์ = ม่วงกลางคืนกับทองของขลัง (ตามปกผีเล่มละบาท)
 *   นิทาน / ชีวิตสอนใจ / ตลก = ฟ้าอ่อนกับเหลืองแบบปกนครไทย แต่กดพื้นให้มืดลง
 * mix (คละหมวด) ใช้ธีมผีไทย ซึ่งเป็นหมวดหลักของแอป
 */
export const CATEGORY_THEMES = {
  ghost: {
    title:'ผีไทย', ...ART,
    light:palette('light',{bg:'#2a1517',panel:'#361c1f',ink:'#f6e6dc',muted:'#d8b4a8',accent:'#ff9a8a',line:'#9a6a64',pick:'#46262a',wood:'#1a0c0d',gold:'#e9c46a',action:'#e9c46a','action-ink':'#1d1400'}),
    dark:palette('dark',{bg:'#1a0d0e',panel:'#281517',ink:'#f6e6dc',muted:'#d2ada2',accent:'#ff9a8a',line:'#9a6a64',pick:'#3a1f22',wood:'#120809',gold:'#e9c46a',action:'#e9c46a','action-ink':'#1d1400'}),
  },
  saiyasat: {
    title:'ไสยศาสตร์และหมอผี', ...ART,
    light:palette('light',{bg:'#231b34',panel:'#2e2443',ink:'#efe8fb',muted:'#c6b9e0',accent:'#e6c46e',line:'#7a6a9e',pick:'#3a2e54',wood:'#150f22',gold:'#e6c46e'}),
    dark:palette('dark',{bg:'#181226',panel:'#221a35',ink:'#efe8fb',muted:'#bfb1db',accent:'#e6c46e',line:'#7a6a9e',pick:'#2d2345',wood:'#0f0a19',gold:'#e6c46e'}),
  },
  folk: {
    title:'นิทานพื้นบ้านและจักรๆ วงศ์ๆ', ...ART,
    light:palette('light',{bg:'#1b2a3d',panel:'#243650',ink:'#fdf3d6',muted:'#c9d3e6',accent:'#ffd85c',line:'#6d82a3',pick:'#2e4463',wood:'#111c2b',gold:'#ffd85c'}),
    dark:palette('dark',{bg:'#121e2d',panel:'#1a2a3e',ink:'#fdf3d6',muted:'#c2cde2',accent:'#ffd85c',line:'#6d82a3',pick:'#23364f',wood:'#0b1420',gold:'#ffd85c'}),
  },
  drama: {
    title:'ชีวิตสอนใจ', ...ART,
    light:palette('light',{bg:'#17303a',panel:'#1f3d49',ink:'#eef7fb',muted:'#b7d3df',accent:'#9fdcf5',line:'#5f8b9c',pick:'#284a58',wood:'#0e1f26',gold:'#f3d27a'}),
    dark:palette('dark',{bg:'#10232b',panel:'#173039',ink:'#eef7fb',muted:'#afcdda',accent:'#9fdcf5',line:'#5f8b9c',pick:'#1f3c48',wood:'#09171c',gold:'#f3d27a'}),
  },
  comedy: {
    title:'ตลกบ้านทุ่ง', ...ART,
    light:palette('light',{bg:'#232a14',panel:'#2f381c',ink:'#fbf5d4',muted:'#d3d6a8',accent:'#ffe14d',line:'#808a55',pick:'#3b4624',wood:'#151a0b',gold:'#ffe14d'}),
    dark:palette('dark',{bg:'#181e0d',panel:'#222a14',ink:'#fbf5d4',muted:'#cdd0a0',accent:'#ffe14d',line:'#808a55',pick:'#2d371b',wood:'#0e1207',gold:'#ffe14d'}),
  },
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
    return `${selector}{${colors.concat(departments,[`--world-image:url('${theme.night}')`,`--temple-wood:${p.wood}`,`--temple-gold:${p.gold}`,`--hero-edge:${p.gold}`,`--temple-surface:${p.pick}`,`--sea-top:${p.pick}`,`--sand-deep:${p.gold}`]).join(';')}}`
  }
  // "คละทุกหมวด" (mix) ต้องมีสีด้วย — เดิมไม่มี html[data-category='mix'] ตัวแปร --category-* จึงว่าง
  // หน้าโพสต์อัตโนมัติ (#posting) ใช้ตัวแปรชุดนี้เป็นพื้นหลัง → พื้นโปร่งใส ซ้อนทับหน้าหลักจนอ่านไม่ได้
  const all=[...Object.entries(CATEGORY_THEMES),['mix',themeForGenre('mix')]]
  return all.map(([id,t])=>rule(id,t,'light')).join('\n') + '\n@media(prefers-color-scheme: dark){\n' + all.map(([id,t])=>rule(id,t,'dark')).join('\n')+'\n}'
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
