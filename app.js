const express = require("express");
const path = require("path");
const session = require("express-session");
const sqlite3 = require("sqlite3").verbose();

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));
app.use(
  session({
    secret: "study-app-secret-key",
    resave: false,
    saveUninitialized: false,
  }),
);

const db = new sqlite3.Database(
  path.join(__dirname, "database.sqlite"),
  (err) => {
    if (err) {
      console.error("Database connection failed:", err);
      process.exit(1);
    }
  },
);

db.run(
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL
  )`,
  (err) => {
    if (err) {
      console.error("Failed to create users table:", err);
      process.exit(1);
    }
  },
);

db.run(
  `CREATE TABLE IF NOT EXISTS study_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    subject TEXT NOT NULL,
    duration REAL NOT NULL,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    record_date TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,
  (err) => {
    if (err) {
      console.error("Failed to create study_logs table:", err);
      process.exit(1);
    }
  },
);

// Ensure older databases have the `record_date` column
db.all("PRAGMA table_info(study_logs)", (err, cols) => {
  if (err) {
    console.error("Failed to read table info:", err);
    return;
  }
  const hasRecordDate = cols && cols.some((c) => c.name === "record_date");
  if (!hasRecordDate) {
    db.run("ALTER TABLE study_logs ADD COLUMN record_date TEXT", (alterErr) => {
      if (alterErr) {
        console.error("Failed to add record_date column:", alterErr);
      }
    });
  }
});

app.get("/", (req, res) => {
  const isLoggedIn = !!req.session.userId;
  const username = req.session.username || "ゲスト";
  res.render("index", { isLoggedIn, username });
});

app.get("/login", (req, res) => {
  const isLoggedIn = !!req.session.userId;
  const username = req.session.username || "ゲスト";
  res.render("login", { isLoggedIn, username });
});

app.get("/join", (req, res) => {
  const isLoggedIn = !!req.session.userId;
  const username = req.session.username || "ゲスト";
  res.render("join", { isLoggedIn, username });
});

app.get("/logs/new", (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }
  const isLoggedIn = true;
  const username = req.session.username || "ゲスト";
  res.render("logs/new", { isLoggedIn, username });
});

app.get("/logs/all", (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }

  db.all(
    "SELECT * FROM study_logs WHERE user_id = ? ORDER BY created_at DESC",
    [req.session.userId],
    (err, studyLogs) => {
      const isLoggedIn = true;
      const username = req.session.username || "ゲスト";
      if (err) {
        console.error("Failed to fetch all logs:", err);
        return res.render("logs/all", {
          studyLogs: [],
          monthOptions: [],
          selectedMonth: null,
          isLoggedIn,
          username,
        });
      }

      const logs = studyLogs || [];
      const formatYearMonth = (dateStr) => {
        if (!dateStr) return null;
        let normalized = dateStr;
        if (typeof normalized === "string" && normalized.indexOf(" ") !== -1) {
          normalized = normalized.replace(" ", "T");
        }
        const d = new Date(normalized);
        if (isNaN(d)) return null;
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      };

      const months = [];
      logs.forEach((log) => {
        const month = formatYearMonth(log.record_date || log.created_at);
        if (month && !months.includes(month)) {
          months.push(month);
        }
      });

      months.sort((a, b) => (a < b ? 1 : -1));
      const selectedMonth = req.query.month || months[0] || null;
      const filteredLogs = selectedMonth
        ? logs.filter(
            (log) =>
              formatYearMonth(log.record_date || log.created_at) ===
              selectedMonth,
          )
        : logs;

      res.render("logs/all", {
        studyLogs: filteredLogs,
        monthOptions: months,
        selectedMonth,
        isLoggedIn,
        username,
      });
    },
  );
});

app.post("/logs/:id/delete", (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }

  const logId = Number(req.params.id);
  if (!logId) {
    return res.redirect("/logs/all");
  }

  db.run(
    "DELETE FROM study_logs WHERE id = ? AND user_id = ?",
    [logId, req.session.userId],
    function (err) {
      if (err) {
        console.error("Failed to delete study log:", err);
      }
      res.redirect("/logs/all");
    },
  );
});

app.post("/join", (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.redirect("/join");
  }

  const sql = "INSERT INTO users (name, email, password) VALUES (?, ?, ?)";
  db.run(sql, [name, email, password], function (err) {
    if (err) {
      console.error("Failed to save user:", err);
      return res.redirect("/join");
    }

    res.redirect("/login");
  });
});

app.post("/login", (req, res) => {
  const email = req.body.email;
  const password = req.body.password;

  db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
    if (err) {
      console.error("Login query failed:", err);
      return res.redirect("/login");
    }

    if (!user || user.password !== password) {
      return res.redirect("/login");
    }

    req.session.userId = user.id;
    req.session.username = user.name;
    res.redirect("/home");
  });
});

app.post("/logs", (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }

  const { subject, duration, note } = req.body;
  // Use provided record_date or default to today's date (YYYY-MM-DD)
  const record_date =
    req.body.record_date || new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  if (!subject || !duration) {
    return res.redirect("/logs/new");
  }

  const sql =
    "INSERT INTO study_logs (user_id, subject, duration, note, record_date) VALUES (?, ?, ?, ?, ?)";
  db.run(
    sql,
    [req.session.userId, subject, duration, note || "", record_date || null],
    (err) => {
      if (err) {
        console.error("Failed to save study log:", err);
        return res.redirect("/logs/new");
      }

      res.redirect("/home");
    },
  );
});

app.get("/home", (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }

  db.all(
    "SELECT * FROM study_logs WHERE user_id = ? ORDER BY created_at DESC",
    [req.session.userId],
    (err, studyLogs) => {
      if (err) {
        console.error("Failed to fetch study logs:", err);
        const isLoggedIn = true;
        const username = req.session.username || "ゲスト";
        return res.render("home", {
          studyLogs: [],
          isLoggedIn,
          username,
          weeklyData: [],
          weekLabels: [],
        });
      }

      // Calculate weekly aggregates for the last 7 weeks
      const weeklyMap = {};
      const now = new Date();

      // Helper: format Date to local YYYY-MM-DD
      const formatLocalDate = (d) => {
        return (
          d.getFullYear() +
          "-" +
          String(d.getMonth() + 1).padStart(2, "0") +
          "-" +
          String(d.getDate()).padStart(2, "0")
        );
      };

      for (let i = 0; i < 7; i++) {
        const weekEnd = new Date(now);
        weekEnd.setDate(weekEnd.getDate() - i * 7);
        weekEnd.setHours(23, 59, 59, 999);

        const weekStart = new Date(weekEnd);
        weekStart.setDate(weekStart.getDate() - 6);
        weekStart.setHours(0, 0, 0, 0);

        const weekKey = formatLocalDate(weekStart);
        weeklyMap[weekKey] = 0;
      }

      if (studyLogs) {
        studyLogs.forEach((log) => {
          const dateSource = log.record_date || log.created_at;
          // Normalize created_at like 'YYYY-MM-DD HH:MM:SS' -> 'YYYY-MM-DDTHH:MM:SS'
          let dateStr = dateSource;
          if (!dateStr) return;
          if (typeof dateStr === "string" && dateStr.indexOf(" ") !== -1) {
            dateStr = dateStr.replace(" ", "T");
          }
          const logDate = new Date(dateStr);
          if (isNaN(logDate)) {
            console.warn("[home] invalid log date:", dateSource);
            return;
          }
          const daysDiff = Math.floor((now - logDate) / (1000 * 60 * 60 * 24));

          if (daysDiff < 49) {
            const weekIndex = Math.floor(daysDiff / 7);
            const weekEnd = new Date(now);
            weekEnd.setDate(weekEnd.getDate() - weekIndex * 7);
            const weekStart = new Date(weekEnd);
            weekStart.setDate(weekStart.getDate() - 6);
            const weekKey = formatLocalDate(weekStart);

            if (weeklyMap.hasOwnProperty(weekKey)) {
              const added = Number(log.duration) || 0;
              weeklyMap[weekKey] += added;
              console.log(
                `[home] log id=${log.id} date=${dateStr} weekKey=${weekKey} duration=${log.duration} added=${added}`,
              );
            } else {
              console.log(
                `[home] log id=${log.id} date=${dateStr} weekKey=${weekKey} NOT_FOUND in weeklyMap`,
              );
            }
          }
        });
      }

      console.log("[home] weeklyMap=", JSON.stringify(weeklyMap));

      const weekLabels = [];
      const weeklyData = [];

      for (let i = 6; i >= 0; i--) {
        const weekEnd = new Date(now);
        weekEnd.setDate(weekEnd.getDate() - i * 7);
        const weekStart = new Date(weekEnd);
        weekStart.setDate(weekStart.getDate() - 6);

        const weekKey = formatLocalDate(weekStart);
        const startStr = formatLocalDate(weekStart);
        const endStr = formatLocalDate(weekEnd);

        weekLabels.push(startStr + " - " + endStr);
        weeklyData.push(weeklyMap[weekKey] || 0);
      }

      const isLoggedIn = true;
      const username = req.session.username || "ゲスト";
      const recentLogs = (studyLogs || []).slice(0, 3);

      // Debug logging: show counts and weekly aggregates
      try {
        console.log("[home] studyLogsCount=", (studyLogs || []).length);
        console.log("[home] weekLabels=", JSON.stringify(weekLabels));
        console.log("[home] weeklyData=", JSON.stringify(weeklyData));
      } catch (e) {
        console.error("[home] debug log failed:", e);
      }

      res.render("home", {
        studyLogs: studyLogs || [],
        recentLogs,
        isLoggedIn,
        username,
        weeklyData,
        weekLabels,
      });
    },
  );
});

app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Failed to destroy session:", err);
    }
    res.redirect("/");
  });
});

// Debug route: list study_logs for current user as JSON
app.get("/debug/logs", (req, res) => {
  if (!req.session.userId)
    return res.status(403).send({ error: "not_logged_in" });

  db.all(
    "SELECT id, subject, duration, note, created_at, record_date FROM study_logs WHERE user_id = ? ORDER BY created_at DESC",
    [req.session.userId],
    (err, rows) => {
      if (err) return res.status(500).send({ error: err.message });
      res.json(rows || []);
    },
  );
});

// Unauthenticated debug route: fetch logs for any user id (for local testing)
app.get("/debug/logs/user/:userId", (req, res) => {
  const userId = Number(req.params.userId);
  if (!userId) return res.status(400).send({ error: "invalid_user_id" });

  db.all(
    "SELECT id, subject, duration, note, created_at, record_date FROM study_logs WHERE user_id = ? ORDER BY created_at DESC",
    [userId],
    (err, rows) => {
      if (err) return res.status(500).send({ error: err.message });
      res.json(rows || []);
    },
  );
});

app.listen(3000, () => {
  console.log("Server started on http://localhost:3000");
});
