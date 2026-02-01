require("dotenv").config();
const slugify = require("slugify");
const { supabase } = require("./supabase");

async function ensureAdmin() {
  const { data, error } = await supabase
    .from("users")
    .select("id")
    .order("id", { ascending: true })
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  if (!data) {
    console.log("Nenhum usu rio ainda. Crie uma conta pelo /register (o 1§ vira admin).");
    process.exit(0);
  }

  return data.id;
}

async function insertPost({ title, excerpt, content, category, tags, source_url, author_id }) {
  const slug = slugify(title, { lower: true, strict: true, trim: true });

  const { data: existing, error: findError } = await supabase
    .from("posts")
    .select("id")
    .eq("slug", slug)
    .single();

  if (findError && findError.code !== "PGRST116") throw findError;
  if (existing) return;

  const { error: insertError } = await supabase
    .from("posts")
    .insert([{
      slug,
      title,
      excerpt,
      content,
      category,
      tags: JSON.stringify(tags),
      source_url: source_url || null,
      author_id
    }]);

  if (insertError) throw insertError;
}

async function run() {
  const author_id = await ensureAdmin();

  await insertPost({
    title: "O que ‚ SQM e por que tantos casos sÆo subnotificados",
    excerpt: "Entenda o b sico da S¡ndrome Qu¡mica M£ltipla e como ela impacta rotina, trabalho e sa£de.",
    content: `SQM (S¡ndrome Qu¡mica M£ltipla) ‚ uma condi‡Æo em que exposi‡äes a substƒncias qu¡micas comuns
podem desencadear sintomas diversos. Este ‚ um post inicial do MVP para testar cards, leitura e coment rios.`,
    category: "Introdu‡Æo",
    tags: ["sqm", "sa£de", "comunidade"],
    source_url: "",
    author_id
  });

  await insertPost({
    title: "Checklist de gatilhos: fragrƒncias, limpeza e ambientes fechados",
    excerpt: "Um checklist pr tico para mapear gatilhos comuns e registrar rea‡äes ao longo do tempo.",
    content: `Objetivo: ajudar a mapear padräes. NÆo ‚ orienta‡Æo m‚dica.
1) Fragrƒncias
2) Produtos de limpeza
3) Pintura/solventes
4) Ambientes fechados e ventila‡Æo
Comente com seus gatilhos mais comuns.`,
    category: "Gatilhos",
    tags: ["gatilhos", "fragrƒncias", "limpeza"],
    source_url: "",
    author_id
  });

  await insertPost({
    title: "Como a comunidade pode ajudar: relatos, m‚dicos e recursos",
    excerpt: "Diretrizes b sicas para relatos £teis, organiza‡Æo de recursos e respeito entre membros.",
    content: `Regras do MVP:
- Sem diagn¢sticos nos coment rios
- Compartilhe fontes quando poss¡vel
- Foque em experiˆncias e medidas pr ticas
Este post serve como base para modera‡Æo futura.`,
    category: "Comunidade",
    tags: ["relatos", "recursos", "regras"],
    source_url: "",
    author_id
  });

  console.log("Seed aplicado com sucesso.");
}

run().catch(err => {
  console.error("Erro ao aplicar seed:", err);
  process.exit(1);
});
