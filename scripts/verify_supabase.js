require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ ERRO: SUPABASE_URL ou SUPABASE_KEY não encontrados no .env");
    console.log("URL:", supabaseUrl);
    console.log("KEY:", supabaseKey ? "Definida (oculta)" : "Não definida");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
    console.log("🔄 Testando conexão com Supabase...");
    console.log(`📡 URL: ${supabaseUrl}`);

    try {
        const { data, error } = await supabase.from('users').select('count', { count: 'exact', head: true });

        if (error) {
            console.error("❌ Falha na conexão ou na query:");
            console.error(error);

            if (error.code === 'PGRST301') {
                console.error("💡 Dica: Verifique se você desativou o RLS (Row Level Security) ou criou policies para a tabela 'users'.");
            }
        } else {
            console.log("✅ Conexão bem sucedida!");
            console.log(`📊 Tabela 'users' encontrada (Acesso verificado).`);
        }
    } catch (err) {
        console.error("❌ Erro inesperado:", err);
    }
}

verify();
