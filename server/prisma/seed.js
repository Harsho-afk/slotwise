require("dotenv").config();
const argon2 = require("argon2");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// Mon–Fri, 9am–5pm — same default the admin UI offers when creating a doctor.
const WEEKDAY_AVAILABILITY = [1, 2, 3, 4, 5].map((weekday) => ({
  weekday,
  startTime: "09:00",
  endTime: "17:00",
}));

function timeOf(hhmm) {
  return new Date(`1970-01-01T${hhmm}:00.000Z`);
}

// Nearest future weekday at a given hour/minute, `daysAhead` weekdays out —
// keeps the demo appointments inside each doctor's Mon–Fri 9–5 availability
// no matter what day you actually run the seed on.
function nextWeekdaySlot(daysAhead, hour, minute = 0) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  let added = 0;
  while (added < daysAhead) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) added++;
  }
  d.setUTCHours(hour, minute, 0, 0);
  return d;
}

function pastSlot(daysAgo, hour, minute = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  d.setUTCHours(hour, minute, 0, 0);
  return d;
}

async function ensureUser({ email, password, fullName, phone, role, isVerified = true }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  return prisma.user.create({
    data: { email, passwordHash, fullName, phone, role, isVerified },
  });
}

async function ensureDoctor({ email, password, fullName, specialty, feeRupees, slotMinutes = 20 }) {
  const existing = await prisma.doctor.findFirst({ where: { user: { email } } });
  if (existing) return existing;

  const user = await ensureUser({ email, password, fullName, role: "doctor" });
  const doctor = await prisma.doctor.create({
    data: {
      userId: user.id,
      specialty,
      slotDurationMinutes: slotMinutes,
      consultationFeePaise: feeRupees * 100,
    },
  });
  await prisma.doctorAvailability.createMany({
    data: WEEKDAY_AVAILABILITY.map((a) => ({
      doctorId: doctor.id,
      weekday: a.weekday,
      startTime: timeOf(a.startTime),
      endTime: timeOf(a.endTime),
    })),
  });
  return doctor;
}

async function ensureAppointment({ patientId, doctor, slotStart, status, withPayment }) {
  const slotEnd = new Date(slotStart.getTime() + doctor.slotDurationMinutes * 60 * 1000);

  const existing = await prisma.appointment.findFirst({
    where: { doctorId: doctor.id, slotStart },
  });
  if (existing) return existing;

  const appointment = await prisma.appointment.create({
    data: { patientId, doctorId: doctor.id, slotStart, slotEnd, status },
  });

  if (withPayment) {
    await prisma.payment.create({
      data: {
        appointmentId: appointment.id,
        provider: "mock",
        providerPaymentId: `mock_order_seed_${appointment.id}`,
        amountPaise: doctor.consultationFeePaise,
        status: withPayment, // "paid" | "created"
      },
    });
  }

  return appointment;
}

async function main() {
  // --- Admin ---
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@clinic.test";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "ChangeMe123!";
  const adminExisted = await prisma.user.findUnique({ where: { email: adminEmail } });
  await ensureUser({
    email: adminEmail,
    password: adminPassword,
    fullName: "Clinic Admin",
    role: "admin",
  });

  // --- Doctors ---
  const drRao = await ensureDoctor({
    email: "s.rao@clinic.test",
    password: "Doctor123!",
    fullName: "Dr. Sunita Rao",
    specialty: "General Physician",
    feeRupees: 500,
    slotMinutes: 20,
  });
  const drMehta = await ensureDoctor({
    email: "a.mehta@clinic.test",
    password: "Doctor123!",
    fullName: "Dr. Arjun Mehta",
    specialty: "Dermatology",
    feeRupees: 800,
    slotMinutes: 30,
  });
  const drIyer = await ensureDoctor({
    email: "p.iyer@clinic.test",
    password: "Doctor123!",
    fullName: "Dr. Priya Iyer",
    specialty: "Pediatrics",
    feeRupees: 600,
    slotMinutes: 20,
  });

  // --- Patients ---
  const patientDefs = [
    { email: "asha.verma@example.com", fullName: "Asha Verma", phone: "9876500001" },
    { email: "rohan.kapoor@example.com", fullName: "Rohan Kapoor", phone: "9876500002" },
    { email: "meera.nair@example.com", fullName: "Meera Nair", phone: "9876500003" },
  ];
  const patients = [];
  for (const p of patientDefs) {
    patients.push(await ensureUser({ ...p, password: "Patient123!", role: "patient" }));
  }
  const [asha, rohan, meera] = patients;

  // --- Appointments: a mix of past (completed/no-show) and upcoming
  //     (confirmed/pending_payment) across doctors, so the admin dashboard
  //     stats and patient appointment lists both have something to show. ---
  await ensureAppointment({
    patientId: asha.id,
    doctor: drRao,
    slotStart: pastSlot(3, 10, 0),
    status: "completed",
    withPayment: "paid",
  });
  await ensureAppointment({
    patientId: rohan.id,
    doctor: drMehta,
    slotStart: pastSlot(2, 14, 30),
    status: "no_show",
    withPayment: "paid",
  });
  await ensureAppointment({
    patientId: meera.id,
    doctor: drIyer,
    slotStart: pastSlot(1, 11, 0),
    status: "completed",
    withPayment: "paid",
  });
  await ensureAppointment({
    patientId: asha.id,
    doctor: drIyer,
    slotStart: nextWeekdaySlot(1, 9, 40),
    status: "confirmed",
    withPayment: "paid",
  });
  await ensureAppointment({
    patientId: rohan.id,
    doctor: drRao,
    slotStart: nextWeekdaySlot(2, 15, 0),
    status: "confirmed",
    withPayment: "paid",
  });
  await ensureAppointment({
    patientId: meera.id,
    doctor: drMehta,
    slotStart: nextWeekdaySlot(3, 10, 30),
    status: "pending_payment",
    withPayment: "created",
  });

  console.log("Seed complete.\n");
  console.log("Login credentials:");
  if (!adminExisted) {
    console.log(`  Admin:    ${adminEmail} / ${adminPassword}  (change this immediately)`);
  } else {
    console.log(`  Admin:    ${adminEmail} (already existed, password unchanged)`);
  }
  console.log(`  Doctor:   s.rao@clinic.test / Doctor123!      (Dr. Sunita Rao — General Physician)`);
  console.log(`  Doctor:   a.mehta@clinic.test / Doctor123!    (Dr. Arjun Mehta — Dermatology)`);
  console.log(`  Doctor:   p.iyer@clinic.test / Doctor123!     (Dr. Priya Iyer — Pediatrics)`);
  console.log(`  Patient:  asha.verma@example.com / Patient123!`);
  console.log(`  Patient:  rohan.kapoor@example.com / Patient123!`);
  console.log(`  Patient:  meera.nair@example.com / Patient123!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
