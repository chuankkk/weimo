const pad = (value: number) => String(value).padStart(2, "0");

/** 本地时区的 YYYY-MM-DD（不要用 toISOString().slice(0,10)，会跨日）。 */
export const localDateKey = (input: Date | string | number = new Date()) => {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export const startOfDay = (input: Date | string | number = new Date()) => {
  const date = input instanceof Date ? new Date(input) : new Date(input);
  date.setHours(0, 0, 0, 0);
  return date;
};

export const addDays = (input: Date | string, days: number) => {
  const date = new Date(input);
  date.setDate(date.getDate() + days);
  return date;
};

export const addDaysIso = (iso: string, days: number) => addDays(iso, days).toISOString();

export const nowIso = () => new Date().toISOString();

export const daysSince = (iso?: string) => {
  if (!iso) return Number.POSITIVE_INFINITY;
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (Date.now() - time) / 86400000);
};

export const isDue = (iso?: string) => {
  if (!iso) return true;
  const time = new Date(iso).getTime();
  return Number.isNaN(time) || time <= Date.now();
};

export const formatClock = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
};

export const formatDuration = (ms: number) => {
  const total = Math.max(0, Math.round(ms / 1000));
  if (total < 60) return `${total} 秒`;
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes < 60) return seconds ? `${minutes} 分 ${seconds} 秒` : `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  return `${hours} 小时 ${minutes % 60} 分`;
};

export const formatDate = (input: Date | string, withWeekday = false) => {
  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return "";
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const base = `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日`;
  return withWeekday ? `${base} · ${weekdays[date.getDay()]}` : base;
};

export const formatTime = (input: Date | string) => {
  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return "";
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const relativeTime = (iso?: string) => {
  if (!iso) return "尚未作答";
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return "尚未作答";
  const diff = Date.now() - time;
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  const today = localDateKey();
  const dateKey = localDateKey(iso);
  if (dateKey === today) return `今天 ${formatTime(iso)}`;
  const yesterday = localDateKey(addDays(new Date(), -1));
  if (dateKey === yesterday) return `昨天 ${formatTime(iso)}`;
  const days = Math.floor(diff / 86_400_000);
  if (days < 7) return `${days} 天前`;
  const date = new Date(iso);
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日`;
};

/** 最近 n 天（含今天）的每日练习量，用于首页活跃度条。 */
export const buildActivitySeries = (records: { answeredAt: string; isCorrect: boolean }[], days = 14) => {
  const buckets = new Map<string, { total: number; correct: number }>();
  for (const record of records) {
    const key = localDateKey(record.answeredAt);
    if (!key) continue;
    const bucket = buckets.get(key) ?? { total: 0, correct: 0 };
    bucket.total += 1;
    if (record.isCorrect) bucket.correct += 1;
    buckets.set(key, bucket);
  }
  const series: { key: string; label: string; total: number; correct: number; date: Date }[] = [];
  for (let index = days - 1; index >= 0; index -= 1) {
    const date = addDays(new Date(), -index);
    const key = localDateKey(date);
    const bucket = buckets.get(key) ?? { total: 0, correct: 0 };
    series.push({
      key,
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      total: bucket.total,
      correct: bucket.correct,
      date
    });
  }
  return series;
};

export const currentStreak = (records: { answeredAt: string }[]) => {
  const days = new Set(records.map((record) => localDateKey(record.answeredAt)));
  let streak = 0;
  const cursor = new Date();
  if (!days.has(localDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(localDateKey(cursor))) return 0;
  }
  while (days.has(localDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
};
