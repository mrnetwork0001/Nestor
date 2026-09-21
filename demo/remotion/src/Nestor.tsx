import React from 'react'
import { AbsoluteFill, Audio, Freeze, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion'
import durations from '../public/vo/durations.json'
import {
  Backdrop, Body, BrowserFrame, CARD, CLAY, CLAY_TINT, CREAM, Caption, Chip, Eyebrow, FOREST,
  FOREST_DEEP, Focus, HAIRLINE, HONEY, Hairline, Headline, HeadLine, INK, INK_FAINT, INK_SOFT, Lockup,
  MOSS, PAPER, ProgressRail, Reveal, Rise, SANS, SERIF, SITE, Shot, SponsorLabel, StepNumber, easeInOut,
  easeOut, hasClip,
} from './ui'

/* ------------------------------------------------------------------- timing */

export const FPS = 30
const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

/** Frames of picture before the voice starts in every scene. */
const LEAD = 8
/** Seconds of air after the voice ends, per scene. */
const TAIL: Record<string, number> = { v00: 1.3, v11: 2.4 }
const TAIL_DEFAULT = 0.65
/**
 * The narration was mastered about 7dB below where it wanted to be, and YouTube only
 * ever turns content down, never up -- so a quiet film stays quiet next to everything
 * else a judge watches. This uses the headroom that was going spare: it lands the peak
 * near -1dBFS with nothing limited. The masters then get a final loudness pass in
 * scripts/finish.mjs; baking the bulk of it in here means a re-render keeps it.
 */
const VO_GAIN = 2

/** Cross-fade length at each end of a scene. */
const FADE = 12
/**
 * Where two scenes both carry a browser window, a long dissolve lays one page of
 * dense body copy over another at slightly different positions and the text doubles
 * -- two address pills, two pointers, two email bodies, unreadable for a third of a
 * second. It is the same reason shots inside a scene cut rather than dissolve. Those
 * joins get a short fade: long enough that the paper, the arch and the rail do not
 * snap, short enough that the doubling does not read.
 */
const FADE_OVER_WINDOW = 5
/** S02 to S10 put footage on screen; the title card, the problem and the close do not. */
const HAS_WINDOW = (i: number) => i >= 2 && i <= 10
const fadeInto = (i: number) => (i > 0 && HAS_WINDOW(i) && HAS_WINDOW(i - 1) ? FADE_OVER_WINDOW : FADE)

const IDS = ['v00', 'v01', 'v02', 'v03', 'v04', 'v05', 'v06', 'v07', 'v08', 'v09', 'v10', 'v11'] as const
type Id = (typeof IDS)[number]
const VO = durations as Record<Id, number>

const SCENES = IDS.map((id) => ({
  id,
  dur: LEAD + Math.round((VO[id] + (TAIL[id] ?? TAIL_DEFAULT)) * FPS),
}))
const STARTS = SCENES.reduce<number[]>((a, _, i) => [...a, i === 0 ? 0 : a[i - 1] + SCENES[i - 1].dur], [])
export const NESTOR_DURATION = SCENES.reduce((n, sc) => n + sc.dur, 0)
const durOf = (id: Id) => SCENES[IDS.indexOf(id)].dur

/** Narration seconds to scene frames. Every cue below is written in narration seconds. */
const at = (sec: number) => LEAD + Math.round(sec * FPS)
/** Narration seconds to scene seconds, for BrowserFrame shots and focus. */
const sec = (narration: number) => narration + LEAD / FPS

/**
 * A focus rectangle written the way a camera is actually aimed: put this point
 * of the page in the middle of the window, at this zoom. camFor fits a rectangle
 * with 8% of air around it, so these come back as exactly `z`, and the window is
 * 1600/z by 900/z page pixels wide and high around (cx, cy).
 */
const box = (cx: number, cy: number, z: number): [number, number, number, number] => [
  cx - 736 / z,
  cy - 414 / z,
  1472 / z,
  828 / z,
]

/* ------------------------------------------------------------------ layouts */

/**
 * Footage beside type. A 500px text column on the left, the browser window on
 * the right. The heading sits high, the sponsor label sits low, and whatever
 * the scene wants to say in between goes in `children`.
 */
const SIDE_FRAME_W = 1210
const Side: React.FC<{
  step?: number
  eyebrow: string
  lines: HeadLine[]
  children?: React.ReactNode
  foot?: React.ReactNode
  frame: React.ReactNode
  out?: number
  /** Width of the browser window and of the text column, when a scene wants more picture. */
  frameW?: number
  colW?: number
}> = ({ step, eyebrow, lines, children, foot, frame, out, frameW = SIDE_FRAME_W, colW = 500 }) => (
  <AbsoluteFill>
    <div style={{ position: 'absolute', left: 96, top: 104, width: colW }}>
      {step !== undefined && (
        <>
          <StepNumber n={step} delay={2} out={out} />
          <div style={{ height: 26 }} />
        </>
      )}
      <Eyebrow delay={6} out={out}>{eyebrow}</Eyebrow>
      <div style={{ height: 18 }} />
      <Headline lines={lines} delay={10} size={58} out={out} />
      <div style={{ height: 40 }} />
      {children}
    </div>
    <div style={{ position: 'absolute', left: 96, bottom: 96, width: 500 }}>{foot}</div>
    <div
      style={{
        position: 'absolute',
        right: frameW === SIDE_FRAME_W ? 80 : 60,
        top: 0,
        bottom: 0,
        width: frameW,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {frame}
    </div>
  </AbsoluteFill>
)

/**
 * Footage first. The window takes the width; beneath it a single strip carries
 * the step, its title, and on the right whoever is doing the work.
 */
const WIDE_FRAME_W = 1440
const Wide: React.FC<{
  step: number
  eyebrow: React.ReactNode
  title: string
  /** A second title that takes over at frame `swapAt`. */
  title2?: string
  swapAt?: number
  right?: React.ReactNode
  /** A third line under the title: honey tags and proof chips live here, not beside the eyebrow. */
  note?: React.ReactNode
  frame: React.ReactNode
}> = ({ step, eyebrow, title, title2, swapAt, right, note, frame }) => (
  <AbsoluteFill>
    <div style={{ position: 'absolute', left: (1920 - WIDE_FRAME_W) / 2, top: 22 }}>{frame}</div>
    <div
      style={{
        position: 'absolute',
        left: (1920 - WIDE_FRAME_W) / 2,
        right: (1920 - WIDE_FRAME_W) / 2,
        top: 892,
        height: 172,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
        <StepNumber n={step} delay={4} size={112} />
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, height: 32 }}>{eyebrow}</div>
          <div style={{ height: 4 }} />
          <div style={{ position: 'relative', height: 48 }}>
            {[title, title2].map((t, i) =>
              t === undefined ? null : (
                <div key={i} style={{ position: 'absolute', left: 0, top: 0 }}>
                  <Reveal delay={i === 0 ? 12 : (swapAt ?? 0) + 8} out={i === 0 && title2 !== undefined ? swapAt : undefined}>
                    <div style={{ fontFamily: SERIF, fontSize: 38, fontWeight: 500, letterSpacing: '-0.018em', color: INK, lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                      {t}
                    </div>
                  </Reveal>
                </div>
              ),
            )}
          </div>
          <div style={{ height: 8 }} />
          <div style={{ position: 'relative', height: 46 }}>{note}</div>
        </div>
      </div>
      <div style={{ width: 560, height: 120, position: 'relative', flexShrink: 0 }}>{right}</div>
    </div>
  </AbsoluteFill>
)

/** Pins a lower-third in the right-hand slot of the Wide strip. */
const Slot: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ position: 'absolute', right: 0, top: 0, width: 560 }}>{children}</div>
)

/** One line of tags under the Wide title. Several may share the slot and take turns. */
const Note: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ position: 'absolute', left: 0, top: 0, display: 'flex', alignItems: 'center', gap: 12, whiteSpace: 'nowrap' }}>{children}</div>
)

/* =================================================================== S00 == */
/* Title. The doorway, the name, the promise. */

const S00_LOCKUP = 4
const S00_RULE = 34
const S00_TAGLINE = 40

/** A fine inset border, as on a hotel's letterhead. It draws itself from two corners. */
const InsetFrame: React.FC<{ delay?: number }> = ({ delay = 0 }) => {
  const f = useCurrentFrame()
  const p = easeInOut(interpolate(f, [delay, delay + 44], [0, 1], CLAMP))
  const c = 'rgba(246,240,228,.22)'
  const m = 44
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: m, top: m, height: 1.5, width: `calc((100% - ${m * 2}px) * ${p})`, background: c }} />
      <div style={{ position: 'absolute', left: m, top: m, width: 1.5, height: `calc((100% - ${m * 2}px) * ${p})`, background: c }} />
      <div style={{ position: 'absolute', right: m, bottom: m, height: 1.5, width: `calc((100% - ${m * 2}px) * ${p})`, background: c }} />
      <div style={{ position: 'absolute', right: m, bottom: m, width: 1.5, height: `calc((100% - ${m * 2}px) * ${p})`, background: c }} />
    </AbsoluteFill>
  )
}

const S00: React.FC = () => (
  <>
    <Backdrop tone="forest" arch="right" />
    <InsetFrame delay={2} />
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: -20 }}>
        <Lockup height={230} delay={S00_LOCKUP} color={CREAM} />
        <div style={{ height: 50 }} />
        <Hairline delay={S00_RULE} width={120} color="rgba(246,240,228,.45)" origin="left" />
        <div style={{ height: 34 }} />
        <Reveal delay={S00_TAGLINE}>
          <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 400, fontSize: 58, color: CREAM, letterSpacing: '-0.01em', lineHeight: 1.25 }}>
            Your apartment-hunting concierge
          </div>
        </Reveal>
      </div>
    </AbsoluteFill>
  </>
)

/* =================================================================== S01 == */
/* The problem: four exhibits, one per clause of the narration. */

const S01_HEAD = at(0)
const S01_GRID = at(0.9) // the four figure headings are ruled in
const S01_LISTINGS = at(2.7)
const S01_INTROS = at(5.5)
const S01_INBOX = at(8.1)
const S01_LEASE = at(10.35)
const S01_ALL = at(12.7) // every exhibit returns to full strength

const BEATS = [S01_LISTINGS, S01_INTROS, S01_INBOX, S01_LEASE]

/** Full strength while it is the subject, quieter once the voice has moved on. */
const useBeatOpacity = (i: number) => {
  const f = useCurrentFrame()
  const next = BEATS[i + 1]
  const dim = next === undefined ? 0 : interpolate(f, [next, next + 18], [0, 1], CLAMP)
  const back = interpolate(f, [S01_ALL, S01_ALL + 18], [0, 1], CLAMP)
  return 1 - 0.42 * dim * (1 - back)
}

const Exhibit: React.FC<{
  i: number
  label: string
  x: number
  y: number
  note?: React.ReactNode
  children: React.ReactNode
}> = ({ i, label, x, y, note, children }) => {
  const f = useCurrentFrame()
  const start = BEATS[i]
  const o = useBeatOpacity(i)
  // The four headings are ruled in early, quietly, like figure slots on a spread;
  // each comes up to full strength when the voice reaches it.
  const drawn = S01_GRID + i * 6
  const lit = interpolate(f, [start - 4, start + 12], [0.62, 1], CLAMP)
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: 510, opacity: o }}>
      <div style={{ opacity: lit }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 40 }}>
          <Reveal delay={drawn + 6}>
            <div style={{ fontFamily: SANS, fontSize: 22, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: MOSS }}>
              <span style={{ color: CLAY }}>{String(i + 1).padStart(2, '0')}</span>
              <span style={{ margin: '0 12px', color: '#D9CDB8' }}>/</span>
              {label}
            </div>
          </Reveal>
          {note}
        </div>
        <div style={{ height: 8 }} />
        <Hairline delay={drawn} color="#D9CDB8" />
      </div>
      <div style={{ height: 22 }} />
      <div style={{ position: 'relative', height: 306 }}>{children}</div>
    </div>
  )
}

const paperCard: React.CSSProperties = {
  position: 'absolute',
  background: CARD,
  border: `1.5px solid ${HAIRLINE}`,
  borderRadius: 16,
  boxShadow: '0 22px 40px -30px rgba(60,44,20,.40), 0 2px 6px -3px rgba(60,44,20,.12)',
}

/** Grey bars standing in for text nobody has time to read. */
const Bars: React.FC<{ widths: number[]; gap?: number; color?: string }> = ({ widths, gap = 13, color = '#E9E0D0' }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap }}>
    {widths.map((w, i) => (
      <div key={i} style={{ width: `${w}%`, height: 9, borderRadius: 9, background: color }} />
    ))}
  </div>
)

/** Clay marker drawn behind a line of fine print. */
const Marked: React.FC<{ children: React.ReactNode; delay: number }> = ({ children, delay }) => {
  const f = useCurrentFrame()
  const p = easeInOut(interpolate(f, [delay, delay + 20], [0, 1], CLAMP))
  return (
    <span style={{ position: 'relative', display: 'inline-block', padding: '1px 8px', marginLeft: -8 }}>
      <span
        style={{
          position: 'absolute',
          inset: 0,
          background: CLAY_TINT,
          borderRadius: 5,
          transform: `scaleX(${p})`,
          transformOrigin: 'left center',
        }}
      />
      <span style={{ position: 'relative', color: p > 0.5 ? CLAY : INK_FAINT, fontWeight: 500 }}>{children}</span>
    </span>
  )
}

const ExListings: React.FC = () => {
  const f = useCurrentFrame()
  const s = S01_LISTINGS
  const tabs = Math.round(interpolate(f, [s + 10, s + 64], [3, 31], { ...CLAMP, easing: easeOut }))
  const backs = [
    { name: '1 bed, Harbor Lofts', price: '$1,890', left: 44, top: 0, d: s + 4 },
    { name: 'Studio, Juniper Row', price: '$1,540', left: 22, top: 46, d: s + 10 },
  ]
  return (
    <Exhibit
      i={0}
      label="Listings"
      x={740}
      y={84}
      note={<Chip tone="plain" size={20} delay={s + 10}>{tabs} tabs open</Chip>}
    >
      {backs.map((b) => (
        <Rise key={b.name} delay={b.d} distance={18} style={{ ...paperCard, left: b.left, top: b.top, width: 466, height: 150, padding: '9px 22px', background: '#FBF7F0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: SANS, fontSize: 21, color: INK_FAINT }}>
            <span>{b.name}</span>
            <span>{b.price}</span>
          </div>
        </Rise>
      ))}
      <Rise delay={s + 16} distance={18} style={{ ...paperCard, left: 0, top: 92, width: 466, height: 214, padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontFamily: SERIF, fontSize: 31, fontWeight: 500, color: INK, letterSpacing: '-0.01em' }}>2 bed, Alder Street</span>
          <span style={{ fontFamily: SANS, fontSize: 25, fontWeight: 700, color: FOREST }}>$2,150</span>
        </div>
        <div style={{ height: 16 }} />
        <Bars widths={[92, 78]} />
        <div style={{ height: 18 }} />
        <div style={{ fontFamily: SANS, fontSize: 22, lineHeight: 1.5, color: INK_FAINT }}>
          <Marked delay={s + 40}>plus a $350 admin fee,</Marked>
          <br />
          <Marked delay={s + 52}>$75 a month for amenities</Marked>
        </div>
      </Rise>
    </Exhibit>
  )
}

const ExIntros: React.FC = () => {
  const s = S01_INTROS
  const slips = [
    { to: 'Harbor Lofts leasing', left: 56, top: 0, d: s + 4 },
    { to: 'Juniper Row management', left: 28, top: 50, d: s + 13 },
    { to: 'T. Brennan, Alder Street', left: 0, top: 100, d: s + 22 },
  ]
  return (
    <Exhibit
      i={1}
      label="Introductions"
      x={1300}
      y={150}
      note={<Chip tone="clay" size={20} delay={s + 44}>Pasted 3 times</Chip>}
    >
      {slips.map((m, i) => (
        <Rise key={m.to} delay={m.d} distance={18} style={{ ...paperCard, left: m.left, top: m.top, width: 454, height: 206, padding: '11px 22px', background: i === 2 ? CARD : '#FBF7F0' }}>
          <div style={{ fontFamily: SANS, fontSize: 21, color: INK_FAINT, whiteSpace: 'nowrap' }}>
            To <span style={{ color: INK_SOFT, fontWeight: 600, marginLeft: 8 }}>{m.to}</span>
          </div>
          {i === 2 && (
            <>
              <div style={{ height: 10 }} />
              <div style={{ height: 1.5, background: HAIRLINE }} />
              <div style={{ height: 12 }} />
              <div style={{ fontFamily: SERIF, fontSize: 24, lineHeight: 1.38, color: INK }}>
                Hello, my name is Dana. I am looking for a one-bedroom from October, and I would love to see the apartment
              </div>
            </>
          )}
        </Rise>
      ))}
    </Exhibit>
  )
}

const ExInbox: React.FC = () => {
  const s = S01_INBOX
  const rows: [string, string, 'clay' | 'honey'][] = [
    ['Alder Street', 'No reply, 6 days', 'clay'],
    ['Harbor Lofts', 'No reply, 4 days', 'clay'],
    ['Calloway Court', 'Asked to call back', 'honey'],
    ['Juniper Row', 'No reply, 2 days', 'clay'],
  ]
  return (
    <Exhibit i={2} label="Inbox" x={740} y={536}>
      <Rise delay={s + 4} distance={18} style={{ ...paperCard, left: 0, top: 0, width: 510, height: 300, padding: '8px 24px' }}>
        {rows.map(([name, status, tone], i) => (
          <div
            key={name}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              height: 70,
              borderBottom: i < rows.length - 1 ? `1.5px solid ${HAIRLINE}` : 'none',
            }}
          >
            <Rise delay={s + 10 + i * 6} distance={10} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ width: 9, height: 9, borderRadius: 9, background: tone === 'clay' ? '#D5CAB6' : '#B97D10' }} />
              <span style={{ fontFamily: SANS, fontSize: 25, fontWeight: 600, color: INK }}>{name}</span>
            </Rise>
            <Chip tone={tone} size={20} delay={s + 24 + i * 8}>{status}</Chip>
          </div>
        ))}
      </Rise>
    </Exhibit>
  )
}

const LEASE_BARS = [96, 88, 93, 70, 0, 95, 90, 84, 97, 62, 0, 92, 96, 80, 89, 94, 58, 0, 97, 86, 91, 95, 74, 0, 90, 96, 83, 66]

const ExLease: React.FC = () => {
  const f = useCurrentFrame()
  const s = S01_LEASE
  const p = easeInOut(interpolate(f, [s + 12, s + 78], [0, 1], CLAMP))
  const page = Math.max(1, Math.round(p * 38))
  const sign = easeInOut(interpolate(f, [s + 60, s + 86], [0, 1], CLAMP))
  return (
    <Exhibit
      i={3}
      label="Lease"
      x={1300}
      y={602}
      note={<Chip tone="clay" size={20} delay={s + 70}>Signed, unread</Chip>}
    >
      <Rise delay={s + 4} distance={18} style={{ ...paperCard, left: 0, top: 0, width: 510, height: 300, padding: '18px 26px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 500, color: INK }}>Residential lease</span>
          <span style={{ fontFamily: SANS, fontSize: 21, color: INK_FAINT, fontVariantNumeric: 'tabular-nums' }}>page {page} of 38</span>
        </div>
        <div style={{ height: 14 }} />
        <div style={{ height: 150, overflow: 'hidden', position: 'relative' }}>
          <div style={{ transform: `translateY(${-p * 440}px)` }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              {LEASE_BARS.map((w, i) => (
                <div
                  key={i}
                  style={{
                    width: `${w}%`,
                    height: 9,
                    borderRadius: 9,
                    background: i === 8 || i === 9 || i === 19 ? '#EBC6B6' : '#E9E0D0',
                  }}
                />
              ))}
            </div>
          </div>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 40, background: `linear-gradient(rgba(255,253,249,0), ${CARD})` }} />
        </div>
        <div style={{ height: 16 }} />
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
          <span style={{ fontFamily: SANS, fontSize: 21, color: INK_FAINT }}>Tenant</span>
          <div style={{ flex: 1, position: 'relative', height: 44 }}>
            <svg width="230" height="44" viewBox="0 0 230 44" style={{ position: 'absolute', left: 8, bottom: 2 }}>
              <path
                d="M4 32c10-22 18-26 22-14 4 14-10 20-4 6 8-16 20-18 22-4 1 8 8 6 14-2 6-8 10-6 10 2 0 8 8 4 16-4 10-10 16-4 22 2 8 8 30 4 60-6 20-7 42-8 58-4"
                fill="none"
                stroke={FOREST_DEEP}
                strokeWidth="2.6"
                strokeLinecap="round"
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1 - sign}
              />
            </svg>
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 1.5, background: '#CFC2AA' }} />
          </div>
        </div>
      </Rise>
    </Exhibit>
  )
}

const S01_LEGEND = ['Read the listings', 'Write the introductions', 'Chase the replies', 'Sign the lease']

const LegendRow: React.FC<{ i: number }> = ({ i }) => {
  const o = useBeatOpacity(i)
  return (
    <Rise delay={BEATS[i]} distance={14}>
      <div style={{ opacity: o }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 22, padding: '15px 0' }}>
          <span style={{ fontFamily: SERIF, fontSize: 30, color: CLAY, width: 44, fontFeatureSettings: '"lnum" 1' }}>
            {String(i + 1).padStart(2, '0')}
          </span>
          <span style={{ fontFamily: SANS, fontSize: 30, fontWeight: 500, color: INK }}>{S01_LEGEND[i]}</span>
        </div>
        <div style={{ height: 1.5, background: HAIRLINE }} />
      </div>
    </Rise>
  )
}

const S01: React.FC = () => (
  <>
    <Backdrop arch="left" />
    <div style={{ position: 'absolute', left: 110, top: 150, width: 580 }}>
      <Eyebrow delay={S01_HEAD - 4}>The problem</Eyebrow>
      <div style={{ height: 26 }} />
      <Headline lines={['Finding an', 'apartment is', { em: 'a second job.' }]} delay={S01_HEAD} size={88} stagger={8} />
      <div style={{ height: 56 }} />
      <div style={{ width: 500 }}>
        <Hairline delay={S01_LISTINGS - 8} />
        {S01_LEGEND.map((_, i) => (
          <LegendRow key={i} i={i} />
        ))}
      </div>
    </div>
    <ExListings />
    <ExIntros />
    <ExInbox />
    <ExLease />
  </>
)

/* =================================================================== S02 == */
/* The answer: the landing page, and the five jobs Nestor takes over. */

// The hero is held, then the glide down the landing page (3.3s to 18.8s of the clip)
// runs at about 2x -- but it stops three times, on the frame it had reached, so the
// before-and-after table, the lease flag and the house rules can be read rather than
// glimpsed. Every moving part of this scene carries the "Sped up" note.
const S02_SHOTS: Shot[] = [
  { clip: 'landing', startFrom: 1.6, path: '/' },
  { clip: 'landing', at: 1.7, startFrom: 3.3, playbackRate: 1.6, path: '/', fast: true, dissolve: 0 },
  { clip: 'landing', at: 2.65, startFrom: 4.82, freeze: true, path: '/', fast: true, dissolve: 0 },
  { clip: 'landing', at: 3.55, startFrom: 4.82, playbackRate: 2.0, path: '/', fast: true, dissolve: 0 },
  { clip: 'landing', at: 7.4, startFrom: 12.5, freeze: true, path: '/', fast: true, dissolve: 0 },
  { clip: 'landing', at: 8.2, startFrom: 12.5, playbackRate: 1.9, path: '/', fast: true, dissolve: 0 },
  { clip: 'landing', at: 9.62, startFrom: 15.2, freeze: true, path: '/', fast: true, dissolve: 0 },
  { clip: 'landing', at: 10.5, startFrom: 15.2, playbackRate: 1.7, path: '/', fast: true, dissolve: 0 },
]
// The page holds three fabricated examples, each labelled as one on the page itself.
// The camera stays off two of them and holds instead on what the product does, on a
// flag quoted from the sample-lease review, and on the house rules. It cannot stay off
// the hero, which is the top of the page -- so the caption in the left column says what
// the page's own Fig. 1 line says, in type a viewer can actually read.
const S02_FOCUS: Focus[] = [
  { rect: box(818, 475, 1.16), from: 0, to: 1.5, move: 1.0 }, // the hero, framed on the page's own edges
  { rect: box(1073, 408, 1.92), from: 2.0, to: 3.55, move: 0.65 }, // 01 Paste a listing
  { rect: box(1085, 565, 2.0), from: 6.7, to: 8.2, move: 0.7 }, // one flagged clause, quoted
  { rect: box(810, 500, 1.12), from: 8.9, to: 10.5, move: 0.7 }, // house rules
  { rect: box(800, 450, 1.1), from: 10.7, to: 99, move: 0.9 }, // on down to the four tools
]
const S02_W = 1290
const S02_JOBS: [string, number][] = [
  ['Reads the listings', 2.3],
  ['Writes to landlords', 4.0],
  ['Negotiates your terms', 5.9],
  ['Books the tours', 8.2],
  ['Checks the lease', 9.6],
]

const S02: React.FC = () => (
  <>
    <Backdrop />
    <Side
      eyebrow="The answer"
      lines={['Nestor does', { em: 'that work for you.' }]}
      frameW={S02_W}
      colW={450}
      foot={
        <Rise delay={at(9.6) + 16} distance={12}>
          <div style={{ fontFamily: SANS, fontSize: 21, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: MOSS }}>On screen</div>
          <div style={{ height: 10 }} />
          <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 30, lineHeight: 1.3, color: INK, width: 420 }}>The live landing page, from the top to the footer.</div>
        </Rise>
      }
      frame={<BrowserFrame shots={S02_SHOTS} focus={S02_FOCUS} width={S02_W} dur={durOf('v02')} delay={0} />}
    >
      {/*
        The scene opens on the page's hero, and the hero tells a made-up story. The
        page labels it -- "Fig. 1 ... Maya, Dana and Maple Court are fictional" -- but
        that line sits at the very foot of the hero at about 11 source pixels, so no
        camera move inside this take's budget makes it readable, and a viewer who only
        watches the film would never see it. Rather than let the first product image in
        the film read as a real result, say it here, in type that can be read, for the
        two seconds the hero is on screen. Absolutely positioned so the jobs list below
        does not move when it leaves.
      */}
      <div style={{ position: 'relative', height: 0 }}>
        <Caption from={14} to={at(S02_JOBS[0][1]) - 26} width={430} size={28}>
          The hero is the page&rsquo;s own Fig. 1. Maya, Dana and Maple Court are fictional.
        </Caption>
      </div>
      <Hairline delay={at(S02_JOBS[0][1]) - 8} />
      {S02_JOBS.map(([label, t], i) => (
        <Rise key={label} delay={at(t)} distance={16}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 22, padding: '17px 0' }}>
            <span style={{ fontFamily: SERIF, fontSize: 30, color: CLAY, width: 44, fontFeatureSettings: '"lnum" 1' }}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <span style={{ fontFamily: SANS, fontSize: 32, fontWeight: 500, color: INK }}>{label}</span>
          </div>
          <div style={{ height: 1.5, background: HAIRLINE }} />
        </Rise>
      ))}
    </Side>
  </>
)

/* =================================================================== S03 == */
/* Sign up, then onboarding. The private budget is the point of the scene. */

// "Create an account" is the sign-up form being typed; "where you are looking" is
// step 1; "what you want negotiated" is step 3; then back to the budget field for
// the two sentences about it.
const S03_SHOTS: Shot[] = [
  { clip: 'signup', startFrom: 6.2, playbackRate: 2.3, path: '/signin', fast: true },
  { clip: 'onboarding', at: sec(2.3), startFrom: 3.6, playbackRate: 4.2, path: '/onboarding', fast: true },
  { clip: 'onboarding', at: sec(4.4), startFrom: 55.0, playbackRate: 1.5, path: '/onboarding', fast: true },
  { clip: 'onboarding', at: sec(6.2), startFrom: 12.7, playbackRate: 0.42, path: '/onboarding' },
]
// Signup, onboarding and discover are the 1600px takes and cannot be re-filmed, so
// the camera stays inside 1.4x of them. The sign-in page is split down the middle at
// x=724: the window is the cream half exactly, which needs a hair over 1.4 -- worth
// it, because the alternative is a finger of the green panel at the frame edge.
const S03_FOCUS: Focus[] = [
  { rect: box(1170, 460, 1.86), from: 0, to: sec(2.0), maxMag: 1.46 }, // the account form, being typed
  { rect: box(800, 545, 1.45), from: sec(2.3), to: sec(6.2), move: 1.0 }, // the onboarding form
  { rect: box(555, 620, 1.616), from: sec(6.4), to: sec(8.5) }, // the budget fields and the private-budget note
  { rect: box(555, 620, 1.789), from: sec(8.7), to: 99 }, // "Your budget stays with you"
]
const S03_CAPTION = at(6.1)

const S03: React.FC = () => (
  <>
    <Backdrop />
    <Side
      step={1}
      eyebrow="Your profile"
      lines={['Tell Nestor', { em: 'what you want.' }]}
      frame={<BrowserFrame shots={S03_SHOTS} focus={S03_FOCUS} width={SIDE_FRAME_W} dur={durOf('v03')} delay={4} />}
    >
      <Body delay={18} size={29} width={480}>Where you are looking, what you can pay, and what you want negotiated.</Body>
      <div style={{ height: 44 }} />
      <Caption from={S03_CAPTION} width={490}>
        Your maximum budget is never shown to a landlord, and never given to the model.
      </Caption>
    </Side>
  </>
)

/* =================================================================== S04 == */
/* The Scout. Firecrawl searches, reads, and Nestor scores. */

const S04_SHOTS: Shot[] = [
  { clip: 'discover', startFrom: 2.9, path: '/app' }, // the click, the queued cards
  { clip: 'discover', at: sec(5.0), startFrom: 13.0, playbackRate: 2.3, path: '/app', fast: true }, // cards fill in, scored
  { clip: 'listing', at: sec(8.2), startFrom: 6.15, path: '/app/listings/\u2026' }, // the match and its reasons
]
// Measured off the clip itself at the moment each move holds: the sidebar hairline is
// at x=240, the page content starts at 268, the board and its stage columns end at
// 1220, and the activity feed runs 1240 to 1580. That leaves two gaps to land an edge
// in, 240-268 and 1220-1240, and every window below puts its left and right edges in
// one of them. The board plus its columns is 1000px wide, which needs a hair over 1.4x
// of a 1600px take -- the same trade S03 makes on the sign-in panel, and worth it,
// because the alternative is sawing listing cards in half. The listing is a 3200px
// take: 2.4x of it still reads on the 1080p master.
const S04_FOCUS: Focus[] = [
  { rect: box(922, 470, 1.18), from: 0, to: sec(2.0) }, // the whole board, and the feed entire
  { rect: box(933, 440, 1.2), from: sec(2.3), to: sec(4.7) }, // the Scout in the live feed
  { rect: box(740, 600, 1.6), from: sec(5.4), to: sec(7.9), maxMag: 1.47 }, // the cards being scored
  { rect: box(562, 363, 2.64), from: sec(8.0), to: 99, move: 0.8, maxMag: 2.42 }, // 91, Great match, and why
]
const S04_LABEL = at(1.6)

const S04: React.FC = () => (
  <>
    <Backdrop />
    <Wide
      step={2}
      eyebrow={<Eyebrow delay={8} size={22}>The Scout</Eyebrow>}
      title="Real listings, each one scored"
      frame={<BrowserFrame shots={S04_SHOTS} focus={S04_FOCUS} width={WIDE_FRAME_W} dur={durOf('v04')} delay={2} origin="center top" pushIn={[1, 1.02]} />}
      right={
        <Slot>
          <SponsorLabel name="Firecrawl" role="live web search, pages read into structured facts" from={S04_LABEL} width={560} />
        </Slot>
      }
    />
  </>
)

/* =================================================================== S05 == */
/* The Negotiator's first email, its reasoning, and the disclosure. */

const S05_PATH = '/app/listings/\u2026'
// One clip, cut inside itself. OpenAI wrote this email in five and a half seconds
// with nothing to wait for, so only that stretch runs fast, and it says so; the cuts
// on either side of it fall on the frame the last shot reached, and do not show.
const S05_SHOTS: Shot[] = [
  { clip: 'draft', startFrom: 1.6, path: S05_PATH }, // the listing, and the demo-landlord button
  { clip: 'draft', at: 2.4, startFrom: 4.0, playbackRate: 1.9, path: S05_PATH, fast: true, dissolve: 0 }, // writing
  { clip: 'draft', at: 5.25, startFrom: 9.42, playbackRate: 0.75, path: S05_PATH, dissolve: 0 }, // the draft, held
  { clip: 'draft', at: 11.5, startFrom: 25.5, path: S05_PATH, dissolve: 0 }, // pointer rests on Approve and send
]
const S05_FOCUS: Focus[] = [
  { rect: box(1230, 438, 2.16), from: 0, to: 5.2 }, // the Negotiator card, then the writing
  { rect: box(1230, 675, 2.16), from: 5.6, to: 7.7, move: 0.9 }, // "Why Nestor wrote it this way"
  { rect: box(1230, 257, 2.16), from: 7.9, to: 10.9, move: 0.9 }, // the disclosure, the first line of the email
  { rect: box(1230, 675, 2.16), from: 11.1, to: 99, move: 0.9 }, // the three buttons, Approve among them
]
const S05_LABEL_IN = at(3.2)
const S05_CAPTION = at(7.9)
const S05_APPROVE = at(11.3)

const S05: React.FC = () => (
  <>
    <Backdrop />
    <Side
      step={3}
      eyebrow="The Negotiator"
      lines={['The first email,', { em: 'with its reasoning.' }]}
      frame={<BrowserFrame shots={S05_SHOTS} focus={S05_FOCUS} width={SIDE_FRAME_W} dur={durOf('v05')} delay={4} />}
    >
      <SponsorLabel name="OpenAI" role="drafts the email and shows its reasoning" from={S05_LABEL_IN} width={470} />
      <div style={{ height: 52 }} />
      <Caption from={S05_CAPTION} width={490} size={33}>
        &ldquo;Nestor, an AI assistant, is writing on behalf of Dominic &hellip;&rdquo;
      </Caption>
      <div style={{ height: 36 }} />
      <Chip tone="forest" delay={S05_APPROVE} size={24} dot>Nothing is sent until you approve</Chip>
    </Side>
  </>
)

/* =================================================================== S06 == */
/* Approve, send, and the reply comes back. Two sponsors, in order. */

// The click and the send are the live part of this clip. Between 7.68s and 11.68s of
// it the picture is frozen on "Waiting for Priya" and nothing moves but the ellipsis,
// and the reply lands at 11.68. The reply has to arrive at 11.33 scene seconds,
// because the webhook chip and the camera move to the reply are both written to that
// moment -- so the scene time has to come from somewhere. Take it from the dead
// stretch rather than the live one: the live part runs at 0.55 instead of 0.72 and the
// frozen stretch at 2.3x, which holds the frozen picture for 1.7s instead of 4.0s and
// still puts the reply on the same frame. Only the frozen stretch is faster than it
// happened, and only it carries the "Sped up" note. Both cuts fall on the frame the
// last shot reached, and do not show.
const S06_RATE = 0.55
const S06_SPED: [number, number] = [7.68, 11.68]
const S06_T = (S06_SPED[0] - 2.4) / S06_RATE // scene seconds at which the frozen stretch starts
const S06_REPLY = 11.3333 // and at which the reply has to arrive
const S06_SPED_RATE = (S06_SPED[1] - S06_SPED[0]) / (S06_REPLY - S06_T)
const S06_SHOTS: Shot[] = [
  { clip: 'send-reply', startFrom: 2.4, playbackRate: S06_RATE, path: S05_PATH },
  { clip: 'send-reply', at: S06_T, startFrom: S06_SPED[0], playbackRate: S06_SPED_RATE, path: S05_PATH, fast: true, dissolve: 0 },
  { clip: 'send-reply', at: S06_REPLY, startFrom: S06_SPED[1], path: S05_PATH, dissolve: 0 },
]
const S06_FOCUS: Focus[] = [
  { rect: box(1232, 675, 2.17), from: 0, to: sec(1.2) }, // the pointer, and the click on Approve and send
  { rect: box(1232, 300, 2.17), from: sec(1.5), to: sec(4.6), move: 1.0 }, // to nestor-demo-landlord@agentmail.to
  { rect: box(1232, 640, 2.17), from: sec(5.0), to: sec(10.9), move: 1.0 }, // Sent via AgentMail, then the wait
  { rect: box(1232, 450, 2.17), from: sec(11.3), to: sec(16.9), move: 1.0 }, // the reply, Received via AgentMail
  { rect: box(1232, 420, 2.17), from: sec(17.3), to: 99, move: 0.9 }, // What Nestor understood, Read by OpenAI
]
const S06_AGENTMAIL: [number, number] = [at(3.6), at(14.4)]
const S06_TAG: [number, number] = [at(5.4), at(10.8)]
const S06_HOOK: [number, number] = [at(11.2), at(14.4)]
const S06_TIMES: [number, number] = [at(14.8), at(99)]
const S06_OPENAI = at(15.0)

const S06: React.FC = () => (
  <>
    <Backdrop />
    <Wide
      step={4}
      eyebrow={<Eyebrow delay={8} size={22}>Real email</Eyebrow>}
      title="Out and back in seconds"
      note={
        <>
          <Note><Chip tone="honey" size={24} delay={S06_TAG[0]} out={S06_TAG[1]}>Demo landlord: a second real mailbox that Nestor runs</Chip></Note>
          <Note><Chip tone="forest" size={24} delay={S06_HOOK[0]} out={S06_HOOK[1]} dot>Signed webhook, verified in a Convex HTTP action</Chip></Note>
          <Note><Chip tone="plain" size={24} delay={S06_TIMES[0]}>Sent 2:56:02 PM, reply received 2:56:15 PM</Chip></Note>
        </>
      }
      frame={<BrowserFrame shots={S06_SHOTS} focus={S06_FOCUS} width={WIDE_FRAME_W} dur={durOf('v06')} delay={2} origin="center top" pushIn={[1, 1.02]} />}
      right={
        <>
          <Slot>
            <SponsorLabel name="AgentMail" role="real email out, signed webhook back" from={S06_AGENTMAIL[0]} to={S06_AGENTMAIL[1]} width={560} />
          </Slot>
          <Slot>
            <SponsorLabel name="OpenAI" role="reads the reply: offer, tour times, open questions" from={S06_OPENAI} width={560} />
          </Slot>
        </>
      }
    />
  </>
)

/* =================================================================== S07 == */
/* The delivery record, then picking a tour. */

// The record under the sent email, then the record under the reply: the same thread
// id on both sides, and thirteen seconds between them. The camera barely moves
// between the two, which is the point.
const S07_CUT = 7.1
const S07_SHOTS: Shot[] = [
  { clip: 'delivery', startFrom: 1.5, playbackRate: 0.72, path: S05_PATH }, // the record under the sent email
  { clip: 'delivery', at: 4.95, startFrom: 8.8, playbackRate: 0.85, path: S05_PATH, dissolve: 0 }, // and under the reply
  { clip: 'tour', at: sec(S07_CUT), startFrom: 1.6, playbackRate: 0.85, path: S05_PATH }, // the times, then Choose
  { clip: 'tour', at: 9.5, startFrom: 6.5, playbackRate: 0.85, path: S05_PATH, dissolve: 0 }, // the confirmation draft
]
const S07_FOCUS: Focus[] = [
  { rect: box(1232, 455, 2.17), from: 0, to: 4.6, move: 1.0 }, // message id, thread id, time to the second
  { rect: box(1232, 497, 2.17), from: 4.9, to: 7.2, move: 0.9 }, // the same thread id, on the reply
  { rect: box(1232, 683, 2.17), from: 7.4, to: 99, move: 0.8 }, // the tour times, then the confirmation
]
const S07_CHIPS: [string, number][] = [
  ['AgentMail message ID', 2.6],
  ['Thread', 4.4],
  ['Time, to the second', 6.0],
]
const S07_CHIPS_OUT = at(7.0)
const S07_TOUR = at(7.7)

const S07: React.FC = () => (
  <>
    <Backdrop />
    <Wide
      step={5}
      eyebrow={<Eyebrow delay={8} size={22}>Proof of delivery</Eyebrow>}
      title="Every message keeps its record"
      title2="Pick a tour time"
      swapAt={at(S07_CUT)}
      frame={<BrowserFrame shots={S07_SHOTS} focus={S07_FOCUS} width={WIDE_FRAME_W} dur={durOf('v07')} delay={2} origin="center top" pushIn={[1, 1.02]} />}
      right={
        <>
          <Slot>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap', paddingTop: 14 }}>
              {S07_CHIPS.map(([label, t]) => (
                <Chip key={label} tone="forest" size={24} delay={at(t)} out={S07_CHIPS_OUT} dot>{label}</Chip>
              ))}
            </div>
          </Slot>
          <Slot>
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 14 }}>
              <Caption from={S07_TOUR} width={500} size={31}>Pick a tour, and Nestor writes the confirmation.</Caption>
            </div>
          </Slot>
        </>
      }
    />
  </>
)

/* =================================================================== S08 == */
/* The live dashboard. */

// Filmed live. A second browser, signed in as the same person, approved a draft that
// was waiting; nothing was clicked or reloaded in front of the camera. The card rises
// out of "Needs your OK" into "Awaiting reply" at 2.05s of the clip, the feed ticks at
// 4.65s, and when the demo landlord answers the card moves again, into "Negotiating",
// at 11.35s. The clip compresses one stretch of itself, 7.75s to 10.75s, and the cut
// steps over exactly that: shot two runs 4.41 scene seconds at 0.85 from clip 4.0 and
// so ends on clip 7.75, and shot three picks up at 10.75. Nothing in this scene runs
// faster than it happened, which is why none of it carries the "Sped up" note.
const S08_SHOTS: Shot[] = [
  { clip: 'dashboard', startFrom: 0.2, playbackRate: 0.55, path: '/app' }, // Needs your OK, then the card moves
  { clip: 'dashboard', at: 4.4, startFrom: 4.0, playbackRate: 0.85, path: '/app', dissolve: 0 }, // the feed ticks
  { clip: 'dashboard', at: 8.81, startFrom: 10.75, playbackRate: 0.8, path: '/app', dissolve: 0 }, // and it moves again
]
const S08_FOCUS: Focus[] = [
  { rect: box(740, 590, 1.6), from: 0, to: 4.3 }, // the pipeline, and the card changing column
  { rect: box(1232, 430, 2.179), from: 4.6, to: 8.6, move: 1.0 }, // the live activity feed
  { rect: box(740, 590, 1.6), from: 8.7, to: 99, move: 1.2 }, // back to the board for the second move
]
const S08_ELSEWHERE: [number, number] = [at(3.2), at(8.6)]
const S08_PUSH = at(9.4)
const S08_LABEL = at(7.4)

const S08: React.FC = () => (
  <>
    <Backdrop />
    <Wide
      step={6}
      eyebrow={<Eyebrow delay={8} size={22}>The dashboard</Eyebrow>}
      title="A board that keeps itself current"
      note={
        <>
          <Note><Chip tone="honey" size={24} delay={S08_ELSEWHERE[0]} out={S08_ELSEWHERE[1]}>Approved in another window. This tab was never touched</Chip></Note>
          <Note><Chip tone="plain" size={24} delay={S08_PUSH}>No reload: the queries push every change</Chip></Note>
        </>
      }
      frame={<BrowserFrame shots={S08_SHOTS} focus={S08_FOCUS} width={WIDE_FRAME_W} dur={durOf('v08')} delay={2} origin="center top" pushIn={[1, 1.02]} />}
      right={
        <Slot>
          <SponsorLabel name="Convex" role="reactive queries, nothing refreshed" from={S08_LABEL} width={560} />
        </Slot>
      }
    />
  </>
)

/* =================================================================== S09 == */
/* Lease review. */

// A real PDF, chosen through the app's own file chooser. OpenAI took 52.9 seconds over
// it; the clip holds that wait between 13.76s and 17.76s of itself, and only that shot
// says "Sped up". Every cut is a straight cut: two views of the same page dissolved
// into each other and the text doubled.
const S09_SHOTS: Shot[] = [
  { clip: 'lease', startFrom: 5.9, path: '/app/lease' }, // the PDF is chosen, the file name appears
  { clip: 'lease', at: 3.0, startFrom: 13.9, path: '/app/lease', fast: true, dissolve: 0 }, // reading the fine print
  { clip: 'lease', at: 6.9, startFrom: 18.5, path: '/app/lease', dissolve: 0 }, // High risk as written
  { clip: 'lease', at: 9.1, startFrom: 27.9, playbackRate: 0.55, path: '/app/lease', dissolve: 0 }, // one clause, held
  { clip: 'lease', at: 11.8, startFrom: 38.0, playbackRate: 0.8, path: '/app/lease', dissolve: 0 }, // not legal advice
]
const S09_FOCUS: Focus[] = [
  { rect: box(368, 392, 2.174), from: 0, to: 2.1 }, // the upload card: pecan-hollow-lease.pdf, checking the file
  { rect: box(1103, 250, 2.18), from: 2.3, to: 6.7, move: 0.8 }, // Nestor is reading the fine print
  { rect: box(1103, 388, 2.0), from: 7.0, to: 9.0, move: 0.8 }, // High risk as written, 9 serious
  { rect: box(1103, 335, 2.0), from: 9.2, to: 11.7, move: 0.8 }, // the clause: quoted, explained, answered
  { rect: box(1100, 675, 2.0), from: 11.9, to: 99, move: 0.8 }, // not legal advice
]
const S09_LABEL = at(2.4)
const S09_CAPTION = at(11.6)

const S09: React.FC = () => (
  <>
    <Backdrop />
    <Side
      step={7}
      eyebrow="Lease review"
      lines={['Read the lease', { em: 'before you sign.' }]}
      frame={<BrowserFrame shots={S09_SHOTS} focus={S09_FOCUS} width={SIDE_FRAME_W} dur={durOf('v09')} delay={4} />}
    >
      <Chip tone="plain" size={24} delay={14}>An uploaded PDF, not the sample lease</Chip>
      <div style={{ height: 40 }} />
      <SponsorLabel name="OpenAI" role="quotes, explains, drafts your reply" from={S09_LABEL} width={470} />
      <div style={{ height: 52 }} />
      <Caption from={S09_CAPTION} width={490} size={34}>Not legal advice, and it says so.</Caption>
    </Side>
  </>
)

/* =================================================================== S10 == */
/* The Renter Passport, then the proof that the real path works. */

const S10_SHOTS: Shot[] = [
  { clip: 'passport', startFrom: 9.9, path: '/passport/117790b9…' }, // what a landlord opens
]
const S10_FOCUS: Focus[] = [
  { rect: box(798, 390, 1.34), from: 0, to: sec(1.4) }, // the page a landlord opens
  { rect: box(810, 420, 1.95), from: sec(1.6), to: 99, move: 1.4 }, // credit and income, as ranges
]
const S10_BANDS = at(2.2)
const S10_SWAP = at(4.0) // the passport layout leaves
const S10_PROOF = at(4.4) // the record arrives
// The record of the production test, as written up in the README's audit section.
const S10_STEPS: { k: string; v: string; d: string; t: number }[] = [
  { k: 'Landlord', v: 'A Gmail address', d: 'Typed under Landlord contact on a real PadMapper listing, on production.', t: 6.6 },
  { k: 'Reply', v: 'Typed by hand', d: 'Written in Gmail by a person. No script, no template.', t: 8.3 },
  { k: 'Return', v: 'The signed webhook', d: 'AgentMail to a Convex HTTP action, signature checked.', t: 9.7 },
  { k: 'Result', v: 'Read correctly', d: '', t: 11.0 },
]
const S10_READ = ['Counter-offer: $1,650 against $1,690', 'Application fee waived', 'Two tour times', 'Parking question held for the renter']

/**
 * If the owner's own phone footage of that Gmail thread is ever filmed, drop the file
 * into public/clips and name it on the next line: the fourth card becomes the phone
 * shot and the written record steps aside. Nothing else in the scene changes.
 */
const S10_PHONE: string | null = null // e.g. 'phone-gmail'

/** Portrait phone footage, in a plain phone-shaped frame. */
const PhoneShot: React.FC<{ clip: string }> = ({ clip }) => (
  <div
    style={{
      width: 168,
      height: 340,
      margin: '0 auto',
      borderRadius: 26,
      border: `3px solid ${INK}`,
      overflow: 'hidden',
      background: INK,
      boxShadow: '0 22px 40px -28px rgba(60,44,20,.5)',
    }}
  >
    <OffthreadVideo src={staticFile(`clips/${clip}.mp4`)} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
  </div>
)

const ProofCard: React.FC<{ i: number }> = ({ i }) => {
  const f = useCurrentFrame()
  const st = S10_STEPS[i]
  const lit = interpolate(f, [at(st.t) - 4, at(st.t) + 14], [0, 1], CLAMP)
  const last = i === S10_STEPS.length - 1
  return (
    <Rise delay={S10_PROOF + 14 + i * 6} distance={20} style={{ flex: 1 }}>
      <div
        style={{
          height: 430,
          boxSizing: 'border-box',
          background: CARD,
          border: `1.5px solid ${HAIRLINE}`,
          borderRadius: 20,
          padding: '30px 30px 0',
          boxShadow: '0 26px 50px -34px rgba(60,44,20,.34), 0 3px 8px -4px rgba(60,44,20,.10)',
          opacity: 0.64 + 0.36 * lit,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: SERIF, fontSize: 76, lineHeight: 1, color: last ? CLAY : FOREST, letterSpacing: '-0.03em', fontFeatureSettings: '"lnum" 1' }}>
            {String(i + 1).padStart(2, '0')}
          </span>
          <span style={{ fontFamily: SANS, fontSize: 21, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: MOSS }}>{st.k}</span>
        </div>
        <div style={{ height: 22 }} />
        <div style={{ height: 2, background: last ? CLAY : FOREST, transform: `scaleX(${easeInOut(lit)})`, transformOrigin: 'left center' }} />
        <div style={{ height: 22 }} />
        <div style={{ fontFamily: SERIF, fontSize: 40, lineHeight: 1.14, fontWeight: 500, letterSpacing: '-0.015em', color: INK }}>{st.v}</div>
        <div style={{ height: 16 }} />
        {last ? (
          S10_PHONE && hasClip(S10_PHONE) ? (
            <PhoneShot clip={S10_PHONE} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {S10_READ.map((c, j) => (
                <Rise key={c} delay={at(st.t) + 10 + j * 7} distance={10}>
                  <div style={{ display: 'flex', gap: 12, fontFamily: SANS, fontSize: 22, lineHeight: 1.32, color: INK_SOFT }}>
                    <span style={{ width: 8, height: 8, borderRadius: 8, background: j === 3 ? HONEY : FOREST, marginTop: 10, flexShrink: 0 }} />
                    <span>{c}</span>
                  </div>
                </Rise>
              ))}
            </div>
          )
        ) : (
          <div style={{ fontFamily: SANS, fontSize: 24, lineHeight: 1.42, color: INK_SOFT, opacity: lit }}>{st.d}</div>
        )}
      </div>
    </Rise>
  )
}

const S10: React.FC = () => {
  const f = useCurrentFrame()
  const leave = easeInOut(interpolate(f, [S10_SWAP, S10_SWAP + 16], [0, 1], CLAMP))
  return (
    <>
      <Backdrop arch={f > S10_SWAP + 8 ? 'right' : 'none'} />
      {f < S10_SWAP + 18 && (
        <AbsoluteFill style={{ opacity: 1 - leave, transform: `translateY(${-leave * 14}px)` }}>
          <Side
            step={8}
            eyebrow="Renter Passport"
            lines={['Bands,', { em: 'never documents.' }]}
            frame={<BrowserFrame shots={S10_SHOTS} focus={S10_FOCUS} width={SIDE_FRAME_W} dur={durOf('v10')} delay={4} />}
          >
            <Body delay={S10_BANDS} size={29} width={480}>What a landlord sees about you: income and credit as ranges, nothing to download.</Body>
          </Side>
        </AbsoluteFill>
      )}
      {f >= S10_PROOF - 2 && (
        <AbsoluteFill>
          <div style={{ position: 'absolute', left: 130, top: 118, width: 1300 }}>
            <Eyebrow delay={S10_PROOF}>The real path</Eyebrow>
            <div style={{ height: 22 }} />
            <Headline lines={['Tested with a Gmail address', { em: 'as the landlord.' }]} delay={S10_PROOF + 4} size={74} />
          </div>
          <div style={{ position: 'absolute', right: 130, top: 124, textAlign: 'right' }}>
            <Rise delay={S10_PROOF + 16} distance={12}>
              <div style={{ fontFamily: SANS, fontSize: 21, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: INK_FAINT }}>From the audit log</div>
              <div style={{ height: 8 }} />
              <div style={{ fontFamily: SERIF, fontSize: 34, color: INK, letterSpacing: '-0.01em' }}>20 September 2026</div>
              <div style={{ height: 4 }} />
              <div style={{ fontFamily: SANS, fontSize: 23, color: INK_SOFT }}>on production, one real mailbox</div>
            </Rise>
          </div>
          <div style={{ position: 'absolute', left: 130, right: 130, top: 420, display: 'flex', gap: 24 }}>
            {S10_STEPS.map((_, i) => (
              <ProofCard key={i} i={i} />
            ))}
          </div>
          <div style={{ position: 'absolute', left: 130, right: 130, top: 884 }}>
            <Rise delay={at(S10_STEPS[0].t) + 10} distance={10}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontFamily: SANS, fontSize: 24, color: INK_SOFT }}>
                <span style={{ width: 9, height: 9, borderRadius: 9, background: '#B97D10' }} />
                The first email landed in Gmail&rsquo;s spam folder. That is in the README too, under Known limitations.
              </div>
            </Rise>
          </div>
        </AbsoluteFill>
      )}
    </>
  )
}

/* =================================================================== S11 == */
/* The stack, as text. Then the close. */

const S11_ROWS: { name: string; kind: string; t: number; parts: [string, number][] }[] = [
  { name: 'Convex', kind: 'Platform', t: 0.1, parts: [['backend,', 0.9], ['sign-in,', 1.8], ['scheduling,', 2.6], ['hosting', 3.5]] },
  { name: 'Firecrawl', kind: 'Web data', t: 4.5, parts: [['finds the homes', 4.7]] },
  { name: 'AgentMail', kind: 'Email', t: 6.3, parts: [['carries the mail', 6.5]] },
  { name: 'OpenAI', kind: 'Language', t: 8.2, parts: [['writes,', 8.6], ['reads,', 9.1], ['and reviews', 9.5]] },
]
const S11_COVER = at(10.15) // the forest panel starts to rise
const S11_LOCKUP = at(10.6)
const S11_GUEST = at(12.1)
const S11_NOSIGNUP = at(12.8)
// The one thing a judge might write down, so it wants more than three seconds.
const S11_URL = at(13.1)

/**
 * Two receipts for the two claims that can be checked from outside: the owner's own
 * provider dashboards, filmed silently and cropped here to the part that carries the
 * numbers. Nothing identifying is inside either crop -- no address, no key, no account,
 * no plan or balance -- and the captions say only what the frames show.
 */
const RECEIPTS: {
  file: string
  natural: [number, number]
  crop: [number, number, number, number]
  seconds: number
  caption: string
  t: number
  left: number
  /** The crop cuts a column of the table mid-word: let it fade out instead. */
  fade?: boolean
}[] = [
  {
    file: 'usage-firecrawl-logs',
    natural: [1440, 640],
    crop: [0, 96, 430, 253], // the request log: /SCRAPE, twice, against two real listing sites
    // A receipt is a still. Held on the first frame, which is also the only part of
    // this recording with no mouse pointer in it -- the hand arrives over the
    // padmapper row at about frame 30 and a stray pointer inside a still looks
    // unfinished. Nothing else in either panel moves, so nothing is lost.
    seconds: 0,
    // The caption says only what is inside the crop. The STATUS, # CREDITS and TIME
    // columns sit at x=865 and beyond in the source: reaching them means a crop three
    // times this wide, and at the width this card can have on screen that would put
    // the type near 9px. Legibility wins; the claim shrinks to fit the evidence.
    caption: 'Firecrawl: /SCRAPE, real listing sites',
    t: 4.8,
    left: 700,
    fade: true,
  },
  {
    file: 'usage-agentmail',
    natural: [1504, 482],
    crop: [0, 0, 620, 110], // sent, received and bounced; stops inside the cell, not mid-word
    seconds: 0,
    caption: 'AgentMail: 44 sent, 45 received, 0 bounced',
    t: 6.6,
    left: 1186,
  },
]

const Receipt: React.FC<{ i: number }> = ({ i }) => {
  const f = useCurrentFrame()
  const r = RECEIPTS[i]
  const [cx, cy, cw, ch] = r.crop
  const delay = at(r.t)
  const lastFrame = Math.max(0, Math.round(r.seconds * FPS))
  return (
    <div style={{ position: 'absolute', left: r.left, bottom: 60 }}>
      <Rise delay={delay} distance={18}>
        <div
          style={{
            width: cw + 24,
            background: CARD,
            border: `1.5px solid ${HAIRLINE}`,
            borderRadius: 16,
            padding: 12,
            boxShadow: '0 26px 50px -34px rgba(60,44,20,.34), 0 3px 8px -4px rgba(60,44,20,.10)',
          }}
        >
          <div style={{ width: cw, height: ch, overflow: 'hidden', borderRadius: 9, position: 'relative', background: '#0C100E' }}>
            <Sequence from={delay} layout="none">
              <Freeze frame={Math.min(Math.max(0, f - delay), lastFrame)}>
                <OffthreadVideo
                  src={staticFile(`extras/${r.file}.mp4`)}
                  muted
                  style={{ position: 'absolute', left: -cx, top: -cy, width: r.natural[0], height: r.natural[1] }}
                />
              </Freeze>
            </Sequence>
            {r.fade && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  bottom: 0,
                  width: 96,
                  background: 'linear-gradient(90deg, rgba(12,16,14,0), #0C100E)',
                }}
              />
            )}
          </div>
          <div style={{ height: 10 }} />
          <div style={{ fontFamily: SANS, fontSize: 24, color: INK_SOFT }}>{r.caption}</div>
        </div>
      </Rise>
    </div>
  )
}

/** All four rows are ruled in at once, quietly; each comes up to full ink when it is named. */
const StackRow: React.FC<{ i: number }> = ({ i }) => {
  const f = useCurrentFrame()
  const row = S11_ROWS[i]
  const drawn = 4 + i * 5
  const lit = interpolate(f, [at(row.t) - 4, at(row.t) + 14], [0.44, 1], CLAMP)
  return (
    <div>
      <Hairline delay={drawn} color="#D9CDB8" />
      <div style={{ display: 'flex', alignItems: 'baseline', height: 128, paddingTop: 34, boxSizing: 'border-box', opacity: lit }}>
        <div style={{ width: 370 }}>
          <Reveal delay={drawn + 4}>
            <div style={{ fontFamily: SERIF, fontSize: 66, fontWeight: 500, letterSpacing: '-0.02em', color: INK, lineHeight: 1.1 }}>{row.name}</div>
          </Reveal>
        </div>
        <div style={{ flex: 1, display: 'flex', gap: 10, fontFamily: SANS, fontSize: 31, lineHeight: 1.3, color: INK_SOFT, whiteSpace: 'nowrap' }}>
          {row.parts.map(([w, t]) => (
            <Rise key={w} delay={at(t)} distance={12}><span>{w}</span></Rise>
          ))}
        </div>
        <Rise delay={drawn + 10} distance={10}>
          <div style={{ fontFamily: SANS, fontSize: 22, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: MOSS }}>{row.kind}</div>
        </Rise>
      </div>
      {i === S11_ROWS.length - 1 && <Hairline delay={drawn + 5} color="#D9CDB8" />}
    </div>
  )
}

const S11: React.FC = () => {
  const f = useCurrentFrame()
  const cover = easeInOut(interpolate(f, [S11_COVER, S11_COVER + 30], [0, 1], CLAMP))
  const y = interpolate(cover, [0, 1], [112, -14]) // top edge of the panel, in % of height
  return (
    <>
      <Backdrop arch="left" />
      <div style={{ position: 'absolute', left: 110, top: 270, width: 520 }}>
        <Eyebrow delay={0}>Built on</Eyebrow>
        <div style={{ height: 26 }} />
        <Headline lines={['Four services,', { em: 'each doing' }, { em: 'real work.' }]} delay={2} size={76} />
      </div>
      <div style={{ position: 'absolute', left: 720, right: 110, top: 150 }}>
        {S11_ROWS.map((_, i) => (
          <StackRow key={i} i={i} />
        ))}
      </div>
      {RECEIPTS.map((_, i) => (
        <Receipt key={i} i={i} />
      ))}

      {/* The cover: a forest panel whose leading edge is the roofline from the mark. */}
      <AbsoluteFill style={{ clipPath: `polygon(0 ${y + 12}%, 100% ${y}%, 100% 101%, 0 101%)` }}>
        <Backdrop tone="forest" arch="right" />
        <InsetFrame delay={S11_COVER + 16} />
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 24 }}>
            <Lockup height={190} delay={S11_LOCKUP} color={CREAM} />
            <div style={{ height: 56 }} />
            <div style={{ display: 'flex', gap: 16, fontFamily: SERIF, fontStyle: 'italic', fontSize: 56, color: CREAM, letterSpacing: '-0.012em', lineHeight: 1.25 }}>
              <Reveal delay={S11_GUEST}><span>Try it as a guest.</span></Reveal>
              <Reveal delay={S11_NOSIGNUP}><span style={{ color: '#E9B9A4' }}>No sign-up needed.</span></Reveal>
            </div>
            <div style={{ height: 50 }} />
            <Rise delay={S11_URL} distance={14}>
              <div
                style={{
                  fontFamily: SANS,
                  fontSize: 44,
                  fontWeight: 500,
                  letterSpacing: '0.005em',
                  color: CREAM,
                  border: '2px solid rgba(246,240,228,.55)',
                  borderRadius: 999,
                  padding: '20px 52px',
                }}
              >
                {SITE}
              </div>
            </Rise>
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    </>
  )
}

/* ============================================================== composition */

const BODIES: React.FC[] = [S00, S01, S02, S03, S04, S05, S06, S07, S08, S09, S10, S11]

/** Fade every scene in and out so cuts never snap. */
const Scene: React.FC<{ dur: number; first: boolean; last: boolean; fade: number; children: React.ReactNode }> = ({
  dur,
  first,
  last,
  fade,
  children,
}) => {
  const f = useCurrentFrame()
  // The film opens on the cover and holds on the close, so neither end fades to paper.
  // Each scene stays on screen while the next one dissolves in over it, so the paper,
  // the rail and whatever the two scenes share never drop out between them.
  void dur
  void last
  const o = first ? 1 : easeInOut(interpolate(f, [0, fade], [0, 1], CLAMP))
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>
}

/**
 * The rail is forest on paper and cream on the two forest scenes. It draws itself in
 * as the title card leaves: the title card is the film's thumbnail, and a few bright
 * pixels of rail in its bottom corner read as a scratch on the print.
 */
const Rail: React.FC = () => {
  const f = useCurrentFrame()
  const onForest = f < STARTS[1] + FADE / 2 || f > STARTS[11] + S11_COVER + 22
  const o = interpolate(f, [STARTS[1] - 30, STARTS[1]], [0, 1], CLAMP)
  return (
    <AbsoluteFill style={{ opacity: o }}>
      <ProgressRail total={NESTOR_DURATION} color={onForest ? 'rgba(246,240,228,.7)' : FOREST} />
    </AbsoluteFill>
  )
}

export const Nestor: React.FC = () => (
  <AbsoluteFill style={{ background: PAPER }}>
    {SCENES.map((sc, i) => {
      const Body_ = BODIES[i]
      return (
        <Sequence
          key={sc.id}
          from={STARTS[i]}
          // Hold this scene under the next one for exactly as long as that one takes
          // to come up, so the join never shows paper through the gap.
          durationInFrames={sc.dur + (i === SCENES.length - 1 ? 0 : fadeInto(i + 1))}
          name={sc.id}
        >
          <Scene dur={sc.dur} first={i === 0} last={i === SCENES.length - 1} fade={fadeInto(i)}>
            <Body_ />
          </Scene>
          <Sequence from={LEAD} layout="none">
            <Audio src={staticFile(`vo/${sc.id}.mp3`)} volume={VO_GAIN} />
          </Sequence>
        </Sequence>
      )
    })}
    <Rail />
  </AbsoluteFill>
)
