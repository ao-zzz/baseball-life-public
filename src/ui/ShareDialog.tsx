import { useEffect, useRef, useState } from 'react'
import type { LifeState } from '../engine/types.ts'
import { fullName, prefName } from '../engine/life.ts'
import { shownAge } from '../engine/displayAge.ts'
import { highestLabel } from '../engine/summary.ts'
import { ladderOf } from '../engine/ladder.ts'
import { brandName, postText, shareFacts, shareHighlights, shareText } from '../game/shareLink.ts'
import { t, wordSep } from '../i18n/index.ts'
import { placeName } from '../i18n/places.ts'
import { gameText as g } from '../i18n/game.ts'

// Opened only when the player presses a share button (PROJECT_PLAN §5.4 B4, §11.23). Nothing is sent anywhere unless the player
// chooses to post; copy and save happen on the device. The card says at a glance who he was, how far he got and how rare that is;
// the link is the game's page (it carried his birth until PROJECT_PLAN §11.62; a shared link now opens the title page as any visit).
// (the texts are in src/i18n, the card's too; his name and the stages are the game's words, through src/i18n/game.ts; the title comes
// in the language now)

export function ShareDialog({ life, title, rarityText, onClose }: { life: LifeState; title: string; rarityText: string | null; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [copied, setCopied] = useState(false)
  const [imageCopied, setImageCopied] = useState(false)
  const pngRef = useRef<Blob | null>(null)
  const fileRef = useRef<File | null>(null)
  const base = typeof location !== 'undefined' ? location.origin + location.pathname : ''
  // the link is the game's own page: whoever opens it starts a life of their own (PROJECT_PLAN §11.62)
  const url = base
  const text = shareText(life, title, rarityText, url)

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    const css = getComputedStyle(document.documentElement)
    const v = (n: string) => css.getPropertyValue(n).trim() || '#000'
    const W = 1080
    const H = 1500
    c.width = W
    c.height = H
    ctx.fillStyle = v('--surface')
    ctx.fillRect(0, 0, W, H)
    // band
    ctx.fillStyle = v('--accent')
    ctx.fillRect(0, 0, W, 110)
    ctx.fillStyle = v('--on-accent')
    ctx.font = `700 50px ${v('--font-serif')}`
    ctx.fillText(brandName(life.person.country), 60, 76)
    ctx.font = `28px ${v('--font-sans')}`
    ctx.textAlign = 'right'
    ctx.fillText(life.pot ? t('share.card.pot', { n: life.pot.stars ?? 1 }) : t('share.card.sim'), W - 60, 72)
    ctx.textAlign = 'left'
    // who
    ctx.fillStyle = v('--text-2')
    ctx.font = `32px ${v('--font-sans')}`
    ctx.fillText(t('share.card.who', { place: placeName(prefName(life)), from: life.person.birthYear, to: life.year, age: shownAge(life.age) }), 60, 190)
    ctx.fillStyle = v('--text')
    ctx.font = `700 104px ${v('--font-serif')}`
    ctx.fillText(g(fullName(life)), 60, 310)
    // how far: the ladder, filled up to the highest rung
    const ladder = ladderOf(life.person.country).slice(1)
    const top = life.career.highestRank
    const x0 = 60
    const step = (W - 120) / (ladder.length - 1)
    ctx.strokeStyle = v('--line')
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.moveTo(x0, 420)
    ctx.lineTo(W - 60, 420)
    ctx.stroke()
    ladder.forEach((r, i) => {
      const reached = r.rank <= top
      ctx.fillStyle = reached ? v('--teal') : v('--surface')
      ctx.strokeStyle = reached ? v('--teal') : v('--line')
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.arc(x0 + i * step, 420, r.rank === top ? 22 : 14, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    })
    ctx.fillStyle = v('--text-2')
    ctx.font = `26px ${v('--font-sans')}`
    ctx.fillText(g(ladder[0].short), x0 - 10, 480)
    ctx.textAlign = 'right'
    ctx.fillText(g(ladder[ladder.length - 1].short), W - 50, 480)
    ctx.textAlign = 'left'
    ctx.fillStyle = v('--text')
    ctx.font = `700 54px ${v('--font-serif')}`
    wrap(ctx, t('share.card.highest', { label: g(highestLabel(life)) }), 60, 570, W - 120, 66)
    // how rare
    if (rarityText) {
      ctx.fillStyle = v('--accent-weak')
      ctx.fillRect(60, 650, W - 120, 210)
      ctx.fillStyle = v('--text-2')
      ctx.font = `30px ${v('--font-sans')}`
      ctx.fillText(t('share.card.rarity'), 90, 710)
      ctx.fillStyle = v('--accent')
      ctx.font = `700 92px ${v('--font-serif')}`
      ctx.fillText(rarityText, 90, 815)
    }
    // the life in a few lines
    ctx.fillStyle = v('--text')
    ctx.font = `700 46px ${v('--font-serif')}`
    wrap(ctx, t('share.quote', { text: title }), 60, rarityText ? 950 : 740, W - 120, 58)
    ctx.font = `34px ${v('--font-sans')}`
    ctx.fillStyle = v('--text-2')
    shareHighlights(life).forEach((h, i) => ctx.fillText(t('share.card.item', { text: h }), 60, (rarityText ? 1040 : 840) + i * 52))
    // the figures of the life's end (model values; see shareFacts)
    const f = shareFacts(life)
    ctx.fillStyle = v('--accent-weak')
    ctx.fillRect(60, 1210, W - 120, 130)
    const colW = (W - 120) / 3
    ;(
      [
        [t('res.income'), f.income],
        [t('res.edu'), f.edu],
        [t('res.money'), f.money],
      ] as const
    ).forEach(([k, val], i) => {
      ctx.fillStyle = v('--text-2')
      ctx.font = `26px ${v('--font-sans')}`
      ctx.fillText(k, 80 + i * colW, 1255)
      ctx.fillStyle = v('--text')
      ctx.font = `700 40px ${v('--font-serif')}`
      ctx.fillText(val, 80 + i * colW, 1315)
    })
    // foot
    ctx.fillStyle = v('--text-3')
    ctx.font = `24px ${v('--font-sans')}`
    wrap(
      ctx,
      life.person.country === 'JP' ? t('share.card.foot.JP') : t('share.card.foot'),
      60,
      H - 96,
      W - 120,
      34,
    )
    // the card as a file, made ahead: the share menu and the clipboard must be called at once on the press (a phone refuses them later)
    c.toBlob((b) => {
      pngRef.current = b
      fileRef.current = b && typeof File === 'function' ? new File([b], `12man-${life.config.seed}.png`, { type: 'image/png' }) : null
    }, 'image/png')
  }, [life, title, rarityText])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }
  const save = () => {
    const c = canvasRef.current
    if (!c) return
    const a = document.createElement('a')
    a.href = c.toDataURL('image/png')
    a.download = `12man-${life.config.seed}.png`
    a.click()
  }
  // the post on X is the short text (X's limit); the copied text above stays the long one
  const short = postText(life, title, rarityText, url)
  const post = `https://x.com/intent/post?text=${encodeURIComponent(short)}`
  // on a phone the link opens X in the browser, where the player is often not signed in (the app is), and a link can carry no image:
  // the phone's own share menu hands the card and the text to the X app instead. Offered only where the browser has that menu and
  // the screen is a touch screen.
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function' && !!window.matchMedia?.('(pointer: coarse)').matches
  const shareMenu = async () => {
    const f = fileRef.current
    try {
      if (f && navigator.canShare?.({ files: [f] })) await navigator.share({ files: [f], text: short })
      else await navigator.share({ text: short })
    } catch {
      // closed by the player, or refused: nothing is sent
    }
  }
  // on a computer the X page cannot be handed an image: the card is put on the clipboard as the page opens, to paste into the post
  const copyImage = () => {
    const b = pngRef.current
    if (!b || typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) return
    navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]).then(
      () => setImageCopied(true),
      () => setImageCopied(false),
    )
  }

  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-labelledby="share-title" onClick={onClose}>
      <div className="dialog share" onClick={(e) => e.stopPropagation()}>
        <div className="hd">
          <span id="share-title">{t('share.this')}</span>
          <button type="button" className="btn sm" onClick={onClose}>
            {t('share.close')}
          </button>
        </div>
        <div className="bd">
          <p className="small muted">{t('share.intro')}</p>
          <canvas ref={canvasRef} aria-label={t('share.preview')} />
          <pre className="sharetext">{text}</pre>
          <div className="acts">
            <button type="button" className="btn" onClick={copy}>
              {copied ? t('share.copied') : t('share.copy')}
            </button>
            <button type="button" className="btn" onClick={save}>
              {t('share.save')}
            </button>
            {canShare ? (
              <>
                <button type="button" className="btn primary" onClick={shareMenu} style={{ gridColumn: '1 / -1' }}>
                  {t('share.app')}
                </button>
                <a className="btn" href={post} target="_blank" rel="noopener noreferrer" style={{ gridColumn: '1 / -1' }}>
                  {t('share.browser')}
                </a>
              </>
            ) : (
              <a className="btn" href={post} target="_blank" rel="noopener noreferrer" onClick={copyImage} style={{ gridColumn: '1 / -1' }}>
                {t('share.post')}
              </a>
            )}
          </div>
          {!canShare && (
            <p className="small muted">
              {imageCopied
                ? t('share.imageCopied')
                : t('share.imageAuto')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * a text on the card in lines of at most maxW: Japanese breaks at any character, English between words (a word wider than the card,
 * such as a stage's Japanese name, at any character too)
 */
function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) {
  let line = ''
  let yy = y
  const pieces = wordSep() === ' ' ? text.split(/(?<= )/).flatMap((w) => (ctx.measureText(w).width > maxW ? [...w] : [w])) : text
  for (const ch of pieces) {
    if (ctx.measureText(line + ch).width > maxW) {
      ctx.fillText(line, x, yy)
      line = ch
      yy += lh
    } else line += ch
  }
  if (line) ctx.fillText(line, x, yy)
}
