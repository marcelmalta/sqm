const express = require("express");
const rateLimit = require("express-rate-limit");
const { z } = require("zod");
const { supabase, createSupabaseClient } = require("../supabase");

const router = express.Router();

const authLimiter = rateLimit({ windowMs: 60_000, max: 20 });

function getBaseUrl(req) {
  return process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;
}

async function getOrCreateProfile({ email, authUserId, name }) {
  if (!email) throw new Error("Email obrigatorio para perfil");

  const { data: byAuth, error: authError } = await supabase
    .from("users")
    .select("id, email, role, auth_user_id")
    .eq("auth_user_id", authUserId)
    .single();

  if (authError && authError.code !== "PGRST116") throw authError;
  if (byAuth) return byAuth;

  const { data: byEmail, error: emailError } = await supabase
    .from("users")
    .select("id, email, role, auth_user_id")
    .eq("email", email)
    .single();

  if (emailError && emailError.code !== "PGRST116") throw emailError;
  if (byEmail) {
    if (!byEmail.auth_user_id && authUserId) {
      const { data: updated, error: updateError } = await supabase
        .from("users")
        .update({ auth_user_id: authUserId })
        .eq("id", byEmail.id)
        .select("id, email, role, auth_user_id")
        .single();
      if (updateError) throw updateError;
      return updated;
    }
    return byEmail;
  }

  const { count, error: countError } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true });

  if (countError) throw countError;

  const role = count === 0 ? "admin" : "user";
  const { data: created, error: insertError } = await supabase
    .from("users")
    .insert([{ email, role, auth_user_id: authUserId || null, name: name || null }])
    .select("id, email, role, auth_user_id")
    .single();

  if (insertError) throw insertError;
  return created;
}

router.get("/login", (req, res) => {
  res.render("login", { user: req.session.user, error: null, success: null });
});

router.get("/register", (req, res) => {
  res.render("register", { user: req.session.user, error: null, success: null });
});

router.get("/forgot", (req, res) => {
  res.render("forgot", { user: req.session.user, error: null, success: null });
});

router.get("/reset", (req, res) => {
  res.render("reset", { user: req.session.user, error: null, success: null });
});

router.get("/auth/google", async (req, res, next) => {
  try {
    const client = createSupabaseClient();
    const redirectTo = `${getBaseUrl(req)}/auth/callback`;
    const { data, error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo }
    });

    if (error || !data?.url) {
      return res.status(400).render("login", {
        user: req.session.user,
        error: "Falha ao iniciar login com Google.",
        success: null
      });
    }

    res.redirect(data.url);
  } catch (err) {
    next(err);
  }
});

router.get("/auth/callback", async (req, res, next) => {
  try {
    const code = req.query.code;
    if (!code) {
      return res.render("auth-callback", { user: null, error: null, success: null });
    }

    const client = createSupabaseClient();
    const { data, error } = await client.auth.exchangeCodeForSession(code);
    if (error) throw error;

    const authUser = data.user;
    const profile = await getOrCreateProfile({
      email: authUser.email,
      authUserId: authUser.id,
      name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || null
    });

    req.session.user = { id: profile.id, email: profile.email, role: profile.role };
    res.redirect("/");
  } catch (err) {
    next(err);
  }
});

router.post("/auth/callback", async (req, res, next) => {
  try {
    const schema = z.object({
      access_token: z.string().min(10),
      refresh_token: z.string().min(10)
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).render("login", { user: null, error: "Tokens invalidos.", success: null });
    }

    const client = createSupabaseClient();
    const { error: sessionError } = await client.auth.setSession({
      access_token: parsed.data.access_token,
      refresh_token: parsed.data.refresh_token
    });
    if (sessionError) throw sessionError;

    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData?.user) {
      return res.status(400).render("login", { user: null, error: "Falha ao validar usuario.", success: null });
    }

    const authUser = userData.user;
    const profile = await getOrCreateProfile({
      email: authUser.email,
      authUserId: authUser.id,
      name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || null
    });

    req.session.user = { id: profile.id, email: profile.email, role: profile.role };
    res.redirect("/");
  } catch (err) {
    next(err);
  }
});

router.post("/login", authLimiter, async (req, res, next) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(6)
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).render("login", { user: null, error: "Dados invalidos.", success: null });
    }

    const { email, password } = parsed.data;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data?.user) {
      return res.status(401).render("login", { user: null, error: "Credenciais incorretas.", success: null });
    }

    const profile = await getOrCreateProfile({ email: data.user.email, authUserId: data.user.id });
    req.session.user = { id: profile.id, email: profile.email, role: profile.role };
    res.redirect("/");
  } catch (err) {
    next(err);
  }
});

router.post("/register", authLimiter, async (req, res, next) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(6)
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).render("register", { user: null, error: "Dados invalidos.", success: null });
    }

    const { email, password } = parsed.data;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${getBaseUrl(req)}/auth/callback` }
    });

    if (error) {
      return res.status(400).render("register", { user: null, error: error.message, success: null });
    }

    if (data?.user) {
      await getOrCreateProfile({ email: data.user.email, authUserId: data.user.id });
    }

    if (!data?.session) {
      return res.render("register", {
        user: null,
        error: null,
        success: "Cadastro criado. Verifique seu email para confirmar o acesso."
      });
    }

    const profile = await getOrCreateProfile({ email: data.user.email, authUserId: data.user.id });
    req.session.user = { id: profile.id, email: profile.email, role: profile.role };
    res.redirect("/");
  } catch (err) {
    next(err);
  }
});

router.post("/forgot", authLimiter, async (req, res, next) => {
  try {
    const schema = z.object({ email: z.string().email() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).render("forgot", { user: null, error: "Email invalido.", success: null });
    }

    const { email } = parsed.data;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getBaseUrl(req)}/reset`
    });

    if (error) {
      return res.status(400).render("forgot", { user: null, error: error.message, success: null });
    }

    res.render("forgot", { user: null, error: null, success: "Enviamos um link de recuperacao para seu email." });
  } catch (err) {
    next(err);
  }
});

router.post("/reset", authLimiter, async (req, res, next) => {
  try {
    const schema = z.object({
      password: z.string().min(6),
      access_token: z.string().min(10),
      refresh_token: z.string().min(10)
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).render("reset", { user: null, error: "Dados invalidos.", success: null });
    }

    const { password, access_token, refresh_token } = parsed.data;
    const client = createSupabaseClient();
    const { error: sessionError } = await client.auth.setSession({ access_token, refresh_token });
    if (sessionError) throw sessionError;

    const { error: updateError } = await client.auth.updateUser({ password });
    if (updateError) throw updateError;

    res.render("reset", { user: null, error: null, success: "Senha atualizada com sucesso. Voce ja pode fazer login." });
  } catch (err) {
    next(err);
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

module.exports = router;
