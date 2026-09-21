// Real-product footage for the Nestor demo video. Playwright drives Google Chrome through the
// real app, one BEAT at a time, and every beat becomes public/clips/<beat>.mp4 plus an entry in
// public/clips/meta.json that tells the editor what is on screen and when.
//
//   node scripts/capture.mjs <beat> [<beat> ...]     record beats (TARGET=dev by default)
//   TARGET=prod node scripts/capture.mjs signup      record against the live site
//   node scripts/capture.mjs recut <beat>            rebuild a clip from its kept frames
//   node scripts/capture.mjs list                    list the beats
//   DPR=2 node scripts/capture.mjs settings          same 1600x900 page, filmed at 3200x1800
//
// Environment: TARGET=prod | DPR=2 | CLIPS_OUT=<dir> | JPEG_QUALITY=92 | CRF=15 | PROMOTE=1
//
// What is different from the NimSnap capture script this grew out of:
//   - Frames come from the DevTools screencast as high-quality JPEGs with their own timestamps,
//     not from Playwright's 1 Mbit VP8 recorder, so text stays sharp and marks line up exactly.
//   - A pointer and a click ring are injected into every page, and the mouse travels on an eased
//     path before each click, because a headless recording has no cursor of its own.
//   - Scrolling is an eased glide driven from inside the page, on the window or on whichever
//     scroll container holds the target.
//   - Every meaningful moment is logged as a mark. Long waits (a web search, an email round
//     trip, a lease review) are declared as ranges and compressed when the clip is cut; marks
//     are mapped through the same function, so meta.json times are clip times.
//   - Dev rehearsals write to clips/tmp/dev-clips and never touch public/clips unless PROMOTE=1.
import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TARGET = process.env.TARGET === 'prod' ? 'prod' : 'dev'
const BASE = TARGET === 'prod' ? 'https://standing-elephant-306.convex.site' : 'http://127.0.0.1:5173'
const TMP = path.join(ROOT, 'clips/tmp')
const PUBLIC_CLIPS = path.join(ROOT, 'public/clips')
// CLIPS_OUT sends the finished mp4 and its meta.json somewhere else entirely (probes, experiments).
const OUT = process.env.CLIPS_OUT
  ? path.resolve(ROOT, process.env.CLIPS_OUT)
  : TARGET === 'prod' || process.env.PROMOTE
    ? PUBLIC_CLIPS
    : path.join(TMP, 'dev-clips')
const AUTH = path.join(TMP, TARGET === 'prod' ? 'auth.json' : 'auth-dev.json')
const STATE = path.join(TMP, `state-${TARGET}.json`)
const CREDS = path.join(TMP, 'creds.json') // { prod: { email, password } }  (gitignored)
const SIZE = { width: 1600, height: 900 }
// Optional supersampling. The page is always laid out as the same 1600x900 CSS viewport -- every
// coordinate, mark, glide and region below is unchanged -- but DPR=2 renders and screencasts it at
// device scale 2, so the clip is 3200x1800 and a push-in has real pixels to enlarge instead of
// interpolated ones. DPR unset (or 1) behaves exactly as it always has.
const DPR = Number(process.env.DPR ?? 1) || 1
const FRAME = { width: Math.round(SIZE.width * DPR), height: Math.round(SIZE.height * DPR) }
const JPEG_QUALITY = Number(process.env.JPEG_QUALITY ?? 92) || 92
const CRF = process.env.CRF ?? '15'
for (const dir of [TMP, OUT, PUBLIC_CLIPS]) fs.mkdirSync(dir, { recursive: true })

// Frames and session.json live beside the beat; a non-default scale gets its own folder so a probe
// can never clobber the frames a real take left behind (`recut` finds the matching one).
const sessionDir = (beat) => path.join(TMP, 'sessions', `${TARGET}${DPR === 1 ? '' : `-dpr${DPR}`}-${beat}`)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const readJson = (file, fallback) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback)
const writeJson = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 1))
const state = readJson(STATE, {})
const saveState = () => writeJson(STATE, state)
const round = (n) => Math.round(n * 100) / 100

// The renter on camera. Realistic and consistent from sign-up to the Passport.
const PROFILE = {
  name: 'Dominic Okafor',
  city: 'Austin, TX',
  neighborhoods: ['East Austin', 'Hyde Park', 'Mueller'],
  budgetMax: '2200',
  budgetMin: '1500',
  bedrooms: '1',
  mustHaves: ['In-unit laundry'],
  customMustHaves: ['Pet friendly'],
  moveIn: '2026-11-01',
  leaseMonths: '12',
  headline: 'Product designer relocating to Austin for a new role',
  occupation: 'Senior product designer at a health-tech company',
  bio: 'Quiet, tidy and organised. I work hybrid, pay on time, and have rented for six years with every deposit returned in full.',
  pets: 'One house-trained beagle, 25 lb, vaccinations up to date',
  credit: 'excellent',
  income: '8k_12k',
  goals: ['Lower monthly rent', 'Waive pet fee or deposit', 'Waive application fee'],
}

function credentials() {
  if (TARGET === 'prod') {
    const creds = readJson(CREDS, {}).prod
    if (!creds) throw new Error(`Put { "prod": { "email": ..., "password": ... } } in ${CREDS}`)
    return creds
  }
  if (!state.email) {
    state.email = `nestor-video-test-${Date.now()}@example.com`
    state.password = 'rehearsal-2026'
    saveState()
  }
  return { email: state.email, password: state.password }
}

// ---------------------------------------------------------------------------------------------
// The pointer. Runs in every document before the app's own scripts.
// ---------------------------------------------------------------------------------------------
function pointerScript() {
  if (window.__nestorPointer) return
  window.__nestorPointer = true
  const KEY = '__nestor_pointer_xy'
  let x = 800
  let y = 450
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) || 'null')
    if (saved) [x, y] = saved
  } catch {}
  const el = document.createElement('div')
  el.setAttribute('aria-hidden', 'true')
  el.style.cssText =
    'position:fixed;left:0;top:0;width:26px;height:26px;z-index:2147483647;pointer-events:none;' +
    'will-change:transform;filter:drop-shadow(0 2px 3px rgba(28,38,33,.35));'
  el.innerHTML =
    '<svg width="26" height="26" viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M4 2.5 L4 20.5 L8.9 16.2 L12.2 23.6 L15.4 22.2 L12.2 14.9 L18.8 14.6 Z" ' +
    'fill="#1c2621" stroke="#fffdf9" stroke-width="1.6" stroke-linejoin="round"/></svg>'
  const place = () => (el.style.transform = `translate(${x - 4}px, ${y - 2.5}px)`)
  place()
  const attach = () => {
    if (!document.documentElement) return false
    document.documentElement.appendChild(el)
    return true
  }
  if (!attach()) document.addEventListener('DOMContentLoaded', attach, { once: true })
  // Some apps replace the whole body; keep the pointer attached.
  setInterval(() => !el.isConnected && attach(), 500)

  window.__nestorRing = (rx = x, ry = y) => {
    const ring = document.createElement('div')
    ring.style.cssText =
      `position:fixed;left:${rx - 22}px;top:${ry - 22}px;width:44px;height:44px;border-radius:50%;` +
      'border:3px solid #c2512f;background:rgba(194,81,47,.16);z-index:2147483646;pointer-events:none;'
    document.documentElement.appendChild(ring)
    ring
      .animate(
        [
          { transform: 'scale(.25)', opacity: 0.95 },
          { transform: 'scale(1.25)', opacity: 0 },
        ],
        { duration: 520, easing: 'cubic-bezier(.2,.7,.2,1)' },
      )
      .finished.then(() => ring.remove(), () => ring.remove())
  }
  window.addEventListener(
    'mousemove',
    (e) => {
      x = e.clientX
      y = e.clientY
      place()
      try {
        sessionStorage.setItem(KEY, JSON.stringify([x, y]))
      } catch {}
    },
    true,
  )
  window.addEventListener('mousedown', (e) => window.__nestorRing(e.clientX, e.clientY), true)

  // The app scrolls new arrivals into view by itself. While filming a conversation the camera
  // does that instead (set window.__nestorHoldScroll), so what the narration is about stays put.
  const nativeScrollIntoView = Element.prototype.scrollIntoView
  Element.prototype.scrollIntoView = function (...args) {
    if (window.__nestorHoldScroll) return
    return nativeScrollIntoView.apply(this, args)
  }

  // Eased scrolling from inside the page. `target` null means the window.
  window.__nestorGlide = (container, to, ms) =>
    new Promise((resolve) => {
      const isWin = !container
      const from = isWin ? window.scrollY : container.scrollTop
      const max = isWin
        ? document.documentElement.scrollHeight - window.innerHeight
        : container.scrollHeight - container.clientHeight
      const goal = Math.max(0, Math.min(max, to))
      if (Math.abs(goal - from) < 2) return resolve(goal)
      const t0 = performance.now()
      const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)
      const tick = (now) => {
        const p = Math.min(1, (now - t0) / ms)
        const v = from + (goal - from) * ease(p)
        if (isWin) window.scrollTo({ top: v, behavior: 'instant' })
        else container.scrollTop = v
        if (p < 1) requestAnimationFrame(tick)
        else resolve(goal)
      }
      requestAnimationFrame(tick)
    })
  window.__nestorScroller = (el) => {
    for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
      const style = getComputedStyle(node)
      if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 4) return node
    }
    return null
  }
}

// ---------------------------------------------------------------------------------------------
// A recording session: one browser, one page, a screencast, marks and compressible ranges.
// ---------------------------------------------------------------------------------------------
async function openSession(beat, { auth = true } = {}) {
  const dir = sessionDir(beat)
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  // --force-device-scale-factor is not belt-and-braces with the context's deviceScaleFactor, it is
  // the whole trick. Setting deviceScaleFactor alone makes Chrome *render* at 2x, but the DevTools
  // screencast (and Page.captureScreenshot) still hand back a frame downscaled to the CSS viewport,
  // so the extra detail is thrown away before it reaches us. Forcing the scale factor at launch
  // makes the screencast itself 3200x1800. Measured on the dev site: both flags -> 3200x1800 at
  // ~60 fps; deviceScaleFactor alone, at any maxWidth -> 1600x900.
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--lang=en-US', ...(DPR === 1 ? [] : [`--force-device-scale-factor=${DPR}`])],
  })
  const ctx = await browser.newContext({
    viewport: SIZE,
    deviceScaleFactor: DPR,
    locale: 'en-US',
    timezoneId: 'America/Chicago', // Austin: timestamps on screen match the search
    storageState: auth && fs.existsSync(AUTH) ? AUTH : undefined,
  })
  await ctx.addInitScript(pointerScript)
  const page = await ctx.newPage()
  page.setDefaultTimeout(20_000)

  const cdp = await ctx.newCDPSession(page)
  const frames = []
  const writes = []
  cdp.on('Page.screencastFrame', (frame) => {
    const file = `f${String(frames.length).padStart(6, '0')}.jpg`
    frames.push({ file, t: frame.metadata.timestamp })
    writes.push(fs.promises.writeFile(path.join(dir, file), Buffer.from(frame.data, 'base64')))
    cdp.send('Page.screencastFrameAck', { sessionId: frame.sessionId }).catch(() => {})
  })
  await cdp.send('Page.startScreencast', {
    format: 'jpeg',
    quality: JPEG_QUALITY,
    // Device pixels, not CSS pixels: at DPR 2 the surface is 3200x1800 and a smaller cap here would
    // quietly hand back a downscaled frame, which is the very thing this is meant to avoid.
    maxWidth: FRAME.width,
    maxHeight: FRAME.height,
    everyNthFrame: 1,
  })

  const now = () => Date.now() / 1000
  const s = {
    beat,
    page,
    ctx,
    dir,
    marks: [],
    ranges: [],
    notes: [],
    mouse: { x: 800, y: 450 },
    mark(name) {
      s.marks.push({ name, t: now() })
      console.log(`  [${beat}] ${name}`)
    },
    regions: {},
    /**
     * Where something is on screen, so the editor can punch in on it. Always CSS pixels in the
     * 1600x900 space that ui.tsx's SRC_W/SRC_H and FOCUS rectangles use, whatever DPR the clip
     * was filmed at -- a 3200x1800 clip is the same picture, just denser.
     */
    async region(name, locator) {
      const box = await locator.first().boundingBox({ timeout: 1500 }).catch(() => null)
      if (box) s.regions[name] = { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height), at: now() }
    },
    note(text) {
      s.notes.push(text)
      console.log(`  [${beat}] note: ${text}`)
    },
    /** Run a slow step; when the clip is cut the middle of it is sped up to about `to` seconds. */
    async compress(name, fn, { lead = 2, tail = 1, to = 3.5 } = {}) {
      const t0 = now()
      const result = await fn()
      const t1 = now()
      const a = t0 + lead
      const b = t1 - tail
      if (b - a > to + 1) s.ranges.push({ name, a, b, to })
      return result
    },
    async finish({ shows, saveAuth = auth } = {}) {
      // Nothing here may hang: a take on production cannot be repeated. The frames and marks are
      // written to disk first, so `recut` can always rebuild the clip.
      const within = (label, promise, ms = 12_000) => {
        let timer
        const timeout = new Promise((resolve) => {
          timer = setTimeout(() => {
            console.log(`  [${beat}] finish: "${label}" timed out, moving on`)
            resolve(undefined)
          }, ms)
        })
        return Promise.race([promise, timeout])
          .catch((error) => console.log(`  [${beat}] finish: "${label}" failed: ${error.message.split('\n')[0]}`))
          .finally(() => clearTimeout(timer))
      }
      const endWall = now()
      const errors = await within(
        'toasts',
        page.locator('[data-sonner-toast][data-type="error"]').allInnerTexts(),
        4000,
      )
      if (Array.isArray(errors) && errors.length) s.note(`error toast on screen at the end: ${errors.join(' | ')}`)
      await within('stop screencast', cdp.send('Page.stopScreencast'), 5000)
      await Promise.all(writes)
      const session = { beat, target: TARGET, shows, frames, marks: s.marks, ranges: s.ranges, notes: s.notes, regions: s.regions, endWall }
      writeJson(path.join(dir, 'session.json'), session)
      if (saveAuth) await within('storage state', ctx.storageState({ path: AUTH }))
      await within('close context', ctx.close(), 6000)
      await within('close browser', browser.close(), 4000)
      return cut(session, dir)
    },
    async abort(error) {
      console.log(`  [${beat}] FAILED: ${String(error?.message ?? error).split('\n')[0]}`)
      await page.screenshot({ path: path.join(TMP, `fail-${TARGET}-${beat}.png`) }).catch(() => {})
      await cdp.send('Page.stopScreencast').catch(() => {})
      await Promise.all(writes).catch(() => {})
      await ctx.close().catch(() => {})
      await browser.close().catch(() => {})
    },
  }
  return s
}

/** Turn a session's frames into <beat>.mp4: cut to [start, end], compress ranges, 30 fps H.264. */
function cut(session, dir) {
  const { beat, frames, marks, ranges } = session
  const startMark = marks.find((m) => m.name === 'start')
  const endMark = [...marks].reverse().find((m) => m.name === 'end')
  const T0 = startMark ? startMark.t : frames[0].t
  const T1 = endMark ? endMark.t : session.endWall
  const live = ranges.filter((r) => r.b > T0 && r.a < T1).sort((x, y) => x.a - y.a)

  // Wall-clock time -> clip time. Inside a compressed range time runs at to/(b-a).
  const mapTime = (t) => {
    let out = 0
    let cursor = T0
    const clamped = Math.max(T0, Math.min(T1, t))
    for (const r of live) {
      if (clamped <= r.a) break
      out += r.a - cursor
      const inside = Math.min(clamped, r.b) - r.a
      out += inside * (r.to / (r.b - r.a))
      cursor = r.b
      if (clamped <= r.b) return out
    }
    return out + (clamped - cursor)
  }

  // The frame on screen at T0 is the last one at or before it.
  let first = 0
  for (let i = 0; i < frames.length; i++) if (frames[i].t <= T0) first = i
  const used = frames.slice(first).filter((f, i) => i === 0 || f.t < T1)
  const lines = []
  for (let i = 0; i < used.length; i++) {
    const at = mapTime(used[i].t)
    const next = i + 1 < used.length ? mapTime(used[i + 1].t) : mapTime(T1)
    const duration = Math.max(0.001, next - at)
    lines.push(`file '${path.join(dir, used[i].file)}'`, `duration ${duration.toFixed(4)}`)
  }
  lines.push(`file '${path.join(dir, used[used.length - 1].file)}'`)
  const list = path.join(dir, 'concat.txt')
  fs.writeFileSync(list, lines.join('\n'))

  // What the screencast actually delivered. Scaling 1600x900 frames up to a 3200x1800 clip would
  // look like a win in ffprobe and like nothing at all on screen, so say so instead of faking it.
  const probed = execFileSync('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height',
    '-of', 'csv=p=0', path.join(dir, used[0].file),
  ]).toString().trim()
  if (probed !== `${FRAME.width},${FRAME.height}`) {
    console.log(`  [${beat}] WARNING: frames are ${probed.replace(',', 'x')} but the clip is being written at ${FRAME.width}x${FRAME.height}.`)
    console.log(`  [${beat}]          Nothing is gained by enlarging them; check --force-device-scale-factor.`)
  }

  const target = path.join(OUT, `${beat}.mp4`)
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list,
    '-vf', `fps=30,scale=${FRAME.width}:${FRAME.height}:flags=lanczos:in_range=full:out_range=tv,format=yuv420p`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', CRF, '-movflags', '+faststart',
    '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-an', target,
  ])
  const duration = Number(
    execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', target])
      .toString()
      .trim(),
  )

  const moments = {}
  for (const m of marks) {
    if (m.name === 'start' || m.name === 'end' || m.t < T0 || m.t > T1) continue
    moments[m.name] = round(mapTime(m.t))
  }
  const entry = {
    file: `clips/${beat}.mp4`,
    duration: round(duration),
    size: `${FRAME.width}x${FRAME.height}`,
    fps: 30,
    // Only said out loud when it is not the historical 1x, so default meta.json stays byte-identical.
    ...(DPR === 1 ? {} : { dpr: DPR, sourceSpace: `${SIZE.width}x${SIZE.height} CSS pixels (FOCUS rectangles use these)` }),
    recordedOn: session.target === 'prod' ? 'production (standing-elephant-306.convex.site)' : 'local dev site (throwaway account)',
    shows: session.shows ?? '',
    spedUp: live.map((r) => ({
      what: r.name,
      clipFrom: round(mapTime(r.a)),
      clipTo: round(mapTime(r.b)),
      realSeconds: round(r.b - r.a),
      factor: round((r.b - r.a) / r.to),
    })),
    moments,
    regions: Object.fromEntries(
      Object.entries(session.regions ?? {}).map(([name, r]) => [name, { x: r.x, y: r.y, w: r.w, h: r.h, validFrom: round(mapTime(r.at)) }]),
    ),
    notes: session.notes,
  }
  const metaFile = path.join(OUT, 'meta.json')
  const meta = readJson(metaFile, { about: 'Beat clips for the Nestor demo. Times are seconds within each clip.', clips: {} })
  meta.clips[beat] = entry
  writeJson(metaFile, meta)
  console.log(`${beat}: ${duration.toFixed(1)}s -> ${path.relative(ROOT, target)}  (${used.length} frames)`)
  return entry
}

// ---------------------------------------------------------------------------------------------
// Acting: pointer travel, clicks, typing, glides.
// ---------------------------------------------------------------------------------------------
async function moveTo(s, x, y, { ms } = {}) {
  const from = { ...s.mouse }
  const dist = Math.hypot(x - from.x, y - from.y)
  if (dist < 2) return
  const duration = ms ?? Math.min(950, Math.max(320, dist * 0.95))
  const steps = Math.max(12, Math.round(duration / 14))
  // A slight arc reads as a hand, a straight line reads as a script.
  const bow = Math.min(40, dist * 0.08) * (x > from.x ? -1 : 1)
  const t0 = Date.now()
  for (let i = 1; i <= steps; i++) {
    const p = i / steps
    const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2
    const arc = Math.sin(Math.PI * e) * bow
    await s.page.mouse.move(from.x + (x - from.x) * e, from.y + (y - from.y) * e + arc)
    const due = t0 + (duration * i) / steps
    const wait = due - Date.now()
    if (wait > 0) await sleep(wait)
  }
  s.mouse = { x, y }
}

/**
 * Park the pointer in the empty space just past the END OF THE TEXT, not on top of it.
 *
 * A bounding box is the wrong thing to measure here: a paragraph's box is as wide as its column,
 * so "right edge + gap" lands off the card even though the last line stops half way. Measuring the
 * element's client rects gives one rect per rendered line, so the last one ends where the words
 * actually end and the gap after it is genuinely blank. Take 1's worst habit was resting the
 * pointer on the very sentence the editor then enlarged; this is the fix for that.
 */
async function parkBeside(s, locator, { gap = 40, dy = 0, maxX = 1566, ms = 900 } = {}) {
  const spot = await locator
    .first()
    .evaluate((el, g) => {
      const range = document.createRange()
      range.selectNodeContents(el)
      const lines = [...range.getClientRects()].filter((r) => r.width > 2 && r.height > 2)
      const last = lines[lines.length - 1]
      const box = last ?? el.getBoundingClientRect()
      return { x: box.right + g, y: box.top + box.height / 2 }
    }, gap)
    .catch(() => null)
  if (!spot) return false
  await moveTo(s, Math.min(maxX, spot.x), spot.y + dy, { ms })
  return true
}

/** Glide so the element sits at `at` (0 top, 1 bottom) of its scroll container, if it is not comfortably in view. */
async function bringIntoView(s, locator, { at = 0.5, ms = 900, force = false } = {}) {
  await locator.waitFor({ state: 'visible' })
  await locator.evaluate(
    async (el, { at, ms, force }) => {
      const scroller = window.__nestorScroller(el)
      const box = el.getBoundingClientRect()
      const view = scroller ? scroller.getBoundingClientRect() : { top: 0, height: window.innerHeight }
      const mid = box.top + box.height / 2 - view.top
      const comfortable = box.top - view.top > 90 && box.bottom - view.top < view.height - 110
      if (comfortable && !force) return
      const delta = mid - view.height * at
      const from = scroller ? scroller.scrollTop : window.scrollY
      await window.__nestorGlide(scroller, from + delta, ms)
    },
    { at, ms, force },
  )
  await sleep(250)
}

async function centreOf(locator, { dx = 0, dy = 0 } = {}) {
  const box = await locator.boundingBox()
  if (!box) throw new Error('element has no box')
  return { x: box.x + box.width / 2 + dx, y: box.y + box.height / 2 + dy }
}

async function hover(s, locator, opts = {}) {
  await bringIntoView(s, locator, opts)
  const { x, y } = await centreOf(locator, opts)
  await moveTo(s, x, y)
}

async function click(s, locator, opts = {}) {
  await hover(s, locator, opts)
  await sleep(opts.dwell ?? 260)
  await s.page.mouse.down()
  await sleep(70)
  await s.page.mouse.up()
  await sleep(opts.after ?? 350)
}

async function type(s, locator, text, { delay = 45, enter = false, after = 380, ...opts } = {}) {
  await click(s, locator, { after: 200, ...opts })
  // Some fields arrive with a starting value; typing replaces it, as a person would.
  if ((await locator.inputValue().catch(() => '')) !== '') {
    await s.page.keyboard.press('ControlOrMeta+A')
    await sleep(220)
  }
  await s.page.keyboard.type(text, { delay })
  if (enter) {
    await sleep(160)
    await s.page.keyboard.press('Enter')
  }
  await sleep(after)
}

/** A native <select> opens an OS popup the recording cannot see, so point at it and set the value. */
async function choose(s, locator, value) {
  await hover(s, locator)
  await sleep(250)
  await s.page.evaluate(() => window.__nestorRing())
  await sleep(180)
  await locator.selectOption(value)
  await sleep(450)
}

const glideWindow = (s, to, ms) => s.page.evaluate(([to, ms]) => window.__nestorGlide(null, to, ms), [to, ms])

async function settle(page) {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.evaluate(() => document.fonts.ready).catch(() => {})
}

/** Open the app signed in. Signs in off camera when the saved session has gone stale. */
async function openApp(s, route = '/app') {
  const { page } = s
  await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' })
  await Promise.race([
    page.locator('nav[aria-label="App"]').first().waitFor({ timeout: 25_000 }),
    page.waitForURL(/\/signin/, { timeout: 25_000 }),
    page.waitForURL(/\/onboarding/, { timeout: 25_000 }),
  ]).catch(() => {})
  if (/\/signin/.test(page.url())) {
    const { email, password } = credentials()
    console.log(`  [${s.beat}] saved session was stale, signing in off camera`)
    await page.fill('input[name="email"]', email)
    await page.fill('input[name="password"]', password)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await page.waitForURL(/\/(app|onboarding)/, { timeout: 30_000 })
    if (!page.url().includes(route)) await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' })
  }
  await settle(page)
  await sleep(900)
}

/**
 * On a listing page the conversation column is sticky and scrolls on its own. Until the window has
 * scrolled past the page header, the column's lower part hangs below the viewport, so dock it first.
 */
async function dockConversation(s, ms = 900) {
  const y = await s.page.evaluate(() => {
    const inside = document.querySelector('section[aria-label^="Conversation"]') ?? document.querySelector('main h2')
    const column = inside?.closest('[class*="lg:max-h"]')
    return column ? Math.max(0, Math.round(column.getBoundingClientRect().top + window.scrollY - 24)) : 0
  })
  await glideWindow(s, y, ms)
  await sleep(250)
}

const holdScroll = (s) => s.page.evaluate(() => (window.__nestorHoldScroll = true))

const listingUrl = () => {
  if (!state.listingId) throw new Error('No listing chosen yet: record the "listing" beat first.')
  return `/app/listings/${state.listingId}`
}

const sidebarLink = (page, label) => page.locator('nav[aria-label="App"]').first().getByRole('link', { name: label })

/** A pipeline column, by its label. Empty columns fold down to a rail and say "empty" instead of a count. */
const column = (page, label) =>
  page.locator(`section[aria-labelledby="pipeline-heading"] section[aria-label^="${label}: "]`)

/**
 * Arms a second, unrecorded browser that is signed in as the same person and sitting on a draft
 * that is already waiting, with its finger over "Approve and send". Nothing happens until fire().
 *
 * It is a separate browser, not a second tab, for a mechanical reason: the DevTools screencast only
 * emits frames for a *visible* page, so giving another tab in the same window the focus would stall
 * the recording at the exact moment there is something to see. It signs in fresh rather than
 * loading auth.json, so its session is its own and token rotation cannot log the recorded tab out
 * mid-take, and it never writes auth.json back -- the recorded session owns that file.
 */
async function prepareApproval(listingId) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--lang=en-US'] })
  const ctx = await browser.newContext({ viewport: SIZE, locale: 'en-US', timezoneId: 'America/Chicago' })
  const page = await ctx.newPage()
  page.setDefaultTimeout(30_000)
  const close = async () => {
    await ctx.close().catch(() => {})
    await browser.close().catch(() => {})
  }
  try {
    const { email, password } = credentials()
    await page.goto(`${BASE}/signin`, { waitUntil: 'domcontentloaded' })
    await page.fill('input[name="email"]', email)
    await page.fill('input[name="password"]', password)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await page.waitForURL(/\/(app|onboarding)/, { timeout: 30_000 })
    await page.goto(`${BASE}/app/listings/${listingId}`, { waitUntil: 'domcontentloaded' })
    const approve = page
      .locator('section[aria-label="Draft waiting for your approval"]')
      .getByRole('button', { name: 'Approve and send' })
    await approve.waitFor({ timeout: 30_000 })
    return { fire: () => approve.click(), close }
  } catch (error) {
    await close()
    throw error
  }
}

// ---------------------------------------------------------------------------------------------
// The beats.
// ---------------------------------------------------------------------------------------------
const BEATS = {
  async landing() {
    const s = await openSession('landing', { auth: false })
    try {
      const { page } = s
      await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
      await settle(page)
      await page.mouse.move(1180, 520)
      s.mouse = { x: 1180, y: 520 }
      await sleep(1600)
      s.mark('start')
      await moveTo(s, 980, 430, { ms: 900 })
      await sleep(2200)
      const height = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)
      const stops = await page.evaluate(() =>
        [...document.querySelectorAll('main section, main > div > section, footer')]
          .map((el) => Math.round(el.getBoundingClientRect().top + window.scrollY - 70))
          .filter((y, i, all) => y > 200 && all.indexOf(y) === i)
          .sort((a, b) => a - b),
      )
      // Keep stops at least 500px apart, and finish at the very bottom.
      const hops = []
      for (const y of stops) if (y < height - 250 && (hops.length === 0 || y - hops[hops.length - 1] > 500)) hops.push(y)
      hops.push(height)
      s.mark('scroll down begins')
      const budget = 15_500
      const travel = budget - hops.length * 520
      let from = 0
      for (const y of hops) {
        const ms = Math.max(650, (travel * (y - from)) / height)
        await glideWindow(s, y, ms)
        from = y
        await sleep(520)
      }
      s.mark('bottom of page')
      await sleep(1300)
      s.mark('scroll back up begins')
      await glideWindow(s, 0, 3300)
      s.mark('back at the hero')
      await sleep(700)
      await hover(s, page.locator('main').getByRole('link', { name: 'Launch app' }).first())
      await sleep(1500)
      s.mark('end')
      return await s.finish({
        saveAuth: false,
        shows: 'The landing page from the hero: an eased glide down through every section to the footer, a faster glide back up, and the pointer coming to rest on "Launch app".',
      })
    } catch (error) {
      await s.abort(error)
      throw error
    }
  },

  async signup() {
    const s = await openSession('signup', { auth: false })
    try {
      const { page } = s
      const { email, password } = credentials()
      await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
      await settle(page)
      await page.mouse.move(1100, 560)
      s.mouse = { x: 1100, y: 560 }
      await sleep(1200)
      s.mark('start')
      await sleep(700)
      await click(s, page.locator('main').getByRole('link', { name: 'Launch app' }).first(), { after: 200 })
      s.mark('clicked Launch app')
      await page.waitForURL(/\/signin/)
      await page.locator('input[name="email"]').waitFor()
      s.mark('sign-in page')
      await sleep(1100)
      await click(s, page.getByRole('button', { name: 'Create an account' }))
      s.mark('switched to Create your account')
      await sleep(500)
      await type(s, page.locator('input[name="email"]'), email)
      s.mark('email typed')
      await type(s, page.locator('input[name="password"]'), password)
      s.mark('password typed')
      await click(s, page.getByRole('button', { name: 'Create account', exact: true }), { after: 100 })
      s.mark('clicked Create account')
      const outcome = await Promise.race([
        page.waitForURL(/\/(onboarding|app)(\/|$|\?)/, { timeout: 30_000 }).then(() => 'in'),
        page.locator('[role="alert"]').waitFor({ timeout: 30_000 }).then(() => 'refused'),
      ])
      if (outcome === 'refused') {
        s.note('Registration was refused (the account already exists), so the clip shows "Sign in instead" and a sign-in.')
        s.mark('account already exists')
        await sleep(1400)
        await click(s, page.getByRole('button', { name: 'Sign in instead' }))
        await sleep(400)
        await click(s, page.getByRole('button', { name: 'Sign in', exact: true }), { after: 100 })
        s.mark('clicked Sign in')
        await page.waitForURL(/\/(onboarding|app)(\/|$|\?)/, { timeout: 30_000 })
      }
      await page.getByRole('heading', { level: 1 }).first().waitFor()
      s.mark(page.url().includes('/onboarding') ? 'onboarding opens' : 'dashboard opens')
      state.registered = true
      saveState()
      await settle(page)
      await sleep(2200)
      s.mark('end')
      await sleep(300)
      return await s.finish({
        saveAuth: true,
        shows: 'Landing hero, a click on "Launch app", the sign-in page, "Create an account", the email and password typed by hand, "Create account", and the first onboarding step opening.',
      })
    } catch (error) {
      // Whatever happened, keep the session if one exists: registration cannot be filmed twice.
      await s.ctx.storageState({ path: AUTH }).catch(() => {})
      await s.abort(error)
      throw error
    }
  },

  async onboarding() {
    const s = await openSession('onboarding')
    try {
      const { page } = s
      await openApp(s, '/onboarding')
      if (!page.url().includes('/onboarding')) throw new Error('This account already has a profile: onboarding cannot be filmed again.')
      await page.getByRole('heading', { name: 'First, what are you looking for?' }).waitFor()
      // The date field follows the operating system's date order, not the page's locale. Find out
      // which one this machine uses before the camera matters, then put the field back.
      const [yyyy, mm, dd] = PROFILE.moveIn.split('-')
      const probe = page.getByLabel('Move-in date')
      const original = await probe.inputValue()
      await probe.click({ position: { x: 24, y: 20 } })
      await page.keyboard.type(`${mm}${dd}${yyyy}`)
      const monthFirst = (await probe.inputValue()) === PROFILE.moveIn
      await probe.fill(original)
      await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : null))
      await page.mouse.move(1180, 640)
      s.mouse = { x: 1180, y: 640 }
      await sleep(800)
      s.mark('start')
      await sleep(900)

      // Step 1: you and your search.
      await type(s, page.getByLabel('Your name'), PROFILE.name)
      await type(s, page.getByLabel('City'), PROFILE.city)
      s.mark('name and city typed')
      for (const hood of PROFILE.neighborhoods) {
        await type(s, page.getByLabel('Neighborhoods you like'), hood, { enter: true, after: 260 })
      }
      s.mark('neighborhoods added')
      await type(s, page.getByLabel('Most you can pay each month'), PROFILE.budgetMax)
      s.mark('maximum budget typed (private-budget note visible below)')
      await type(s, page.getByLabel('Least you expect to pay (optional)'), PROFILE.budgetMin)
      await sleep(500)
      await click(s, page.getByRole('radiogroup', { name: 'Bedrooms, at least' }).getByRole('radio', { name: PROFILE.bedrooms, exact: true }))
      for (const item of PROFILE.mustHaves) await click(s, page.getByRole('button', { name: item, exact: true }))
      for (const item of PROFILE.customMustHaves) {
        await type(s, page.getByLabel('Add your own must-have'), item, { enter: true, after: 300 })
      }
      s.mark('must-haves chosen')
      const moveIn = page.getByLabel('Move-in date')
      await click(s, moveIn, { dx: -120 })
      await page.keyboard.type(monthFirst ? `${mm}${dd}${yyyy}` : `${dd}${mm}${yyyy}`, { delay: 90 })
      if ((await moveIn.inputValue()) !== PROFILE.moveIn) await moveIn.fill(PROFILE.moveIn)
      await sleep(350)
      await choose(s, page.getByLabel('Lease length'), PROFILE.leaseMonths)
      s.mark('step 1 complete')
      await sleep(500)
      await click(s, page.getByRole('button', { name: 'Continue' }), { after: 200 })
      await page.getByRole('heading', { name: 'Now, what should a landlord know?' }).waitFor()
      s.mark('step 2 opens')
      await sleep(1100)

      // Step 2: Passport facts. The preview on the right fills in as these are typed.
      await type(s, page.getByLabel('One-line introduction'), PROFILE.headline, { delay: 34 })
      await type(s, page.getByLabel('What you do'), PROFILE.occupation, { delay: 34 })
      await type(s, page.getByLabel('A few words to landlords'), PROFILE.bio, { delay: 26 })
      s.mark('introduction typed (Passport preview filling in)')
      const yes = (group) => page.getByRole('radiogroup', { name: group }).getByRole('radio', { name: 'Yes' })
      const no = (group) => page.getByRole('radiogroup', { name: group }).getByRole('radio', { name: 'No' })
      await click(s, yes('Any pets?'))
      await type(s, page.getByLabel('Tell landlords about them'), PROFILE.pets, { delay: 34 })
      s.mark('pet described')
      if ((await no('Do you smoke?').getAttribute('aria-checked')) !== 'true') await click(s, no('Do you smoke?'))
      else await hover(s, no('Do you smoke?'))
      await click(s, yes('Rented before?'))
      await choose(s, page.getByLabel('Credit score range'), PROFILE.credit)
      await choose(s, page.getByLabel('Household income range'), PROFILE.income)
      s.mark('step 2 complete')
      await sleep(600)
      await click(s, page.getByRole('button', { name: 'Continue' }), { after: 200 })
      await page.getByRole('heading', { name: 'Last, what should Nestor ask for?' }).waitFor()
      s.mark('step 3 opens')
      await sleep(1100)

      // Step 3: what to negotiate.
      for (const goal of PROFILE.goals) {
        const button = page.getByRole('button', { name: new RegExp(`^${goal}`) })
        if ((await button.getAttribute('aria-pressed')) !== 'true') await click(s, button, { after: 420 })
      }
      s.mark('goals chosen')
      await sleep(900)
      await click(s, page.getByRole('button', { name: 'Open my dashboard' }), { after: 100 })
      s.mark('clicked Open my dashboard')
      await page.waitForURL(/\/app(\/|$|\?)/, { timeout: 30_000 })
      await page.getByText('Your board is empty').waitFor({ timeout: 30_000 })
      s.mark('dashboard opens')
      await sleep(3000)
      s.mark('end')
      await sleep(300)
      return await s.finish({
        shows: 'All three onboarding steps filled in by hand: search (city, neighborhoods, private budget, must-haves, move-in), Passport facts with the live landlord preview on the right, negotiation goals, then "Open my dashboard" and the empty dashboard.',
      })
    } catch (error) {
      await s.ctx.storageState({ path: AUTH }).catch(() => {})
      await s.abort(error)
      throw error
    }
  },

  async discover() {
    const s = await openSession('discover')
    try {
      const { page } = s
      await openApp(s, '/app')
      const button = page.getByRole('button', { name: 'Find real listings for me' })
      await button.waitFor()
      await sleep(600)
      s.mark('start')
      await moveTo(s, 760, 300, { ms: 700 })
      await sleep(900)
      await click(s, button, { after: 100, at: 0.62 })
      s.mark('clicked Find real listings for me')
      // Scoped to the board: the activity feed links to listings too, and its lines mention the Scout.
      const board = page.locator('section[aria-labelledby="pipeline-heading"]')
      const cards = board.locator('a[href^="/app/listings/"]')
      const scored = board.locator('a[href^="/app/listings/"]:has([role="img"][aria-label*="out of 100"])')
      const reading = board.locator('a[href^="/app/listings/"]:has-text("Scout")')
      await s.compress('Firecrawl searching the web', () => cards.first().waitFor({ timeout: 90_000 }), { lead: 2.4, tail: 0.8, to: 2 })
      s.mark('scouting cards appear')
      await sleep(600)
      await bringIntoView(s, page.locator('#pipeline-heading'), { at: 0.1, ms: 1000, force: true })
      await s.compress('Firecrawl reading the first listing pages', () => scored.first().waitFor({ timeout: 120_000 }), {
        lead: 2.5,
        tail: 1.2,
        to: 3,
      })
      s.mark('first scored card')
      await s.compress(
        'the rest of the cards filling in',
        async () => {
          const deadline = Date.now() + 100_000
          while (Date.now() < deadline && (await reading.count()) > 0) await sleep(500)
        },
        { lead: 1.5, tail: 1.2, to: 4.5 },
      )
      s.mark('all cards scored')
      await bringIntoView(s, page.locator('#pipeline-heading'), { at: 0.1, ms: 900, force: true })
      const left = await reading.count()
      if (left > 0) s.note(`${left} card(s) were still being read when the clip ended`)
      s.note(`${await scored.count()} scored cards on the board`)
      await sleep(1200)
      await hover(s, scored.first())
      await sleep(2600)
      s.mark('end')
      await sleep(300)
      return await s.finish({
        shows: 'The empty dashboard, a click on "Find real listings for me" (a real Firecrawl web search), scouting cards appearing, then filling in live with photos, rent and match scores. Ends with the pointer on the first scored card.',
      })
    } catch (error) {
      await s.abort(error)
      throw error
    }
  },

  async listing() {
    const s = await openSession('listing')
    try {
      const { page } = s
      await openApp(s, '/app')
      await page.locator('a[href^="/app/listings/"] [role="img"][aria-label*="out of 100"]').first().waitFor({ timeout: 30_000 })
      // The best real listing: highest score, with a photo, never a sample.
      const pick = await page.evaluate((preferred) => {
        const rows = [...document.querySelectorAll('section[aria-labelledby="pipeline-heading"] a[href^="/app/listings/"]')].map((a) => {
          const label = a.querySelector('[role="img"][aria-label*="out of 100"]')?.getAttribute('aria-label') ?? ''
          const img = a.querySelector('img')
          return {
            href: a.getAttribute('href'),
            score: Number(/(\d+) out of 100/.exec(label)?.[1] ?? -1),
            sample: /Sample/.test(a.textContent ?? ''),
            photo: Boolean(img && img.naturalWidth > 40),
            staged: /Writing|Needs your OK|Awaiting|Negotiating|Tour booked|Terms|Declined|Closed/.test(a.textContent ?? ''),
          }
        })
        const usable = rows.filter((r) => r.score >= 0 && !r.staged)
        const kept = preferred && usable.find((r) => r.href.endsWith(preferred))
        if (kept) return kept
        const real = usable.filter((r) => !r.sample)
        const pool = real.length ? real : usable
        return pool.sort((a, b) => Number(b.photo) - Number(a.photo) || b.score - a.score)[0] ?? null
      }, process.env.LISTING ?? null)
      if (!pick) throw new Error('No scored listing on the board')
      if (pick.sample) s.note('Only sample listings were on the board, so a sample listing was opened.')
      state.listingId = pick.href.split('/').pop()
      saveState()
      const card = page.locator(`section[aria-labelledby="pipeline-heading"] a[href="${pick.href}"]`).first()
      await bringIntoView(s, card, { at: 0.5, ms: 900 })
      await sleep(500)
      s.mark('start')
      await sleep(600)
      await click(s, card, { after: 100 })
      s.mark('clicked the listing card')
      await page.getByRole('heading', { level: 1 }).first().waitFor()
      await page.getByText('Let Nestor write to the landlord').or(page.getByText('Conversation', { exact: true })).first().waitFor()
      await settle(page)
      s.mark('listing page open (photos, rent, title)')
      await moveTo(s, 520, 470, { ms: 800 })
      await sleep(2200)
      // The left column scrolls with the window; the conversation column is sticky.
      const match = page.getByText(/(Great|Good|Partial|Weak) match/).first()
      if (await match.count()) {
        await bringIntoView(s, match, { at: 0.28, ms: 1300, force: true })
        s.mark('match score and reasons')
        await moveTo(s, 470, 330, { ms: 700 })
        await sleep(3000)
      }
      const fees = page.getByText(/worth raising|Worth raising|Fees/).first()
      if (await fees.count()) {
        await bringIntoView(s, fees, { at: 0.3, ms: 1300, force: true })
        s.mark('fees and facts')
        await sleep(2800)
      }
      const contact = page.getByText('Landlord contact').first()
      if (await contact.count()) {
        await bringIntoView(s, contact, { at: 0.45, ms: 1200, force: true })
        s.mark('landlord contact section')
        await sleep(2000)
      }
      await glideWindow(s, 0, 1500)
      s.mark('back at the top')
      await sleep(1500)
      s.mark('end')
      await sleep(300)
      return await s.finish({
        shows: 'From the board, a click on the best real listing; the listing page with photos and rent; a glide down to the match score with its reasons, the fees and facts, and the landlord contact section; then back to the top.',
      })
    } catch (error) {
      await s.abort(error)
      throw error
    }
  },

  async draft() {
    const s = await openSession('draft')
    try {
      const { page } = s
      await openApp(s, listingUrl())
      const demo = page.getByRole('button', { name: /demo landlord/i })
      const existing = page.locator('section[aria-label="Draft waiting for your approval"]')
      await demo.or(existing).first().waitFor()
      const already = (await existing.count()) > 0
      if (already) s.note('The conversation had already been started, so this take shows the draft without the click that created it.')
      await sleep(700)
      s.mark('start')
      await moveTo(s, 1150, 330, { ms: 800 })
      await sleep(1500)
      if (!already) {
        await click(s, demo, { after: 100 })
        s.mark('clicked the demo landlord button')
      }
      const card = page.locator('section[aria-label="Draft waiting for your approval"]')
      await s.compress('OpenAI writing the first email', () => card.waitFor({ timeout: 90_000 }), { lead: 2.2, tail: 1, to: 3 })
      s.mark('draft appears')
      await sleep(1100)
      await dockConversation(s, 1000)
      const approve = card.getByRole('button', { name: 'Approve and send' })
      // One composition: subject, the whole email, the reasoning and the buttons.
      await bringIntoView(s, approve, { at: 0.9, ms: 1300, force: true })
      s.mark('draft email readable (AI-disclosure sentence on screen)')
      await s.region('draft email body', card.getByLabel('Email'))
      await s.region('why Nestor wrote it this way', card.getByText('Why Nestor wrote it this way').locator('xpath=ancestor::div[2]'))
      const body = card.getByLabel('Email')
      // The word-count caption sits directly under the email and its line stops early, so this
      // leaves the pointer in real whitespace beside the text the camera is about to enlarge
      // instead of on top of a word, which is what take 1 did.
      const caption = card.getByText(/\d+ words\./).first()
      if (!(await parkBeside(s, caption, { gap: 44 }))) {
        const bodyBox = await body.boundingBox()
        if (bodyBox) await moveTo(s, Math.min(1566, bodyBox.x + bodyBox.width + 18), bodyBox.y + bodyBox.height + 16, { ms: 900 })
      }
      await sleep(5200)
      const why = card.getByText('Why Nestor wrote it this way')
      if (await why.count()) {
        await parkBeside(s, why, { gap: 44 })
        s.mark('reasoning readable (Why Nestor wrote it this way)')
        await sleep(4200)
      } else s.note('This draft has no "Why Nestor wrote it this way" panel (template draft).')
      await hover(s, approve)
      s.mark('pointer on Approve and send (not clicked)')
      await sleep(1600)
      s.mark('end')
      await sleep(300)
      return await s.finish({
        shows: 'The listing page, a click on the demo-landlord button, the Negotiator\'s draft appearing with the "Written by OpenAI" badge, a pause on the email (the AI-assistant disclosure is in its opening lines), a pause on "Why Nestor wrote it this way", and the pointer resting on "Approve and send".',
      })
    } catch (error) {
      await s.abort(error)
      throw error
    }
  },

  async 'send-reply'() {
    const s = await openSession('send-reply')
    try {
      const { page } = s
      await openApp(s, listingUrl())
      const card = page.locator('section[aria-label="Draft waiting for your approval"]')
      const approve = card.getByRole('button', { name: 'Approve and send' })
      await approve.waitFor({ timeout: 30_000 })
      await dockConversation(s, 500)
      await bringIntoView(s, approve, { at: 0.9, ms: 600, force: true })
      const near = await centreOf(approve)
      await page.mouse.move(near.x + 190, near.y - 120)
      s.mouse = { x: near.x + 190, y: near.y - 120 }
      const emails = page.locator('ol[aria-label="Emails, oldest first"] > li')
      const before = await emails.count()
      await holdScroll(s)
      await sleep(700)
      s.mark('start')
      await sleep(900)
      await click(s, approve, { after: 100 })
      s.mark('clicked Approve and send')
      await card.waitFor({ state: 'detached', timeout: 60_000 })
      await emails.nth(before).waitFor({ timeout: 60_000 })
      s.mark('email sent (sent state, AgentMail badge)')
      await sleep(500)
      const sentBadge = emails.nth(before).getByText(/Sent via AgentMail|AgentMail/).first()
      if (await sentBadge.count()) {
        await bringIntoView(s, sentBadge, { at: 0.6, ms: 1000, force: true })
        await hover(s, sentBadge, { dx: 150, dy: 4 })
      }
      await s.compress('the email round trip through AgentMail to the demo landlord and back', () => emails.nth(before + 1).waitFor({ timeout: 180_000 }), {
        lead: 3.2,
        tail: 0.4,
        to: 4,
      })
      s.mark('reply arrives')
      await bringIntoView(s, emails.nth(before + 1), { at: 0.5, ms: 1100, force: true })
      const understood = page.getByText('What Nestor understood').last()
      await s.compress('OpenAI reading the reply', () => understood.waitFor({ timeout: 90_000 }), { lead: 2.4, tail: 0.6, to: 2.5 })
      s.mark('analysis appears')
      await sleep(400)
      await bringIntoView(s, understood, { at: 0.36, ms: 1200, force: true })
      s.mark('chips visible (What Nestor understood, Read by OpenAI)')
      await s.region('what Nestor understood', understood.locator('xpath=ancestor::div[2]'))
      const label = page.getByText(/Read by OpenAI/).last()
      if (await label.count()) {
        // Rest the pointer just under the label's right end, where it covers nothing.
        const box = await label.boundingBox()
        if (box) await moveTo(s, Math.min(box.x + box.width + 22, 1570), box.y + box.height / 2 + 4)
      }
      else s.note('No "Read by OpenAI" label: the reply was read by pattern matching.')
      await sleep(5500)
      s.mark('end')
      await sleep(300)
      return await s.finish({
        shows: 'A click on "Approve and send", the draft turning into a sent email, the wait for the demo landlord (compressed), the reply arriving over real email, and the chips under "What Nestor understood" with the "Read by OpenAI" label.',
      })
    } catch (error) {
      await s.abort(error)
      throw error
    }
  },

  async delivery() {
    const s = await openSession('delivery')
    try {
      const { page } = s
      await openApp(s, listingUrl())
      const toggles = page.getByRole('button', { name: 'Delivery details' })
      await toggles.first().waitFor({ timeout: 30_000 })
      await holdScroll(s)
      await dockConversation(s, 500)
      await bringIntoView(s, toggles.first(), { at: 0.35, ms: 700, force: true })
      await sleep(600)
      s.mark('start')
      await sleep(800)
      await click(s, toggles.first())
      s.mark('delivery details open on the sent email')
      await s.region('delivery record (sent email)', page.locator('dl:has-text("Channel")').first())
      await sleep(4600)
      if ((await toggles.count()) > 1) {
        await bringIntoView(s, toggles.nth(1), { at: 0.4, ms: 1100, force: true })
        await click(s, toggles.nth(1))
        s.mark('delivery details open on the reply')
        await s.region('delivery record (reply)', page.locator('dl:has-text("Channel")').nth(1))
        await sleep(4000)
      }
      s.mark('end')
      await sleep(300)
      return await s.finish({
        shows: '"Delivery details" opened under the sent email and then under the landlord\'s reply: channel, AgentMail message id, AgentMail thread id, from, to, and the time to the second.',
      })
    } catch (error) {
      await s.abort(error)
      throw error
    }
  },

  async tour() {
    const s = await openSession('tour')
    try {
      const { page } = s
      await openApp(s, listingUrl())
      const chooseButton = page.getByRole('button', { name: 'Choose', exact: true }).first()
      await chooseButton.waitFor({ timeout: 30_000 })
      // If Nestor already drafted an answer to the reply, the tour choice replaces it.
      await holdScroll(s)
      await dockConversation(s, 500)
      await bringIntoView(s, chooseButton, { at: 0.45, ms: 700, force: true })
      await sleep(700)
      s.mark('start')
      await sleep(1200)
      await click(s, chooseButton, { after: 100 })
      s.mark('clicked Choose on a tour time (the tour shows as booked at once)')
      const card = page.locator('section[aria-label="Draft waiting for your approval"]')
      await sleep(700)
      const bookedNow = page.locator('section[aria-label="Tours"]').getByText(/Tour booked/).first()
      if (await bookedNow.count()) await bringIntoView(s, bookedNow, { at: 0.4, ms: 900, force: true })
      await sleep(900)
      await s.compress('OpenAI writing the confirmation', () => card.getByRole('button', { name: 'Approve and send' }).waitFor({ timeout: 90_000 }), {
        lead: 1.5,
        tail: 1,
        to: 2.5,
      })
      s.mark('confirmation draft appears')
      await bringIntoView(s, card.getByLabel('Email'), { at: 0.45, ms: 1200, force: true })
      await sleep(3200)
      const approve = card.getByRole('button', { name: 'Approve and send' })
      await click(s, approve, { at: 0.7, after: 100 })
      s.mark('clicked Approve and send on the confirmation')
      await s.compress('sending the confirmation', () => card.waitFor({ state: 'detached', timeout: 90_000 }), { lead: 1.5, tail: 0.6, to: 2 })
      s.mark('confirmation sent')
      await sleep(900)
      const banner = page.locator('section[aria-label="Tours"]').getByText(/Tour booked/).first()
      if (await banner.count()) {
        await bringIntoView(s, banner, { at: 0.62, ms: 1200, force: true })
        await hover(s, banner, { dx: 120, dy: 30 })
        await s.region('tour booked banner', page.locator('section[aria-label="Tours"]'))
      }
      s.mark('tour booked banner in view, under the sent confirmation')
      await sleep(3600)
      s.mark('end')
      await sleep(300)
      return await s.finish({
        shows: 'The tour times the landlord offered, a click on "Choose", Nestor drafting the confirmation, "Approve and send", and the "Tour booked" state.',
      })
    } catch (error) {
      await s.abort(error)
      throw error
    }
  },

  async dashboard() {
    const s = await openSession('dashboard')
    // LIVE_LISTING=<id> films the board while a second browser approves that listing's waiting
    // draft, so the card changing column and the feed ticking are real reactive updates rather
    // than a settled board being panned over. Unset, the beat is the settled tour it always was.
    const liveListing = process.env.LIVE_LISTING
    let armed = null
    try {
      const { page } = s
      await openApp(s, '/app')
      await page.locator('a[href^="/app/listings/"]').first().waitFor({ timeout: 30_000 })
      if (liveListing) {
        armed = await prepareApproval(liveListing)
        s.note('A second browser, signed in as the same person, approved the draft. The recorded tab was never clicked and never reloaded.')
      }
      await sleep(900)
      if (liveListing) {
        const href = `/app/listings/${liveListing}`
        const feedItems = page.locator('section[aria-label="Live activity"] ol > li')
        const before = await feedItems.count()
        // Both the board and the feed on screen at once: the card and the feed move together.
        await bringIntoView(s, page.locator('#pipeline-heading'), { at: 0.1, ms: 1200, force: true })
        await moveTo(s, 760, 700, { ms: 800 })
        await sleep(600)
        s.mark('start')
        await s.region('pipeline', page.locator('section[aria-labelledby="pipeline-heading"]'))
        await s.region('live activity feed', page.locator('section[aria-label="Live activity"]'))
        await sleep(1700)
        await armed.fire()
        s.mark('a second tab approved the draft (nothing is clicked or reloaded on camera)')
        await column(page, 'Awaiting reply').locator(`a[href="${href}"]`).waitFor({ timeout: 60_000 })
        s.mark('the card rises into Awaiting reply on its own')
        await sleep(2600)
        await feedItems.nth(before).waitFor({ timeout: 30_000 }).catch(() => {})
        s.mark('the activity feed ticks')
        await sleep(1500)
        // The demo landlord answers within seconds; the card moves a second time, unaided.
        await s.compress(
          'the demo landlord replying, on camera, with nothing touched',
          () => column(page, 'Negotiating').locator(`a[href="${href}"]`).waitFor({ timeout: 120_000 }),
          { lead: 1.6, tail: 0.6, to: 3 },
        )
        s.mark('the landlord replies and the card moves again, into Negotiating')
        await sleep(3800)
        await moveTo(s, 1240, 430, { ms: 800 })
        s.mark('pointer beside the live activity feed')
        await sleep(3000)
        await glideWindow(s, 0, 1100)
        await sleep(1500)
        s.mark('end')
        await sleep(300)
        return await s.finish({
          shows:
            'The dashboard, live. A second tab signed in as the same person approves a waiting draft; on camera the card rises out of "Needs your OK" into "Awaiting reply", the activity feed ticks, and when the demo landlord answers the card moves again into "Negotiating". Nothing is clicked or reloaded in the recorded tab.',
        })
      }
      s.mark('start')
      await moveTo(s, 700, 420, { ms: 800 })
      await sleep(1800)
      const tile = page.locator('section[aria-label="Your search at a glance"]').getByText(/^(Won|Saved)$/).first()
      if (await tile.count()) {
        await hover(s, tile, { dy: 26 })
        s.mark('pointer on the Won or Saved tile')
        await sleep(2200)
      }
      await bringIntoView(s, page.locator('#pipeline-heading'), { at: 0.12, ms: 1300, force: true })
      s.mark('pipeline in view')
      const staged = page.locator('a[href^="/app/listings/"]:has-text("Tour booked")').first()
      if (await staged.count()) await hover(s, staged)
      await sleep(2600)
      const feed = page.locator('[aria-label="Live activity"]').first()
      if (await feed.count()) {
        const box = await feed.boundingBox()
        if (box) await moveTo(s, box.x + box.width / 2, Math.min(box.y + 260, 700), { ms: 900 })
        s.mark('pointer on the live activity feed')
        await sleep(2400)
      }
      await click(s, page.getByRole('button', { name: 'Collapse sidebar' }), { after: 1700 })
      s.mark('sidebar collapsed')
      await click(s, page.getByRole('button', { name: 'Expand sidebar' }), { after: 1500 })
      s.mark('sidebar expanded')
      await glideWindow(s, 0, 1100)
      await sleep(1600)
      s.mark('end')
      await sleep(300)
      return await s.finish({
        shows: 'The dashboard after the conversation: stat tiles (pointer on Won or Saved), the pipeline with the home in its new column, the live activity feed, then the sidebar collapsing and expanding.',
      })
    } catch (error) {
      await s.abort(error)
      throw error
    } finally {
      if (armed) await armed.close()
    }
  },

  async tours() {
    const s = await openSession('tours')
    try {
      const { page } = s
      await openApp(s, '/app')
      await sleep(700)
      s.mark('start')
      await sleep(700)
      await click(s, sidebarLink(page, 'Tours'), { after: 100 })
      await page.waitForURL(/\/app\/tours/)
      await settle(page)
      s.mark('Tours page open')
      await moveTo(s, 1330, 300, { ms: 800 })
      await sleep(2600)
      // "Waiting for your pick" is above the fold; the tours that are actually booked are not.
      const coming = page.getByRole('heading', { name: 'Coming up' })
      if (await coming.count()) {
        await bringIntoView(s, coming, { at: 0.12, ms: 1300, force: true })
        s.mark('the booked tours in view')
        await s.region('coming up', coming.locator('xpath=..'))
        await moveTo(s, 1330, 620, { ms: 700 })
        await sleep(3400)
      } else s.note('No "Coming up" section: nothing is booked yet.')
      s.mark('end')
      await sleep(300)
      return await s.finish({
        shows: 'Sidebar navigation to Tours: the times a landlord has offered and is waiting on a pick, then a glide down to the tours that are already booked.',
      })
    } catch (error) {
      await s.abort(error)
      throw error
    }
  },

  async lease() {
    const s = await openSession('lease')
    try {
      const { page } = s
      await openApp(s, '/app')
      await sleep(700)
      s.mark('start')
      await sleep(600)
      await click(s, sidebarLink(page, 'Lease check'), { after: 100 })
      await page.waitForURL(/\/app\/lease/)
      // LEASE_PDF=<path> uploads a real lease. Without it the beat falls back to the sample review,
      // which is what take 1 filmed.
      const pdf = process.env.LEASE_PDF
      if (pdf) {
        const drop = page.getByText('Drop your lease PDF here').first()
        const choose = page.getByRole('button', { name: 'Choose a PDF' }).first()
        await choose.waitFor({ timeout: 25_000 })
        await settle(page)
        s.mark('Lease check open on "Drop your lease PDF here"')
        await s.region('upload zone', drop.locator('xpath=ancestor::div[2]'))
        await sleep(2200)
        // A real click on a real file chooser, answered with a real PDF, so what is on screen is
        // the app's own upload path and not a state poked in from outside.
        page.once('filechooser', (chooser) => void chooser.setFiles(pdf).catch(() => {}))
        await click(s, choose, { after: 150 })
        s.mark('chose a lease PDF')
        const name = path.basename(pdf)
        await page.getByText(name, { exact: false }).first().waitFor({ timeout: 30_000 })
        s.mark(`the file name appears (${name}) and the upload runs`)
        await sleep(1800)
        const reading = page.getByRole('heading', { name: 'Nestor is reading the fine print' })
        await reading.waitFor({ timeout: 90_000 })
        s.mark('Nestor is reading the fine print (live, on the real upload)')
        await settle(page)
        await sleep(2600)
      } else {
        const sample = page.getByRole('button', { name: /Try the sample lease|Open the sample lease review/ }).first()
        await sample.waitFor()
        await settle(page)
        s.mark('Lease check page open')
        await sleep(1800)
        if (/Open the sample/.test((await sample.innerText()) ?? '')) s.note('A sample review already existed, so this take reopened it instead of running a new one.')
        await click(s, sample, { after: 100 })
        s.mark('clicked Try the sample lease')
      }
      const overall = page.getByText(/Overall: .* risk/).first()
      await s.compress('OpenAI reading the lease end to end', () => overall.waitFor({ timeout: 420_000 }), { lead: 3, tail: 1.2, to: 4 })
      s.mark('review appears (Overall risk)')
      await settle(page)
      await sleep(2600)
      const height = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)
      const headings = await page.evaluate(() =>
        [...document.querySelectorAll('h3[id^="severity-"]')].map((el) => Math.round(el.getBoundingClientRect().top + window.scrollY - 90)),
      )
      const first = headings[0] ?? Math.min(height, 520)
      await glideWindow(s, first, 1400)
      s.mark('flagged clauses begin')
      await moveTo(s, 1556, 470, { ms: 800 })
      await sleep(3000)
      const stop2 = Math.min(height, first + 640)
      await glideWindow(s, stop2, 1600)
      s.mark('a flagged clause: quote, plain-language explanation, sentence to send back')
      await sleep(3200)
      const stop3 = Math.min(height, stop2 + 700)
      if (stop3 > stop2 + 100) {
        await glideWindow(s, stop3, 1600)
        await sleep(2400)
      }
      // Exact, or it matches "This is not legal advice." inside the summary near the top of the
      // page and sends the camera back up there instead of to the box at the end.
      const notLegal = page.getByText('Not legal advice', { exact: true }).last()
      if (await notLegal.count()) {
        await bringIntoView(s, notLegal, { at: 0.42, ms: 1700, force: true })
        await s.region('not legal advice', notLegal.locator('xpath=ancestor::div[2]'))
        await parkBeside(s, notLegal, { gap: 44 })
        s.mark('the "Not legal advice" box')
      } else {
        await glideWindow(s, height, 1800)
        s.mark('bottom of the review')
      }
      await sleep(2800)
      s.mark('end')
      await sleep(300)
      return await s.finish({
        shows: process.env.LEASE_PDF
          ? 'Sidebar navigation to Lease check, a real PDF chosen through the app\'s own file chooser, the upload and the "Nestor is reading the fine print" state, then the live OpenAI verdict (wait compressed), a glide through the flagged clauses -- each with the quoted sentence, why it matters and what to ask for -- and the "Not legal advice" box.'
          : 'Sidebar navigation to Lease check, a click on "Try the sample lease", the live OpenAI review (wait compressed), the overall risk, then a glide through the flagged clauses to the bottom of the review.',
      })
    } catch (error) {
      await s.abort(error)
      throw error
    }
  },

  async passport() {
    const s = await openSession('passport')
    try {
      const { page } = s
      await openApp(s, '/app')
      await sleep(700)
      s.mark('start')
      await sleep(600)
      await click(s, sidebarLink(page, 'Passport'), { after: 100 })
      await page.waitForURL(/\/app\/passport/)
      await page.getByText('Your Passport link').waitFor()
      await settle(page)
      s.mark('Passport editor open')
      await moveTo(s, 760, 420, { ms: 800 })
      await sleep(2400)
      const open = page.getByRole('link', { name: 'Open as a landlord' })
      await hover(s, open)
      await sleep(500)
      const href = await open.getAttribute('href')
      await page.evaluate(() => window.__nestorRing())
      await sleep(260)
      // The link opens a new tab; the recording follows one tab, so open it here.
      await page.goto(`${BASE}${href}`, { waitUntil: 'domcontentloaded' })
      await page.getByRole('heading', { level: 1 }).first().waitFor()
      await settle(page)
      s.mark('public Passport open (the landlord\'s view)')
      await moveTo(s, 1330, 380, { ms: 800 })
      await sleep(3000)
      const height = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)
      if (height > 60) {
        await glideWindow(s, height, 1800)
        s.mark('bottom of the public Passport')
        await sleep(2600)
        await glideWindow(s, 0, 1300)
        await sleep(1200)
      }
      s.mark('end')
      await sleep(300)
      return await s.finish({
        shows: 'Sidebar navigation to the Passport editor with the shareable link, then the public Passport exactly as a landlord sees it: bands and self-reported facts, never documents.',
      })
    } catch (error) {
      await s.abort(error)
      throw error
    }
  },

  async settings() {
    const s = await openSession('settings')
    try {
      const { page } = s
      await openApp(s, '/app')
      await sleep(700)
      s.mark('start')
      await sleep(600)
      await click(s, sidebarLink(page, 'Settings'), { after: 100 })
      await page.waitForURL(/\/app\/settings/)
      const agents = page.getByRole('heading', { name: "Nestor's agents" })
      await agents.waitFor()
      await settle(page)
      s.mark('Settings open')
      await sleep(1500)
      await bringIntoView(s, agents, { at: 0.14, ms: 1300, force: true })
      s.mark('integration status in view')
      await s.region("Nestor's agents", agents.locator('xpath=..'))
      await moveTo(s, 1130, 470, { ms: 800 })
      await sleep(5200)
      s.mark('end')
      await sleep(300)
      return await s.finish({
        shows: 'Sidebar navigation to Settings and the "Nestor\'s agents" integration status: AgentMail, Firecrawl and OpenAI each reporting live.',
      })
    } catch (error) {
      await s.abort(error)
      throw error
    }
  },
}

// ---------------------------------------------------------------------------------------------
const args = process.argv.slice(2)
if (args.length === 0 || args[0] === 'list') {
  console.log(
    `beats: ${Object.keys(BEATS).join(', ')}\nTARGET=${TARGET} -> ${BASE}\n` +
      `clips -> ${path.relative(ROOT, OUT)}\nDPR=${DPR} -> ${FRAME.width}x${FRAME.height} (jpeg q${JPEG_QUALITY}, crf ${CRF})`,
  )
} else if (args[0] === 'recut') {
  for (const beat of args.slice(1)) {
    const dir = sessionDir(beat)
    cut(readJson(path.join(dir, 'session.json')), dir)
  }
} else {
  console.log(`TARGET=${TARGET} -> ${BASE}`)
  for (const beat of args) {
    if (!BEATS[beat]) throw new Error(`Unknown beat "${beat}". Try: ${Object.keys(BEATS).join(', ')}`)
    await BEATS[beat]()
  }
  // Chrome sometimes never answers the final close; nothing is left to do, so do not wait for it.
  process.exit(0)
}
