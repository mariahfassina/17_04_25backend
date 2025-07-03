// 1. IMPORTAÇÕES NECESSÁRIAS
const express = require('express');
const cors = require('cors'); // Essencial para permitir a comunicação entre frontend e backend em domínios diferentes
const { OpenAI } = require('openai');
require('dotenv').config(); // Carrega as variáveis de ambiente do arquivo .env

// 2. CONFIGURAÇÃO INICIAL
const app = express();

// Middlewares: Funções que são executadas em todas as requisições
app.use(cors()); // Habilita o CORS para que seu frontend possa fazer requisições
app.use(express.json()); // Permite que o servidor entenda requisições com corpo no formato JSON

// 3. CONFIGURAÇÃO DA OPENAI
// Pega a chave da API do ambiente, que você configurará no Render
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// 4. ROTA PRINCIPAL PARA O CHAT
// Define um endpoint POST em /chat que receberá as mensagens do usuário
app.post('/chat', async (req, res) => {
    // Usamos um bloco try...catch para lidar com possíveis erros na comunicação com a OpenAI
    try {
        // Pega a mensagem enviada pelo frontend no corpo da requisição
        const { message } = req.body;

        // Validação simples para garantir que uma mensagem foi enviada
        if (!message) {
            return res.status(400).json({ error: 'Nenhuma mensagem foi fornecida.' });
        }

        // Envia a mensagem para a API da OpenAI para obter uma resposta
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo", // Modelo que será usado
            messages: [{ role: "user", content: message }], // Formato da mensagem
        });

        // Extrai o conteúdo da resposta do bot
        const botResponse = completion.choices[0].message.content;

        // Envia a resposta do bot de volta para o frontend
        res.json({ response: botResponse });

    } catch (error) {
        // Se ocorrer um erro, imprime no console do servidor para depuração
        console.error('Erro ao comunicar com a OpenAI:', error);
        // Envia uma resposta de erro para o frontend
        res.status(500).json({ error: 'Ocorreu um erro no servidor ao processar sua mensagem.' });
    }
});

// 5. INICIALIZAÇÃO DO SERVIDOR
// O Render fornecerá a porta através de process.env.PORT. Para rodar localmente, usamos 3000.
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
