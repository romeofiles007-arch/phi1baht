import { categoryOf } from './prompts.js'

// ทั้งสองโหมดเป็นโทนมืดนวลตา — ไม่ใช้พื้นขาว
const semantic = {
  light: { ok:'#8fd3ad', warn:'#ecc763', danger:'#ff9f93', 'accent-ink':'#141b24' },
  dark: { ok:'#8fd3ad', warn:'#ecc763', danger:'#ff9f93', 'accent-ink':'#141a22' },
}
const palette = (mode, values) => ({...semantic[mode], ...values})

export const CATEGORY_THEMES = {
  sanguo: {
    title:'วรรณกรรมจีนและวีรบุรุษ', day:'agents/china-day.png', night:'agents/china-night.png', icon:'icons/category-sanguo.png',
    light:palette('light',{bg:'#2a1a1e',panel:'#36242a',ink:'#fbe9e9',muted:'#d6b0b3',accent:'#ff9f93',line:'#9c7276',pick:'#452b31',wood:'#1b1013',gold:'#eec372',action:'#eec372','action-ink':'#1d1700'}),
    dark:palette('dark',{bg:'#1d1113',panel:'#2b191c',ink:'#fbe9e9',muted:'#d2aaad',accent:'#ff9f93',line:'#9c7276',pick:'#3b2428',wood:'#160c0e',gold:'#eec372',action:'#eec372','action-ink':'#1d1700'}),
  },
  sage: {
    title:'ปรัชญาจีนโบราณ', day:'agents/china-day.png', night:'agents/china-night.png', icon:'icons/category-sanguo.png',
    light:palette('light',{bg:'#1a2342',panel:'#232e52',ink:'#e6ebfb',muted:'#b2bce0',accent:'#9fb3f0',line:'#6d7bab',pick:'#2d3962',wood:'#121732',gold:'#aab8ef'}),
    dark:palette('dark',{bg:'#10152a',panel:'#1a2240',ink:'#e6ebfb',muted:'#aab5dc',accent:'#9fb3f0',line:'#6d7bab',pick:'#242e52',wood:'#0c1021',gold:'#aab8ef'}),
  },
  tale: {
    title:'ตำนานจอมยุทธ์และนิทานจีน', day:'agents/china-day.png', night:'agents/china-night.png', icon:'icons/category-sanguo.png',
    light:palette('light',{bg:'#163126',panel:'#1f4031',ink:'#e4f3e9',muted:'#aecebb',accent:'#8ed9b4',line:'#6a937c',pick:'#28523c',wood:'#0f2418',gold:'#8ed9b4'}),
    dark:palette('dark',{bg:'#0d1f17',panel:'#152c21',ink:'#e4f3e9',muted:'#a6c8b4',accent:'#8ed9b4',line:'#6a937c',pick:'#1e3d2e',wood:'#091710',gold:'#8ed9b4'}),
  },
}

export const themeKey = value => categoryOf(value)?.id ?? 'mix'
export const categoryGenre = value => categoryOf(value)?.name ?? 'mix'
export const themeForGenre = value => CATEGORY_THEMES[themeKey(value)] ?? CATEGORY_THEMES.tale

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
