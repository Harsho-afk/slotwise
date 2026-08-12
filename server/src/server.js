require("dotenv").config();
const app = require("./app");
const { startReminderJob } = require("./services/reminderJob");

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Clinic Appointment Manager API listening on port ${PORT}`);
  startReminderJob();
});
