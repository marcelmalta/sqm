const express = require("express");
const { supabase } = require("../supabase");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

router.get("/admin/moderation", requireAdmin, async (req, res, next) => {
    try {
        const tab = req.query.tab || "users";
        let items = [];

        if (tab === "users") {
            const { data } = await supabase.from("users").select("*").order("created_at", { ascending: false }).limit(50);
            items = data || [];
        } else if (tab === "topics") {
            const { data } = await supabase.from("topics").select("*, users(email)").order("created_at", { ascending: false }).limit(50);
            items = data || [];
        } else if (tab === "comments") {
            const { data } = await supabase.from("comments").select("*, users(email)").order("created_at", { ascending: false }).limit(50);
            items = data || [];
        }

        res.render("admin/moderation", { user: req.session.user, tab, items });
    } catch (err) {
        next(err);
    }
});

// Ban User
router.post("/admin/ban/:id", requireAdmin, async (req, res, next) => {
    try {
        await supabase.from("users").update({ role: "banned" }).eq("id", req.params.id);
        res.redirect("/admin/moderation?tab=users");
    } catch (err) {
        next(err);
    }
});

// Promote User
router.post("/admin/promote/:id", requireAdmin, async (req, res, next) => {
    try {
        await supabase.from("users").update({ role: "admin" }).eq("id", req.params.id);
        res.redirect("/admin/moderation?tab=users");
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
