import React from 'react'
import {
  AbsoluteFill,
  Freeze,
  OffthreadVideo,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'
import { loadFont as loadFraunces } from '@remotion/google-fonts/Fraunces'
import { loadFont as loadFigtree } from '@remotion/google-fonts/Figtree'
import clipManifest from './clips.json'

/**
 * Shared furniture for the Nestor demo.
 *
 * Nestor is a concierge, so the film is set like a printed thing: warm paper,
 * forest ink, a serif that speaks and a sans that labels, hairline rules, and
 * one clay accent used sparingly. Motion is unhurried: things rise a short way
 * and settle, or are uncovered along a rule. Nothing bounces and nothing spins.
 */

/* ------------------------------------------------------------------ palette */

export const PAPER = '#FAF6EF'
export const PAPER_DEEP = '#F2EBDF'
export const CARD = '#FFFDF9'
export const HAIRLINE = '#E6DCCB'
export const INK = '#1C2621'
export const INK_SOFT = '#4A564F'
export const INK_FAINT = '#7D877F'
export const FOREST = '#1F4D3A'
export const FOREST_DEEP = '#163828'
export const FOREST_TINT = '#DFEAE3'
export const MOSS = '#5B7F6A'
export const CLAY = '#C2512F'
export const CLAY_TINT = '#F6E2D9'
export const HONEY = '#B97D10'
export const HONEY_TINT = '#F6EAD0'
export const CREAM = '#F6F0E4'

/* -------------------------------------------------------------------- fonts */

const fraunces = loadFraunces('normal', { weights: ['400', '500', '600'], subsets: ['latin'] })
loadFraunces('italic', { weights: ['400', '500'], subsets: ['latin'] })
const figtree = loadFigtree('normal', { weights: ['400', '500', '600', '700'], subsets: ['latin'] })

export const SERIF = `${fraunces.fontFamily}, "Iowan Old Style", Georgia, serif`
export const SANS = `${figtree.fontFamily}, ui-sans-serif, system-ui, sans-serif`

export const SITE = 'standing-elephant-306.convex.site'

/* ------------------------------------------------------------------- motion */

const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

export const easeOut = (p: number) => 1 - Math.pow(1 - p, 3)
export const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)

/** 0 to 1 over `dur` frames starting at `delay`, eased out. The one curve used everywhere. */
export const useProgress = (delay = 0, dur = 22) => {
  const f = useCurrentFrame()
  return easeOut(interpolate(f, [delay, delay + dur], [0, 1], CLAMP))
}

/** Rise-and-settle entrance. With `out`, the same move in reverse at that frame. */
export const useRise = (delay = 0, distance = 22, out?: number) => {
  const f = useCurrentFrame()
  const pin = easeOut(interpolate(f, [delay, delay + 22], [0, 1], CLAMP))
  const pout = out === undefined ? 0 : easeInOut(interpolate(f, [out, out + 14], [0, 1], CLAMP))
  return {
    opacity: pin * (1 - pout),
    transform: `translateY(${(1 - pin) * distance - pout * 12}px)`,
  }
}

export const Rise: React.FC<{
  children: React.ReactNode
  delay?: number
  distance?: number
  out?: number
  style?: React.CSSProperties
}> = ({ children, delay = 0, distance = 22, out, style }) => (
  <div style={{ ...useRise(delay, distance, out), ...style }}>{children}</div>
)

/** A rule that draws itself from one end. */
export const Hairline: React.FC<{
  delay?: number
  width?: number | string
  color?: string
  weight?: number
  out?: number
  origin?: 'left' | 'right'
}> = ({ delay = 0, width = '100%', color = HAIRLINE, weight = 2, out, origin = 'left' }) => {
  const f = useCurrentFrame()
  const p = easeInOut(interpolate(f, [delay, delay + 26], [0, 1], CLAMP))
  const o = out === undefined ? 1 : 1 - interpolate(f, [out, out + 14], [0, 1], CLAMP)
  return (
    <div
      style={{
        width,
        height: weight,
        background: color,
        opacity: o,
        transform: `scaleX(${p})`,
        transformOrigin: `${origin} center`,
      }}
    />
  )
}

/**
 * Uncovers its children from behind an edge, as if sliding out from under a rule.
 * `from="below"` rises out of its own baseline; `from="above"` drops from a rule on top.
 */
export const Reveal: React.FC<{
  children: React.ReactNode
  delay?: number
  dur?: number
  from?: 'below' | 'above'
  out?: number
  style?: React.CSSProperties
}> = ({ children, delay = 0, dur = 24, from = 'below', out, style }) => {
  const f = useCurrentFrame()
  const pin = easeOut(interpolate(f, [delay, delay + dur], [0, 1], CLAMP))
  const pout = out === undefined ? 0 : easeInOut(interpolate(f, [out, out + 16], [0, 1], CLAMP))
  const sign = from === 'below' ? 1 : -1
  const shift = (1 - pin) * 104 * sign + pout * 104 * sign
  return (
    <div style={{ overflow: 'hidden', paddingBottom: 4, marginBottom: -4, ...style }}>
      <div style={{ transform: `translateY(${shift}%)`, opacity: Math.min(1, pin * 3) }}>{children}</div>
    </div>
  )
}

/* ----------------------------------------------------------------- backdrop */

/**
 * Warm paper with a fine dot screen and a soft vignette. `tone="forest"` is the
 * cover stock, used for the title and the close.
 */
export const Backdrop: React.FC<{ tone?: 'paper' | 'forest'; arch?: 'left' | 'right' | 'none' }> = ({
  tone = 'paper',
  arch = 'none',
}) => {
  const f = useCurrentFrame()
  const forest = tone === 'forest'
  const dot = forest ? 'rgba(246,240,228,.075)' : 'rgba(125,110,80,.17)'
  const drift = Math.sin(f / 140) * 10
  return (
    <AbsoluteFill style={{ background: forest ? FOREST_DEEP : PAPER }}>
      <AbsoluteFill
        style={{
          background: forest
            ? 'radial-gradient(120% 90% at 30% 35%, rgba(47,106,80,.55) 0%, rgba(22,56,40,0) 60%)'
            : 'radial-gradient(110% 90% at 72% 30%, rgba(255,253,249,.95) 0%, rgba(250,246,239,0) 62%)',
        }}
      />
      {arch !== 'none' && (
        <div
          style={{
            position: 'absolute',
            [arch]: -170,
            bottom: -80,
            width: 860,
            height: 1040,
            borderRadius: '430px 430px 0 0',
            background: forest ? 'rgba(246,240,228,.035)' : 'rgba(226,214,192,.34)',
            transform: `translateY(${drift}px)`,
          }}
        />
      )}
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(${dot} 1.3px, transparent 1.6px)`,
          backgroundSize: '26px 26px',
        }}
      />
      <AbsoluteFill
        style={{
          background: forest
            ? 'radial-gradient(ellipse at center, rgba(0,0,0,0) 52%, rgba(6,20,13,.5) 100%)'
            : 'radial-gradient(ellipse at center, rgba(0,0,0,0) 58%, rgba(120,98,62,.13) 100%)',
        }}
      />
    </AbsoluteFill>
  )
}

/* --------------------------------------------------------------------- type */

export const Eyebrow: React.FC<{
  children: React.ReactNode
  delay?: number
  color?: string
  size?: number
  out?: number
}> = ({ children, delay = 0, color = MOSS, size = 24, out }) => (
  <div
    style={{
      ...useRise(delay, 12, out),
      fontFamily: SANS,
      fontSize: size,
      fontWeight: 600,
      letterSpacing: '0.2em',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
      color,
    }}
  >
    {children}
  </div>
)

/**
 * Serif headline. Pass `lines`; a line given as `{ em: '...' }` is set in clay
 * italic. Each line is uncovered from its own baseline, a few frames apart.
 */
export type HeadLine = string | { em: string }
export const Headline: React.FC<{
  lines: HeadLine[]
  delay?: number
  size?: number
  color?: string
  emColor?: string
  stagger?: number
  out?: number
  align?: 'left' | 'center'
}> = ({ lines, delay = 0, size = 76, color = INK, emColor = CLAY, stagger = 6, out, align = 'left' }) => (
  <div
    style={{
      fontFamily: SERIF,
      fontSize: size,
      lineHeight: 1.08,
      letterSpacing: '-0.022em',
      fontWeight: 500,
      color,
      textAlign: align,
    }}
  >
    {lines.map((l, i) => (
      <Reveal key={i} delay={delay + i * stagger} out={out} style={{ paddingBottom: size * 0.16, marginBottom: -size * 0.16 }}>
        {typeof l === 'string' ? (
          <span>{l}</span>
        ) : (
          <span style={{ fontStyle: 'italic', fontWeight: 400, color: emColor }}>{l.em}</span>
        )}
      </Reveal>
    ))}
  </div>
)

export const Body: React.FC<{
  children: React.ReactNode
  delay?: number
  size?: number
  color?: string
  width?: number
  out?: number
}> = ({ children, delay = 0, size = 30, color = INK_SOFT, width = 560, out }) => (
  <div
    style={{
      ...useRise(delay, 18, out),
      fontFamily: SANS,
      fontSize: size,
      lineHeight: 1.45,
      color,
      maxWidth: width,
    }}
  >
    {children}
  </div>
)

/** Large serif numeral for a step, in clay. */
export const StepNumber: React.FC<{ n: number | string; delay?: number; size?: number; out?: number }> = ({
  n,
  delay = 0,
  size = 120,
  out,
}) => (
  <Reveal delay={delay} out={out}>
    <div
      style={{
        fontFamily: SERIF,
        fontSize: size,
        lineHeight: 0.95,
        fontWeight: 400,
        letterSpacing: '-0.03em',
        color: CLAY,
        fontFeatureSettings: '"lnum" 1',
      }}
    >
      {typeof n === 'number' ? String(n).padStart(2, '0') : n}
    </div>
  </Reveal>
)

/* -------------------------------------------------------------------- brand */

/** A brand PNG used as a mask, so the same artwork can be inked in any colour. */
export const Tinted: React.FC<{
  src: string
  width: number
  height: number
  color: string
  style?: React.CSSProperties
}> = ({ src, width, height, color, style }) => {
  const url = `url(${staticFile(src)})`
  return (
    <div
      style={{
        width,
        height,
        background: color,
        WebkitMaskImage: url,
        maskImage: url,
        WebkitMaskSize: '100% 100%',
        maskSize: '100% 100%',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        ...style,
      }}
    />
  )
}

/** The doorway mark (brand/mark-mask.png is 560x800). */
export const Mark: React.FC<{ height?: number; color?: string; style?: React.CSSProperties }> = ({
  height = 120,
  color = FOREST,
  style,
}) => <Tinted src="brand/mark-mask.png" width={(height * 560) / 800} height={height} color={color} style={style} />

/** The word "Nestor" as drawn in the lockup (brand/word-mask.png is 661x200). */
export const Wordmark: React.FC<{ height?: number; color?: string }> = ({ height = 120, color = FOREST }) => (
  <Tinted src="brand/word-mask.png" width={(height * 661) / 200} height={height} color={color} />
)

/**
 * Mark and word together with a quiet entrance: the doorway is uncovered from
 * its threshold upwards, then the word slides out from behind it.
 */
export const Lockup: React.FC<{ height?: number; delay?: number; color?: string }> = ({
  height = 150,
  delay = 0,
  color = FOREST,
}) => {
  const f = useCurrentFrame()
  const door = easeInOut(interpolate(f, [delay, delay + 26], [0, 1], CLAMP))
  const word = easeOut(interpolate(f, [delay + 14, delay + 42], [0, 1], CLAMP))
  const wordH = height * 0.66
  const wordW = (wordH * 661) / 200
  const gap = height * 0.2
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ clipPath: `inset(${(1 - door) * 100}% 0 0 0)`, transform: `translateY(${(1 - door) * 10}px)` }}>
        <Mark height={height} color={color} />
      </div>
      <div
        style={{
          width: (wordW + gap) * word,
          overflow: 'hidden',
          height,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <div style={{ paddingLeft: gap, opacity: Math.min(1, word * 1.6), transform: `translateX(${(1 - word) * -28}px)` }}>
          <Wordmark height={wordH} color={color} />
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------- small parts */

export const Card: React.FC<{
  children: React.ReactNode
  delay?: number
  pad?: number
  width?: number | string
  out?: number
  style?: React.CSSProperties
}> = ({ children, delay = 0, pad = 32, width, out, style }) => (
  <div
    style={{
      ...useRise(delay, 22, out),
      width,
      background: CARD,
      border: `1.5px solid ${HAIRLINE}`,
      borderRadius: 20,
      padding: pad,
      boxShadow: '0 1px 0 rgba(255,255,255,.9) inset, 0 26px 50px -34px rgba(60,44,20,.34), 0 3px 8px -4px rgba(60,44,20,.10)',
      ...style,
    }}
  >
    {children}
  </div>
)

const CHIP_TONES = {
  forest: { bg: FOREST_TINT, fg: FOREST },
  clay: { bg: CLAY_TINT, fg: CLAY },
  honey: { bg: HONEY_TINT, fg: '#8A5C08' },
  plain: { bg: PAPER_DEEP, fg: INK_SOFT },
} as const

/** The product's own pill. */
export const Chip: React.FC<{
  children: React.ReactNode
  tone?: keyof typeof CHIP_TONES
  delay?: number
  size?: number
  dot?: boolean
  out?: number
}> = ({ children, tone = 'forest', delay = 0, size = 22, dot, out }) => {
  const t = CHIP_TONES[tone]
  return (
    <span
      style={{
        ...useRise(delay, 10, out),
        display: 'inline-flex',
        alignItems: 'center',
        gap: size * 0.42,
        fontFamily: SANS,
        fontSize: size,
        fontWeight: 600,
        lineHeight: 1,
        color: t.fg,
        background: t.bg,
        borderRadius: 999,
        padding: `${size * 0.42}px ${size * 0.72}px`,
        whiteSpace: 'nowrap',
      }}
    >
      {dot && <span style={{ width: size * 0.36, height: size * 0.36, borderRadius: 99, background: t.fg }} />}
      {children}
    </span>
  )
}

/** A short on-screen phrase that echoes the narration, set as a pull quote. */
export const Caption: React.FC<{
  children: React.ReactNode
  from?: number
  to?: number
  size?: number
  width?: number
  rule?: string
}> = ({ children, from = 0, to, size = 31, width = 470, rule = CLAY }) => {
  const f = useCurrentFrame()
  const line = easeInOut(interpolate(f, [from, from + 22], [0, 1], CLAMP))
  const out = to === undefined ? 1 : 1 - interpolate(f, [to, to + 14], [0, 1], CLAMP)
  return (
    <div style={{ display: 'flex', gap: 22, width, opacity: out }}>
      <div style={{ width: 3, background: rule, transform: `scaleY(${line})`, transformOrigin: 'top', flexShrink: 0 }} />
      <div
        style={{
          ...useRise(from + 6, 14),
          fontFamily: SERIF,
          fontStyle: 'italic',
          fontWeight: 400,
          fontSize: size,
          lineHeight: 1.32,
          color: INK,
          padding: '2px 0 4px',
        }}
      >
        {children}
      </div>
    </div>
  )
}

/**
 * Lower third naming who is doing the work. A rule draws, the name rises out
 * from behind it and the role drops from under it. Text only: no sponsor logos.
 */
export const SponsorLabel: React.FC<{
  name: string
  role: string
  from?: number
  to?: number
  width?: number
  kicker?: string
}> = ({ name, role, from = 0, to, width = 520, kicker = 'Doing the work' }) => {
  const f = useCurrentFrame()
  if (f < from - 1 || (to !== undefined && f > to + 20)) return null
  return (
    <div style={{ width }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Reveal delay={from + 8} out={to}>
          <div style={{ fontFamily: SERIF, fontSize: 46, fontWeight: 500, letterSpacing: '-0.015em', color: INK, lineHeight: 1.12 }}>
            {name}
          </div>
        </Reveal>
        <Reveal delay={from + 14} out={to}>
          <div
            style={{
              fontFamily: SANS,
              fontSize: 19,
              fontWeight: 600,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: MOSS,
            }}
          >
            {kicker}
          </div>
        </Reveal>
      </div>
      <div style={{ height: 10 }} />
      <Hairline delay={from} color={FOREST} weight={2} out={to} />
      <div style={{ height: 12 }} />
      <Reveal delay={from + 14} from="above" out={to}>
        <div style={{ fontFamily: SANS, fontSize: 24, lineHeight: 1.3, color: INK_SOFT, whiteSpace: 'nowrap' }}>{role}</div>
      </Reveal>
    </div>
  )
}

/** A very thin forest line along the bottom edge: where we are in the film. */
export const ProgressRail: React.FC<{ total: number; color?: string }> = ({ total, color = FOREST }) => {
  const f = useCurrentFrame()
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, background: 'rgba(31,77,58,.10)' }} />
      <div
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          height: 4,
          width: `${(f / Math.max(1, total - 1)) * 100}%`,
          background: color,
        }}
      />
    </AbsoluteFill>
  )
}

/* ------------------------------------------------------------ browser frame */

/**
 * The page is 1600x900 CSS pixels. FOCUS rectangles are always given in those
 * pixels, whatever the clip's own pixel size: the beats re-filmed at device
 * scale 2 are 3200x1800 files of the same 1600x900 page, and BrowserFrame lays
 * every clip out at the same CSS size. The extra pixels buy depth, not width.
 */
export const SRC_W = 1600
export const SRC_H = 900

export type Focus = {
  /** Target in CSS pixels of the 1600x900 page: [x, y, width, height]. */
  rect: [number, number, number, number]
  /** Scene seconds at which the camera starts moving in, and starts leaving. */
  from: number
  to: number
  /** Seconds the move takes. */
  move?: number
  /** Upper bound on the camera's zoom. */
  maxZoom?: number
  /**
   * Largest enlargement of the page on the canvas for this move, overriding the
   * frame's. 1.4 is all a 1600px take will carry; a 3200px take holds 2 cleanly.
   */
  maxMag?: number
}

export type Shot = {
  /** File name in public/clips without the extension. */
  clip: string
  /** Scene seconds at which this shot cuts in (the first is normally 0). */
  at?: number
  /** Seconds into the clip to start from. */
  startFrom?: number
  playbackRate?: number
  /** Holds the frame at `startFrom` instead of playing: a beat on one section. */
  freeze?: boolean
  /** Path shown after the host in the address pill. */
  path?: string
  /** Marks the shot as faster than real time: a quiet "Sped up" note shows in the title bar. */
  fast?: boolean
  /**
   * Frames of cross-fade into this shot. 0 is a straight cut, which is what two
   * views of the same page want: dissolving near-identical frames doubles the text.
   */
  dissolve?: number
}

type Cam = { cx: number; cy: number; z: number }
const FULL: Cam = { cx: SRC_W / 2, cy: SRC_H / 2, z: 1 }

/**
 * `zCap` is how far the camera may push before the picture on the canvas is
 * larger than the frame's `maxMag`; a focus may raise it for its own move.
 */
const camFor = (fo: Focus, zCap: number, capFor: (m: number) => number): Cam => {
  const [x, y, w, h] = fo.rect
  const cap = fo.maxMag === undefined ? zCap : capFor(fo.maxMag)
  const z = Math.max(1, Math.min(fo.maxZoom ?? 4, cap, Math.min(SRC_W / w, SRC_H / h) * 0.92))
  const half = { w: SRC_W / 2 / z, h: SRC_H / 2 / z }
  return {
    z,
    cx: Math.min(SRC_W - half.w, Math.max(half.w, x + w / 2)),
    cy: Math.min(SRC_H - half.h, Math.max(half.h, y + h / 2)),
  }
}

const cameraAt = (t: number, focus: Focus[], zCap: number, capFor: (m: number) => number): Cam => {
  const sorted = [...focus].sort((a, b) => a.from - b.from)
  // A focus that starts at or before zero opens the scene already pushed in.
  const open = sorted[0] && sorted[0].from <= 0 ? camFor(sorted[0], zCap, capFor) : FULL
  const keys: { t: number; c: Cam }[] = [{ t: 0, c: open }]
  sorted.forEach((fo, i) => {
    const move = fo.move ?? 1.2
    const last = keys[keys.length - 1]
    keys.push({ t: Math.max(fo.from, last.t), c: last.c })
    keys.push({ t: Math.max(fo.from, last.t) + move, c: camFor(fo, zCap, capFor) })
    keys.push({ t: Math.max(fo.to, fo.from + move), c: camFor(fo, zCap, capFor) })
    const next = sorted[i + 1]
    if (!next || next.from > fo.to + move) keys.push({ t: fo.to + move, c: FULL })
  })
  for (let i = keys.length - 1; i >= 0; i--) {
    if (t >= keys[i].t) {
      const a = keys[i]
      const b = keys[i + 1]
      if (!b || b.t === a.t) return a.c
      const p = easeInOut(Math.min(1, (t - a.t) / (b.t - a.t)))
      return {
        cx: a.c.cx + (b.c.cx - a.c.cx) * p,
        cy: a.c.cy + (b.c.cy - a.c.cy) * p,
        z: a.c.z + (b.c.z - a.c.z) * p,
      }
    }
  }
  return FULL
}

const manifest = clipManifest as Record<string, { duration: number | null; width?: number | null }>
export const hasClip = (name: string) => Object.prototype.hasOwnProperty.call(manifest, name)

/** Source pixels per CSS pixel: 2 for the takes filmed at device scale 2. */
export const dprOf = (name: string) => (manifest[name]?.width ?? SRC_W) / SRC_W

/** Plays one clip and holds its last frame if the scene outlasts it. */
const ShotVideo: React.FC<{ shot: Shot }> = ({ shot }) => {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  const rate = shot.playbackRate ?? 1
  const start = shot.startFrom ?? 0
  const length = manifest[shot.clip]?.duration ?? null
  const lastFrame = length === null ? Infinity : Math.max(0, Math.floor(((length - start) / rate - 0.2) * fps))
  return (
    <Freeze frame={shot.freeze ? 0 : Math.min(f, lastFrame)}>
      <OffthreadVideo
        src={staticFile(`clips/${shot.clip}.mp4`)}
        startFrom={Math.round(start * fps)}
        playbackRate={rate}
        muted
        style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover' }}
      />
    </Freeze>
  )
}

/** Stands in for footage that has not been recorded yet. */
const MissingClip: React.FC<{ name: string }> = ({ name }) => (
  <AbsoluteFill
    style={{
      background: PAPER_DEEP,
      backgroundImage: 'radial-gradient(rgba(125,110,80,.16) 1.3px, transparent 1.6px)',
      backgroundSize: '26px 26px',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 44 }}>
      <Mark height={190} color="rgba(31,77,58,.20)" />
      <div>
        <div
          style={{
            fontFamily: SANS,
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: MOSS,
          }}
        >
          Footage to come
        </div>
        <div style={{ height: 10 }} />
        <div style={{ fontFamily: SERIF, fontSize: 56, fontWeight: 500, letterSpacing: '-0.02em', color: INK }}>
          clips/{name}.mp4
        </div>
        <div style={{ height: 10 }} />
        <div style={{ fontFamily: SANS, fontSize: 25, color: INK_SOFT }}>
          1600 x 900, then run <span style={{ color: FOREST, fontWeight: 600 }}>npm run clips</span>
        </div>
      </div>
    </div>
  </AbsoluteFill>
)

/**
 * A restrained browser window around captured footage.
 *
 * `shots` are cut inside one window, each cross-dissolving into the next.
 * `focus` moves a virtual camera over the 1600x900 footage: it eases toward a
 * rectangle, holds, and eases back (or on to the next rectangle).
 * `pushIn` is the slow scale of the whole window across the scene.
 */
export const BrowserFrame: React.FC<{
  shots: Shot[]
  width?: number
  delay?: number
  /** Scene length in frames, used to pace the push-in. */
  dur?: number
  pushIn?: [number, number]
  focus?: Focus[]
  origin?: string
  /** Largest enlargement of the 1600px footage on the canvas. */
  maxMag?: number
}> = ({ shots, width = 1260, delay = 0, dur = 360, pushIn = [1, 1.035], focus = [], origin = 'center center', maxMag }) => {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = easeOut(interpolate(f, [delay, delay + 26], [0, 1], CLAMP))
  const push = interpolate(f, [0, dur], pushIn, CLAMP)

  const BAR = 50
  const vw = width
  const vh = (width * SRC_H) / SRC_W
  const k = vw / SRC_W
  // Without a figure given, every clip in the scene is held to what the softest
  // of them will carry: 1.4x for a 1600px take, 2x for one filmed at scale 2.
  const auto = Math.min(...shots.map((sh) => (dprOf(sh.clip) >= 2 ? 2 : 1.4)))
  const capFor = (m: number) => m / (k * pushIn[1])
  const cam = cameraAt(f / fps, focus, capFor(maxMag ?? auto), capFor)
  const tx = vw / 2 - cam.cx * k * cam.z
  const ty = vh / 2 - cam.cy * k * cam.z

  const cuts = shots.map((sh) => Math.round((sh.at ?? 0) * fps))
  let active = 0
  cuts.forEach((c, i) => {
    if (f >= c) active = i
  })
  const fadeOf = (i: number) => (i === 0 ? 0 : Math.round(shots[i].dissolve ?? 8))

  return (
    <div
      style={{
        width,
        opacity: enter,
        transform: `translateY(${(1 - enter) * 30}px) scale(${push})`,
        transformOrigin: origin,
        borderRadius: 14,
        overflow: 'hidden',
        background: CARD,
        border: `1.5px solid ${HAIRLINE}`,
        boxShadow:
          '0 70px 120px -60px rgba(50,36,14,.50), 0 24px 44px -28px rgba(50,36,14,.28), 0 2px 6px rgba(50,36,14,.06)',
      }}
    >
      <div
        style={{
          height: BAR,
          display: 'flex',
          alignItems: 'center',
          padding: '0 20px',
          background: PAPER_DEEP,
          borderBottom: `1.5px solid ${HAIRLINE}`,
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', gap: 9 }}>
          {['#D9A79A', '#E2CB97', '#A9C2AE'].map((c) => (
            <span key={c} style={{ width: 13, height: 13, borderRadius: 99, background: c }} />
          ))}
        </div>
        <div
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            height: 36,
            minWidth: 520,
            padding: '0 22px',
            borderRadius: 99,
            background: CARD,
            border: `1.5px solid ${HAIRLINE}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            fontFamily: SANS,
            fontSize: 22,
            fontWeight: 500,
            color: INK_SOFT,
          }}
        >
          <svg width="13" height="15" viewBox="0 0 13 15" fill="none">
            <rect x="1" y="6.4" width="11" height="7.6" rx="2" fill={MOSS} />
            <path d="M3.6 6.4V4.3a2.9 2.9 0 015.8 0v2.1" stroke={MOSS} strokeWidth="1.6" />
          </svg>
          <span>
            {SITE}
            <span style={{ color: INK_FAINT }}>{shots[active]?.path ?? ''}</span>
          </span>
        </div>
        {/* One note per run of fast shots, so it does not blink at a cut inside the run. */}
        {shots.map((sh, i) => {
          if (!sh.fast || (i > 0 && shots[i - 1].fast)) return null
          let end = i
          while (end + 1 < shots.length && shots[end + 1].fast) end += 1
          const a = cuts[i]
          const b = end + 1 < shots.length ? cuts[end + 1] : Infinity
          const o = Math.min(
            interpolate(f, [a, a + 8], [0, 1], CLAMP),
            b === Infinity ? 1 : interpolate(f, [b - 2, b + 8], [1, 0], CLAMP),
          )
          if (o <= 0) return null
          return (
            <div
              key={`fast-${i}`}
              style={{
                position: 'absolute',
                right: 20,
                top: 6,
                height: 38,
                padding: '0 19px',
                borderRadius: 99,
                border: `1.5px solid ${HAIRLINE}`,
                background: CARD,
                display: 'flex',
                alignItems: 'center',
                fontFamily: SANS,
                fontSize: 24,
                fontWeight: 500,
                color: INK_FAINT,
                opacity: o,
              }}
            >
              Sped up
            </div>
          )
        })}
      </div>

      <div style={{ width: vw, height: vh, position: 'relative', overflow: 'hidden', background: PAPER }}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: vw,
            height: vh,
            transform: `translate(${tx}px, ${ty}px) scale(${cam.z})`,
            transformOrigin: '0 0',
          }}
        >
          {shots.map((sh, i) => {
            const fade = fadeOf(i)
            const from = cuts[i]
            const until = i + 1 < shots.length ? cuts[i + 1] + fadeOf(i + 1) : Infinity
            if (f < from || f > until) return null
            const o = fade <= 0 ? 1 : interpolate(f, [from, from + fade], [0, 1], CLAMP)
            return (
              <AbsoluteFill key={`${sh.clip}-${i}`} style={{ opacity: o }}>
                {hasClip(sh.clip) ? (
                  <Sequence from={from} layout="none">
                    <ShotVideo shot={sh} />
                  </Sequence>
                ) : (
                  <MissingClip name={sh.clip} />
                )}
              </AbsoluteFill>
            )
          })}
        </div>
      </div>
    </div>
  )
}
