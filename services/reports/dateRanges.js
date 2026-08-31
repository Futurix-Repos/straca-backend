const TZ = "Africa/Porto-Novo";

function getLocalYMD(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return {
    y: parts.find((p) => p.type === "year").value,
    m: parts.find((p) => p.type === "month").value,
    d: parts.find((p) => p.type === "day").value,
  };
}

function localDate(y, m, d, hh = "00", mm = "00", ss = "00", ms = "000") {
  return new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}.${ms}+01:00`);
}

function getDayRange(date = new Date()) {
  const { y, m, d } = getLocalYMD(date);
  return {
    start: localDate(y, m, d),
    end: localDate(y, m, d, "23", "59", "59", "999"),
    label: `${d}/${m}/${y}`,
  };
}

function getWeekRange(date = new Date()) {
  const { y, m, d } = getLocalYMD(date);
  const monday = localDate(y, m, d);
  const jsDay = monday.getUTCDay();
  const offset = (jsDay + 6) % 7;
  monday.setUTCDate(monday.getUTCDate() - offset);

  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  sunday.setUTCHours(sunday.getUTCHours() + 23, 59, 59, 999);

  const fmt = (dt) => {
    const p = getLocalYMD(dt);
    return `${p.d}/${p.m}/${p.y}`;
  };

  return {
    start: monday,
    end: sunday,
    label: `${fmt(monday)} → ${fmt(sunday)}`,
  };
}

function getMonthRange(date = new Date()) {
  const { y, m } = getLocalYMD(date);
  const start = localDate(y, m, "01");
  const nextMonth = new Date(start);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  const end = new Date(nextMonth.getTime() - 1);
  return {
    start,
    end,
    label: `${m}/${y}`,
  };
}

function getPreviousMonthRange(date = new Date()) {
  const { y, m } = getLocalYMD(date);
  const currentStart = localDate(y, m, "01");
  const prevEnd = new Date(currentStart.getTime() - 1);
  return getMonthRange(prevEnd);
}

module.exports = {
  TZ,
  getDayRange,
  getWeekRange,
  getMonthRange,
  getPreviousMonthRange,
};
