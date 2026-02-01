require("dotenv").config();
const path = require("path");
const express = require("express");
const session = require("express-session");
const SQLiteStoreFactory = require("connect-sqlite3");
const helmet = require("helmet");
const csrf = require("csurf");

// require("./db"); // SQLite desativado para migração Supabase

const indexRoutes = require("./routes/index");
const authRoutes = require("./routes/auth");
const postsRoutes = require("./routes/posts");
const forumRoutes = require("./routes/forum");
const profileRoutes = require("./routes/profile");
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
app.use(express.static(path.join(process.cwd(), "public")));

const SQLiteStore = SQLiteStoreFactory(session);
app.use(
  session({
    store: new SQLiteStore({ db: "sessions.db", dir: path.join(process.cwd(), "data") }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" }
  })
);

app.use(csrf());
app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
});

app.use("/", indexRoutes);
app.use("/", authRoutes);
app.use("/", postsRoutes);
app.use("/", forumRoutes);
app.use("/", profileRoutes);
app.use("/", adminRoutes);

app.use((err, req, res, next) => {
  if (err.code === "EBADCSRFTOKEN") {
    return res.status(403).render("error", {
      message: "Token CSRF inv\xE1lido. Atualize a p\xE1gina e tente novamente.",
      user: req.session ? req.session.user : null
    });
  }
  console.error(err.stack);
  res.status(500).render("error", {
    message: "Ocorreu um erro interno no servidor.",
    user: req.session ? req.session.user : null
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SQMCC rodando em http://localhost:${PORT}`));
