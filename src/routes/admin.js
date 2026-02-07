const express = require("express");
const { supabase } = require("../supabase");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

router.get("/admin/login", (req, res) => {
    res.render("admin/login", { user: res.locals.user, error: null });
});

router.post("/admin/login", (req, res) => {
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
        return res.status(500).render("admin/login", {
            user: null,
            error: "ADMIN_PASSWORD n\xE3o definido no .env."
        });
    }

    const password = (req.body.password || "").trim();
    if (!password || password !== adminPassword) {
        return res.status(401).render("admin/login", { user: null, error: "Senha inv\xE1lida." });
    }

    req.session.admin = { loggedIn: true };
    res.redirect("/admin/moderation");
});

router.post("/admin/logout", requireAdmin, (req, res) => {
    req.session = null;
    res.redirect("/");
});

router.get("/admin/moderation", requireAdmin, async (req, res, next) => {
    try {
        const tab = req.query.tab || "topics";
        let items = [];

        if (tab === "topics") {
            const { data } = await supabase
                .from("topics")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(50);
            items = data || [];
        } else if (tab === "comments") {
            const { data } = await supabase
                .from("comments")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(50);
            items = data || [];
        }

        res.render("admin/moderation", { user: res.locals.user, tab, items });
    } catch (err) {
        next(err);
    }
});

// Approve Topic
router.post("/admin/approve-topic/:id", requireAdmin, async (req, res, next) => {
    try {
        await supabase.from("topics").update({ status: "approved" }).eq("id", req.params.id);
        res.redirect("/admin/moderation?tab=topics");
    } catch (err) {
        next(err);
    }
});

// Hide Topic
router.post("/admin/hide-topic/:id", requireAdmin, async (req, res, next) => {
    try {
        await supabase.from("topics").update({ status: "hidden" }).eq("id", req.params.id);
        res.redirect("/admin/moderation?tab=topics");
    } catch (err) {
        next(err);
    }
});

// Delete Topic
router.post("/admin/delete-topic/:id", requireAdmin, async (req, res, next) => {
    try {
        // Cascade delete is handled by DB FK usually, but Supabase might need explict handling if not configured with ON DELETE CASCADE
        // My schema.sql used `on delete set null` for author_id, but didn't specify cascade for comments' parent?
        // Actually comments table FK is: `parent_id` which is just BigInt not FK linked to posts/topics directly in the simplified schema I made (Wait, let me check schema.sql)
        // schema.sql: 
        // `parent_id bigint not null` - NO foreign key constraint to posts/topics tables!
        // So comments will remain orphan if not deleted manually. 
        // I should strictly delete comments first or update schema. For MVP: delete comments first.

        await supabase.from("comments").delete().eq("parent_type", "topic").eq("parent_id", req.params.id);
        await supabase.from("topics").delete().eq("id", req.params.id);
        res.redirect("/admin/moderation?tab=topics");
    } catch (err) {
        next(err);
    }
});

// Delete Comment
router.post("/admin/delete-comment/:id", requireAdmin, async (req, res, next) => {
    try {
        await supabase.from("comments").delete().eq("id", req.params.id);
        res.redirect("/admin/moderation?tab=comments");
    } catch (err) {
        next(err);
    }
});

module.exports = router;
