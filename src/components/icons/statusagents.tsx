// Status, alert and agent-badge glyphs of the Nestor icon family.
// Follows the spec in base.tsx and the hand of exemplars.tsx.
import { createIcon, Wash } from "./base";

const TRIANGLE = "M10.4 4.4a1.8 1.8 0 0 1 3.2 0l7.2 13.45a1.8 1.8 0 0 1-1.6 2.65H4.8a1.8 1.8 0 0 1-1.6-2.65Z";

/** A rounded gable carrying the warning. */
export const TriangleAlert = createIcon(
  "TriangleAlert",
  <>
    <Wash d={TRIANGLE} />
    <path d={TRIANGLE} />
    <path d="M12 9.5V14M12 17h.01" />
  </>,
);

export const CircleAlert = createIcon(
  "CircleAlert",
  <>
    <Wash d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5M12 16.5h.01" />
  </>,
);

const LOCK_BODY = "M6 10.5h10.5l3 3v6A1.5 1.5 0 0 1 18 21H6a1.5 1.5 0 0 1-1.5-1.5V12A1.5 1.5 0 0 1 6 10.5Z";

/** Gable-cut body under a narrow shackle that lands 2.5 units clear of the cut; dot-and-stem keyhole. */
export const Lock = createIcon(
  "Lock",
  <>
    <Wash d={LOCK_BODY} />
    <path d={LOCK_BODY} />
    <path d="M8 10.5V7a3 3 0 0 1 6 0v3.5" />
    <path d="M12 15h.01M12 15v3" />
  </>,
);

/** The doorway, and an arrow walking out of it. */
export const LogOut = createIcon(
  "LogOut",
  <>
    <Wash d="M3.5 21V8a5 5 0 0 1 10 0v13Z" />
    <path d="M13.5 8a5 5 0 0 0-10 0v13h10v-4.5" />
    <path d="M8.5 12.5H21M17.5 9l3.5 3.5-3.5 3.5" />
  </>,
);

const EYE = "M3 12c2.5-4.3 5.5-6.5 9-6.5s6.5 2.2 9 6.5c-2.5 4.3-5.5 6.5-9 6.5S5.5 16.3 3 12Z";

export const Eye = createIcon(
  "Eye",
  <>
    <Wash d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    <path d={EYE} />
    <circle cx="12" cy="12" r="3" />
  </>,
);

/** A bin with an arched handle. */
export const Trash2 = createIcon(
  "Trash2",
  <>
    <Wash d="M6 7.5h12l-1 12a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 19.5Z" />
    <path d="m6 7.5 1 12A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5l1-12" />
    <path d="M4 7.5h16M9 7.5V6a3 3 0 0 1 6 0v1.5" />
    <path d="M10 11.5V17M14 11.5V17" />
  </>,
);

const PEN = "M3.5 20.5 5 15.5 15.5 5A2.475 2.475 0 0 1 19 8.5L8.5 19Z";

/** A pen with an arched cap, resting above the line it is drafting. */
export const PenLine = createIcon(
  "PenLine",
  <>
    <Wash d={PEN} />
    <path d={PEN} />
    <path d="M5 15.5 8.5 19M13 21h8" />
  </>,
);

const BULB = "M9.5 16v-1L7 12V8a5 5 0 0 1 10 0v4l-2.5 3v1Z";

/** The glass is a true doorway (straight sides, semicircle top) that tapers to the screw base. */
export const Lightbulb = createIcon(
  "Lightbulb",
  <>
    <Wash d={BULB} />
    <path d={BULB} />
    <path d="M9.5 18.5h5M10.5 21h3" />
  </>,
);

const BRAIN_LEFT = "M12 7a3.25 3.25 0 0 0-6.5 0 4.5 4.5 0 0 0 0 8 3.5 3.5 0 0 0 6.5 2.5";
const BRAIN_RIGHT = "M12 7a3.25 3.25 0 0 1 6.5 0 4.5 4.5 0 0 1 0 8 3.5 3.5 0 0 1-6.5 2.5";

/** The Brain agent badge: two hemispheres of three arches each, seen from above; one is washed. */
export const Brain = createIcon(
  "Brain",
  <>
    <Wash d={`${BRAIN_LEFT}Z`} />
    <path d={`${BRAIN_LEFT}${BRAIN_RIGHT}`} />
    <path d="M12 7v10.5" />
  </>,
);

/** The Live indicator: the Nestor doorway as the beacon, broadcasting both ways. */
export const Radio = createIcon(
  "Radio",
  <>
    <Wash d="M10 14.5v-3a2 2 0 0 1 4 0v3Z" />
    <path d="M10 14.5v-3a2 2 0 0 1 4 0v3Z" />
    <path d="M15.5 7.5a5.7 5.7 0 0 1 0 9M8.5 7.5a5.7 5.7 0 0 0 0 9" />
    <path d="M18 5.5a8.8 8.8 0 0 1 0 13M6 5.5a8.8 8.8 0 0 0 0 13" />
  </>,
);

const BELL = "M4 18c1.5-1 2-2.5 2-4.5V10a6 6 0 0 1 12 0v3.5c0 2 .5 3.5 2 4.5Z";

/** The bell's dome is the doorway arch; two arcs ring beside it. */
export const BellRing = createIcon(
  "BellRing",
  <>
    <Wash d={BELL} />
    <path d={BELL} />
    <path d="M10 21h4" />
    <path d="M3.5 7.5a9 9 0 0 1 3-4.5M20.5 7.5a9 9 0 0 0-3-4.5" />
  </>,
);

/** A conical flask with an arched stopper; the wash is the sample inside. */
export const FlaskConical = createIcon(
  "FlaskConical",
  <>
    <Wash d="M6.25 15h11.5L20 18.5a1.7 1.7 0 0 1-1.5 2.5h-13A1.7 1.7 0 0 1 4 18.5Z" />
    <path d="M9.5 5.5V10L4 18.5A1.7 1.7 0 0 0 5.5 21h13a1.7 1.7 0 0 0 1.5-2.5L14.5 10V5.5a2.5 2.5 0 0 0-5 0Z" />
    <path d="M6.5 15h11" />
  </>,
);

const BUBBLE = "M8.9 19.2A8.5 8.5 0 1 0 4.5 14.4l-1 6.1Z";

export const MessageCircleQuestionMark = createIcon(
  "MessageCircleQuestionMark",
  <>
    <Wash d={BUBBLE} />
    <path d={BUBBLE} />
    <path d="M10 9a2.5 2.5 0 1 1 3.75 2.17c-.8.5-1.25 1-1.25 1.83M12.5 16h.01" />
  </>,
);

const KNOBS = "M11 10.5V7a3 3 0 0 1 6 0v3.5ZM7 19.5V16a3 3 0 0 1 6 0v3.5Z";

/** Two sliders whose knobs are small doorways; each rail stops 2.5 units short of its knob. */
export const Settings2 = createIcon(
  "Settings2",
  <>
    <Wash d={KNOBS} />
    <path d={KNOBS} />
    <path d="M3 7.5h5.5M19.5 7.5H21M3 16.5h1.5M15.5 16.5H21" />
  </>,
);
