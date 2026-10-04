const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// Allow your HTML dashboard to call this backend.
app.use(cors());
app.use(express.json({ limit: "32kb" }));

// In-memory history. Newest result is always first.
// For production, replace this with a database.
let spins = [];

// European roulette colors.
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const BLACK = new Set([2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35]);

function isValidNumber(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 36;
}

function colorOf(number) {
  if (number === 0) return "green";
  if (RED.has(number)) return "red";
  if (BLACK.has(number)) return "black";
  return "unknown";
}

function addSpin(number) {
  const n = Number(number);

  spins.unshift(n);
  spins = spins.slice(0, 1000);

  return {
    number: n,
    color: colorOf(n),
    timestamp: new Date().toISOString()
  };
}

// Health check.
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "roulette-backend",
    spinsStored: spins.length,
    time: new Date().toISOString()
  });
});

// Endpoint used by index.html.
app.get("/api/roulette-history", (req, res) => {
  res.set("Cache-Control", "no-store");

  res.json({
    ok: true,
    game: "roulette",
    spins,
    count: spins.length,
    source: "backend",
    updatedAt: new Date().toISOString()
  });
});

// Add one roulette result.
// Example JSON: { "number": 17 }
app.post("/api/roulette-result", (req, res) => {
  const { number } = req.body || {};

  if (!isValidNumber(number)) {
    return res.status(400).json({
      ok: false,
      error: "number must be a whole number from 0 to 36"
    });
  }

  const result = addSpin(number);

  res.status(201).json({
    ok: true,
    result,
    count: spins.length
  });
});

// Add multiple results at once.
// Example JSON: { "spins": [17, 32, 0, 5] }
app.post("/api/roulette-history", (req, res) => {
  const incoming = req.body && req.body.spins;

  if (!Array.isArray(incoming) || incoming.length === 0) {
    return res.status(400).json({
      ok: false,
      error: "spins must be a non-empty array"
    });
  }

  if (incoming.length > 1000) {
    return res.status(400).json({
      ok: false,
      error: "maximum 1000 results per request"
    });
  }

  const numbers = incoming.map(Number);

  if (numbers.some(n => !isValidNumber(n))) {
    return res.status(400).json({
      ok: false,
      error: "every spin must be a whole number from 0 to 36"
    });
  }

  // The first item supplied is treated as the newest result.
  spins = numbers.concat(spins).slice(0, 1000);

  res.status(201).json({
    ok: true,
    added: numbers.length,
    count: spins.length
  });
});

// Clear stored results.
// Keep this disabled in a public production deployment unless protected.
app.delete("/api/roulette-history", (req, res) => {
  spins = [];

  res.json({
    ok: true,
    message: "Roulette history cleared"
  });
});

// Simple 404 response.
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: "Endpoint not found"
  });
});

// Error handler.
app.use((err, req, res, next) => {
  console.error(err);

  res.status(500).json({
    ok: false,
    error: "Internal server error"
  });
});

app.listen(PORT, () => {
  console.log(`Roulette backend running on port ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
  console.log(`History: http://localhost:${PORT}/api/roulette-history`);
});
