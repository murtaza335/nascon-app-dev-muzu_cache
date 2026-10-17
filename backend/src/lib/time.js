'use strict';
// UTC date helpers (A2: server "today" is UTC). Dates are 'YYYY-MM-DD' strings, timestamps 'YYYY-MM-DDTHH:MM:SSZ'.
const addDays = (date, days) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const isoSeconds = (d) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');
const todayUtc = (d = new Date()) => d.toISOString().slice(0, 10);

module.exports = { addDays, isoSeconds, todayUtc };
