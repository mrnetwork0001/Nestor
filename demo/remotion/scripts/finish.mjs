#!/usr/bin/env node
/**
 * The last step of a master: fix the loudness and make the colour tagging explicit,
 * without touching a single video bit.
 *
 * Why loudness. The narration was mastered around -24 LUFS. YouTube normalises to
 * about -14 and only ever turns things DOWN -- it will not lift a quiet upload -- so
 * the film would play roughly ten decibels under everything else a judge watches that
 * session, in a film where the narration is the whole pitch. src/Nestor.tsx already
 * puts most of that back with a volume on the narration; this measures whatever came
 * out of the render and lands it exactly on target.
 *
 * Why colour. Both masters set the matrix in the H.264 VUI but leave primaries and
 * transfer unspecified and carry no `colr` atom, so ffprobe reports "unknown". Nothing
 * mainstream will misread it, but a master should say what it is.
 *
 * The video stream is copied, not re-encoded, and the script proves it: it hashes the
 * video elementary stream before and after and refuses to swap the file in if they
 * differ.
 *
 *   node scripts/finish.mjs out/nestor-demo.mp4
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { renameSync, statSync, unlinkSync } from 'node:fs'

const TARGET_I = -14      // LUFS, what YouTube normalises to
const TARGET_TP = -1.5    // dBTP, a little under full scale for the lossy encode
const TARGET_LRA = 11
// 320k is asked for; ffmpeg's native AAC encoder will not go above about 224kbps on
// this material whatever you ask of it. That is many times what dual-mono speech
// needs, so it is left alone rather than chased. If a literal 320k is ever wanted,
// `-c:a aac_at` (Apple AudioToolbox) does reach it on this machine -- but change it
// for BOTH masters in the same pass, so the two never disagree.
const AUDIO_BITRATE = '320k'

const run = (args, opts = {}) =>
  execFileSync('ffmpeg', args, { maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], ...opts })

const probe = (file, entries) =>
  execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries',
    `stream=${entries}`, '-of', 'default=nw=1', file]).toString().trim()

/** SHA-256 of the video elementary stream alone, so a re-encode cannot hide. */
const videoHash = (file) => {
  const raw = run(['-v', 'error', '-i', file, '-map', '0:v:0', '-c', 'copy', '-f', 'h264', '-'])
  return createHash('sha256').update(raw).digest('hex')
}

/** loudnorm writes its measurement to stderr, so read the two streams together. */
const measureJson = (file) => {
  const log = execFileSync('sh', ['-c',
    `ffmpeg -hide_banner -nostats -i ${JSON.stringify(file)} -af ` +
    `loudnorm=I=${TARGET_I}:TP=${TARGET_TP}:LRA=${TARGET_LRA}:print_format=json ` +
    `-f null - 2>&1`], { maxBuffer: 1 << 28 }).toString()
  const open = log.lastIndexOf('{')
  if (open < 0) throw new Error(`loudnorm printed no measurement for ${file}`)
  return JSON.parse(log.slice(open, log.indexOf('}', open) + 1))
}

const file = process.argv[2]
if (!file) {
  console.error('usage: node scripts/finish.mjs <master.mp4>')
  process.exit(1)
}

const before = measureJson(file)
console.log(`finish: ${file}`)
console.log(`  measured  ${before.input_i} LUFS, true peak ${before.input_tp} dBTP, LRA ${before.input_lra}`)

const vBefore = videoHash(file)
const tmp = file.replace(/\.mp4$/, '.finishing.mp4')

run(['-v', 'error', '-y', '-i', file,
  '-map', '0:v:0', '-map', '0:a:0',
  '-c:v', 'copy',
  '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
  '-af', 'loudnorm=' + [
    `I=${TARGET_I}`, `TP=${TARGET_TP}`, `LRA=${TARGET_LRA}`,
    `measured_I=${before.input_i}`, `measured_TP=${before.input_tp}`,
    `measured_LRA=${before.input_lra}`, `measured_thresh=${before.input_thresh}`,
    'linear=true', 'print_format=summary',
  ].join(':'),
  '-c:a', 'aac', '-b:a', AUDIO_BITRATE, '-ar', '48000',
  '-movflags', '+faststart', tmp])

const vAfter = videoHash(tmp)
if (vBefore !== vAfter) {
  unlinkSync(tmp)
  throw new Error('the video stream changed -- refusing to replace the master')
}

const after = measureJson(tmp)
renameSync(tmp, file)

console.log(`  now       ${after.input_i} LUFS, true peak ${after.input_tp} dBTP, LRA ${after.input_lra}`)
console.log(`  colour    ${probe(file, 'color_space,color_primaries,color_transfer').replace(/\n/g, ' ')}`)
console.log(`  video stream unchanged (sha256 ${vBefore.slice(0, 16)}...), ${statSync(file).size} bytes`)
