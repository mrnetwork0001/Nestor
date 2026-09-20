import { z } from "zod";
import { v, type Infer } from "convex/values";
import type { ReplyAnalysis, TourSlot } from "./validators";

/*
 * What the Negotiator asks OpenAI for, as zod schemas (sent as strict JSON
 * Schema), plus the code that turns a model answer into the `replyAnalysis`
 * shape the database stores, and the no-OpenAI fallback that reads a landlord
 * email with plain pattern matching.
 *
 * Strict mode rejects `.optional()`: use `.nullable()`. Build the text format
 * with zodTextFormat() right next to the responses.parse() call, because the
 * format object loses its parser when it is copied or serialized.
 */

// Why a draft is being written. Drives the prompt and the template fallback.
export const draftPurpose = v.union(
  v.literal("initial_inquiry"),
  v.literal("follow_up"), // the landlord replied, continue the conversation
  v.literal("answer_questions"), // the renter just answered the landlord's questions
  v.literal("confirm_tour"), // the renter picked a tour time
  v.literal("revise"), // the renter asked for a rewrite
);
export type DraftPurpose = Infer<typeof draftPurpose>;

export const EmailDraft = z.object({
  subject: z.string().describe("Email subject. For a reply, 'Re: ' plus the existing subject."),
  body: z
    .string()
    .describe("Plain-text email body, under 170 words. No markdown. No signature block: it is added later."),
  rationale: z
    .string()
    .describe("One or two sentences for the renter explaining what this email asks for and why."),
});
export type EmailDraft = z.infer<typeof EmailDraft>;

export const LandlordReply = z.object({
  intent: z.enum(["tour_offer", "counter_offer", "acceptance", "question", "rejection", "other"]),
  summary: z.string().describe("One or two plain sentences for the renter's dashboard."),
  sentiment: z.enum(["positive", "neutral", "negative"]),
  tourSlots: z
    .array(
      z.object({
        startsAtISO: z
          .string()
          .describe("ISO 8601 with the UTC offset of the listing's city, e.g. 2026-09-26T14:00:00-05:00."),
        label: z.string().describe("The landlord's own words for this time, e.g. 'Saturday at 2pm'."),
      }),
    )
    .describe("Tour times the landlord proposes or confirms in this email. Empty if none."),
  rentOffered: z
    .number()
    .nullable()
    .describe("Monthly rent the landlord states or offers in this email, in whole dollars. Null if none."),
  concessions: z
    .array(z.string())
    .describe("Concrete concessions the landlord grants, e.g. 'Pet fee waived', '$50 off monthly rent'."),
  questionsForRenter: z
    .array(z.string())
    .describe("Questions that cannot be answered from the renter facts provided. Empty if none."),
});
export type LandlordReply = z.infer<typeof LandlordReply>;

export const SimulatedReply = z.object({
  body: z.string().describe("Plain-text email body, 50 to 120 words, ending with the sender's name."),
});

const MAX_SLOTS = 4;
const MAX_ITEMS = 6;

function cleanList(items: string[], maxLength: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const text = item.replace(/\s+/g, " ").trim().slice(0, maxLength);
    const key = text.toLowerCase();
    if (text.length === 0 || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length === MAX_ITEMS) break;
  }
  return out;
}

/** Narrows a model answer to what the database accepts. Unparseable times are dropped, never guessed. */
export function toReplyAnalysis(parsed: LandlordReply): ReplyAnalysis {
  const tourSlots: TourSlot[] = [];
  for (const slot of parsed.tourSlots) {
    const startsAt = Date.parse(slot.startsAtISO);
    if (!Number.isFinite(startsAt)) continue;
    // Same window as the pattern-matching parser: a tour is not last week or next year.
    if (startsAt < Date.now() - 86_400_000 || startsAt > Date.now() + 120 * 86_400_000) continue;
    if (tourSlots.some((s) => s.startsAt === startsAt)) continue;
    tourSlots.push({ startsAt, label: slot.label.trim().slice(0, 80) || slot.startsAtISO });
    if (tourSlots.length === MAX_SLOTS) break;
  }
  const rent = parsed.rentOffered;
  return {
    intent: parsed.intent,
    summary: parsed.summary.trim().slice(0, 400),
    sentiment: parsed.sentiment,
    tourSlots,
    rentOffered: rent !== null && rent >= 200 && rent <= 50_000 ? Math.round(rent) : undefined,
    concessions: cleanList(parsed.concessions, 120),
    questionsForRenter: cleanList(parsed.questionsForRenter, 240),
  };
}

// Local time ------------------------------------------------------------------

/*
 * Tour times are written and read in the listing's local time. The Convex
 * runtime has no timezone database to rely on, so this covers US zones with
 * the federal daylight-saving rule. Unknown places fall back to US Central.
 */
export type LocalZone = { label: string; standardOffsetMinutes: number; observesDst: boolean };

const EASTERN: LocalZone = { label: "ET", standardOffsetMinutes: -300, observesDst: true };
const CENTRAL: LocalZone = { label: "CT", standardOffsetMinutes: -360, observesDst: true };
const MOUNTAIN: LocalZone = { label: "MT", standardOffsetMinutes: -420, observesDst: true };
const ARIZONA: LocalZone = { label: "MST", standardOffsetMinutes: -420, observesDst: false };
const PACIFIC: LocalZone = { label: "PT", standardOffsetMinutes: -480, observesDst: true };
const ALASKA: LocalZone = { label: "AKT", standardOffsetMinutes: -540, observesDst: true };
const HAWAII: LocalZone = { label: "HST", standardOffsetMinutes: -600, observesDst: false };

const ZONE_BY_STATE: Record<string, LocalZone> = {};
function assign(zone: LocalZone, states: string) {
  for (const state of states.split(" ")) ZONE_BY_STATE[state] = zone;
}
assign(EASTERN, "CT DE DC FL GA IN KY ME MD MA MI NH NJ NY NC OH PA RI SC VT VA WV");
assign(CENTRAL, "AL AR IL IA KS LA MN MS MO NE ND OK SD TN TX WI");
assign(MOUNTAIN, "CO ID MT NM UT WY");
assign(ARIZONA, "AZ");
assign(PACIFIC, "CA NV OR WA");
assign(ALASKA, "AK");
assign(HAWAII, "HI");

const ZONE_BY_PLACE: Array<[RegExp, LocalZone]> = [
  [/new york|brooklyn|boston|philadelphia|miami|atlanta|washington|charlotte|detroit|orlando|tampa|pittsburgh|baltimore|raleigh|durham|columbus|cleveland|cincinnati|jersey city|newark|nyc|manhattan|queens|bronx|richmond|jacksonville|indianapolis|louisville|providence|hartford|buffalo|maryland|new jersey|pennsylvania|michigan|connecticut|florida|georgia|carolina|virginia|ohio|massachusetts/i, EASTERN],
  [/chicago|austin|dallas|houston|san antonio|nashville|minneapolis|new orleans|kansas city|st\.? louis|milwaukee|texas|illinois|tennessee|minnesota/i, CENTRAL],
  [/phoenix|tucson|scottsdale|arizona/i, ARIZONA],
  [/denver|boulder|salt lake|albuquerque|boise|colorado|utah/i, MOUNTAIN],
  [/los angeles|san francisco|san diego|san jose|oakland|seattle|portland|las vegas|sacramento|spokane|tacoma|irvine|long beach|fresno|california|oregon|nevada/i, PACIFIC],
  [/anchorage|alaska/i, ALASKA],
  [/honolulu|hawaii/i, HAWAII],
];

export function zoneForCity(city: string | undefined): LocalZone {
  if (!city) return CENTRAL;
  const state = city.match(/,\s*([A-Za-z]{2})\b\.?\s*(\d{5})?\s*$/);
  if (state) {
    const zone = ZONE_BY_STATE[state[1].toUpperCase()];
    if (zone) return zone;
  }
  for (const [pattern, zone] of ZONE_BY_PLACE) if (pattern.test(city)) return zone;
  return CENTRAL;
}

/** Day of the month of the nth Sunday (1-based) of a UTC month. */
function nthSunday(year: number, month: number, n: number): number {
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  return 1 + ((7 - firstWeekday) % 7) + (n - 1) * 7;
}

export function offsetMinutesAt(zone: LocalZone, utcMs: number): number {
  if (!zone.observesDst) return zone.standardOffsetMinutes;
  const year = new Date(utcMs).getUTCFullYear();
  // Second Sunday of March, 2am standard time, to first Sunday of November, 2am daylight time.
  const start = Date.UTC(year, 2, nthSunday(year, 2, 2), 2) - zone.standardOffsetMinutes * 60_000;
  const end = Date.UTC(year, 10, nthSunday(year, 10, 1), 2) - (zone.standardOffsetMinutes + 60) * 60_000;
  return utcMs >= start && utcMs < end ? zone.standardOffsetMinutes + 60 : zone.standardOffsetMinutes;
}

export type LocalParts = { year: number; month: number; day: number; weekday: number; hour: number; minute: number };

export function localParts(zone: LocalZone, utcMs: number): LocalParts {
  const shifted = new Date(utcMs + offsetMinutesAt(zone, utcMs) * 60_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

export function localToUtc(zone: LocalZone, year: number, month: number, day: number, hour: number, minute: number): number {
  const wallClock = Date.UTC(year, month, day, hour, minute);
  // Resolve the offset at the target instant: guess with the standard offset, then correct once.
  const guess = wallClock - zone.standardOffsetMinutes * 60_000;
  return wallClock - offsetMinutesAt(zone, guess) * 60_000;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function clockLabel(hour: number, minute: number): string {
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${String(minute).padStart(2, "0")} ${suffix}`;
}

/** "Saturday, September 26 at 2:00 PM": the format the demo landlord writes and the fallback parser reads. */
export function formatSlotLabel(zone: LocalZone, utcMs: number): string {
  const p = localParts(zone, utcMs);
  return `${WEEKDAYS[p.weekday]}, ${MONTHS[p.month]} ${p.day} at ${clockLabel(p.hour, p.minute)}`;
}

/** ISO 8601 with the zone's offset, for telling a model what "now" is locally. */
export function isoWithOffset(zone: LocalZone, utcMs: number): string {
  const offset = offsetMinutesAt(zone, utcMs);
  const p = localParts(zone, utcMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  const sign = offset < 0 ? "-" : "+";
  const abs = Math.abs(offset);
  return (
    `${p.year}-${pad(p.month + 1)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:00` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

// Reading a landlord email without a model --------------------------------------

const TIME = String.raw`(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s?m\.?|noon`;
const WEEKDAY = String.raw`(sun|mon|tue(?:s)?|wed(?:nes)?|thu(?:rs)?|fri|sat(?:ur)?)(?:day)?`;
const MONTH = String.raw`\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?`;

function clockFrom(hourText: string | undefined, minuteText: string | undefined, meridiem: string | undefined) {
  if (hourText === undefined || meridiem === undefined) return { hour: 12, minute: 0 }; // "noon"
  const raw = Number(hourText);
  if (raw < 1 || raw > 12) return null;
  const hour = (raw % 12) + (meridiem.toLowerCase() === "p" ? 12 : 0);
  const minute = minuteText ? Number(minuteText) : 0;
  return minute > 59 ? null : { hour, minute };
}

const WEEKDAY_INDEX: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const MONTH_INDEX: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/** Tour times written as a date or weekday plus a clock time. Anything vaguer is left for the renter to read. */
export function parseTourSlots(text: string, receivedAt: number, zone: LocalZone): TourSlot[] {
  const now = localParts(zone, receivedAt);
  const found: TourSlot[] = [];
  const claimed: Array<[number, number]> = [];

  const add = (startsAt: number, label: string, index: number, length: number) => {
    if (claimed.some(([from, to]) => index < to && index + length > from)) return;
    claimed.push([index, index + length]);
    // A landlord does not propose tours in the past or a year out: that is a misread.
    if (startsAt < receivedAt - 3_600_000 || startsAt > receivedAt + 120 * 86_400_000) return;
    if (found.some((s) => s.startsAt === startsAt)) return;
    // The clock pattern swallows a sentence's full stop ("... at 2 PM.").
    found.push({ startsAt, label: label.replace(/\s+/g, " ").trim().replace(/[.,;:]+$/, "").slice(0, 80) });
  };

  // "Saturday, September 26 at 2:00 PM" / "Sept 26th @ 2pm"
  const dated = new RegExp(
    String.raw`(?:\b${WEEKDAY},?\s+)?${MONTH}\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(?:at|@|around)?\s*(?:${TIME})`,
    "gi",
  );
  for (const m of text.matchAll(dated)) {
    const month = MONTH_INDEX[m[2].slice(0, 3).toLowerCase()];
    const day = Number(m[3]);
    const clock = clockFrom(m[4], m[5], m[6]);
    if (month === undefined || day < 1 || day > 31 || !clock) continue;
    const year = month < now.month - 1 ? now.year + 1 : now.year;
    add(localToUtc(zone, year, month, day, clock.hour, clock.minute), m[0], m.index, m[0].length);
  }

  // "9/26 at 2pm"
  const numeric = new RegExp(String.raw`\b(\d{1,2})/(\d{1,2})(?:/\d{2,4})?\s*(?:at|@|around)?\s*(?:${TIME})`, "gi");
  for (const m of text.matchAll(numeric)) {
    const month = Number(m[1]) - 1;
    const day = Number(m[2]);
    const clock = clockFrom(m[3], m[4], m[5]);
    if (month < 0 || month > 11 || day < 1 || day > 31 || !clock) continue;
    const year = month < now.month - 1 ? now.year + 1 : now.year;
    add(localToUtc(zone, year, month, day, clock.hour, clock.minute), m[0], m.index, m[0].length);
  }

  // "Saturday at 2pm", "this Thursday afternoon at 4:30 pm", "tomorrow at 10am"
  const relative = new RegExp(
    String.raw`\b(?:(?:this|next|on)\s+)?(?:${WEEKDAY}|(tomorrow))(?:\s+(?:morning|afternoon|evening))?,?\s*(?:at|@|around)\s*(?:${TIME})`,
    "gi",
  );
  for (const m of text.matchAll(relative)) {
    const clock = clockFrom(m[3], m[4], m[5]);
    if (!clock) continue;
    let daysAhead: number;
    if (m[2]) {
      daysAhead = 1;
    } else {
      const target = WEEKDAY_INDEX[m[1].slice(0, 3).toLowerCase()];
      if (target === undefined) continue;
      daysAhead = (target - now.weekday + 7) % 7;
      // "Saturday at 2pm" written on a Saturday evening means next week.
      if (daysAhead === 0 && (clock.hour < now.hour || (clock.hour === now.hour && clock.minute <= now.minute))) {
        daysAhead = 7;
      }
    }
    add(localToUtc(zone, now.year, now.month, now.day + daysAhead, clock.hour, clock.minute), m[0], m.index, m[0].length);
  }

  return found.sort((a, b) => a.startsAt - b.startsAt).slice(0, MAX_SLOTS);
}

/** Drops the quoted history and everything after a signature delimiter. */
export function newContentOnly(body: string): string {
  const lines: string[] = [];
  for (const line of body.split(/\r?\n/)) {
    if (/^\s*>/.test(line)) continue;
    if (/^\s*On .{5,120} wrote:\s*$/i.test(line)) break;
    if (/^-{2,}\s*(original message|forwarded message)/i.test(line)) break;
    lines.push(line);
  }
  return lines.join("\n").trim();
}

// Questions a renter profile already answers, so the Negotiator does not need to ask the renter.
const ANSWERABLE_FROM_PROFILE =
  /\b(pets?|dogs?|cats?|animals?|move[- ]?in|moving in|when .{0,30}(move|start)|how many (people|adults|occupants|tenants)|who (will|would) be living|occupants?|smok|lease (term|length)|how long .{0,20}lease|employ|occupation|what do you do|income|credit|rental history|rented before)\b/i;

const CONCESSION_PATTERNS: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
  [/\$\s?(\d{2,4})\s*(?:off|less|discount)[^.!?\n]{0,40}/i, (m) => `$${m[1]} off the monthly rent`],
  [/waiv(?:e|ed|ing)\s+(?:the\s+|your\s+)?(?:\$\d+\s+)?((?:pet|application|admin(?:istrative)?|move-?in|amenity|parking)[a-z ]{0,20}?(?:fee|deposit|rent))/i, (m) => `${capitalize(m[1].trim())} waived`],
  [/(first|one|1|two|2)\s+months?\s+(?:of\s+rent\s+)?free/i, (m) => `${capitalize(m[1])} month free`],
  [/(?:free|complimentary|no[- ]cost)\s+parking[^.!?\n]{0,40}/i, (m) => capitalize(m[0].trim())],
  [/(?:reduc(?:e|ed|ing)|lower(?:ed|ing)?)\s+(?:the\s+|your\s+)?(?:security\s+)?deposit[^.!?\n]{0,40}/i, () => "Reduced security deposit"],
  [/flexible\s+(?:on|with)\s+(?:the\s+|your\s+)?(?:move[- ]?in|start)(?:\s+date)?/i, () => "Flexible move-in date"],
];

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function dollars(amount: number): string {
  return `$${Math.round(amount).toLocaleString("en-US")}`;
}

/**
 * Pattern-matching fallback for when OpenAI is not connected. It only reports
 * what is literally in the email: explicit times, dollar figures next to rent
 * words, a short list of concession phrases, and sentences ending in "?".
 */
export function heuristicAnalysis(
  body: string,
  options: { receivedAt: number; zone: LocalZone; rentAsked?: number },
): ReplyAnalysis {
  const text = newContentOnly(body);

  const rejection =
    /\b(no longer available|already (?:been )?(?:rented|leased|taken)|has been (?:rented|leased)|off the market|we(?:'ve| have) (?:rented|leased|filled)|not (?:able|going) to move forward|going with another applicant)\b/i.test(text);
  const tourSlots = rejection ? [] : parseTourSlots(text, options.receivedAt, options.zone);

  let rentOffered: number | undefined;
  const discount = text.match(/\$\s?(\d{2,3})\s*(?:off|less)\b/i);
  const stated = [...text.matchAll(/\$\s?(\d{1,2},?\d{3})(?:\.\d{2})?\s*(?:\/\s*mo\b|a month|per month|monthly|\/month)?/gi)]
    .map((m) => ({ amount: Number(m[1].replace(",", "")), context: text.slice(Math.max(0, m.index - 60), m.index + m[0].length + 30) }))
    .filter((c) => /\b(rent|month|mo\b|offer|could do|can do|bring it|price)\b/i.test(c.context) && !/\bdeposit\b/i.test(c.context))
    // "$1,000 off your first month" is a one-time discount, not a monthly rent.
    .filter((c) => !/\$\s?[\d,]+(?:\.\d{2})?\s*(?:off|less|discount|credit)\b/i.test(c.context) && !/first month|one[- ]time/i.test(c.context));
  if (stated.length > 0) {
    rentOffered = Math.min(...stated.map((c) => c.amount));
  } else if (discount && options.rentAsked) {
    rentOffered = options.rentAsked - Number(discount[1]);
  }

  const concessions: string[] = [];
  for (const [pattern, describe] of CONCESSION_PATTERNS) {
    const match = text.match(pattern);
    if (match) concessions.push(describe(match));
  }

  const questions = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.endsWith("?") && s.length > 8 && s.length < 240)
    // Sign-off pleasantries are not questions anyone needs to answer.
    .filter((s) => s.split(/\s+/).length >= 4 && !/^(any (other |further |more )?questions|does that (work|sound)|sound good|make sense|how does that sound)/i.test(s));
  const questionsForRenter = questions.filter((q) => !ANSWERABLE_FROM_PROFILE.test(q));

  const accepts =
    /\b(that works|works for (?:us|me)|sounds good|we can do that|happy to (?:do|offer|accept)|you(?:'ve| have) got a deal|is confirmed|confirmed for|see you (?:then|on|at))\b/i.test(text);
  const lowerRent = rentOffered !== undefined && options.rentAsked !== undefined && rentOffered < options.rentAsked;

  let intent: ReplyAnalysis["intent"] = "other";
  if (rejection) intent = "rejection";
  else if (concessions.length > 0 || lowerRent) intent = "counter_offer";
  else if (tourSlots.length > 0) intent = "tour_offer";
  else if (accepts) intent = "acceptance";
  else if (questions.length > 0) intent = "question";

  const positive = /\b(happy|glad|great|welcome|look(?:ing)? forward|pleased|thanks|thank you)\b/i.test(text);
  const negative = /\b(unfortunately|cannot|can't|unable|firm on|not able)\b/i.test(text);
  // A landlord who concedes something while holding firm elsewhere is still good news.
  const gaveGround = concessions.length > 0 || lowerRent || tourSlots.length > 0;
  const sentiment: ReplyAnalysis["sentiment"] = rejection ? "negative" : positive || gaveGround ? "positive" : negative ? "negative" : "neutral";

  const parts: string[] = [];
  if (rejection) parts.push("The landlord says the unit is no longer available.");
  if (tourSlots.length > 0) parts.push(`Offered ${tourSlots.length === 1 ? "a tour time" : `${tourSlots.length} tour times`}: ${tourSlots.map((s) => s.label).join(" or ")}.`);
  if (rentOffered !== undefined) parts.push(`Mentioned rent of ${dollars(rentOffered)} a month.`);
  if (concessions.length > 0) parts.push(`Concessions: ${concessions.join(", ")}.`);
  if (questions.length > 0) parts.push(`Asked ${questions.length === 1 ? "a question" : `${questions.length} questions`}.`);
  if (parts.length === 0) parts.push(accepts ? "The landlord agreed." : "The landlord replied without a concrete offer.");

  return {
    intent,
    summary: parts.join(" ").slice(0, 400),
    sentiment,
    tourSlots,
    rentOffered,
    concessions: cleanList(concessions, 120),
    questionsForRenter: cleanList(questionsForRenter, 240),
  };
}
