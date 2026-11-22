"""สร้างไอคอนและภาพตัวละครทั้งหมดจากภาพต้นฉบับใน assets/china-raw/

รัน:  python scripts/build-icons.py           สร้างใหม่ทั้งหมด (ไอคอน + ตัวละคร + GIF)
      python scripts/build-icons.py --icons   สร้างเฉพาะไอคอน (ไม่แตะภาพตัวละคร)

ภาพตัวละคร: ถ้าสร้างใหม่ ต้องรัน scripts/build-sprite-registration.py ต่อทุกครั้ง
เพราะไฟล์ PNG ถูกเข้ารหัสใหม่ ค่า sha256 ในไฟล์ล็อกพื้นยืนจะไม่ตรง
"""
import os
import sys

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
raw = os.path.join(ROOT, 'assets', 'china-raw')
icons = os.path.join(ROOT, 'extension', 'icons')
agents = os.path.join(ROOT, 'extension', 'agents')

# มุมมนโปร่งใสแบบ "ตัดขอบ" — ภาพต้นฉบับชุดปัจจุบัน (ธงกับกลองศึก) วาดมุมมนมาแล้วที่ ~21%
# ถ้าใช้รัศมีเล็กกว่านี้ มุมดำของภาพต้นฉบับจะโผล่ออกมา
RADIUS = 0.211


def rounded(img, size, radius=RADIUS):
    """ย่อภาพเป็นสี่เหลี่ยมจัตุรัสขนาด size แล้วตัดมุมให้โปร่งใส (ขอบเนียนด้วยการวาด 4x)"""
    im = img.convert('RGBA').resize((size, size), Image.LANCZOS)
    ss = 4
    mask = Image.new('L', (size * ss, size * ss), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, size * ss - 1, size * ss - 1], radius=int(size * ss * radius), fill=255)
    mask = mask.resize((size, size), Image.LANCZOS)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(im, (0, 0), mask)
    return out


def build_icons():
    src = Image.open(os.path.join(raw, 'app-icon.png')).convert('RGBA')
    for s in (16, 24, 32, 48, 64, 128, 256, 512):
        rounded(src, s).save(os.path.join(icons, f'icon-{s}.png'))
    rounded(src, 256).save(os.path.join(icons, 'phi1baht.ico'),
                           sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    rounded(src, 128).save(os.path.join(icons, 'icon-128.ico'),
                           sizes=[(16, 16), (32, 32), (48, 48), (128, 128)])
    # ไอคอนหมวด — ใช้ภาพเดียวกับไอคอนแอป ให้ทุกที่หน้าตาเดียวกัน
    rounded(src, 512).save(os.path.join(icons, 'category-sanguo.png'))
    rounded(src, 256).save(os.path.join(icons, 'category-sanguo.ico'),
                           sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    rounded(src, 256).save(os.path.join(icons, 'category-sanguo-transparent.ico'),
                           sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    print('ไอคอน: icon-16..512.png · phi1baht.ico · icon-128.ico · category-sanguo.png/.ico')


def build_agents():
    for a in ('chatgpt', 'flow', 'meta', 'voice', 'edit'):
        Image.open(os.path.join(raw, f'agent-{a}.png')).save(os.path.join(agents, f'china-{a}.png'))
    for w in ('day', 'night'):
        Image.open(os.path.join(raw, f'world-{w}.png')).convert('RGB').save(os.path.join(agents, f'china-{w}.png'))

    # GIF 12 เฟรม (atlas 4x3 -> 12 เฟรม)
    gifdir = os.path.join(agents, 'gif')
    os.makedirs(gifdir, exist_ok=True)
    for a in ('chatgpt', 'flow', 'meta', 'voice', 'edit'):
        sheet = Image.open(os.path.join(raw, f'agent-{a}.png')).convert('RGBA')
        W, H = sheet.size
        cw, ch = W // 4, H // 3
        frames = [sheet.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch)) for r in range(3) for c in range(4)]
        frames = [f.resize((cw // 2, ch // 2), Image.LANCZOS) for f in frames]
        conv = []
        for f in frames:
            p = f.convert('RGBA')
            q = p.convert('P', palette=Image.ADAPTIVE, colors=255)
            mask = p.getchannel('A').point(lambda v: 255 if v < 128 else 0)
            q.paste(255, mask)
            conv.append(q)
        conv[0].save(os.path.join(gifdir, f'china-{a}.gif'), save_all=True, append_images=conv[1:],
                     duration=110, loop=0, transparency=255, disposal=2, optimize=False)
    print('ตัวละคร + GIF: สร้างใหม่แล้ว — อย่าลืมรัน scripts/build-sprite-registration.py')


if __name__ == '__main__':
    build_icons()
    if '--icons' not in sys.argv:
        build_agents()
    print('ok')
