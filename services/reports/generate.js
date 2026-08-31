const {
  getDayRange,
  getWeekRange,
  getMonthRange,
  getPreviousMonthRange,
} = require("./dateRanges");
const { findDeliveriesBetween, summarize } = require("./deliveryQueries");

async function generateReport({ type, date = new Date() }) {
  const d = new Date(date);

  if (type === "daily") {
    const range = getDayRange(d);
    const deliveries = await findDeliveriesBetween(range.start, range.end);
    return {
      type,
      label: range.label,
      period: { start: range.start, end: range.end },
      deliveries,
      summary: summarize(deliveries),
    };
  }

  if (type === "weekly") {
    const range = getWeekRange(d);
    const deliveries = await findDeliveriesBetween(range.start, range.end);
    return {
      type,
      label: range.label,
      period: { start: range.start, end: range.end },
      deliveries,
      summary: summarize(deliveries),
    };
  }

  if (type === "monthly") {
    const current = getMonthRange(d);
    const previous = getPreviousMonthRange(d);
    const [deliveries, previousDeliveries] = await Promise.all([
      findDeliveriesBetween(current.start, current.end),
      findDeliveriesBetween(previous.start, previous.end),
    ]);
    return {
      type,
      label: current.label,
      period: { start: current.start, end: current.end },
      deliveries,
      summary: summarize(deliveries),
      previous: {
        label: previous.label,
        summary: summarize(previousDeliveries),
      },
    };
  }

  throw new Error(`Unknown report type: ${type}`);
}

module.exports = { generateReport };
