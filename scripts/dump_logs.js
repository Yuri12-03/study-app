const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("database.sqlite");

db.all(
  "SELECT id, subject, duration, note, created_at, record_date FROM study_logs",
  (err, rows) => {
    if (err) {
      console.error("DB error:", err);
      process.exit(1);
    }
    console.log(JSON.stringify(rows, null, 2));
    db.close();
  },
);
