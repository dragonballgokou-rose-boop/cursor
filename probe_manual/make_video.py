import math, subprocess, wave, array, os
from PIL import Image, ImageDraw, ImageFont
import imageio_ffmpeg

W, H, FPS = 1280, 720, 30
FONT = "/usr/share/fonts/truetype/ipafont-gothic/ipag.ttf"
if not os.path.exists(FONT):
    FONT = "/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf"
OUT = "/home/user/cursor/probe_manual/プローブの使い方_MDF電話線探索.mp4"
import tempfile
TMP = tempfile.gettempdir()

_fc = {}
def F(size):
    if size not in _fc:
        _fc[size] = ImageFont.truetype(FONT, size)
    return _fc[size]

NAVY = (20, 40, 80); ORANGE = (240, 130, 20); RED = (210, 40, 40)
GREEN = (30, 150, 80); GRAY = (120, 120, 120); LIGHT = (235, 240, 248)
WHITE = (255, 255, 255); BLACK = (25, 25, 25); YELLOW = (255, 215, 0); BLUE = (30, 105, 200)

def ease(x):
    x = max(0.0, min(1.0, x)); return x * x * (3 - 2 * x)

def header(d, step, title):
    d.rectangle([0, 0, W, 90], fill=NAVY)
    if step:
        d.rounded_rectangle([30, 20, 190, 70], 10, fill=ORANGE)
        d.text((110, 45), step, font=F(30), fill=WHITE, anchor="mm")
        d.text((215, 45), title, font=F(40), fill=WHITE, anchor="lm")
    else:
        d.text((40, 45), title, font=F(40), fill=WHITE, anchor="lm")

def caption(d, text):
    d.rectangle([0, H - 90, W, H], fill=(0, 0, 0))
    d.text((W // 2, H - 45), text, font=F(32), fill=WHITE, anchor="mm")

def bullets(d, items, x, y, t, size=34, gap=62, start=0.3, step=0.7):
    for i, it in enumerate(items):
        a = ease((t - start - i * step) / 0.4)
        if a <= 0: continue
        col = RED if it.startswith("!") else BLACK
        txt = it.lstrip("!")
        dx = int((1 - a) * 40)
        d.ellipse([x + dx, y + i * gap + 10, x + dx + 18, y + i * gap + 28], fill=RED if col == RED else ORANGE)
        d.text((x + 34 + dx, y + i * gap), txt, font=F(size), fill=col)

# ---------- drawing parts ----------
def draw_jack(d, cx, cy, label="モジュラージャック"):
    d.rounded_rectangle([cx - 60, cy - 80, cx + 60, cy + 80], 12, fill=WHITE, outline=GRAY, width=3)
    d.rectangle([cx - 25, cy - 20, cx + 25, cy + 20], fill=(60, 60, 60))
    d.rectangle([cx - 10, cy + 20, cx + 10, cy + 28], fill=(60, 60, 60))
    d.text((cx, cy + 105), label, font=F(22), fill=BLACK, anchor="mm")

def draw_generator(d, cx, cy, on=True, blink=True):
    d.rounded_rectangle([cx - 70, cy - 100, cx + 70, cy + 100], 18, fill=BLUE, outline=BLACK, width=3)
    d.text((cx, cy - 65), "発信器", font=F(26), fill=WHITE, anchor="mm")
    d.rounded_rectangle([cx - 45, cy - 30, cx + 45, cy + 10], 6, fill=(250, 240, 220))
    d.text((cx, cy - 10), "SCAN", font=F(22), fill=BLACK, anchor="mm")
    lc = (60, 220, 60) if (on and blink) else (80, 80, 80)
    d.ellipse([cx - 12, cy + 35, cx + 12, cy + 59], fill=lc, outline=BLACK)

def draw_probe(d, tipx, tipy, angle_deg=-60, level=0.0):
    # body extends up-right from tip
    L = 230
    a = math.radians(angle_deg)
    ux, uy = math.cos(a), math.sin(a)
    px, py = -uy, ux
    def pt(s, w):
        return (tipx + ux * s + px * w, tipy + uy * s + py * w)
    d.polygon([pt(0, 0), pt(40, 12), pt(40, -12)], fill=(200, 200, 200), outline=BLACK)
    d.polygon([pt(40, 22), pt(L, 30), pt(L, -30), pt(40, -22)], fill=BLUE, outline=BLACK)
    cx, cy = pt(L - 60, 0)
    d.text((cx, cy), "プローブ", font=F(20), fill=WHITE, anchor="mm")
    # sound waves
    if level > 0.05:
        sx, sy = pt(L + 10, 0)
        n = 1 + int(level * 3.99)
        for i in range(n):
            r = 20 + i * 18
            d.arc([sx - r, sy - r, sx + r, sy + r], angle_deg - 50, angle_deg + 50, fill=RED, width=5)

def level_meter(d, x, y, level):
    d.text((x, y - 36), "音の大きさ", font=F(24), fill=BLACK)
    for i in range(10):
        on = level * 10 > i + 0.2
        col = (GREEN if i < 5 else ORANGE if i < 8 else RED) if on else (215, 215, 215)
        d.rectangle([x + i * 30, y, x + i * 30 + 24, y + 40], fill=col)

def draw_mdf(d, x0, y0, cols, rows, hl=None, target=None, pitch=46):
    d.rounded_rectangle([x0 - 30, y0 - 50, x0 + cols * pitch + 10, y0 + rows * pitch + 20], 10,
                        fill=(200, 205, 215), outline=GRAY, width=3)
    d.text((x0 - 10, y0 - 38), "MDF 端子盤", font=F(22), fill=BLACK)
    for r in range(rows):
        for c in range(cols):
            x = x0 + c * pitch; y = y0 + r * pitch
            col = (240, 240, 240)
            if hl is not None and hl == (r, c): col = (255, 230, 150)
            if target is not None and target == (r, c): col = (255, 170, 170)
            d.rectangle([x, y, x + 30, y + 30], fill=col, outline=(90, 90, 90), width=2)
            d.ellipse([x + 5, y + 9, x + 13, y + 17], fill=(150, 110, 60))
            d.ellipse([x + 17, y + 9, x + 25, y + 17], fill=(150, 110, 60))

# ---------- scenes ----------
scenes = []
def scene(dur, cap=None, tone=None):
    def deco(fn):
        scenes.append((dur, fn, cap, tone)); return fn
    return deco

@scene(7)
def s_title(d, t):
    d.rectangle([0, 0, W, H], fill=NAVY)
    a = ease(t / 1.0)
    d.text((W // 2, 250), "プローブの使い方", font=F(80), fill=(255, 255, 255), anchor="mm")
    d.text((W // 2, 350), "MDFで電話線（お部屋の回線）を探す方法", font=F(40), fill=YELLOW, anchor="mm")
    d.line([W // 2 - int(400 * a), 410, W // 2 + int(400 * a), 410], fill=ORANGE, width=6)
    d.text((W // 2, 470), "エンジニアリング事業部　新人向け作業マニュアル", font=F(30), fill=WHITE, anchor="mm")
    d.text((W // 2, 640), "対象機種：グッドマン LANトーンプローブセット GM608（本体表記 NF-806B）", font=F(22), fill=(190, 200, 220), anchor="mm")

@scene(11, "お部屋から「音」を流して、MDFでその音を拾って探します")
def s_what(d, t):
    header(d, None, "プローブって何？ いつ使う？")
    # house
    d.polygon([(90, 300), (250, 190), (410, 300)], fill=(180, 90, 60))
    d.rectangle([110, 300, 390, 560], fill=(245, 235, 215), outline=GRAY, width=3)
    d.text((250, 318), "お部屋（住戸）", font=F(24), fill=BLACK, anchor="mm")
    draw_generator(d, 250, 440, blink=int(t * 3) % 2 == 0)
    # MDF
    draw_mdf(d, 860, 250, 7, 6, target=(3, 4) if t > 7 else None)
    # line with moving pulses
    d.line([320, 430, 700, 430, 700, 400, 845, 400], fill=(100, 100, 100), width=5)
    if t > 2:
        for k in range(4):
            s = ((t * 0.5 + k * 0.25) % 1.0)
            x = 320 + s * 380
            d.ellipse([x - 10, 420, x + 10, 440], fill=RED)
        d.text((510, 470), "ピー♪ という音（トーン）", font=F(26), fill=RED, anchor="mm")
    if t > 5:
        draw_probe(d, 860 + 4 * 46 + 15, 250 + 3 * 46 + 15, -40, level=0.8 if t > 7 else 0.3)
    d.text((640, 600), "どの線が何号室か分からない → 音で特定できる", font=F(30), fill=NAVY, anchor="mm")

@scene(12, "発信器（音を出す側）とプローブ（音を聞く側）はセットで使います")
def s_tools(d, t):
    header(d, None, "持ち物")
    draw_generator(d, 200, 330)
    d.text((200, 460), "① 発信器", font=F(28), fill=BLACK, anchor="mm")
    d.text((200, 495), "（トーン送信機）", font=F(22), fill=GRAY, anchor="mm")
    draw_probe(d, 330, 470, -60, level=0.6 if int(t * 2) % 2 else 0.0)
    d.text((470, 495), "② プローブ（受信機）", font=F(28), fill=BLACK, anchor="mm")
    bullets(d, ["③ RJ11ワニ口ケーブル（赤・黒クリップ）",
                "④ 予備の9V電池（006P）×2",
                "⑤ マーカー・タグ（見つけた線に目印）",
                "⑥ 付属イヤホン（うるさい場所用）",
                "⑦ 携帯電話（2人作業の連絡用）"], 700, 180, t, size=28, gap=66)

@scene(14, "安全第一！ 通話中の回線やベルが鳴っている線には触らない")
def s_safety(d, t):
    header(d, None, "作業前の安全確認")
    d.polygon([(150, 380), (270, 170), (390, 380)], fill=YELLOW, outline=BLACK, width=4)
    d.text((270, 310), "!", font=F(120), fill=BLACK, anchor="mm")
    bullets(d, ["お客様に「しばらく電話が使えない」ことを説明",
                "電話機・FAX・ルーター等をジャックから外す",
                "!電話線は待機時 約48V・着信時 約75V → 金属部に素手で触れない",
                "!本機の保護電圧は AC60V/DC42V → 着信・通話中はつながない",
                "MDFは共用設備。他の線を外したり動かしたりしない",
                "作業前に端子盤の写真を撮っておく"], 430, 150, t, size=25, gap=68)

@scene(12, "お部屋のモジュラージャックに発信器をつなぎます（電話機は外す）")
def s_step1(d, t):
    header(d, "STEP 1", "住戸側に発信器をつなぐ")
    draw_jack(d, 330, 330)
    a = ease((t - 1) / 3)
    gx = 900 - int(250 * a)
    draw_generator(d, gx, 360, blink=False)
    plug_x = 330 + 40 + int((1 - a) * 300)
    d.line([gx - 70, 360, plug_x + 40, 360], fill=BLACK, width=6)
    d.rectangle([plug_x, 345, plug_x + 45, 375], fill=(220, 220, 220), outline=BLACK, width=2)
    if t > 4.5:
        d.text((640, 540), "カチッと奥まで差し込む", font=F(32), fill=GREEN, anchor="mm")
    if t > 7:
        d.rounded_rectangle([80, 470, 1200, 610], 10, outline=ORANGE, width=3)
        d.text((640, 510), "ジャックが無い／外せない時は、ワニ口クリップで2本の線（L1・L2）をはさむ", font=F(24), fill=BLACK, anchor="mm")
        d.text((640, 560), "（赤・黒のクリップを1本ずつ。クリップ同士をくっつけない）", font=F(24), fill=GRAY, anchor="mm")

@scene(10, "発信器のスライドスイッチを「SCAN」に。STATUSランプが点滅すれば送信中です", tone="gen")
def s_step2(d, t):
    header(d, "STEP 2", "発信器を SCAN にする")
    draw_generator(d, 400, 360, blink=(t > 3 and int(t * 3) % 2 == 0))
    # switch
    d.rounded_rectangle([650, 250, 1050, 330], 10, fill=LIGHT, outline=GRAY, width=2)
    pos = 1 if t < 2.5 else 0
    for i, lab in enumerate(["SCAN", "OFF", "TEST"]):
        x = 700 + i * 130
        d.text((x, 290), lab, font=F(26), fill=ORANGE if i == pos else GRAY, anchor="mm")
    x = 700 + pos * 130
    d.rectangle([x - 45, 310, x + 45, 322], fill=ORANGE)
    if t > 3:
        d.text((850, 400), "STATUS 点滅 → OK", font=F(34), fill=GREEN, anchor="mm")
        d.text((850, 460), "点かない → 電池切れ・接続を確認", font=F(26), fill=RED, anchor="mm")
    if t > 5:
        d.text((850, 530), "※ SWITCHボタンで音色を2種類から切替できる", font=F(22), fill=GRAY, anchor="mm")

@scene(14, "PUSH TO TESTを押しながら端子盤をなぞり「音が大きいエリア」を探します", tone="sweep")
def s_step3(d, t):
    header(d, "STEP 3", "MDFでプローブを使う（大まかに探す）")
    x0, y0, cols, rows, p = 140, 270, 10, 7, 46
    target = (4, 7)
    draw_mdf(d, x0, y0, cols, rows)
    # sweep path: row by row snake over time
    s = max(0.0, min(1.0, (t - 1.5) / 11))
    pos = s * (rows * cols - 1)
    r = int(pos // cols); c = pos % cols
    if r % 2 == 1: c = cols - 1 - c
    tx = x0 + c * p + 15; ty = y0 + r * p + 15
    dist = math.hypot(r - target[0], c - target[1])
    lvl = max(0.0, 1.0 - dist / 4.0) * 0.75
    STATE["lvl"] = lvl
    draw_probe(d, tx, ty, -40, level=lvl)
    level_meter(d, 830, 560, lvl)
    d.text((830, 200), "① PUSH TO TEST を押し続ける", font=F(28), fill=BLACK)
    d.text((830, 250), "② 側面のダイヤルで音量を大きめ", font=F(28), fill=BLACK)
    d.text((830, 300), "③ 先端を端子に近づけて", font=F(28), fill=BLACK)
    d.text((870, 340), "ゆっくりなぞる", font=F(28), fill=BLACK)
    d.text((830, 400), "音が大きくなる方へ", font=F(28), fill=RED)
    d.text((870, 440), "近づいていく", font=F(28), fill=RED)

@scene(16, "感度を下げて1本ずつ当て、一番大きく・はっきり鳴る線が正解です", tone="pin")
def s_step4(d, t):
    header(d, "STEP 4", "1本ずつ当てて絞り込む")
    x0, y0, p = 170, 400, 100
    cand = 5; target = 3
    # big terminals row
    d.rounded_rectangle([x0 - 30, y0 - 60, x0 + cand * p + 10, y0 + 120], 10, fill=(200, 205, 215), outline=GRAY, width=3)
    d.text((x0 - 10, y0 - 50), "音が大きかったエリアを拡大", font=F(22), fill=BLACK)
    idx = min(cand - 1, int(max(0, t - 1.5) / 2.4))
    for i in range(cand):
        x = x0 + i * p
        col = (255, 170, 170) if (i == target and idx == target and t > 11) else (240, 240, 240)
        d.rectangle([x, y0, x + 60, y0 + 60], fill=col, outline=(90, 90, 90), width=2)
        d.ellipse([x + 10, y0 + 22, x + 24, y0 + 36], fill=(150, 110, 60))
        d.ellipse([x + 36, y0 + 22, x + 50, y0 + 36], fill=(150, 110, 60))
        d.text((x + 30, y0 + 85), f"{i + 1}", font=F(24), fill=BLACK, anchor="mm")
    near = {target: 1.0, target - 1: 0.35, target + 1: 0.35}
    lvl = near.get(idx, 0.12) if t > 1.5 else 0
    if t > 11: idx, lvl = target, 1.0
    STATE["lvl"] = lvl
    draw_probe(d, x0 + idx * p + 30, y0 + 30, -50, level=lvl)
    level_meter(d, 780, 560, lvl)
    d.text((780, 200), "・側面ダイヤルで音量を少し下げる", font=F(26), fill=BLACK)
    d.text((780, 245), "・先端を線に直接当てる", font=F(26), fill=BLACK)
    d.text((780, 290), "・隣の線もかすかに鳴るのは普通", font=F(26), fill=BLACK)
    d.text((780, 335), "　→「一番大きい」線を選ぶ", font=F(26), fill=RED)
    if t > 11:
        d.text((x0 + target * p + 30, y0 + 145), "コレ！", font=F(40), fill=RED, anchor="mm")

@scene(13, "発信器をOFFにすると音が消えるか確認。消えればその線で確定です", tone="confirm")
def s_step5(d, t):
    header(d, "STEP 5", "本当にその線か確認する")
    on = t < 6 or t > 10
    draw_generator(d, 250, 360, on=on, blink=on and int(t * 3) % 2 == 0)
    d.text((250, 490), "SCAN" if on else "OFF", font=F(36), fill=GREEN if on else RED, anchor="mm")
    lvl = 1.0 if on else 0.0
    STATE["lvl"] = lvl
    d.rectangle([640, 470, 760, 520], fill=(255, 170, 170), outline=BLACK, width=2)
    draw_probe(d, 700, 470, -55, level=lvl)
    d.text((900, 340), "発信器 SCAN → 鳴る", font=F(30), fill=BLACK)
    d.text((900, 390), "発信器 OFF  → 消える", font=F(30), fill=BLACK)
    d.text((900, 440), "＝ この線で確定！", font=F(30), fill=RED)
    d.text((640, 580), "2人作業なら携帯で「止めて」「つけて」と連絡しながら確認", font=F(26), fill=NAVY, anchor="mm")

@scene(10, "見つけた線にはタグで部屋番号を書き、写真を撮って記録します")
def s_step6(d, t):
    header(d, "STEP 6", "目印をつけて記録する")
    draw_mdf(d, 150, 230, 7, 5, target=(2, 3))
    tx, ty = 150 + 3 * 46 + 15, 230 + 2 * 46 + 30
    if t > 1.5:
        d.line([tx, ty, tx + 40, ty + 150], fill=BLACK, width=2)
        d.rounded_rectangle([tx - 20, ty + 150, tx + 140, ty + 210], 6, fill=WHITE, outline=BLACK, width=2)
        d.text((tx + 60, ty + 180), "〇〇〇号室", font=F(24), fill=BLACK, anchor="mm")
    bullets(d, ["タグに部屋番号・日付を書く",
                "端子盤の位置（何段目・何番）をメモ",
                "スマホで写真を撮る",
                "報告書・日報に記録する"], 640, 220, t - 2, size=30, gap=70)

@scene(12, "最後に発信器を回収し、電話機を戻して「ツー」音が出るか確認して完了")
def s_step7(d, t):
    header(d, "STEP 7", "片付けと復旧確認")
    bullets(d, ["!発信器をジャックから外す（置き忘れ注意！）",
                "外した電話機・FAX・ルーターを元に戻す",
                "受話器を上げて「ツー」音が出るか確認",
                "MDFの扉・カバーを元通り閉める",
                "発信器のスイッチを OFF に戻す（電池の消耗防止）"], 150, 170, t, size=32, gap=78)

@scene(14, "うまく見つからない時は、このチェックポイントを見直してみよう")
def s_tips(d, t):
    header(d, None, "コツ・よくある失敗")
    rows = [("どの線も同じくらい鳴る", "感度を下げる／先端を線に直接当てる"),
            ("どこも鳴らない", "PUSH TO TESTを押しているか／STATUS点滅を確認"),
            ("音が小さい・途切れる", "9V電池切れを疑う（両方）"),
            ("ワニ口の線で探しにくい", "L1かL2どちらか1本に当てて比べる"),
            ("周りがうるさくて聞こえない", "付属イヤホンを使う")]
    d.text((110, 130), "こんな時", font=F(26), fill=GRAY)
    d.text((620, 130), "こうする", font=F(26), fill=GRAY)
    for i, (a, b) in enumerate(rows):
        al = ease((t - 0.5 - i * 1.2) / 0.4)
        if al <= 0: continue
        y = 180 + i * 80
        d.rounded_rectangle([90, y, 560, y + 60], 8, fill=LIGHT)
        d.text((110, y + 30), a, font=F(26), fill=BLACK, anchor="lm")
        d.text((580, y + 30), "→", font=F(30), fill=ORANGE, anchor="lm")
        d.rounded_rectangle([620, y, 1200, y + 60], 8, fill=(255, 243, 225))
        d.text((640, y + 30), b, font=F(26), fill=BLACK, anchor="lm")

@scene(12)
def s_summary(d, t):
    header(d, None, "まとめ：5つの流れ")
    steps = ["住戸のジャックに発信器", "SCANでSTATUS点滅を確認", "MDFで大まかに探す", "1本ずつ当てて絞る", "SCAN/OFFで確定→記録→片付け"]
    for i, s in enumerate(steps):
        a = ease((t - 0.3 - i * 0.8) / 0.4)
        if a <= 0: continue
        y = 140 + i * 95
        d.ellipse([140, y, 210, y + 70], fill=ORANGE)
        d.text((175, y + 35), str(i + 1), font=F(36), fill=WHITE, anchor="mm")
        d.text((240, y + 35), s, font=F(36), fill=BLACK, anchor="lm")
    if t > 5:
        d.text((W // 2, 650), "分からない時は先輩に確認！　無理に線を外さない", font=F(30), fill=RED, anchor="mm")

STATE = {"lvl": 0.0}

# ---------- render ----------
SR = 44100
audio = array.array("h")
ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
silent = os.path.join(TMP, "video_noaudio.mp4")
proc = subprocess.Popen([ffmpeg, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
                         "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-c:v", "libx264",
                         "-pix_fmt", "yuv420p", "-crf", "22", silent], stdin=subprocess.PIPE)
spf = SR // FPS
phase = 0.0
for dur, fn, cap, tone in scenes:
    n = int(dur * FPS)
    for i in range(n):
        t = i / FPS
        STATE["lvl"] = 0.0
        img = Image.new("RGB", (W, H), WHITE)
        d = ImageDraw.Draw(img)
        fn(d, t)
        if cap: caption(d, cap)
        # fade in/out
        fade = min(1.0, t / 0.35, (dur - t) / 0.35)
        if fade < 1.0:
            img = Image.blend(Image.new("RGB", (W, H), (0, 0, 0)), img, max(0.0, fade))
        proc.stdin.write(img.tobytes())
        # audio: probe warble tone scaled by level
        amp = 0.0
        if tone in ("sweep", "pin", "confirm"):
            amp = STATE["lvl"] ** 1.5 * 0.35
        elif tone == "gen" and t > 3:
            amp = 0.12
        for k in range(spf):
            tt = t + k / SR
            f = 1000 if int(tt * 6) % 2 == 0 else 1250  # warble like a tone tracer
            phase += 2 * math.pi * f / SR
            audio.append(int(32767 * amp * fade * math.sin(phase)))
proc.stdin.close(); proc.wait()

wav = os.path.join(TMP, "tone.wav")
with wave.open(wav, "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(audio.tobytes())
subprocess.run([ffmpeg, "-y", "-loglevel", "error", "-i", silent, "-i", wav, "-c:v", "copy",
                "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart", OUT], check=True)
print("done", OUT, sum(s[0] for s in scenes), "sec")
