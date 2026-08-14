import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { appointmentsApi } from "../api/resources";

function formatDateTime(iso) {
  return new Date(iso).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_LABEL = {
  pending_payment: "Awaiting payment",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  completed: "Completed",
  no_show: "No-show",
};

export function MyAppointments() {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState(null);
  const [error, setError] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [resumingId, setResumingId] = useState(null);

  function load() {
    appointmentsApi
      .mine()
      .then(setAppointments)
      .catch((err) => setError(err.message));
  }

  useEffect(load, []);

  async function handleCancel(id) {
    setCancellingId(id);
    setError(null);
    try {
      await appointmentsApi.cancel(id);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCancellingId(null);
    }
  }

  // For a slot that's still pending_payment — e.g. checkout was abandoned
  // last time — this creates a fresh mock order and sends the patient back
  // to checkout, rather than leaving them stuck with no way to pay.
  async function handleResumePayment(id) {
    setResumingId(id);
    setError(null);
    try {
      const { orderId } = await appointmentsApi.pay(id);
      navigate(`/checkout/${orderId}?appointmentId=${id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setResumingId(null);
    }
  }

  return (
    <div className="shell" style={{ paddingTop: "3rem" }}>
      <p className="eyebrow">Your bookings</p>
      <h1>My appointments</h1>

      {error && <div className="error-banner">{error}</div>}

      {appointments === null ? (
        <p>Loading…</p>
      ) : appointments.length === 0 ? (
        <div className="empty-state">You don't have any appointments yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {appointments.map((a) => {
            const hoursUntil = (new Date(a.slotStart).getTime() - Date.now()) / (1000 * 60 * 60);
            const canCancel =
              ["pending_payment", "confirmed"].includes(a.status) && hoursUntil >= 2;

            return (
              <div key={a.id} className="card" style={{ padding: "1rem 1.25rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{a.doctor.user.fullName}</div>
                    <div style={{ fontSize: "0.85rem", color: "var(--ink-soft)" }}>
                      {formatDateTime(a.slotStart)}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <span className={`tag tag-${a.status}`}>{STATUS_LABEL[a.status] || a.status}</span>
                    {a.status === "pending_payment" && hoursUntil >= 2 && (
                      <button
                        className="btn btn-primary"
                        disabled={resumingId === a.id}
                        onClick={() => handleResumePayment(a.id)}
                      >
                        {resumingId === a.id ? "Starting…" : "Pay now"}
                      </button>
                    )}
                    {canCancel && (
                      <button
                        className="btn btn-danger"
                        disabled={cancellingId === a.id}
                        onClick={() => handleCancel(a.id)}
                      >
                        {cancellingId === a.id ? "Cancelling…" : "Cancel"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
