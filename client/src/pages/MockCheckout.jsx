import { useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { appointmentsApi } from "../api/resources";

export function MockCheckout() {
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const appointmentId = searchParams.get("appointmentId");
  const navigate = useNavigate();
  const [status, setStatus] = useState("idle"); // idle | processing | paid | failed
  const [error, setError] = useState(null);

  async function simulate(outcome) {
    setStatus("processing");
    setError(null);
    try {
      // The webhook call itself succeeds (200) for both outcomes — a
      // "declined" payment is still a successfully delivered webhook
      // event. Whether it means the appointment is confirmed depends on
      // `outcome`, not on whether the request threw.
      await appointmentsApi.simulatePayment(orderId, outcome);
      if (outcome === "success") {
        setStatus("paid");
        setTimeout(() => navigate("/appointments"), 1400);
      } else {
        setStatus("failed");
      }
    } catch (err) {
      setError(err.message);
      setStatus("idle");
    }
  }

  return (
    <div className="shell" style={{ maxWidth: 420, paddingTop: "4rem" }}>
      <p className="eyebrow">Mock checkout</p>
      <h1>Complete payment</h1>
      <p style={{ fontSize: "0.85rem" }}>
        This stands in for a hosted gateway page (Razorpay/Stripe). Choosing an
        outcome here fires a signed webhook at the server — exactly like a
        real gateway would — which is the only thing that actually confirms
        the appointment.
      </p>

      <div className="card">
        {error && <div className="error-banner">{error}</div>}

        {status === "paid" ? (
          <div style={{ textAlign: "center", padding: "1rem 0" }}>
            <span className="stamp">Payment received</span>
            <p style={{ marginTop: "1rem" }}>Redirecting to your appointments…</p>
          </div>
        ) : status === "failed" ? (
          <div style={{ textAlign: "center", padding: "1rem 0" }}>
            <span className="stamp stamp-failed">Payment declined</span>
            <p style={{ marginTop: "1rem" }}>
              The slot is still held as <code>pending_payment</code>. You can retry from{" "}
              <a href="/appointments">My appointments</a>, or the booking will simply not be
              confirmed.
            </p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: "0.8rem", fontFamily: "var(--font-mono)" }}>
              order: {orderId}
              {appointmentId && (
                <>
                  <br />
                  appointment: {appointmentId}
                </>
              )}
            </p>
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
              <button
                className="btn btn-primary"
                disabled={status === "processing"}
                onClick={() => simulate("success")}
              >
                Simulate success
              </button>
              <button
                className="btn btn-danger"
                disabled={status === "processing"}
                onClick={() => simulate("failure")}
              >
                Simulate failure
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
