const express = require("express");
const { supabase } = require("../supabase");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const q = (req.query.q || "").trim();
    const cat = (req.query.cat || "").trim();

    let query = supabase
      .from("posts")
      .select("*, users(email)")
      .order("created_at", { ascending: false })
      .limit(24);

    if (cat) {
      query = query.eq("category", cat);
    }

    if (q) {
      query = query.or(`title.ilike.%${q}%,excerpt.ilike.%${q}%,content.ilike.%${q}%`);
    }

    const { data: postsData, error: postsError } = await query;
    if (postsError) throw postsError;

    // Transform result to match template expectation (users.email -> author_email)
    const posts = postsData.map(p => ({ ...p, author_email: p.users ? p.users.email : null }));

    // Aggregation for categories (Client-side for MVP)
    const { data: allCats, error: catError } = await supabase
      .from("posts")
      .select("category");

    if (catError) throw catError;

    const catMap = allCats.reduce((acc, curr) => {
      acc[curr.category] = (acc[curr.category] || 0) + 1;
      return acc;
    }, {});

    const categories = Object.entries(catMap)
      .map(([category, n]) => ({ category, n }))
      .sort((a, b) => b.n - a.n || a.category.localeCompare(b.category));

    res.render("index", { user: req.session.user, posts, categories, q, cat });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
