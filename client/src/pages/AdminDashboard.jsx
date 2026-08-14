import { useEffect, useState } from "react";
import { adminApi } from "../api/resources";
import { useAuth } from "../context/AuthContext";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function AdminDashboard() {
  const { user } = useAuth();
  const isAdmin = user.role === "admin";

  const [date, setDate] = useState(todayIso());
  const [status, setStatus] = useState("");
  const [appointments, setAppointments] = useState([]);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  function loadAppointments() {
    const params = { date };
    if (status) params.status = status;
    adminApi
      .listAppointments(params)
      .then(setAppointments)
      .catch((err) => setError(err.message));
  }

  useEffect(loadAppointments, [date, status]);

  useEffect(() => {
    if (isAdmin) adminApi.stats().then(setStats).catch(() => {});
  }, [isAdmin]);

  async function markStatus(id, newStatus) {
    setUpdatingId(id);
    setError(null);
    try {
      await adminApi.updateAppointmentStatus(id, newStatus);
      loadAppointments();
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="shell" style={{ paddingTop: "3rem" }}>
      <p className="eyebrow">{isAdmin ? "Admin" : "Doctor"} dashboard</p>
      <h1>Today's schedule</h1>

      {error && <div className="error-banner">{error}</div>}

      {isAdmin && stats && (
        <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          <StatCard label="Bookings this week" value={stats.bookingsThisWeek} />
          <StatCard label="Completed this week" value={stats.completedThisWeek} />
          <StatCard label="No-show rate" value={`${(stats.noShowRate * 100).toFixed(0)}%`} />
        </div>
      )}

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="date">Date</label>
            <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="status">Status</label>
            <select id="status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All</option>
              <option value="pending_payment">Awaiting payment</option>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="no_show">No-show</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {appointments.length === 0 ? (
        <div className="empty-state">No appointments match this filter.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Patient</th>
              {isAdmin && <th>Doctor</th>}
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {appointments.map((a) => (
              <tr key={a.id}>
                <td style={{ fontFamily: "var(--font-mono)" }}>{formatTime(a.slotStart)}</td>
                <td>{a.patient.fullName}</td>
                {isAdmin && <td>{a.doctor.user.fullName}</td>}
                <td>
                  <span className={`tag tag-${a.status}`}>{a.status.replace("_", " ")}</span>
                </td>
                <td>
                  {a.status === "confirmed" && (
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        className="btn btn-secondary"
                        disabled={updatingId === a.id}
                        onClick={() => markStatus(a.id, "completed")}
                      >
                        Complete
                      </button>
                      <button
                        className="btn btn-secondary"
                        disabled={updatingId === a.id}
                        onClick={() => markStatus(a.id, "no_show")}
                      >
                        No-show
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {isAdmin && <CreateDoctorForm onCreated={loadAppointments} />}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="card" style={{ flex: "1 1 160px", padding: "1rem 1.25rem" }}>
      <div className="eyebrow">{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "1.6rem", marginTop: "0.25rem" }}>
        {value}
      </div>
    </div>
  );
}

function CreateDoctorForm({ onCreated }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    specialty: "",
    consultationFeePaise: "50000",
    slotDurationMinutes: "20",
  });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await adminApi.createDoctor({
        ...form,
        consultationFeePaise: Number(form.consultationFeePaise),
        slotDurationMinutes: Number(form.slotDurationMinutes),
        // Mon-Fri, 9am-5pm as a sensible default availability
        availability: [1, 2, 3, 4, 5].map((weekday) => ({
          weekday,
          startTime: "09:00",
          endTime: "17:00",
        })),
      });
      setForm({
        fullName: "",
        email: "",
        password: "",
        specialty: "",
        consultationFeePaise: "50000",
        slotDurationMinutes: "20",
      });
      setOpen(false);
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button className="btn btn-secondary" style={{ marginTop: "2rem" }} onClick={() => setOpen(true)}>
        + Add doctor
      </button>
    );
  }

  return (
    <div className="card" style={{ marginTop: "2rem", maxWidth: 420 }}>
      <h2 style={{ fontSize: "1rem" }}>New doctor account</h2>
      <p style={{ fontSize: "0.8rem" }}>Default availability: Mon–Fri, 9am–5pm.</p>
      {error && <div className="error-banner">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>Full name</label>
          <input required value={form.fullName} onChange={update("fullName")} />
        </div>
        <div className="field">
          <label>Email</label>
          <input type="email" required value={form.email} onChange={update("email")} />
        </div>
        <div className="field">
          <label>Temporary password</label>
          <input type="password" required minLength={8} value={form.password} onChange={update("password")} />
        </div>
        <div className="field">
          <label>Specialty</label>
          <input value={form.specialty} onChange={update("specialty")} />
        </div>
        <div className="field">
          <label>Consultation fee (paise)</label>
          <input type="number" required value={form.consultationFeePaise} onChange={update("consultationFeePaise")} />
        </div>
        <div className="field">
          <label>Slot duration (minutes)</label>
          <input type="number" required value={form.slotDurationMinutes} onChange={update("slotDurationMinutes")} />
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? "Creating…" : "Create doctor"}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
