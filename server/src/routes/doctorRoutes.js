const express = require("express");
const { listDoctors, getSlots } = require("../controllers/doctorController");

const router = express.Router();

router.get("/", listDoctors);
router.get("/:id/slots", getSlots);

module.exports = router;
