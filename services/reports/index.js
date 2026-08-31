const transporter = require("../mail");
const { generateReport } = require("./generate");
const {
  buildDailyReport,
  buildWeeklyReport,
  buildMonthlyReport,
} = require("./templates");
const { buildDeliveriesWorkbook } = require("./excelExport");

const PREFIX_BY_TYPE = {
  daily: "voyages_journalier",
  weekly: "voyages_hebdomadaire",
  monthly: "voyages_mensuel",
};

const TEMPLATE_BY_TYPE = {
  daily: buildDailyReport,
  weekly: buildWeeklyReport,
  monthly: buildMonthlyReport,
};

function getRecipients() {
  const raw = process.env.REPORT_RECIPIENTS || "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function slugifyLabel(label) {
  return label.replace(/[^\w-]+/g, "_");
}

function reportFilename(type, label) {
  return `${PREFIX_BY_TYPE[type]}_${slugifyLabel(label)}.xlsx`;
}

async function buildReportXlsx(reportData) {
  return buildDeliveriesWorkbook(reportData.deliveries, {
    periodLabel: reportData.label,
  });
}

function buildEmailPayload(reportData) {
  const template = TEMPLATE_BY_TYPE[reportData.type];
  return template(reportData);
}

async function sendReport({ subject, html, attachments = [] }) {
  const recipients = getRecipients();
  if (recipients.length === 0) {
    console.warn("[reports] REPORT_RECIPIENTS is empty — email not sent");
    return { skipped: true };
  }

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: recipients.join(","),
    subject,
    html,
    attachments,
  });
  return { sent: true, recipients };
}

async function sendReportByType(type) {
  const reportData = await generateReport({ type });
  const payload = buildEmailPayload(reportData);

  const attachments = [];
  if (reportData.deliveries.length > 0) {
    const buffer = await buildReportXlsx(reportData);
    attachments.push({
      filename: reportFilename(type, reportData.label),
      content: buffer,
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  }

  const result = await sendReport({ ...payload, attachments });
  console.log(
    `[reports] ${type} ${reportData.label} → ${reportData.deliveries.length} voyages`,
    result,
  );
  return result;
}

const sendDailyReport = () => sendReportByType("daily");
const sendWeeklyReport = () => sendReportByType("weekly");
const sendMonthlyReport = () => sendReportByType("monthly");

module.exports = {
  sendDailyReport,
  sendWeeklyReport,
  sendMonthlyReport,
  buildReportXlsx,
  reportFilename,
};
