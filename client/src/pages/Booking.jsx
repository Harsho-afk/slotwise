import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { doctorsApi, appointmentsApi } from "../api/resources";
import "../components/ledger.css";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatMoney(paise) {
  return `₹${(paise / 100).toFixed(0)}`;
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function Booking() {
  const navigate = useNavigate();
  const [doctors, setDoctors] = useState([]);
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState(todayIso());
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    doctorsApi.list().then((list) => {
      setDoctors(list);
      if (list.length > 0) setDoctorId(list[0].id);
    });
  }, []);

  useEffect(() => {
    if (!doctorId || !date) return;
    setLoadingSlots(true);
    setError(null);
    doctorsApi
      .slots(doctorId, date)
      .then((res) => setSlots(res.slots))
      .catch((err) => setError(err.message))
      .finally(() => setLoadingSlots(false));
  }, [doctorId, date]);

  const selectedDoctor = doctors.find((d) => d.id === doctorId);

  async function claimSlot(slotStart) {
    setBooking(true);
    setError(null);
    try {
      const appointment = await appointmentsApi.create(doctorId, slotStart);
      const { orderId } = await appointmentsApi.pay(appointment.id);
      navigate(`/checkout/${orderId}?appointmentId=${appointment.id}`);
    } catch (err) {
      setError(err.message);
      // Re-fetch — the slot may now be taken (double-booking race).
      doctorsApi.slots(doctorId, date).then((res) => setSlots(res.slots));
    } finally {
      setBooking(false);
    }
  }

  return (
    <div className="shell" style={{ paddingTop: "3rem" }}>
      <p className="eyebrow">Book an appointment</p>
      <h1>Reserve a time with your doctor</h1>
      <p>Pick a doctor and a date — open slots are pulled from their live schedule.</p>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <div className="field" style={{ flex: "1 1 220px", marginBottom: 0 }}>
            <label htmlFor="doctor">Doctor</label>
            <select id="doctor" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.fullName}
                  {d.specialty ? ` — ${d.specialty}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: "1 1 160px", marginBottom: 0 }}>
            <label htmlFor="date">Date</label>
            <input
              id="date"
              type="date"
              min={todayIso()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>
        {selectedDoctor && (
          <p style={{ marginTop: "1rem", marginBottom: 0, fontSize: "0.85rem" }}>
            Consultation fee:{" "}
            <strong style={{ fontFamily: "var(--font-mono)" }}>
              {formatMoney(selectedDoctor.consultationFeePaise)}
            </strong>{" "}
            · {selectedDoctor.slotDurationMinutes}-minute slots
          </p>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}

      <h2 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>Open slots</h2>

      {loadingSlots ? (
        <p>Checking the appointment book…</p>
      ) : slots.length === 0 ? (
        <div className="empty-state">No open slots on this date. Try another day.</div>
      ) : (
        <div className="ledger">
          {slots.map((slot) => (
            <div className="ledger-row" key={slot.start}>
              <div className="ledger-hole" />
              <div className="ledger-time">{formatTime(slot.start)}</div>
              <div className="ledger-action">
                <button
                  className="ledger-claim"
                  disabled={booking}
                  onClick={() => claimSlot(slot.start)}
                >
                  Claim slot
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
