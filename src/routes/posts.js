const express = require("express");
const slugify = require("slugify");
const { z } = require("zod");
const { supabase } = require("../supabase");
const { requireAdmin, requireAuth } = require("../middleware/auth");

const router = express.Router();

// View post
router.get("/p/:slug", async (req, res, next) => {
  try {
    const { data: postData, error: postError } = await supabase
      .from("posts")
      .select("*, users(email)")
      .eq("slug", req.params.slug)
      .single();

    if (postError || !postData) {
      return res.status(404).render("error", { message: "Post não encontrado.", user: req.session.user });
    }

    const post = { ...postData, author_email: postData.users ? postData.users.email : null };

    const { data: commentsData, error: commentsError } = await supabase
      .from("comments")
      .select("*, users(email)")
      .eq("parent_type", "post")
      .eq("parent_id", post.id)
      .order("created_at", { ascending: true });

    if (commentsError) throw commentsError;

    const comments = commentsData.map(c => ({ ...c, author_email: c.users ? c.users.email : null }));

    res.render("post", { user: req.session.user, post, comments });
  } catch (err) {
    next(err);
  }
});

// Post comment
router.post("/p/:slug/comment", requireAuth, async (req, res, next) => {
  try {
    const { data: post, error: findError } = await supabase
      .from("posts")
      .select("id")
      .eq("slug", req.params.slug)
      .single();

    if (findError || !post) return res.status(404).send("Post não encontrado.");

    const schema = z.object({ body: z.string().min(1).max(2000) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).send("Comentário inválido.");

    const { error: insertError } = await supabase
      .from("comments")
      .insert([{
        parent_type: "post",
        parent_id: post.id,
        body: parsed.data.body,
        author_id: req.session.user.id
      }]);

    if (insertError) throw insertError;

    res.redirect(`/p/${req.params.slug}`);
  } catch (err) {
    next(err);
  }
});

// Admin - Create Post
router.get("/admin/new-post", requireAdmin, (req, res) => {
  res.render("new-post", { user: req.session.user, error: null });
});

router.post("/admin/new-post", requireAdmin, async (req, res, next) => {
  try {
    const schema = z.object({
      title: z.string().min(5).max(160),
      excerpt: z.string().min(10).max(220),
      content: z.string().min(30).max(20000),
      category: z.string().min(2).max(40).default("Geral"),
      tags: z.string().optional(),
      source_url: z.string().url().optional().or(z.literal(""))
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).render("new-post", { user: req.session.user, error: "Dados inválidos: " + parsed.error.issues.map(i => i.message).join(", ") });
    }

    const { title, excerpt, content, category, tags, source_url } = parsed.data;

    const slugBase = slugify(title, { lower: true, strict: true, trim: true });
    let slug = slugBase;
    let i = 2;

    // Check for unique slug
    while (true) {
      const { data } = await supabase.from("posts").select("id").eq("slug", slug).single();
      if (!data) break; // Unique
      slug = `${slugBase}-${i++}`;
    }

    const tagArr = (tags || "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    const { error: insertError } = await supabase
      .from("posts")
      .insert([{
        slug,
        title,
        excerpt,
        content,
        category,
        tags: JSON.stringify(tagArr),
        source_url: source_url || null,
        author_id: req.session.user.id
      }]);

    if (insertError) throw insertError;

    res.redirect(`/p/${slug}`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
