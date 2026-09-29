import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle,
                                PageBreak, KeepTogether)

HERE = os.path.dirname(os.path.abspath(__file__))
IMG = os.path.join(HERE, "pdf_img")
OUT = "/home/user/cursor/probe_manual/プローブの使い方_手順書.pdf"
pdfmetrics.registerFont(TTFont("IPAG", "/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf"))

NAVY = colors.HexColor("#142850"); ORANGE = colors.HexColor("#F08214")
RED = colors.HexColor("#D22828"); LIGHT = colors.HexColor("#EBF0F8"); CREAM = colors.HexColor("#FFF3E1")

def st(name, size, color=colors.black, lead=None, **kw):
    return ParagraphStyle(name, fontName="IPAG", fontSize=size, leading=lead or size * 1.55,
                          textColor=color, wordWrap="CJK", **kw)
TITLE = st("t", 24, NAVY, alignment=1)
SUB = st("s", 13, ORANGE, alignment=1)
H1 = st("h1", 15, colors.white)
BODY = st("b", 10.5)
SMALL = st("sm", 8.5, colors.grey)
STEPH = st("sh", 13, NAVY)
WARN = st("w", 10.5, RED)

CW = A4[0] - 30 * mm  # content width

def section(title):
    t = Table([[Paragraph(title, H1)]], colWidths=[CW])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), NAVY),
                           ("LEFTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 5),
                           ("BOTTOMPADDING", (0, 0), (-1, -1), 7)]))
    return [Spacer(1, 4 * mm), t, Spacer(1, 3 * mm)]

def img(name, width, maxh=55 * mm):
    from PIL import Image as P
    w, h = P.open(os.path.join(IMG, name + ".png")).size
    if width * h / w > maxh: width = maxh * w / h
    return Image(os.path.join(IMG, name + ".png"), width=width, height=width * h / w)

def bl(items, style=BODY):
    return [Paragraph(("<font color='#D22828'>■</font> " if i.startswith("!") else "・") + i.lstrip("!"),
                      WARN if i.startswith("!") else style) for i in items]

def step(no, title, image, items):
    head = Table([[Paragraph(f"STEP {no}", st("n", 11, colors.white, alignment=1)), Paragraph(title, STEPH)]],
                 colWidths=[22 * mm, CW - 22 * mm])
    head.setStyle(TableStyle([("BACKGROUND", (0, 0), (0, 0), ORANGE), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                              ("LINEBELOW", (0, 0), (-1, 0), 1, ORANGE)]))
    left = img(image, 78 * mm) if image else ""
    body = Table([[left, bl(items)]], colWidths=[82 * mm, CW - 82 * mm])
    body.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 2)]))
    return KeepTogether([head, Spacer(1, 2 * mm), body, Spacer(1, 4 * mm)])

def footer(c, doc):
    c.saveState(); c.setFont("IPAG", 8); c.setFillColor(colors.grey)
    c.drawString(15 * mm, 10 * mm, "プローブの使い方 手順書（MDFで電話線を探す）")
    c.drawRightString(A4[0] - 15 * mm, 10 * mm, f"{doc.page} ページ")
    c.restoreState()

s = []
s += [Paragraph("プローブの使い方　手順書", TITLE), Spacer(1, 2 * mm),
      Paragraph("MDFで電話線（お部屋の回線）を探す方法", SUB), Spacer(1, 1 * mm),
      Paragraph("エンジニアリング事業部　新人向け作業マニュアル　／　対象機種：グッドマン LANトーンプローブセット GM608（本体表記 NF-806B）", SMALL)]

s += section("1. プローブとは？ いつ使う？")
s += [img("what", CW * 0.8, 80 * mm), Spacer(1, 2 * mm)]
s += bl(["MDFの中で、どの線が何号室の電話線か分からない時に使います。",
         "お部屋側で<b>発信器</b>から「ピー」という音（トーン）を流し、MDFで<b>プローブ</b>を近づけてその音を拾い、線を特定します。"])

s += section("2. 持ち物")
tools = Table([[img("tools", 78 * mm), bl(["① 発信器（トーン送信機）", "② プローブ（受信機）",
                                           "③ RJ11ワニ口ケーブル（赤・黒クリップ）", "④ RJ11パッチケーブル", "⑤ 予備の9V電池（006P）×2",
                                           "⑥ 付属イヤホン（うるさい場所用）", "⑦ マーカー・タグ", "⑧ 携帯電話（2人作業の連絡用）"])]],
              colWidths=[82 * mm, CW - 82 * mm])
tools.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
s += [tools]

s += section("3. 作業前の安全確認")
warn = Table([[bl(["お客様に「しばらく電話が使えない」ことを説明する",
                   "電話機・FAX・ルーター等をジャックから外す",
                   "!電話線は待機時 約48V、着信時は約75Vの呼出信号が加わる → 金属部に素手で触れない",
                   "!本機（NF-806B）の保護電圧は AC60V／DC42V。着信中・通話中の線には絶対につながない",
                   "!MDFは共用設備。他の線を外したり動かしたりしない",
                   "作業前に端子盤の写真を撮っておく"])]], colWidths=[CW])
warn.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 1.5, RED), ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFF5F5")),
                          ("LEFTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 6),
                          ("BOTTOMPADDING", (0, 0), (-1, -1), 8)]))
s += [warn, PageBreak()]

s += section("4. 作業手順")
s += [step(1, "住戸側に発信器をつなぐ", "step1",
           ["電話機を外し、発信器の RJ11 口とモジュラージャックを RJ11パッチケーブルでつなぐ", "カチッと奥まで差し込む",
            "ジャックが使えない時は RJ11ワニ口ケーブルを発信器の RJ11 口に差し、赤・黒クリップで2本の線（L1・L2）をはさむ", "!クリップ同士をくっつけない"]),
      step(2, "発信器を SCAN にする", "step2",
           ["スライドスイッチを「SCAN」にする（OFF の左）", "STATUS ランプ点滅 → 信号が出ている（OK）", "!点滅しない → 9V電池・接続を確認",
            "SWITCH ボタンで音色を2種類から切り替えられる", "「TEST」はLANケーブルの導通テスト用（今回は使わない）"]),
      step(3, "MDFで大まかに探す", "step3",
           ["受信機の「PUSH TO TEST」ボタンを押している間だけ音が鳴る（SIGNALランプ点灯）", "側面のダイヤルで音量を大きめにする", "先端を端子に近づけて、端子盤全体をゆっくりなぞる",
            "音が大きくなる方へ近づいていく"]),
      step(4, "1本ずつ当てて絞り込む", "step4",
           ["側面のダイヤルで音量を少し下げる", "先端を線に直接当てて1本ずつ比べる", "隣の線もかすかに鳴るのは普通",
            "!「一番大きく・はっきり鳴る」線が正解"]),
      step(5, "本当にその線か確認する", "step5",
           ["発信器 SCAN → 鳴る／OFF → 消える ＝ その線で確定", "2人作業なら携帯で「止めて」「つけて」と連絡しながら確認",
            "1人作業なら住戸とMDFを往復して確認"]),
      step(6, "目印をつけて記録する", "step6",
           ["タグに部屋番号・日付を書いて付ける", "端子盤の位置（何段目・何番）をメモ", "スマホで写真を撮る",
            "報告書・日報に記録する"]),
      step(7, "片付けと復旧確認", None,
           ["!発信器をジャックから外す（置き忘れ注意！）", "外した電話機・FAX・ルーターを元に戻す",
            "受話器を上げて「ツー」音が出るか確認", "MDFの扉・カバーを元通り閉める",
            "発信器のスイッチを OFF に戻す（電池の消耗防止）", "ケースに戻す（ケースの番号を確認）"]),]

s += [PageBreak()]
s += section("5. 本機の仕様（GM608 ／ NF-806B）")
spec = [["項目", "内容"],
        ["製品名", "グッドマン LANトーンプローブセット GM608（本体表記 NOYAFA NF-806B）"],
        ["発信器の操作部", "スライドスイッチ SCAN（線探し）／OFF／TEST（LAN導通テスト）、SWITCHボタン、STATUS・VERIFYランプ、RJ11・RJ45口"],
        ["受信機の操作部", "PUSH TO TEST ボタン、SIGNAL ランプ、側面の音量ダイヤル、イヤホン端子、RJ45口（導通テスト用）"],
        ["電源", "9V電池（006P）× 各1個（発信器・受信機）"],
        ["探索距離", "最大 約2km"],
        ["トーン", "2種類切替（約900〜1000Hz）"],
        ["保護電圧", "AC60V ／ DC42V"],
        ["その他の機能", "LANケーブルの導通テスト（断線・ショート・クロス）、電話線の極性チェック"],
        ["付属品", "RJ11/RJ45パッチケーブル、RJ11ワニ口ケーブル、イヤホン、ケース、電池"]]
sp = Table([[Paragraph(a, BODY), Paragraph(b, BODY)] for a, b in spec], colWidths=[32 * mm, CW - 32 * mm])
sp.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), LIGHT), ("BACKGROUND", (0, 1), (0, -1), LIGHT),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey), ("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
s += [sp, Spacer(1, 2 * mm), Paragraph("※ 販売店・メーカー公開情報より。細部は付属の取扱説明書で確認してください。", SMALL)]


s += section("6. コツ・よくある失敗")
rows = [[Paragraph("こんな時", BODY), Paragraph("こうする", BODY)]] + [
    [Paragraph(a, BODY), Paragraph(b, BODY)] for a, b in [
        ("どの線も同じくらい鳴る", "感度を下げる／先端を線に直接当てる"),
        ("どこも鳴らない", "PUSH TO TEST を押しているか／STATUS が点滅しているか確認"),
        ("音が小さい・途切れる", "9V電池切れを疑う（発信器・受信機の両方）"),
        ("周りがうるさくて聞こえない", "付属イヤホンを使う"),
        ("ワニ口の線で探しにくい", "L1かL2どちらか1本に当てて比べる"),
        ("発信器を置き忘れた", "下の作業チェックリストを必ず実施")]]
tips = Table(rows, colWidths=[CW * 0.42, CW * 0.58])
tips.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), LIGHT), ("BACKGROUND", (1, 1), (1, -1), CREAM),
                          ("GRID", (0, 0), (-1, -1), 0.5, colors.grey), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                          ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
s += [tips]

s += [PageBreak()]
s += section("7. 作業チェックリスト（現場で記入）")
info = Table([[Paragraph(x, BODY), ""] for x in ["物件名・番号", "作業日", "作業者", "部屋番号", "端子位置（段・番）"]],
             colWidths=[40 * mm, CW - 40 * mm])
info.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.5, colors.grey), ("BACKGROUND", (0, 0), (0, -1), LIGHT),
                          ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 8)]))
s += [info, Spacer(1, 4 * mm)]
checks = ["お客様に説明した", "電話機・FAX・ルーターを外した", "発信器をつないで SCAN、STATUS 点滅を確認",
          "MDFで音が大きいエリアを見つけた", "1本ずつ当てて一番大きい線を見つけた", "発信器 SCAN/OFF で確定した",
          "タグ・メモ・写真で記録した", "発信器を回収した（置き忘れなし）", "電話機を戻して「ツー」音を確認した",
          "MDFの扉・カバーを閉めた"]
ck = Table([["□", Paragraph(c, BODY)] for c in checks], colWidths=[10 * mm, CW - 10 * mm])
ck.setStyle(TableStyle([("FONT", (0, 0), (0, -1), "IPAG", 14), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                        ("LINEBELOW", (0, 0), (-1, -1), 0.3, colors.lightgrey)]))
s += [ck, Spacer(1, 5 * mm), Paragraph("分からない時は先輩に確認！　無理に線を外さない", st("end", 12, RED, alignment=1))]


doc = SimpleDocTemplate(OUT, pagesize=A4, leftMargin=15 * mm, rightMargin=15 * mm, topMargin=14 * mm,
                        bottomMargin=16 * mm, title="プローブの使い方 手順書", author="エンジニアリング事業部")
doc.build(s, onFirstPage=footer, onLaterPages=footer)
print("ok", OUT)
