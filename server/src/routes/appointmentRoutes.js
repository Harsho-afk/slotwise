const express = require("express");
const {
  createAppointment,
  payForAppointment,
  cancelAppointment,
  myAppointments,
} = require("../controllers/appointmentController");
const { requireAuth } = require("../middleware/auth");
const { requireRole } = require("../middleware/requireRole");

const router = express.Router();

router.post("/", requireAuth, requireRole("patient"), createAppointment);
router.get("/me", requireAuth, requireRole("patient"), myAppointments);
router.post("/:id/pay", requireAuth, payForAppointment);
router.delete("/:id", requireAuth, cancelAppointment);

module.exports = router;
