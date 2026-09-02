// Domain-wide constants for SAFT Media Team
/** Fallback admin access key. The live value lives in app_settings.admin_access_key. */
export const ADMIN_ACCESS_KEY = "SAFT@2026";
export const SYNTHETIC_EMAIL_DOMAIN = "saft.local";


export const usernameToEmail = (username: string) =>
  `${username.trim().toLowerCase()}@${SYNTHETIC_EMAIL_DOMAIN}`;

export const emailToUsername = (email: string | null | undefined) =>
  email ? email.split("@")[0] : "";

export type ServiceType = "sunday_morning" | "sunday_evening" | "tuesday_evening";

export const SERVICES: { id: ServiceType; label: string; short: string; day: number; hour: number }[] = [
  { id: "sunday_morning", label: "Sunday Morning", short: "Sun AM", day: 0, hour: 9 },
  { id: "sunday_evening", label: "Sunday Evening", short: "Sun PM", day: 0, hour: 18 },
  { id: "tuesday_evening", label: "Tuesday Evening", short: "Tue PM", day: 2, hour: 19 },
];

export const ROSTER_ROLES: { role: string; camera?: string; defaultNotes?: string }[] = [
  { role: "Camera", camera: "Cam 1", defaultNotes: "Single Frame Worship Leader" },
  { role: "Camera", camera: "Cam 2", defaultNotes: "Pastor Close Shot" },
  { role: "Camera", camera: "Cam 3", defaultNotes: "Ladies Side Crowd" },
  { role: "Camera", camera: "4K", defaultNotes: "Back Crowd" },
  { role: "Streaming Director", defaultNotes: "ATEM Recording" },
  { role: "Audio Engineer", defaultNotes: "Audio Mixer" },
  { role: "Drone Operator", defaultNotes: "Optional" },
];

// Editable option lists used by the Build Roster page (each supports "Other…")
export const ROLE_OPTIONS = [
  "Camera",
  "Streaming Director",
  "Audio Engineer",
  "Drone Operator",
  "Lighting",
  "Presentation / Slides",
  "Photographer",
];

export const CAMERA_OPTIONS = ["Cam 1", "Cam 2", "Cam 3", "Cam 4", "4K", "Drone", "Handheld", "—"];

export const FRAME_OPTIONS = [
  "Single Frame Worship Leader",
  "Pastor Close Shot",
  "Ladies Side Crowd",
  "Men Side Crowd",
  "Back Crowd",
  "Wide Shot",
  "ATEM Recording",
  "Audio Mixer",
  "Optional",
];


export const PRELOADED_MEMBERS = [
  "Kingston", "Akash", "Sam", "Ezra", "Vishal", "David",
  "Isaac", "Sanjay", "Sujith", "Samuel", "Edward", "Lorenzo",
];

// Return the next occurrence (date) of a given weekday.
export function nextDateForWeekday(weekday: number, from: Date = new Date()): Date {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const diff = (weekday - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d;
}

export function nextServiceDate(service: ServiceType, from: Date = new Date()): Date {
  const s = SERVICES.find((x) => x.id === service)!;
  const d = nextDateForWeekday(s.day, from);
  d.setHours(s.hour, 0, 0, 0);
  return d;
}

export function nextUpcomingService(from: Date = new Date()) {
  let best: { service: ServiceType; date: Date } | null = null;
  for (const s of SERVICES) {
    const d = nextServiceDate(s.id, from);
    if (!best || d < best.date) best = { service: s.id, date: d };
  }
  return best!;
}

function parseLocal(d: Date | string): Date {
  if (typeof d !== "string") return d;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(d);
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Day Month Year, e.g. "Sun 09 August 2026".
 * Formatted manually (no Intl) so the server and browser always agree —
 * locale data differences caused React hydration mismatches / blank screens.
 */
export function formatServiceDate(d: Date | string) {
  const date = parseLocal(d);
  const day = String(date.getDate()).padStart(2, "0");
  return `${DAYS[date.getDay()]} ${day} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** Compact Day Month Year, e.g. "09 Aug 2026" */
export function formatDayMonthYear(d: Date | string) {
  const date = parseLocal(d);
  const day = String(date.getDate()).padStart(2, "0");
  return `${day} ${MONTHS[date.getMonth()].slice(0, 3)} ${date.getFullYear()}`;
}


/** Services ordered so the soonest upcoming one comes first. */
export function servicesByNextDate(from: Date = new Date()) {
  return [...SERVICES]
    .map((s) => ({ ...s, nextDate: nextServiceDate(s.id, from) }))
    .sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime());
}


export function toDateOnly(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function serviceLabel(id: ServiceType) {
  return SERVICES.find((s) => s.id === id)?.label ?? id;
}
/** Member seniority levels (replaces free-text role title). */
export type Seniority = "super_senior" | "senior" | "junior" | "newbie";

export const SENIORITY_OPTIONS: { value: Seniority; label: string }[] = [
  { value: "super_senior", label: "Super Senior" },
  { value: "senior", label: "Senior" },
  { value: "junior", label: "Junior" },
  { value: "newbie", label: "Newbie" },
];

export const seniorityLabel = (s?: string | null) =>
  SENIORITY_OPTIONS.find((o) => o.value === s)?.label ?? null;

export const seniorityClass = (s?: string | null) => {
  switch (s) {
    case "super_senior": return "bg-primary/15 text-primary";
    case "senior": return "bg-success/15 text-success";
    case "junior": return "bg-warning/15 text-warning";
    case "newbie": return "bg-muted text-muted-foreground";
    default: return "bg-muted text-muted-foreground";
  }
};

/** Equipment categories for the SAFT → MPZ checklist. */
export const ITEM_CATEGORIES = [
  "Camera",
  "Lens",
  "Tripod",
  "Audio",
  "Cables",
  "Lighting",
  "Streaming",
  "Power",
  "Accessories",
  "Other",
];

/** Date of the 2nd Saturday of a given month. */
export function secondSaturday(year: number, month: number): Date {
  const d = new Date(year, month, 1);
  const offset = (6 - d.getDay() + 7) % 7;
  d.setDate(1 + offset + 7);
  return d;
}

/* ---------- Availability cutoffs (Asia/Kolkata) ---------- */

/** Current time in IST as a "wall clock" Date (values read in IST). */
export function nowIST(): Date {
  const now = new Date();
  return new Date(now.getTime() + (330 + now.getTimezoneOffset()) * 60000);
}

/** IST cutoff hour for a service, or null when the service has no cutoff. */
export function cutoffHourFor(service: ServiceType): number | null {
  if (service === "sunday_morning") return 11; // 11:00 AM IST
  if (service === "sunday_evening") return 19; // 7:00 PM IST
  return null;
}

/**
 * True when member responses for this service date are closed.
 * Sunday Morning closes after 11:00 AM IST, Sunday Evening after 7:00 PM IST.
 */
export function isAvailabilityClosed(
  service: ServiceType,
  serviceDate: Date | string,
  now: Date = nowIST(),
): boolean {
  const hour = cutoffHourFor(service);
  if (hour === null) return false;
  const d = parseLocal(serviceDate);
  const cutoff = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, 0, 0, 0);
  return now.getTime() > cutoff.getTime();
}

export function cutoffLabel(service: ServiceType): string | null {
  const hour = cutoffHourFor(service);
  if (hour === null) return null;
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:00 ${hour < 12 ? "AM" : "PM"} IST`;
}
