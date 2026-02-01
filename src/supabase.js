require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("ERRO: SUPABASE_URL e SUPABASE_KEY são obrigatórios no arquivo .env");
    // Não lançar erro aqui para não crashar o app imediatamente se as vars não estiverem setadas, 
    // mas as chamadas falharão.
}

const clientOptions = { auth: { persistSession: false } };
const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseKey || "placeholder",
  clientOptions
);

function createSupabaseClient() {
  return createClient(
    supabaseUrl || "https://placeholder.supabase.co",
    supabaseKey || "placeholder",
    clientOptions
  );
}

module.exports = { supabase, createSupabaseClient };
