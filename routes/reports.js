const express = require("express");
const router = express.Router();
const { authorizeJwt } = require("../helpers/verifyAccount");
const {
  sendDailyReport,
  sendWeeklyReport,
  sendMonthlyReport,
  buildReportXlsx,
  reportFilename,
} = require("../services/reports");
const { generateReport } = require("../services/reports/generate");

const VALID_TYPES = new Set(["daily", "weekly", "monthly"]);

const triggerHandlers = {
  daily: sendDailyReport,
  weekly: sendWeeklyReport,
  monthly: sendMonthlyReport,
};

function parseType(req, res) {
  const type = (req.query.type || "").toLowerCase();
  if (!VALID_TYPES.has(type)) {
    res
      .status(400)
      .json({ message: "type must be one of: daily, weekly, monthly" });
    return null;
  }
  return type;
}

function parseDate(req, res) {
  const raw = req.query.date;
  if (!raw) return new Date();
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    res.status(400).json({ message: "date must be a valid ISO string" });
    return null;
  }
  return parsed;
}

router.post("/trigger", authorizeJwt, async (req, res) => {
  const type = parseType(req, res);
  if (!type) return;

  try {
    const result = await triggerHandlers[type]();
    res.status(200).json({ type, ...result });
  } catch (error) {
    console.error("[reports/trigger] error:", error);
    res.status(500).json({ message: error.message });
  }
});

router.get("/preview", authorizeJwt, async (req, res) => {
  const type = parseType(req, res);
  if (!type) return;
  const date = parseDate(req, res);
  if (!date) return;

  try {
    const report = await generateReport({ type, date });
    res.status(200).json(report);
  } catch (error) {
    console.error("[reports/preview] error:", error);
    res.status(500).json({ message: error.message });
  }
});

router.get("/download", authorizeJwt, async (req, res) => {
  const type = parseType(req, res);
  if (!type) return;
  const date = parseDate(req, res);
  if (!date) return;

  try {
    const report = await generateReport({ type, date });
    const buffer = await buildReportXlsx(report);
    const filename = reportFilename(type, report.label);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`,
    );
    res.status(200).send(buffer);
  } catch (error) {
    console.error("[reports/download] error:", error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
