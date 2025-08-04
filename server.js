// 1. IMPORTAÇÕES
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { MongoClient } = require('mongodb');
require('dotenv').config();

// 2. VARIÁVEIS DE AMBIENTE
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MONGO_URI_LOGS = process.env.MONGO_URI_LOGS;
const MONGO_URI_HISTORY = process.env.MONGO_URI_HISTORY;
let BUNDLE_URL_FRONTEND = process.env.BUNDLE_URL_FRONTEND || 'https://chatbotflashcards.vercel.app';

// ORIGENS PERMITIDAS
const allowedOrigins = [
  'http://localhost:3000',
  'https://chatbotflashcards.vercel.app',
  'https://chatbotflashcards.vercel.app/',
  BUNDLE_URL_FRONTEND
];

// Checagem obrigatória das variáveis de ambiente
if (!GEMINI_API_KEY || !MONGO_URI_LOGS || !MONGO_URI_HISTORY) {
  console.error("ERRO FATAL: Variáveis de ambiente não configuradas corretamente!");
  process.exit(1);
}

// 3. CONFIGURAÇÃO INICIAL DO EXPRESS
const app = express();
const corsOptions = {
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error('Origem não permitida pelo CORS'));
  },
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
let dadosRankingVitrine = [];

// 4. CONEXÃO COM MONGODB (apenas 1 vez na inicialização)
let clientLogs;
let clientHistory;
let dbLogs;
let dbHistory;

async function connectToDatabases() {
  try {
    clientLogs = new MongoClient(MONGO_URI_LOGS);
    await clientLogs.connect();
    dbLogs = clientLogs.db("IIW2023A_Logs"); // confirme o nome do banco aqui!
    console.log("Conectado ao MongoDB Logs com sucesso!");

    clientHistory = new MongoClient(MONGO_URI_HISTORY);
    await clientHistory.connect();
    dbHistory = clientHistory.db("MeuChatbotHistory"); // confirme o nome do banco aqui!
    console.log("Conectado ao MongoDB Histórico com sucesso!");
  } catch (error) {
    console.error("Erro ao conectar no MongoDB:", error);
    process.exit(1); // Sai do processo se não conectar
  }
}

connectToDatabases();

// 5. ROTAS DA API

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

  try {
    const collection = dbLogs.collection("tb_cl_user_log_acess");
    const agora = new Date();
    const dataFormatada = agora.toISOString().split('T')[0];
    const horaFormatada = agora.toTimeString().split(' ')[0];
    const logEntry = { col_data: dataFormatada, col_hora: horaFormatada, col_IP: ip, col_nome_bot: nomeBot, col_acao: acao };

    await collection.insertOne(logEntry);
    console.log("Log de acesso registrado com sucesso:", logEntry);
    res.status(201).json({ message: "Log de acesso registrado com sucesso." });
  } catch (error) {
    console.error("Erro ao registrar log de acesso:", error);
    res.status(500).json({ error: "Erro ao inserir log no banco de dados." });
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

  try {
    const collection = dbHistory.collection("chat_histories");
    const historyEntry = { createdAt: new Date(), conversation: history };
    await collection.insertOne(historyEntry);
    console.log("Histórico salvo com sucesso:", historyEntry);
    res.status(201).json({ message: "Histórico salvo." });
  } catch (error) {
    console.error("Erro ao salvar histórico:", error);
    res.status(500).json({ error: "Erro ao salvar no banco de dados de histórico." });
  }
});

// 6. INICIALIZAÇÃO DO SERVIDOR
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
