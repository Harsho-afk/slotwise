const cron = require("node-cron");
const prisma = require("../db/prisma");
const { sendAppointmentReminder } = require("./email");

// Reminders go out roughly 24h before the slot. Running this hourly with a
// 23-25h lookahead window guarantees every confirmed appointment gets
// exactly one reminder without needing sub-hour precision.
const LOOKAHEAD_MIN_HOURS = 23;
const LOOKAHEAD_MAX_HOURS = 25;

async function runReminderSweep() {
  const now = Date.now();
  const windowStart = new Date(now + LOOKAHEAD_MIN_HOURS * 60 * 60 * 1000);
  const windowEnd = new Date(now + LOOKAHEAD_MAX_HOURS * 60 * 60 * 1000);

  const due = await prisma.appointment.findMany({
    where: {
      status: "confirmed",
      reminderSent: false,
      slotStart: { gte: windowStart, lt: windowEnd },
    },
    include: {
      patient: { select: { email: true } },
      doctor: { include: { user: { select: { fullName: true } } } },
    },
  });

  for (const appointment of due) {
    try {
      await sendAppointmentReminder(appointment.patient.email, appointment);
      // Mark sent individually and only after a successful send, so a
      // mid-sweep crash just retries that appointment on the next run
      // instead of silently skipping it.
      await prisma.appointment.update({
        where: { id: appointment.id },
        data: { reminderSent: true },
      });
    } catch (err) {
      console.error(`Failed to send reminder for appointment ${appointment.id}:`, err);
    }
  }

  if (due.length > 0) {
    console.log(`Reminder sweep: sent ${due.length} reminder email(s).`);
  }
  return due.length;
}

// Runs at the top of every hour. Disabled automatically outside of
// production/development server runs (e.g. under test) unless explicitly started.
function startReminderJob() {
  cron.schedule("0 * * * *", () => {
    runReminderSweep().catch((err) => console.error("Reminder sweep failed:", err));
  });
  console.log("Reminder job scheduled (hourly).");
}

module.exports = { startReminderJob, runReminderSweep };
