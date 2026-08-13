import { apiJson } from "./client";

export const authApi = {
  signup: (data) => apiJson("/auth/signup", { method: "POST", body: JSON.stringify(data) }),
  login: (data) => apiJson("/auth/login", { method: "POST", body: JSON.stringify(data) }),
  logout: () => apiJson("/auth/logout", { method: "POST" }),
};

export const doctorsApi = {
  list: () => apiJson("/doctors"),
  slots: (doctorId, date) => apiJson(`/doctors/${doctorId}/slots?date=${date}`),
};

export const appointmentsApi = {
  create: (doctorId, slotStart) =>
    apiJson("/appointments", { method: "POST", body: JSON.stringify({ doctorId, slotStart }) }),
  pay: (appointmentId) => apiJson(`/appointments/${appointmentId}/pay`, { method: "POST" }),
  cancel: (appointmentId) => apiJson(`/appointments/${appointmentId}`, { method: "DELETE" }),
  mine: () => apiJson("/appointments/me"),
  simulatePayment: (orderId, outcome) =>
    apiJson(`/payments/mock/${orderId}/simulate?outcome=${outcome}`, { method: "POST" }),
};

export const adminApi = {
  createDoctor: (data) => apiJson("/admin/doctors", { method: "POST", body: JSON.stringify(data) }),
  listAppointments: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiJson(`/admin/appointments${qs ? `?${qs}` : ""}`);
  },
  updateAppointmentStatus: (id, status) =>
    apiJson(`/admin/appointments/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
  stats: () => apiJson("/admin/stats"),
};
