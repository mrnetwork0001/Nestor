// People, household and money glyphs of the Nestor icon family.
// Follows the style spec at the top of base.tsx and the hand of exemplars.tsx.
import { createIcon, Wash } from "./base";

/** Round head over doorway-arch shoulders. */
export const UserRound = createIcon(
  "UserRound",
  <>
    <Wash d="M5.5 21v-1a6.5 6.5 0 0 1 13 0v1Z" />
    <circle cx="12" cy="7.5" r="3.25" />
    <path d="M5.5 21v-1a6.5 6.5 0 0 1 13 0v1Z" />
  </>,
);

/** One person in front, a smaller arch behind to the right, both standing on one ground line. */
export const Users = createIcon(
  "Users",
  <>
    <Wash d="M3 21v-1a6 6 0 0 1 12 0v1Z" />
    <circle cx="9" cy="8" r="3" />
    <circle cx="17" cy="8.5" r="2.5" />
    <path d="M3 21v-1a6 6 0 0 1 12 0v1ZM17.5 14.6a4 4 0 0 1 3.5 4V21h-6" />
  </>,
);

/** The Renter Passport: gable-cut card, a small bust and two lines. */
export const IdCard = createIcon(
  "IdCard",
  <>
    <Wash d="M5 16.5a3.5 3.5 0 0 1 7 0Z" />
    <path d="M4.5 5H17l4 4v8.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-11A1.5 1.5 0 0 1 4.5 5Z" />
    <circle cx="8.5" cy="9.25" r="1.75" />
    <path d="M5 16.5a3.5 3.5 0 0 1 7 0Z" />
    <path d="M15 10.5h3M15 14h2" />
  </>,
);

/** Gable-cut case under a doorway-arch handle; the flap is washed. */
export const Briefcase = createIcon(
  "Briefcase",
  <>
    <Wash d="M4.5 8H17l4 4v2H3V9.5A1.5 1.5 0 0 1 4.5 8Z" />
    <path d="M4.5 8H17l4 4v6.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5v-9A1.5 1.5 0 0 1 4.5 8Z" />
    <path d="M8.5 8V7a3.5 3.5 0 0 1 7 0v1" />
    <path d="M3 14h5.5M15.5 14H21M12 14h.01" />
  </>,
);

/** Side view: tall headboard post, two pillows that are small doorways, and the washed mattress. */
export const BedDouble = createIcon(
  "BedDouble",
  <>
    <Wash d="M3 13h16.5a1.5 1.5 0 0 1 1.5 1.5v3H3Z" />
    <path d="M3 20V6" />
    <path d="M3 13h16.5a1.5 1.5 0 0 1 1.5 1.5V20" />
    <path d="M3 17.5h18" />
    <path d="M6 13v-.5a2.5 2.5 0 0 1 5 0v.5M12.5 13v-.5a2.5 2.5 0 0 1 5 0v.5" />
  </>,
);

/** An arch-topped pad under four toes. */
export const PawPrint = createIcon(
  "PawPrint",
  <>
    <Wash d="M7 16.5a5 5 0 0 1 10 0c0 2.2-1.8 4-4 4h-2c-2.2 0-4-1.8-4-4Z" />
    <path d="M7 16.5a5 5 0 0 1 10 0c0 2.2-1.8 4-4 4h-2c-2.2 0-4-1.8-4-4Z" />
    <circle cx="4.75" cy="11" r="1.75" />
    <circle cx="9" cy="6" r="1.75" />
    <circle cx="15" cy="6" r="1.75" />
    <circle cx="19.25" cy="11" r="1.75" />
  </>,
);

/** A plain bar with a washed filter and one rising curl of smoke. */
export const Cigarette = createIcon(
  "Cigarette",
  <>
    <Wash d="M3 14h5.5v5H3Z" />
    <path d="M3 14h18v5H3Z" />
    <path d="M8.5 14v5" />
    <path d="M19 10.5c-2.5-1.5 2.5-4 0-6.5" />
  </>,
);

/** Cigarette with a diagonal strike that breaks the bar and tucks into its closed end. */
export const CigaretteOff = createIcon(
  "CigaretteOff",
  <>
    <Wash d="M3 14h5.5v5H3Z" />
    <path d="M12 14H3v5h13.5M16.5 14H21v5" />
    <path d="M8.5 14v5" />
    <path d="M19 10.5c-2.5-1.5 2.5-4 0-6.5" />
    <path d="M4 4l14.5 14.5" />
  </>,
);

/** An arch-headed pin with the Nestor doorway punched out of its wash. */
export const MapPin = createIcon(
  "MapPin",
  <>
    <Wash d="M5 10a7 7 0 0 1 14 0v1c0 3.5-3 6.5-7 10-4-3.5-7-6.5-7-10ZM9.5 13.5h5V10a2.5 2.5 0 0 0-5 0Z" />
    <path d="M5 10a7 7 0 0 1 14 0v1c0 3.5-3 6.5-7 10-4-3.5-7-6.5-7-10Z" />
    <path d="M9.5 13.5V10a2.5 2.5 0 0 1 5 0v3.5Z" />
  </>,
);

/** Gable-cut wallet with a washed snap strap. */
export const Wallet = createIcon(
  "Wallet",
  <>
    <Wash d="M21 11.5h-5a2.5 2.5 0 0 0 0 5h5Z" />
    <path d="M4.5 5H17l4 4v8.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-11A1.5 1.5 0 0 1 4.5 5Z" />
    <path d="M21 11.5h-5a2.5 2.5 0 0 0 0 5h5" />
    <path d="M16.5 14h.01" />
  </>,
);

const PIG = "M10.5 7.5h2c2.6 0 4.6 1.2 5.4 3h1.6A1.5 1.5 0 0 1 21 12v2a1.5 1.5 0 0 1-1.5 1.5h-1.6c-.8 1.8-2.8 3-5.4 3h-2c-4 0-7-2.3-7-5.5s3-5.5 7-5.5Z";

/** Oval body, square snout, coin slot and two legs; the ear repeats the mark's roof slope. */
export const PiggyBank = createIcon(
  "PiggyBank",
  <>
    <Wash d={PIG} />
    <path d={PIG} />
    <path d="M7.5 18.5V21M14.5 18.5V21" />
    <path d="M13.5 7.5 17 4.5V9" />
    <path d="M7.5 11h4M15.5 12.5h.01" />
  </>,
);

/** A label pointing left, gable cut top-right, with its string hole. */
export const Tag = createIcon(
  "Tag",
  <>
    <Wash d="M9 6h9l3 3v7.5a1.5 1.5 0 0 1-1.5 1.5H9l-6-6Z" />
    <path d="M9 6h9l3 3v7.5a1.5 1.5 0 0 1-1.5 1.5H9l-6-6Z" />
    <path d="M9.5 12h.01" />
    <path d="M14 10.5h3.5M14 14h2" />
  </>,
);

/** A level balance on a domed foot, with washed pans. */
export const Scale = createIcon(
  "Scale",
  <>
    <Wash d="M3 14a3 3 0 0 0 6 0ZM15 14a3 3 0 0 0 6 0Z" />
    <path d="M12 3.5V18M6 6.5h12" />
    <path d="M7 21h10M9 21a3 3 0 0 1 6 0" />
    <path d="M3 14 6 6.5 9 14M15 14l3-7.5 3 7.5" />
    <path d="M3 14a3 3 0 0 0 6 0M15 14a3 3 0 0 0 6 0" />
  </>,
);

/** A dial that is a wide doorway arch: three tick dots on the low side, the needle on the high side. */
export const Gauge = createIcon(
  "Gauge",
  <>
    <Wash d="M3 18v-3a9 9 0 0 1 18 0v3Z" />
    <path d="M3 18v-3a9 9 0 0 1 18 0v3Z" />
    <path d="M12 15l4.5-5" />
    <path d="M6 14.5h.01M8 10h.01M12 8.5h.01" />
  </>,
);

/** Four panels; both tall ones are Nestor doorways. */
export const LayoutDashboard = createIcon(
  "LayoutDashboard",
  <>
    <Wash d="M3 12.5v-6a3.5 3.5 0 0 1 7 0v6Z" />
    <path d="M3 12.5v-6a3.5 3.5 0 0 1 7 0v6Z" />
    <path d="M3 16h7v5H3Z" />
    <path d="M14 3h7v5h-7Z" />
    <path d="M14 21v-6a3.5 3.5 0 0 1 7 0v6Z" />
  </>,
);
