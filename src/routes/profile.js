const express = require("express");
const { z } = require("zod");
const { supabase } = require("../supabase");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// Public Profile
router.get("/u/:id", async (req, res, next) => {
    try {
        const userId = req.params.id;
        const tab = req.query.tab || "topics"; // topics | comments

        // Fetch Profile User
        const { data: profileUser, error: userError } = await supabase
            .from("users")
            .select("id, email, role, created_at, name, bio")
            .eq("id", userId)
            .single();

        if (userError || !profileUser) {
            return res.status(404).render("error", { message: "Usuário não encontrado.", user: req.session.user });
        }

        // Fetch Stats
        const { count: topicsCount } = await supabase.from("topics").select("*", { count: "exact", head: true }).eq("author_id", userId);
        const { count: commentsCount } = await supabase.from("comments").select("*", { count: "exact", head: true }).eq("author_id", userId);

        let items = [];
        let postSlugById = {};
        if (tab === "topics") {
            const { data } = await supabase
                .from("topics")
                .select("*")
                .eq("author_id", userId)
                .order("created_at", { ascending: false })
                .limit(20);
            items = data || [];
        } else {
            const { data } = await supabase
                .from("comments")
                .select("*")
                .eq("author_id", userId)
                .order("created_at", { ascending: false })
                .limit(20);
            items = data || [];

            const postIds = items.filter(i => i.parent_type === "post").map(i => i.parent_id);
            if (postIds.length) {
                const { data: posts, error: postsError } = await supabase
                    .from("posts")
                    .select("id, slug")
                    .in("id", postIds);
                if (postsError) throw postsError;
                postSlugById = (posts || []).reduce((acc, p) => {
                    acc[p.id] = p.slug;
                    return acc;
                }, {});
            }
        }

        res.render("profile", {
            user: req.session.user,
            profileUser,
            stats: { topics: topicsCount || 0, comments: commentsCount || 0 },
            tab,
            items,
            postSlugById
        });
    } catch (err) {
        next(err);
    }
});

// Settings (Protected)
router.get("/settings", requireAuth, async (req, res, next) => {
    try {
        const { data: profile } = await supabase
            .from("users")
            .select("name, bio")
            .eq("id", req.session.user.id)
            .single();

        res.render("settings", { user: req.session.user, profile: profile || {}, success: false });
    } catch (err) {
        next(err);
    }
});

router.post("/settings", requireAuth, async (req, res, next) => {
    try {
        const schema = z.object({
            name: z.string().max(50).optional(),
            bio: z.string().max(500).optional()
        });

        const parsed = schema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).render("error", { message: "Dados inválidos.", user: req.session.user });
        }

        const { name, bio } = parsed.data;

        const { error } = await supabase
            .from("users")
            .update({ name, bio })
            .eq("id", req.session.user.id);

        if (error) throw error;

        // Refresh data for render
        res.render("settings", { user: req.session.user, profile: { name, bio }, success: true });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
