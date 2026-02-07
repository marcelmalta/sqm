const express = require("express");
const { z } = require("zod");
const { supabase } = require("../supabase");
const { topicLimiter, commentLimiter, isHoneypotFilled, isFormTimingValid } = require("../middleware/antiSpam");

const router = express.Router();

router.get("/forum", async (req, res, next) => {
  try {
    const pending = req.query.pending === "1";
    const { data: topicsData, error } = await supabase
      .from("topics")
      .select("*")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    const topics = topicsData.map(t => {
      const display = t.author_name || t.author_email || "Anônimo";
      return { ...t, author_display: display };
    });

    res.render("forum", { user: res.locals.user, topics, formTs: Date.now(), pending });
  } catch (err) {
    next(err);
  }
});

router.get("/t/:id", async (req, res, next) => {
  try {
    const { data: topicData, error: topicError } = await supabase
      .from("topics")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (topicError || !topicData) {
      return res.status(404).render("error", { message: "Tópico não encontrado.", user: res.locals.user });
    }

    if (topicData.status !== "approved" && !res.locals.user) {
      return res.status(404).render("error", { message: "Tópico não encontrado.", user: res.locals.user });
    }

    const topic = {
      ...topicData,
      author_display: topicData.author_name || topicData.author_email || "Anônimo"
    };

    const { data: commentsData, error: commentsError } = await supabase
      .from("comments")
      .select("*")
      .eq("parent_type", "topic")
      .eq("parent_id", topic.id)
      .order("created_at", { ascending: true });

    if (commentsError) throw commentsError;

    const comments = commentsData.map(c => {
      const display = c.author_name || c.author_email || "Anônimo";
      return { ...c, author_display: display };
    });

    res.render("topic", { user: res.locals.user, topic, comments, formTs: Date.now() });
  } catch (err) {
    next(err);
  }
});

router.post("/forum/new", topicLimiter, async (req, res, next) => {
  try {
    if (isHoneypotFilled(req.body)) {
      return res.status(400).render("error", { message: "Envio inválido.", user: res.locals.user });
    }
    if (!isFormTimingValid(req.body)) {
      return res.status(400).render("error", { message: "Envio muito rápido. Tente novamente.", user: res.locals.user });
    }

    const schema = z.object({
      category: z.string().min(2).max(40).default("Geral"),
      title: z.string().min(5).max(160),
      body: z.string().min(10).max(5000),
      author_name: z.string().min(2).max(60),
      author_email: z.string().email().optional().or(z.literal(""))
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).render("error", { message: "Dados inválidos.", user: res.locals.user });

    const { category, title, body, author_name, author_email } = parsed.data;

    const { data: newTopic, error } = await supabase
      .from("topics")
      .insert([{
        category,
        title,
        body,
        author_name: author_name.trim(),
        author_email: author_email ? author_email.trim() : null,
        status: "pending"
      }])
      .select()
      .single();

    if (error) throw error;

    res.redirect("/forum?pending=1");
  } catch (err) {
    next(err);
  }
});

router.post("/t/:id/comment", commentLimiter, async (req, res, next) => {
  try {
    // Check existence
    const { data: topic, error: findError } = await supabase
      .from("topics")
      .select("id, status")
      .eq("id", req.params.id)
      .single();

    if (findError || !topic) return res.status(404).send("Tópico não encontrado.");
    if (topic.status !== "approved" && !res.locals.user) {
      return res.status(404).send("Tópico não encontrado.");
    }

    if (isHoneypotFilled(req.body)) {
      return res.status(400).send("Comentário inválido.");
    }
    if (!isFormTimingValid(req.body)) {
      return res.status(400).send("Envio muito rápido. Tente novamente.");
    }

    const schema = z.object({
      author_name: z.string().min(2).max(60),
      author_email: z.string().email().optional().or(z.literal("")),
      body: z.string().min(1).max(2000)
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).send("Comentário inválido.");

    const authorName = parsed.data.author_name.trim();
    const authorEmail = parsed.data.author_email ? parsed.data.author_email.trim() : null;

    const { error: insertError } = await supabase
      .from("comments")
      .insert([{
        parent_type: "topic",
        parent_id: topic.id,
        body: parsed.data.body,
        author_name: authorName,
        author_email: authorEmail || null
      }]);

    if (insertError) throw insertError;

    res.redirect(`/t/${topic.id}`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
