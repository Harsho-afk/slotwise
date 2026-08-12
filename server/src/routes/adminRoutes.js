const express = require("express");
const {
  createDoctor,
  listAppointments,
  updateAppointmentStatus,
  stats,
} = require("../controllers/adminController");
const { requireAuth } = require("../middleware/auth");
const { requireRole } = require("../middleware/requireRole");

const router = express.Router();

router.use(requireAuth);

router.post("/doctors", requireRole("admin"), createDoctor);
router.get("/appointments", requireRole("admin", "doctor"), listAppointments);
router.patch("/appointments/:id", requireRole("admin", "doctor"), updateAppointmentStatus);
router.get("/stats", requireRole("admin"), stats);

module.exports = router;
