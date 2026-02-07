require("dotenv").config();
const path = require("path");
const express = require("express");
const cookieSession = require("cookie-session");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const csrf = require("csurf");

// require("./db"); // SQLite desativado para migração Supabase

const indexRoutes = require("./routes/index");
const postsRoutes = require("./routes/posts");
const forumRoutes = require("./routes/forum");
const adminRoutes = require("./routes/admin");

const app = express();

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  console.error("ERRO: SESSION_SECRET n\xE3o definido no .env");
  process.exit(1);
}

app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "views"));

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  })
);
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(process.cwd(), "public")));

app.use(
  cookieSession({
    name: "sqm_admin",
    keys: [sessionSecret],
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production"
  })
);

app.use((req, res, next) => {
  if (req.path.startsWith("/auth/callback")) return next();
  csrf({
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    }
  })(req, res, next);
});
app.use((req, res, next) => {
  if (req.path.startsWith("/auth/callback")) return next();
  res.locals.csrfToken = req.csrfToken();
  next();
});
app.use((req, res, next) => {
  if (req.session?.admin) {
    res.locals.user = {
      role: "admin",
      email: process.env.ADMIN_EMAIL || "admin"
    };
  } else {
    res.locals.user = null;
  }
  next();
});

app.use("/", indexRoutes);
app.use("/", postsRoutes);
app.use("/", forumRoutes);
app.use("/", adminRoutes);

app.use((err, req, res, next) => {
  if (err.code === "EBADCSRFTOKEN") {
    return res.status(403).render("error", {
      message: "Token CSRF inv\xE1lido. Atualize a p\xE1gina e tente novamente.",
      user: res.locals.user
    });
  }
  console.error(err.stack);
  res.status(500).render("error", {
    message: "Ocorreu um erro interno no servidor.",
    user: res.locals.user
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SQMCC rodando em http://localhost:${PORT}`));
