export const ADMIN_RANGE_PRESETS = [
  ["today", "Today"],
  ["yesterday", "Yesterday"],
  ["24h", "Last 24 Hours"],
  ["7d", "Last 7 Days"],
  ["30d", "Last 30 Days"],
  ["90d", "Last 90 Days"],
  ["this_month", "This Month"],
  ["previous_month", "Previous Month"],
  ["6m", "Last 6 Months"],
  ["12m", "Last 12 Months"],
  ["all", "All Time"],
  ["custom", "Custom Range"],
] as const;

export type AdminRangePreset = (typeof ADMIN_RANGE_PRESETS)[number][0];
export type AnalyticsBucket = "hour" | "day" | "week" | "month";

export type AdminAnalyticsRange = {
  preset: AdminRangePreset;
  label: string;
  startAt: string;
  endAt: string;
  timezone: string;
  bucket: AnalyticsBucket;
  comparisonStartAt: string | null;
  comparisonEndAt: string | null;
};

type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const PRESET_LABELS = Object.fromEntries(ADMIN_RANGE_PRESETS) as Record<AdminRangePreset, string>;
const MAX_CUSTOM_RANGE_MS = 10 * 366 * 24 * 60 * 60 * 1000;

function isPreset(value: string | null): value is AdminRangePreset {
  return ADMIN_RANGE_PRESETS.some(([key]) => key === value);
}

export function isValidTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function zonedParts(date: Date, timezone: string): DateParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

function shiftParts(parts: DateParts, values: { days?: number; months?: number }): DateParts {
  const shifted = new Date(Date.UTC(
    parts.year,
    parts.month - 1 + (values.months ?? 0),
    parts.day + (values.days ?? 0),
    parts.hour,
    parts.minute,
    parts.second,
  ));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
  };
}

function partsToUtc(parts: DateParts, timezone: string) {
  const targetWallTime = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  let candidate = targetWallTime;

  for (let iteration = 0; iteration < 3; iteration += 1) {
    const actual = zonedParts(new Date(candidate), timezone);
    const actualWallTime = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    candidate += targetWallTime - actualWallTime;
  }

  const roundTrip = zonedParts(new Date(candidate), timezone);
  if (Object.keys(parts).some((key) => roundTrip[key as keyof DateParts] !== parts[key as keyof DateParts])) {
    throw new Error("The selected local time does not exist in this timezone.");
  }

  return new Date(candidate);
}

function parseCustomDateTime(value: string | null, timezone: string, field: string) {
  if (!value) throw new Error(`${field} is required for a custom range.`);
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(value)) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error(`${field} is not a valid date/time.`);
    return date;
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) throw new Error(`${field} must include a date and time.`);
  return partsToUtc({
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? 0),
  }, timezone);
}

function chooseBucket(start: Date, end: Date): AnalyticsBucket {
  const duration = end.getTime() - start.getTime();
  if (duration <= 48 * 60 * 60 * 1000) return "hour";
  if (duration <= 90 * 24 * 60 * 60 * 1000) return "day";
  if (duration <= 2 * 366 * 24 * 60 * 60 * 1000) return "week";
  return "month";
}

export function parseAdminAnalyticsRange(searchParams: URLSearchParams, now = new Date()): AdminAnalyticsRange {
  const rawPreset = searchParams.get("range");
  const preset = isPreset(rawPreset) ? rawPreset : "30d";
  const requestedTimezone = searchParams.get("timezone") || "UTC";
  if (!isValidTimezone(requestedTimezone)) throw new Error("Invalid timezone.");

  const timezone = requestedTimezone;
  const nowParts = zonedParts(now, timezone);
  const localMidnight = { ...nowParts, hour: 0, minute: 0, second: 0 };
  let start: Date;
  let end = now;

  switch (preset) {
    case "today":
      start = partsToUtc(localMidnight, timezone);
      break;
    case "yesterday":
      end = partsToUtc(localMidnight, timezone);
      start = partsToUtc(shiftParts(localMidnight, { days: -1 }), timezone);
      break;
    case "24h":
      start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case "7d":
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30d":
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "90d":
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case "this_month":
      start = partsToUtc({ ...localMidnight, day: 1 }, timezone);
      break;
    case "previous_month": {
      const thisMonth = { ...localMidnight, day: 1 };
      end = partsToUtc(thisMonth, timezone);
      start = partsToUtc(shiftParts(thisMonth, { months: -1 }), timezone);
      break;
    }
    case "6m":
      start = partsToUtc(shiftParts(nowParts, { months: -6 }), timezone);
      break;
    case "12m":
      start = partsToUtc(shiftParts(nowParts, { months: -12 }), timezone);
      break;
    case "all":
      start = new Date(0);
      break;
    case "custom":
      start = parseCustomDateTime(searchParams.get("start_at"), timezone, "start_at");
      end = parseCustomDateTime(searchParams.get("end_at"), timezone, "end_at");
      break;
  }

  const duration = end.getTime() - start.getTime();
  if (duration <= 0) throw new Error("end_at must be later than start_at.");
  if (preset === "custom" && duration > MAX_CUSTOM_RANGE_MS) {
    throw new Error("Custom ranges cannot exceed 10 years; use All Time instead.");
  }

  const comparisonEnd = preset === "all" ? null : start;
  const comparisonStart = comparisonEnd ? new Date(comparisonEnd.getTime() - duration) : null;

  return {
    preset,
    label: PRESET_LABELS[preset],
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    timezone,
    bucket: chooseBucket(start, end),
    comparisonStartAt: comparisonStart?.toISOString() ?? null,
    comparisonEndAt: comparisonEnd?.toISOString() ?? null,
  };
}

export function rangeToSearchParams(range: Pick<AdminAnalyticsRange, "preset" | "startAt" | "endAt" | "timezone">) {
  const params = new URLSearchParams({ range: range.preset, timezone: range.timezone });
  if (range.preset === "custom") {
    params.set("start_at", range.startAt);
    params.set("end_at", range.endAt);
  }
  return params;
}
