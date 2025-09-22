// server.js (Versão final com MongoDB, CORS e arquivos na raiz)

// 1. IMPORTAÇÕES
const express = require("express");
const cors = require("cors");
const path = require("path"); // Adicionado para servir arquivos
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { MongoClient, ObjectId } = require("mongodb"); // Importar ObjectId
require("dotenv").config();

// ===================================================================
// 2. VERIFICAÇÃO DE VARIÁVEIS DE AMBIENTE
// ===================================================================
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MONGO_URI_HISTORY = process.env.MONGO_URI_HISTORY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD; // Senha do admin

// Validação crítica das variáveis de ambiente
if (!GEMINI_API_KEY || !MONGO_URI_HISTORY || !ADMIN_PASSWORD) {
  console.error(
    "ERRO FATAL: As variáveis de ambiente (GEMINI_API_KEY, MONGO_URI_HISTORY, ADMIN_PASSWORD) são obrigatórias!"
  );
  process.exit(1);
}

// ===================================================================
// 3. CONFIGURAÇÃO INICIAL
// ===================================================================
const app = express();
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// --- CONFIGURAÇÃO DO CORS (A PARTE MAIS IMPORTANTE DA CORREÇÃO) ---
const allowedOrigins = [
    'https://chatbotflashcards.vercel.app', // Seu frontend
    'http://localhost:3000',                // Para testes locais
    'http://127.0.0.1:5500'                 // Para testes com Live Server
];

const corsOptions = {
    origin: function (origin, callback ) {
        // Permite requisições sem 'origin' (como Postman/Insomnia) ou se a origem estiver na lista
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Não permitido pela política de CORS'));
        }
    },
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    // Permite o cabeçalho customizado que você usa para a senha
    allowedHeaders: "Content-Type, x-admin-password" 
};

app.use(cors(corsOptions)); // APLICA A CONFIGURAÇÃO DE CORS CORRETA
app.use(express.json());

// --- SERVIR ARQUIVOS ESTÁTICOS DA RAIZ ---
// Diz ao Express para servir admin.html, admin.css, etc., da pasta raiz do projeto.
app.use(express.static(path.join(__dirname)));


// ===================================================================
// MIDDLEWARE PARA VERIFICAR AUTENTICAÇÃO DE ADMIN
// ===================================================================
function verificarAutenticacaoAdmin(req, res, next) {
  // Pega a senha do cabeçalho 'x-admin-password'
  const senhaFornecida = req.headers["x-admin-password"];

  if (!senhaFornecida || senhaFornecida !== ADMIN_PASSWORD) {
    return res
      .status(403)
      .json({ message: "Acesso negado. Senha de administrador incorreta." });
  }
  // Se a senha estiver correta, continua para a próxima função (a rota em si)
  next();
}

// ===================================================================
// 4. ROTAS DA API
// ===================================================================

// --- ENDPOINTS DE ADMINISTRAÇÃO (Protegidos pelo middleware) ---

// Rota para buscar estatísticas
app.get("/api/admin/stats", verificarAutenticacaoAdmin, async (req, res) => {
  const client = new MongoClient(MONGO_URI_HISTORY);
  try {
    await client.connect();
    const db = client.db("MeuChatbotHistory");
    const collection = db.collection("chat_histories");
    
    const totalConversas = await collection.countDocuments();
    
    const ultimasConversas = await collection
      .find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .project({ title: 1, createdAt: 1 }) // Pega apenas os campos necessários
      .toArray();

    // Renomeia 'title' para 'titulo' para bater com o que o frontend espera
    const ultimasConversasFormatadas = ultimasConversas.map(conversa => ({
        title: conversa.title || "Conversa sem título",
        createdAt: conversa.createdAt
    }));

    res.json({ 
        totalConversas: totalConversas, 
        ultimasConversas: ultimasConversasFormatadas 
    });

  } catch (error) {
    console.error("Erro ao buscar estatísticas:", error);
    res.status(500).json({ message: "Erro ao buscar estatísticas do sistema." });
  } finally {
    if (client) await client.close();
  }
});

// Rota para buscar a instrução do sistema
app.get("/api/admin/system-instruction", verificarAutenticacaoAdmin, async (req, res) => {
  const client = new MongoClient(MONGO_URI_HISTORY);
  try {
    await client.connect();
    const db = client.db("MeuChatbotHistory");
    const collection = db.collection("system_config");
    const config = await collection.findOne({ type: "system_instruction" });
    
    if (config) {
      res.json({ instruction: config.instruction });
    } else {
      // Se não houver instrução no banco, retorna uma padrão
      res.json({ instruction: "Você é um assistente prestativo." });
    }
  } catch (error) {
    console.error("Erro ao buscar instrução de sistema:", error);
    res.status(500).json({ message: "Erro ao buscar instrução de sistema." });
  } finally {
    if (client) await client.close();
  }
});

// Rota para salvar a instrução do sistema
app.post("/api/admin/system-instruction", verificarAutenticacaoAdmin, async (req, res) => {
  // O frontend envia 'newInstruction', então vamos usar esse nome
  const { newInstruction } = req.body; 
  if (!newInstruction || newInstruction.trim() === "") {
    return res.status(400).json({ message: "A instrução não pode ser vazia." });
  }
  const client = new MongoClient(MONGO_URI_HISTORY);
  try {
    await client.connect();
    const db = client.db("MeuChatbotHistory");
    const collection = db.collection("system_config");
    
    // `upsert: true` cria o documento se ele não existir
    await collection.updateOne(
      { type: "system_instruction" },
      { $set: { instruction: newInstruction.trim(), updatedAt: new Date() } },
      { upsert: true }
    );
    
    res.json({ message: "Instrução salva com sucesso!" });
  } catch (error) {
    console.error("Erro ao atualizar instrução de sistema:", error);
    res.status(500).json({ message: "Erro ao atualizar instrução de sistema." });
  } finally {
    if (client) await client.close();
  }
});


// --- ENDPOINTS DO CHAT ---

// Rota principal do chat
app.post("/api/chat", async (req, res) => { // Mudei para /api/chat para consistência
  const client = new MongoClient(MONGO_URI_HISTORY);
  try {
    const { mensagem, historico } = req.body; // Nomes que o frontend envia
    if (!mensagem) {
      return res.status(400).json({ error: "Nenhuma mensagem foi fornecida." });
    }

    let promptDeSistema = "Você é um assistente de estudos que cria flash cards."; // Padrão simples

    // Busca a instrução mais recente do banco de dados
    await client.connect();
    const db = client.db("MeuChatbotHistory");
    const config = await db.collection("system_config").findOne({ type: "system_instruction" });
    if (config && config.instruction) {
      promptDeSistema = config.instruction;
    }
    
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-pro-latest", // Usando o modelo mais novo
      systemInstruction: promptDeSistema,
    });

    const chat = model.startChat({
      history: historico || [],
    });

    const result = await chat.sendMessage(mensagem);
    const response = await result.response;
    const text = response.text();

    // Salva a conversa no histórico
    const novaConversa = {
        title: historico.length > 0 ? historico[0].parts[0].text.substring(0, 30) : "Nova Conversa",
        createdAt: new Date(),
        conversation: [...(historico || []), { role: 'user', parts: [{ text: mensagem }] }, { role: 'model', parts: [{ text }] }]
    };
    await db.collection("chat_histories").insertOne(novaConversa);

    res.json({ resposta: text }); // O frontend espera a chave 'resposta'

  } catch (error) {
    console.error("Erro na rota /api/chat:", error);
    res.status(500).json({ error: "Ocorreu um erro no servidor ao processar sua mensagem." });
  } finally {
      if(client) await client.close();
  }
});


// ===================================================================
// 5. INICIALIZAÇÃO DO SERVIDOR
// ===================================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
