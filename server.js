
require("dotenv").config();
const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        await client.connect();
        await client.db("admin").command({ ping: 1 });
        console.log("Conectado ao MongoDB!");
    } catch (error) {
        console.error("Erro ao conectar ao MongoDB:", error);
        process.exit(1);
    }
}
run().catch(console.dir);

// Google Gemini Setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

// Admin Password (for demonstration purposes, use environment variables in production)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

// Middleware de autenticação para rotas de admin
const authenticateAdmin = (req, res, next) => {
    const adminPassword = req.headers["x-admin-password"];
    if (adminPassword === ADMIN_PASSWORD) {
        next();
    } else {
        res.status(403).json({ message: "Acesso negado. Senha de administrador incorreta." });
    }
};

// Rota para o chatbot
app.post("/chat", async (req, res) => {
    try {
        const { prompt, userId, chatId } = req.body;
        const db = client.db("chatbot_db");
        const chatsCollection = db.collection("chats");

        let currentChat;
        if (chatId) {
            currentChat = await chatsCollection.findOne({ _id: new ObjectId(chatId) });
        }

        if (!currentChat) {
            currentChat = {
                userId: userId || "anonymous",
                title: prompt.substring(0, 50) + "...", // Título inicial da conversa
                messages: [],
                createdAt: new Date(),
            };
        }

        // Adiciona a mensagem do usuário ao histórico
        currentChat.messages.push({ role: "user", parts: [{ text: prompt }] });

        const chat = model.startChat({ history: currentChat.messages });
        const result = await chat.sendMessage(prompt);
        const response = await result.response;
        const botResponse = response.text();

        // Adiciona a resposta do bot ao histórico
        currentChat.messages.push({ role: "model", parts: [{ text: botResponse }] });

        if (chatId) {
            await chatsCollection.updateOne(
                { _id: new ObjectId(chatId) },
                { $set: { messages: currentChat.messages } }
            );
        } else {
            const insertResult = await chatsCollection.insertOne(currentChat);
            currentChat._id = insertResult.insertedId;
        }

        res.json({ response: botResponse, chatId: currentChat._id });
    } catch (error) {
        console.error("Erro no chatbot:", error);
        res.status(500).json({ error: "Erro interno do servidor." });
    }
});

// Rota para buscar o histórico de conversas de um usuário
app.get("/history/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        const db = client.db("chatbot_db");
        const chatsCollection = db.collection("chats");

        const userChats = await chatsCollection.find({ userId }).sort({ createdAt: -1 }).toArray();
        res.json(userChats);
    } catch (error) {
        console.error("Erro ao buscar histórico:", error);
        res.status(500).json({ error: "Erro interno do servidor." });
    }
});

// Rota para buscar uma conversa específica
app.get("/chat/:chatId", async (req, res) => {
    try {
        const { chatId } = req.params;
        const db = client.db("chatbot_db");
        const chatsCollection = db.collection("chats");

        const chat = await chatsCollection.findOne({ _id: new ObjectId(chatId) });
        if (!chat) {
            return res.status(404).json({ message: "Conversa não encontrada." });
        }
        res.json(chat);
    } catch (error) {
        console.error("Erro ao buscar conversa:", error);
        res.status(500).json({ error: "Erro interno do servidor." });
    }
});

// Rota para a instrução do sistema (admin)
let systemInstruction = "Você é um chatbot prestativo."; // Default instruction

app.get("/api/admin/system-instruction", authenticateAdmin, (req, res) => {
    res.json({ instruction: systemInstruction });
});

app.post("/api/admin/system-instruction", authenticateAdmin, (req, res) => {
    const { newInstruction } = req.body;
    if (newInstruction) {
        systemInstruction = newInstruction;
        res.json({ message: "Instrução do sistema atualizada com sucesso." });
    } else {
        res.status(400).json({ message: "Nova instrução não fornecida." });
    }
});

// Rota para estatísticas de admin (existente)
app.get("/api/admin/stats", authenticateAdmin, async (req, res) => {
    try {
        const db = client.db("chatbot_db");
        const chatsCollection = db.collection("chats");

        const totalConversas = await chatsCollection.countDocuments();
        const ultimasConversas = await chatsCollection.find({}).sort({ createdAt: -1 }).limit(5).toArray();

        res.json({
            totalConversas,
            ultimasConversas: ultimasConversas.map(chat => ({
                title: chat.title,
                createdAt: chat.createdAt
            }))
        });
    } catch (error) {
        console.error("Erro ao buscar estatísticas de admin:", error);
        res.status(500).json({ message: "Erro ao buscar estatísticas de admin." });
    }
});

// NOVO ENDPOINT DO DASHBOARD
app.get("/api/admin/dashboard", authenticateAdmin, async (req, res) => {
    try {
        const db = client.db("chatbot_db");
        const chatsCollection = db.collection("chats");

        // 1. Profundidade de Engajamento
        const engagementMetrics = await chatsCollection.aggregate([
            { $addFields: { messageCount: { $size: "$messages" } } },
            { $group: {
                _id: null,
                averageMessageCount: { $avg: "$messageCount" },
                shortConversations: { $sum: { $cond: [{ $lte: ["$messageCount", 3] }, 1, 0] } },
                longConversations: { $sum: { $cond: [{ $gt: ["$messageCount", 3] }, 1, 0] } },
                totalConversations: { $sum: 1 }
            }},
            { $project: { _id: 0 } }
        ]).toArray();

        // 2. Lealdade do Usuário (Top 5 Agentes Mais Ativos)
        const topUsers = await chatsCollection.aggregate([
            { $group: { _id: "$userId", chatCount: { $sum: 1 } } },
            { $sort: { chatCount: -1 } },
            { $limit: 5 }
        ]).toArray();

        // 3. Análise de Falhas (Respostas Inconclusivas do Bot)
        const failureKeywords = [/não entendi/i, /não posso ajudar com isso/i, /pode reformular/i, /desculpe, não compreendi/i]; // Adicione mais conforme necessário
        const failedConversations = await chatsCollection.aggregate([
            { $unwind: "$messages" },
            { $match: { "messages.role": "model", "messages.parts.text": { $in: failureKeywords } } },
            { $group: { _id: "$_id", userId: { $first: "$userId" }, title: { $first: "$title" }, failedMessages: { $push: "$messages.parts.text" } } },
            { $project: { _id: 1, userId: 1, title: 1, failedMessages: 1 } }
        ]).toArray();
        
        const inconclusiveResponsesCount = failedConversations.length;

        res.json({
            engagementMetrics: engagementMetrics[0] || { averageMessageCount: 0, shortConversations: 0, longConversations: 0, totalConversations: 0 },
            topUsers,
            failureAnalysis: {
                inconclusiveResponsesCount,
                failedConversations: failedConversations.map(conv => ({
                    title: conv.title,
                    userId: conv.userId,
                    messages: conv.failedMessages.join(" | ")
                }))
            }
        });

    } catch (error) {
        console.error("Erro ao buscar dados do dashboard:", error);
        res.status(500).json({ message: "Erro ao buscar dados do dashboard", error: error.message });
    }
});

// Start Server
app.listen(port, () => {
    console.log(`Servidor backend rodando em http://localhost:${port}`);
});


