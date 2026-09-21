// Lists the footage that exists in public/clips into src/clips.json, with each
// clip's measured length. The Remotion bundle runs in a browser and cannot look
// at the disk, so BrowserFrame reads this manifest instead: a clip that is not
// listed renders as a placeholder card rather than crashing the render.
//
// Runs automatically before `npm run studio`, `npm run render` and `npm run still`.
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dir = join(root, 'public', 'clips')

/**
 * Duration in seconds and the clip's pixel width. The width matters: the beats
 * re-filmed at device scale 2 are 3200px wide for the same 1600px page, so the
 * film may enlarge them further before anything is upscaled. BrowserFrame reads
 * the width back out of this manifest and caps its push-ins accordingly.
 */
const probe = (file) => {
  try {
    const out = execFileSync(
      'ffprobe',
      [
        '-v', 'error',
        '-select_streams', 'v:0',
        '-show_entries', 'format=duration:stream=width,height',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        file,
      ],
      { encoding: 'utf8' },
    )
    const [w, h, d] = out.trim().split('\n').map((s) => Number.parseFloat(s))
    return {
      duration: Number.isFinite(d) ? Math.round(d * 100) / 100 : null,
      width: Number.isFinite(w) ? w : null,
      height: Number.isFinite(h) ? h : null,
    }
  } catch {
    return { duration: null, width: null, height: null }
  }
}

const clips = {}
if (existsSync(dir)) {
  for (const f of readdirSync(dir).sort()) {
    if (!f.endsWith('.mp4') || f.startsWith('.') || f.startsWith('_')) continue
    clips[f.replace(/\.mp4$/, '')] = probe(join(dir, f))
  }
}

writeFileSync(join(root, 'src', 'clips.json'), JSON.stringify(clips, null, 1) + '\n')
const names = Object.keys(clips)
console.log(`clips.json: ${names.length} clip(s)${names.length ? ' - ' + names.join(', ') : ''}`)
