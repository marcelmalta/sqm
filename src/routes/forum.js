const express = require("express");
const { z } = require("zod");
const { supabase } = require("../supabase");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/forum", async (req, res, next) => {
  try {
    const { data: topicsData, error } = await supabase
      .from("topics")
      .select("*, users(email)")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    const topics = topicsData.map(t => ({ ...t, author_email: t.users ? t.users.email : null }));

    res.render("forum", { user: req.session.user, topics });
  } catch (err) {
    next(err);
  }
});

router.get("/t/:id", async (req, res, next) => {
  try {
    const { data: topicData, error: topicError } = await supabase
      .from("topics")
      .select("*, users(email)")
      .eq("id", req.params.id)
      .single();

    if (topicError || !topicData) {
      return res.status(404).render("error", { message: "Tópico não encontrado.", user: req.session.user });
    }

    const topic = { ...topicData, author_email: topicData.users ? topicData.users.email : null };

    const { data: commentsData, error: commentsError } = await supabase
      .from("comments")
      .select("*, users(email)")
      .eq("parent_type", "topic")
      .eq("parent_id", topic.id)
      .order("created_at", { ascending: true });

    if (commentsError) throw commentsError;

    const comments = commentsData.map(c => ({ ...c, author_email: c.users ? c.users.email : null }));

    res.render("topic", { user: req.session.user, topic, comments });
  } catch (err) {
    next(err);
  }
});

router.post("/forum/new", requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      category: z.string().min(2).max(40).default("Geral"),
      title: z.string().min(5).max(160),
      body: z.string().min(10).max(5000)
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).render("error", { message: "Dados inválidos.", user: req.session.user });

    const { category, title, body } = parsed.data;

    const { data: newTopic, error } = await supabase
      .from("topics")
      .insert([{ category, title, body, author_id: req.session.user.id }])
      .select()
      .single();

    if (error) throw error;

    res.redirect(`/t/${newTopic.id}`);
  } catch (err) {
    next(err);
  }
});

router.post("/t/:id/comment", requireAuth, async (req, res, next) => {
  try {
    // Check existence
    const { data: topic, error: findError } = await supabase
      .from("topics")
      .select("id")
      .eq("id", req.params.id)
      .single();

    if (findError || !topic) return res.status(404).send("Tópico não encontrado.");

    const schema = z.object({ body: z.string().min(1).max(2000) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).send("Comentário inválido.");

    const { error: insertError } = await supabase
      .from("comments")
      .insert([{
        parent_type: "topic",
        parent_id: topic.id,
        body: parsed.data.body,
        author_id: req.session.user.id
      }]);

    if (insertError) throw insertError;

    res.redirect(`/t/${topic.id}`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
