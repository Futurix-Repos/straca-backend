const cron = require("node-cron");
const { TZ } = require("./dateRanges");
const {
  sendDailyReport,
  sendWeeklyReport,
  sendMonthlyReport,
} = require("./index");

const jobs = [
  { name: "daily", expr: "0 20 * * *", run: sendDailyReport },
  { name: "weekly", expr: "0 20 * * 0", run: sendWeeklyReport },
  { name: "monthly", expr: "0 8 1 * *", run: sendMonthlyReport },
];

function start() {
  for (const { name, expr, run } of jobs) {
    cron.schedule(
      expr,
      async () => {
        try {
          await run();
        } catch (err) {
          console.error(`[reports] ${name} report failed:`, err);
        }
      },
      { timezone: TZ },
    );
    console.log(`[reports] scheduled ${name} (${expr}, ${TZ})`);
  }
}

module.exports = { start };
