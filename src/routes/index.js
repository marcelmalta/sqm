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
    const posts = postsData.map(p => {
      const display = p.author_name || p.author_email || (p.users ? p.users.email : null) || "Anônimo";
      return { ...p, author_display: display };
    });

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

    res.render("index", { user: res.locals.user, posts, categories, q, cat });
  } catch (err) {
    next(err);
  }
});

router.get("/shop", async (req, res, next) => {
  try {
    let products = [];
    const { data: productsData, error: productsError } = await supabase
      .from("products")
      .select("id, slug, name, summary, details, price_cents, currency, image_url")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(12);

    if (productsError && productsError.code !== "PGRST205") {
      throw productsError;
    }

    if (productsData && productsData.length) {
      const formatPrice = (cents, currency) => {
        const value = (cents || 0) / 100;
        return new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: currency || "BRL"
        }).format(value);
      };

      products = productsData.map(p => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        price: formatPrice(p.price_cents, p.currency),
        price_cents: p.price_cents,
        summary: p.summary,
        details: p.details || "Sem descrição adicional.",
        image_url: p.image_url || "/images/logo-badge.png"
      }));
    } else {
      products = [
        {
          id: "spray-nasal",
          name: "Spray nasal hipoalergênico",
          price: "R$ 39,90",
          price_cents: 3990,
          summary: "Ajuda no conforto respiratório diário (demo).",
          details: "Fórmula suave, sem fragrância e sem álcool. Indicado para uso diário em ambientes secos.",
          image_url: "/images/logo-badge.png"
        },
        {
          id: "vitamina-d3-k2",
          name: "Vitamina D3 + K2",
          price: "R$ 58,90",
          price_cents: 5890,
          summary: "Suporte básico para rotina de suplementação (demo).",
          details: "Cápsulas de fácil digestão. Consulte orientação profissional antes de iniciar.",
          image_url: "/images/logo-badge.png"
        },
        {
          id: "detergente-neutro",
          name: "Detergente neutro sem perfume",
          price: "R$ 22,90",
          price_cents: 2290,
          summary: "Limpeza leve para peles e vias sensíveis (demo).",
          details: "Sem corantes e sem fragrância. Ideal para rotina doméstica com sensibilidade.",
          image_url: "/images/logo-badge.png"
        },
        {
          id: "mascara-reutilizavel",
          name: "Máscara reutilizável com filtro",
          price: "R$ 29,90",
          price_cents: 2990,
          summary: "Proteção confortável para o dia a dia (demo).",
          details: "Material respirável e ajuste ergonômico. Troque o filtro regularmente.",
          image_url: "/images/logo-badge.png"
        }
      ];
    }

    res.render("shop", { user: res.locals.user, products });
  } catch (err) {
    next(err);
  }
});

router.get("/cart", (req, res) => {
  res.render("cart", { user: res.locals.user });
});

module.exports = router;
