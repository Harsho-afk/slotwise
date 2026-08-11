const prisma = require("../db/prisma");

// Given a doctor and a date (YYYY-MM-DD), compute the slots that fall
// within their configured availability for that weekday, minus slots
// that are already booked (confirmed or pending_payment).
async function getAvailableSlots(doctorId, dateStr) {
  const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
  if (!doctor) return null;

  const date = new Date(`${dateStr}T00:00:00.000Z`);
  const weekday = date.getUTCDay();

  const availability = await prisma.doctorAvailability.findMany({
    where: { doctorId, weekday },
  });
  if (availability.length === 0) return [];

  const durationMs = doctor.slotDurationMinutes * 60 * 1000;

  // Build the full list of candidate slots from each availability window.
  const candidates = [];
  for (const window of availability) {
    const [startH, startM] = [window.startTime.getUTCHours(), window.startTime.getUTCMinutes()];
    const [endH, endM] = [window.endTime.getUTCHours(), window.endTime.getUTCMinutes()];

    let cursor = new Date(date);
    cursor.setUTCHours(startH, startM, 0, 0);
    const end = new Date(date);
    end.setUTCHours(endH, endM, 0, 0);

    while (cursor.getTime() + durationMs <= end.getTime()) {
      candidates.push(new Date(cursor));
      cursor = new Date(cursor.getTime() + durationMs);
    }
  }

  // Exclude slots already taken by a live appointment.
  const dayStart = new Date(date);
  const dayEnd = new Date(date.getTime() + 24 * 60 * 60 * 1000);

  const taken = await prisma.appointment.findMany({
    where: {
      doctorId,
      slotStart: { gte: dayStart, lt: dayEnd },
      status: { in: ["pending_payment", "confirmed"] },
    },
    select: { slotStart: true },
  });
  const takenTimes = new Set(taken.map((a) => a.slotStart.getTime()));

  return candidates
    .filter((slot) => !takenTimes.has(slot.getTime()))
    .map((slot) => ({
      start: slot.toISOString(),
      end: new Date(slot.getTime() + durationMs).toISOString(),
    }));
}

module.exports = { getAvailableSlots };
