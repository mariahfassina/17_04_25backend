// 1. IMPORTAÇÕES
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { MongoClient } = require('mongodb'); // Importa o driver do MongoDB
require('dotenv').config();

// 2. CONFIGURAÇÃO INICIAL
const app = express();

const corsOptions = {
    origin: 'https://chatbotflashcards.vercel.app', // Permite acesso do seu frontend
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

// 3. VARIÁVEIS DE AMBIENTE E CONEXÃO
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// String de conexão para o banco de DADOS COMPARTILHADO (Logs)
const MONGO_URI_LOGS = process.env.MONGO_URI_LOGS; 
// String de conexão para o seu banco de DADOS PESSOAL (Histórico do Chat)
const MONGO_URI_HISTORY = process.env.MONGO_URI_HISTORY;

if (!GEMINI_API_KEY || !MONGO_URI_LOGS || !MONGO_URI_HISTORY) {
    console.error("ERRO FATAL: Variáveis de ambiente não foram definidas!");
    // Em um ambiente de produção, você pararia o processo aqui: process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// 4. SIMULAÇÃO DO RANKING (EM MEMÓRIA)
let dadosRankingVitrine = [];

// ===================================================================
// 5. ROTAS DA API
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

// ROTA PARA SALVAR LOG DE ACESSO (ATIVIDADE A7)
app.post('/api/log-acesso', async (req, res) => {
    const { ip, acao, nomeBot } = req.body;
    if (!ip || !acao || !nomeBot) {
        return res.status(400).json({ error: "Dados de log incompletos (IP, ação e nomeBot são obrigatórios)." });
    }

    const client = new MongoClient(MONGO_URI_LOGS);
    try {
        await client.connect();
        const db = client.db("IIW2023A_Logs"); // Nome do banco de dados compartilhado
        const collection = db.collection("tb_cl_user_log_acess");

        const agora = new Date();
        const dataFormatada = agora.toISOString().split('T')[0]; // YYYY-MM-DD
        const horaFormatada = agora.toTimeString().split(' ')[0]; // HH:MM:SS

        const logEntry = {
            col_data: dataFormatada,
            col_hora: horaFormatada,
            col_IP: ip,
            col_nome_bot: nomeBot,
            col_acao: acao
        };

        await collection.insertOne(logEntry);
        res.status(201).json({ message: "Log de acesso registrado com sucesso." });
    } catch (error) {
        console.error("Erro ao registrar log de acesso:", error);
        res.status(500).json({ error: "Erro ao conectar ou inserir no banco de dados de logs." });
    } finally {
        await client.close();
    }
});

// ROTA PARA REGISTRAR ACESSO PARA RANKING (ATIVIDADE A7)
app.post('/api/ranking/registrar-acesso-bot', (req, res) => {
    const { botId, nomeBot } = req.body;
    if (!botId || !nomeBot) {
        return res.status(400).json({ error: "ID e Nome do Bot são obrigatórios para o ranking." });
    }
    
    const botExistente = dadosRankingVitrine.find(b => b.botId === botId);
    if (botExistente) {
        botExistente.contagem += 1;
        botExistente.ultimoAcesso = new Date();
    } else {
        dadosRankingVitrine.push({ botId, nomeBot, contagem: 1, ultimoAcesso: new Date() });
    }

    console.log('[Servidor] Dados de ranking atualizados:', dadosRankingVitrine);
    res.status(201).json({ message: `Acesso ao bot ${nomeBot} registrado para ranking.` });
});

// ROTA PARA SALVAR HISTÓRICO DO CHAT (ATIVIDADE A8)
app.post('/api/chat/save-history', async (req, res) => {
    const { history } = req.body;
    if (!history || !Array.isArray(history) || history.length === 0) {
        return res.status(400).json({ error: 'Histórico de chat inválido ou vazio.' });
    }
    
    const client = new MongoClient(MONGO_URI_HISTORY);
    try {
        await client.connect();
        const db = client.db("MeuChatbotHistory"); // Nome do seu banco de dados pessoal
        const collection = db.collection("chat_histories");

        const historyEntry = {
            createdAt: new Date(),
            conversation: history
        };

        await collection.insertOne(historyEntry);
        res.status(201).json({ message: "Histórico do chat salvo com sucesso." });
    } catch (error) {
        console.error("Erro ao salvar histórico do chat:", error);
        res.status(500).json({ error: "Erro ao conectar ou inserir no banco de dados de histórico." });
    } finally {
        await client.close();
    }
});


// 6. INICIALIZAÇÃO DO SERVIDOR
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
