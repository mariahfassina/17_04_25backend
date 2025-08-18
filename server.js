// 1. IMPORTAÇÕES
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { MongoClient } = require('mongodb');
require('dotenv').config();

// ===================================================================
// 2. VERIFICAÇÃO DE VARIÁVEIS DE AMBIENTE (À PROVA DE BALAS)
// ===================================================================
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MONGO_URI_LOGS = process.env.MONGO_URI_LOGS;
const MONGO_URI_HISTORY = process.env.MONGO_URI_HISTORY;
let BUNDLE_URL_FRONTEND = process.env.BUNDLE_URL_FRONTEND;

// Define a URL do frontend padrão se não estiver nas variáveis de ambiente
if (!BUNDLE_URL_FRONTEND) {
    console.log("AVISO: BUNDLE_URL_FRONTEND não definida. Usando valor padrão: https://chatbotflashcards.vercel.app");
    BUNDLE_URL_FRONTEND = 'https://chatbotflashcards.vercel.app';
}

// Adiciona as origens permitidas (localhost + URL do bundle)
const allowedOrigins = [
    'http://localhost:3000',
    'https://chatbotflashcards.vercel.app',
    'https://chatbotflashcards.vercel.app/',
    BUNDLE_URL_FRONTEND
];

if (!GEMINI_API_KEY) {
    console.error("ERRO FATAL: Variável de ambiente GEMINI_API_KEY não foi definida!");
    process.exit(1); // Para o servidor imediatamente
}
if (!MONGO_URI_LOGS) {
    console.error("ERRO FATAL: Variável de ambiente MONGO_URI_LOGS não foi definida!");
    process.exit(1);
}
if (!MONGO_URI_HISTORY) {
    console.error("ERRO FATAL: Variável de ambiente MONGO_URI_HISTORY não foi definida!");
    process.exit(1);
}

// 3. CONFIGURAÇÃO INICIAL
const app = express();
const corsOptions = {
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Origem não permitida pelo CORS'));
        }
    },
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
let dadosRankingVitrine = [];

// ===================================================================
// 4. ROTAS DA API
// ===================================================================

// ROTA PRINCIPAL DO CHAT
app.post('/chat', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) return res.status(400).json({ error: 'Nenhuma mensagem foi fornecida.' });

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        const result = await model.generateContent(message);
        const response = await result.response;
        const text = response.text();
        res.json({ response: text });
    } catch (error) {
        console.error('Erro na rota /chat:', error);
        res.status(500).json({ error: 'Ocorreu um erro no servidor ao processar sua mensagem.' });
    }
});

// ROTA PARA SALVAR LOG DE ACESSO
app.post('/api/log-acesso', async (req, res) => {
    const { ip, acao, nomeBot } = req.body;
    if (!ip || !acao || !nomeBot) {
        return res.status(400).json({ error: "Dados de log incompletos (IP, ação e nomeBot são obrigatórios)." });
    }

    const client = new MongoClient(MONGO_URI_LOGS);
    try {
        await client.connect();
        const db = client.db("IIW2023A_Logs");
        const collection = db.collection("tb_cl_user_log_acess");
        const agora = new Date();
        const dataFormatada = agora.toISOString().split('T')[0];
        const horaFormatada = agora.toTimeString().split(' ')[0];
        const logEntry = { col_data: dataFormatada, col_hora: horaFormatada, col_IP: ip, col_nome_bot: nomeBot, col_acao: acao };
        await collection.insertOne(logEntry);
        res.status(201).json({ message: "Log de acesso registrado com sucesso." });
    } catch (error) {
        console.error("Erro ao registrar log de acesso:", error);
        res.status(500).json({ error: "Erro ao conectar ou inserir no banco de dados de logs." });
    } finally {
        if (client) await client.close();
    }
});

// ROTA PARA RANKING
app.post('/api/ranking/registrar-acesso-bot', (req, res) => {
    const { botId, nomeBot } = req.body;
    if (!botId || !nomeBot) return res.status(400).json({ error: "ID e Nome do Bot são obrigatórios." });
    
    const botExistente = dadosRankingVitrine.find(b => b.botId === botId);
    if (botExistente) {
        botExistente.contagem += 1;
        botExistente.ultimoAcesso = new Date();
    } else {
        dadosRankingVitrine.push({ botId, nomeBot, contagem: 1, ultimoAcesso: new Date() });
    }
    console.log('[Servidor] Dados de ranking atualizados:', dadosRankingVitrine);
    res.status(201).json({ message: `Acesso ao bot ${nomeBot} registrado.` });
});

// ROTA PARA SALVAR HISTÓRICO
app.post('/api/chat/save-history', async (req, res) => {
    const { history } = req.body;
    if (!history || !Array.isArray(history) || history.length === 0) return res.status(400).json({ error: 'Histórico inválido.' });
    
    const client = new MongoClient(MONGO_URI_HISTORY);
    try {
        await client.connect();
        const db = client.db("MeuChatbotHistory");
        const collection = db.collection("chat_histories");
        const historyEntry = { createdAt: new Date(), conversation: history };
        await collection.insertOne(historyEntry);
        res.status(201).json({ message: "Histórico salvo." });
    } catch (error) {
        console.error("Erro ao salvar histórico:", error);
        res.status(500).json({ error: "Erro ao salvar no banco de dados de histórico." });
    } finally {
        if (client) await client.close();
    }
});

// ROTA PARA LISTAR TODOS OS HISTÓRICOS SALVOS (SOMENTE PARA TESTE)
app.get('/api/chat/history', async (req, res) => {
    const client = new MongoClient(MONGO_URI_HISTORY);
    try {
        await client.connect();
        const db = client.db("MeuChatbotHistory");
        const collection = db.collection("chat_histories");
        const histories = await collection.find({}).toArray();
        res.json(histories);
    } catch (error) {
        console.error("Erro ao buscar históricos:", error);
        res.status(500).json({ error: "Erro ao buscar históricos." });
    } finally {
        if (client) await client.close();
    }
});

// ROTA PARA EXCLUIR HISTÓRICO
app.delete('/api/chat/historicos/:id', async (req, res) => {
    const { id } = req.params;
    const client = new MongoClient(MONGO_URI_HISTORY);
    try {
        await client.connect();
        const db = client.db("MeuChatbotHistory");
        const collection = db.collection("chat_histories");
        const { ObjectId } = require('mongodb');
        const result = await collection.findOneAndDelete({ _id: new ObjectId(id) });
        if (!result.value) {
            return res.status(404).json({ error: "Histórico não encontrado." });
        }
        res.status(200).json({ message: "Histórico excluído com sucesso." });
    } catch (error) {
        console.error("Erro ao excluir histórico:", error);
        if (error.name === 'CastError') {
            return res.status(400).json({ error: "ID inválido." });
        }
        res.status(500).json({ error: "Erro ao excluir histórico." });
    } finally {
        if (client) await client.close();
    }
});

// ROTA PARA GERAR TÍTULO INTELIGENTE
app.post('/api/chat/historicos/:id/gerar-titulo', async (req, res) => {
    const { id } = req.params;
    const client = new MongoClient(MONGO_URI_HISTORY);
    try {
        await client.connect();
        const db = client.db("MeuChatbotHistory");
        const collection = db.collection("chat_histories");
        const { ObjectId } = require('mongodb');
        const historico = await collection.findOne({ _id: new ObjectId(id) });
        
        if (!historico) {
            return res.status(404).json({ error: "Histórico não encontrado." });
        }

        // Formatar o histórico para o Gemini
        const conversaFormatada = historico.conversation.map(msg => 
            `${msg.role === 'user' ? 'Usuário' : 'Bot'}: ${msg.text}`
        ).join('\n');

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        const prompt = `Baseado nesta conversa, sugira um título curto e conciso de no máximo 5 palavras:\n\n${conversaFormatada}`;
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const tituloSugerido = response.text().trim();

        res.status(200).json({ titulo: tituloSugerido });
    } catch (error) {
        console.error("Erro ao gerar título:", error);
        if (error.name === 'CastError') {
            return res.status(400).json({ error: "ID inválido." });
        }
        res.status(500).json({ error: "Erro ao gerar título." });
    } finally {
        if (client) await client.close();
    }
});

// ROTA PARA SALVAR TÍTULO
app.put('/api/chat/historicos/:id', async (req, res) => {
    const { id } = req.params;
    const { titulo } = req.body;
    
    if (!titulo || titulo.trim() === '') {
        return res.status(400).json({ error: "Título é obrigatório." });
    }

    const client = new MongoClient(MONGO_URI_HISTORY);
    try {
        await client.connect();
        const db = client.db("MeuChatbotHistory");
        const collection = db.collection("chat_histories");
        const { ObjectId } = require('mongodb');
        const result = await collection.findOneAndUpdate(
            { _id: new ObjectId(id) },
            { $set: { titulo: titulo.trim() } },
            { returnDocument: 'after' }
        );
        
        if (!result.value) {
            return res.status(404).json({ error: "Histórico não encontrado." });
        }
        
        res.status(200).json(result.value);
    } catch (error) {
        console.error("Erro ao salvar título:", error);
        if (error.name === 'CastError') {
            return res.status(400).json({ error: "ID inválido." });
        }
        res.status(500).json({ error: "Erro ao salvar título." });
    } finally {
        if (client) await client.close();
    }
});
// ROTA PARA TESTAR SE VARIÁVEIS DE AMBIENTE ESTÃO OK
app.get('/api/test-env', (req, res) => {
    res.json({
        GEMINI_API_KEY: GEMINI_API_KEY ? '✅ RECEBIDA' : '❌ NÃO DEFINIDA',
        MONGO_URI_LOGS: MONGO_URI_LOGS ? '✅ RECEBIDA' : '❌ NÃO DEFINIDA',
        MONGO_URI_HISTORY: MONGO_URI_HISTORY ? '✅ RECEBIDA' : '❌ NÃO DEFINIDA',
        BUNDLE_URL_FRONTEND: BUNDLE_URL_FRONTEND || '❌ NÃO DEFINIDA'
    });
});

// 5. INICIALIZAÇÃO DO SERVIDOR
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});


