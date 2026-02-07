const rateLimit = require("express-rate-limit");

const topicLimiter = rateLimit({
  windowMs: 60_000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Muitas tentativas. Aguarde um minuto e tente novamente."
});

const commentLimiter = rateLimit({
  windowMs: 60_000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Muitos comentarios em pouco tempo. Aguarde um minuto."
});

function isHoneypotFilled(body) {
  return typeof body.website === "string" && body.website.trim().length > 0;
}

function isFormTimingValid(body, { minMs = 2000, maxMs = 60 * 60 * 1000 } = {}) {
  const raw = body.form_ts;
  const ts = Number(raw);
  if (!Number.isFinite(ts)) return false;
  const delta = Date.now() - ts;
  return delta >= minMs && delta <= maxMs;
}

module.exports = {
  topicLimiter,
  commentLimiter,
  isHoneypotFilled,
  isFormTimingValid
};
