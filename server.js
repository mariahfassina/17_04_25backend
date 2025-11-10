const express = require("express");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// // MongoDB Connection - BLOCO COMENTADO
// const uri = process.env.MONGODB_URI;
// const client = new MongoClient(uri, {
//     serverApi: {
//         version: ServerApiVersion.v1,
//         strict: true,
//         deprecationErrors: true,
//     }
// });

// async function run() {
//     try {
//         await client.connect();
//         await client.db("admin").command({ ping: 1 });
//         console.log("Conectado ao MongoDB!");
//     } catch (error) {
//         console.error("Erro ao conectar ao MongoDB:", error);
//         process.exit(1);
//     }
// }
// run().catch(console.dir);

// Google Gemini Setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

// Importa a simulação de preferências de usuário
const { getCustomInstruction, saveCustomInstruction, STATIC_USER_ID } = require("./user_preferences");

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

// Rota para o chatbot (mantida, mas não funcional sem MongoDB para histórico)
app.post("/chat", async (req, res) => {
    try {
        const { prompt } = req.body; // Removido userId e chatId, pois dependem do DB
        
        // 1. Lógica de Personalidade Adaptativa (Prioridade do Usuário)
        const userId = STATIC_USER_ID; // Simula o usuário logado
        const customInstruction = getCustomInstruction(userId);
        
        let finalSystemInstruction;
        if (customInstruction && customInstruction.trim() !== "") {
            finalSystemInstruction = customInstruction;
        } else {
            finalSystemInstruction = systemInstruction; // Usa a global do admin
        }
        
        // console.log("Instrução de Sistema Final:", finalSystemInstruction); // Para debug
        
        const systemMessage = {
            role: "user", // O Gemini usa 'user' para a instrução de sistema no histórico
            parts: [{ text: finalSystemInstruction }]
        };
        // Simulação de resposta do Gemini, sem salvar histórico
        const chat = model.startChat({ history: [systemMessage] }); // Inicia chat com a instrução de sistema correta
        const result = await chat.sendMessage({ role: "user", parts: [{ text: prompt }] });
        const response = await result.response;
        const botResponse = response.text();

        res.json({ response: botResponse, chatId: "static_chat_id" }); // ID de chat estático
    } catch (error) {
        console.error("Erro no chatbot:", error);
        res.status(500).json({ error: "Erro interno do servidor." });
    }
});

// Rotas de histórico e chat individual (comentadas, pois dependem do MongoDB)
// app.get("/history/:userId", async (req, res) => { /* ... */ });
// app.get("/chat/:chatId", async (req, res) => { /* ... */ });

// Rota para a instrução do sistema (admin)
let systemInstruction = "Você é um chatbot prestativo."; // Default instruction

// Simulação de autenticação de usuário (já que não há login real)
const authenticateUser = (req, res, next) => {
    // Em um cenário estático, simplesmente passamos o ID fixo
    req.userId = STATIC_USER_ID;
    next();
};

// Endpoints de Preferências do Usuário
app.get("/api/user/preferences", authenticateUser, (req, res) => {
    const instruction = getCustomInstruction(req.userId);
    res.json({ systemInstruction: instruction || "" });
});

app.put("/api/user/preferences", authenticateUser, (req, res) => {
    const { newInstruction } = req.body;
    if (typeof newInstruction === "string") {
        saveCustomInstruction(req.userId, newInstruction);
        res.json({ message: "Instrução de sistema personalizada salva com sucesso." });
    } else {
        res.status(400).json({ message: "Nova instrução não fornecida." });
    }
});

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

// Rota para estatísticas de admin (agora com dados estáticos)
app.get("/api/admin/stats", authenticateAdmin, async (req, res) => {
    // Dados estáticos para simular as estatísticas
    const totalConversas = 16;
    const ultimasConversas = [
        { title: "Conversa sobre clima...", createdAt: new Date("2025-10-20T10:00:00Z") },
        { title: "Dúvidas sobre IA...", createdAt: new Date("2025-10-20T09:30:00Z") },
        { title: "Ajuda com programação...", createdAt: new Date("2025-10-20T09:00:00Z") },
        { title: "Feedback sobre o bot...", createdAt: new Date("2025-10-19T18:00:00Z") },
        { title: "Sugestão de funcionalidade...", createdAt: new Date("2025-10-19T17:00:00Z") },
    ];

    res.json({
        totalConversas,
        ultimasConversas: ultimasConversas.map(chat => ({
            title: chat.title,
            createdAt: chat.createdAt
        }))
    });
});

// NOVO ENDPOINT DO DASHBOARD (agora com dados estáticos)
app.get("/api/admin/dashboard", authenticateAdmin, async (req, res) => {
    // Dados estáticos para simular as métricas do dashboard
    const engagementMetrics = {
        averageMessageCount: 3.5,
        shortConversations: 8,
        longConversations: 8,
        totalConversations: 16,
    };

    const topUsers = [
        { _id: "userA", chatCount: 5 },
        { _id: "userB", chatCount: 4 },
        { _id: "userC", chatCount: 3 },
        { _id: "userD", chatCount: 2 },
        { _id: "userE", chatCount: 2 },
    ];

    const failureAnalysis = {
        inconclusiveResponsesCount: 2,
        failedConversations: [
            { title: "Erro de compreensão", userId: "userA", messages: "não entendi" },
            { title: "Limitação de conhecimento", userId: "userC", messages: "não posso ajudar com isso" },
        ],
    };

    res.json({
        engagementMetrics,
        topUsers,
        failureAnalysis,
    });
});

// Start Server
app.listen(port, () => {
    console.log(`Servidor backend rodando em http://localhost:${port}`);
});


