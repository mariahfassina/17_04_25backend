// 1. IMPORTAÇÕES NECESSÁRIAS
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

// 2. CONFIGURAÇÃO INICIAL
const app = express();

// ===================================================================
// CONFIGURAÇÃO DE CORS EXPLÍCITA - A SOLUÇÃO PROVÁVEL
// Estamos dizendo para o backend aceitar requisições APENAS do seu site na Vercel.
const corsOptions = {
    origin: 'https://chatbotflashcards.vercel.app',
    optionsSuccessStatus: 200 // Para compatibilidade com navegadores mais antigos
};
app.use(cors(corsOptions));
// ===================================================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. CONFIGURAÇÃO DO GOOGLE GEMINI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 4. ROTA PRINCIPAL PARA O CHAT
app.post('/chat', async (req, res) => {
    console.log('Recebido no backend - Corpo da requisição:', req.body);

    try {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ error: 'Nenhuma mensagem foi fornecida.' });
        }
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const result = await model.generateContent(message);
        const response = await result.response;
        const text = response.text();
        res.json({ response: text });
    } catch (error) {
        console.error('Erro ao comunicar com a API do Gemini:', error);
        res.status(500).json({ error: 'Ocorreu um erro no servidor ao processar sua mensagem.' });
    }
});

// 5. INICIALIZAÇÃO DO SERVIDOR
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
