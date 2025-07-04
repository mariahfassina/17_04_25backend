// 1. IMPORTAÇÕES NECESSÁRIAS
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

// 2. CONFIGURAÇÃO INICIAL
const app = express();
app.use(cors());
app.use(express.json()); // Permite ler JSON
app.use(express.urlencoded({ extended: true })); // Garante a leitura de outros tipos de corpo de requisição

// 3. CONFIGURAÇÃO DO GOOGLE GEMINI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 4. ROTA PRINCIPAL PARA O CHAT
app.post('/chat', async (req, res) => {
    // ===================================================================
    // NOSSO ESPIÃO NO BACKEND!
    // Esta linha vai mostrar nos logs do Render o que o servidor recebeu.
    console.log('Recebido no backend - Corpo da requisição:', req.body);
    // ===================================================================

    try {
        // Pega a mensagem do corpo da requisição
        const { message } = req.body;

        // Validação que causa o erro 400
        if (!message) {
            return res.status(400).json({ error: 'Nenhuma mensagem foi fornecida. O corpo da requisição pode estar vazio ou mal formatado.' });
        }

        // Inicializa o modelo do Gemini
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        // Gera o conteúdo com base na mensagem do usuário
        const result = await model.generateContent(message);
        const response = await result.response;
        const text = response.text();

        // Envia a resposta do Gemini de volta para o frontend
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
