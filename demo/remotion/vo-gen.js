// Narration for the Nestor demo, generated with ElevenLabs.
//   node vo-gen.js              all sections
//   VO_ONLY=v03 node vo-gen.js  one section
// The key and voice are read from an env file OUTSIDE this repo (ELEVEN_ENV, or the
// default below), so no secret is ever written here. A local .env also works.
const fs = require('fs')
const ENV_FILES = [process.env.ELEVEN_ENV, '.env', '/Users/mrnetwork/Syntura/video/.env'].filter(Boolean)
for (const file of ENV_FILES) {
  if (!fs.existsSync(file)) continue
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z_]+)\s*=\s*(.*?)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
const key = process.env.ELEVENLABS_API_KEY
if (!key) { console.error('No ELEVENLABS_API_KEY found. Set ELEVEN_ENV to an env file that has it.'); process.exit(1) }
const VOICE = process.env.ELEVENLABS_VOICE || 'CwhRBWXzGAHq8TQ4Fs17'
const MODEL = 'eleven_multilingual_v2'

// Twelve sections, about 150 s of speech. Every sentence is something the footage shows or the
// build log records. The demo landlord is named as a demo landlord.
const SECTIONS = [
  ['00', "Nestor. Your apartment-hunting concierge."],
  ['01', "Finding an apartment is a second job. You read dozens of listings that bury the fees, write the same introduction to every landlord, chase replies across your inbox, and then sign a contract you never had time to read."],
  ['02', "Nestor does that work for you. It reads the listings, writes to landlords from its own inbox, negotiates the terms you care about, books the tours, and checks the lease before you sign."],
  ['03', "Create an account, and tell Nestor where you are looking, what you can pay, and what you want negotiated. Your maximum budget stays private. It is never shown to a landlord, and never given to the model."],
  ['04', "Then let the Scout search. Firecrawl searches the web for real listings that fit, reads each page into structured facts, and Nestor scores every home against your profile, and tells you why."],
  ['05', "Open one, and the Negotiator writes the first email. OpenAI drafts it and shows its reasoning. Every email says up front that it was written by an AI assistant, on your behalf. Nothing is sent until you approve it."],
  ['06', "Approve, and it leaves Nestor's own inbox as real email, through AgentMail. This is the demo landlord, a second real mailbox, so the answer takes seconds, not days. It comes back through a signed webhook, and OpenAI reads it into an offer, tour times, and any question only you can answer."],
  ['07', "Every message keeps its delivery record. The AgentMail message ID, the thread, and the time, to the second. Pick a tour, and Nestor writes the confirmation."],
  ['08', "The dashboard is live. Homes move through the pipeline as conversations progress, beside a feed of what the agents are doing. It runs on Convex reactive queries. Nothing is ever refreshed."],
  ['09', "Before you sign, upload the lease. Nestor quotes the clauses that deserve a second look, explains each one in plain language, and hands you the sentence to send back. It is not legal advice, and it says so."],
  ['10', "Landlords see your Renter Passport. Bands, never documents. And the real path works too. With a Gmail address as the landlord, a reply typed by hand came back through the webhook, and was read correctly."],
  ['11', "Convex runs the backend, the sign-in, the scheduling, and hosts the site. Firecrawl finds the homes. AgentMail carries the mail. OpenAI writes, reads, and reviews. Nestor. Try it as a guest. No sign-up needed."],
]

const only = process.env.VO_ONLY ? process.env.VO_ONLY.replace(/^v/, '') : null
const todo = SECTIONS.filter(([id]) => !only || id === only)
console.log('characters:', todo.reduce((n, s) => n + s[1].length, 0), 'in', todo.length, 'sections')
fs.mkdirSync('public/vo', { recursive: true })

;(async () => {
  for (const [id, text] of todo) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({
        text, model_id: MODEL,
        voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.0, use_speaker_boost: true },
      }),
    })
    if (!res.ok) { console.error(`v${id}: ${res.status} ${(await res.text()).slice(0, 200)}`); continue }
    const buf = Buffer.from(await res.arrayBuffer())
    fs.writeFileSync(`public/vo/v${id}.mp3`, buf)
    console.log(`v${id}: ${(buf.length / 1024).toFixed(0)}kb`)
  }
})()
