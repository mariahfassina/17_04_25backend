const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getPreferences, updatePreferences } = require('./user_preferences');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

if (!process.env.GEMINI_API_KEY) {
  console.warn("AVISO: A variável de ambiente GEMINI_API_KEY não está definida.");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "CHAVE_API_AUSENTE");

// Rota de chat simplificada e mais robusta
app.post('/chat', async (req, res) => {
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Erro de configuração no servidor: A chave da API do Gemini (GEMINI_API_KEY) não foi definida.' });
  }

  try {
    const { history } = req.body;
    
    // Pega a última mensagem enviada pelo usuário de forma segura
    const lastUserMessage = history?.[history.length - 1]?.parts?.[0]?.text;

    // Validação: Se não houver mensagem, retorna um erro.
    if (!lastUserMessage) {
      return res.status(400).json({ error: 'Nenhuma mensagem válida encontrada no histórico.' });
    }

    const userPreferences = getPreferences();
    const personality = userPreferences.personality || 'Você é um assistente prestativo.';

    // Seleciona o modelo
    const model = genAI.getGenerativeModel({
      model: "gemini-pro",
      systemInstruction: personality,
    });

    // --- MUDANÇA PRINCIPAL ---
    // Em vez de usar startChat, usamos generateContent diretamente.
    // É mais simples e direto para interações de pergunta e resposta.
    const result = await model.generateContent(lastUserMessage);
    const response = await result.response;
    const text = response.text();
    
    res.json({ response: text });

  } catch (error) {
    console.error("Erro detalhado na rota /chat:", error); 
    res.status(500).json({ error: 'Ocorreu um erro interno ao se comunicar com a API do Gemini.' });
  }
});

// Rotas de preferências (permanecem as mesmas)
app.get('/api/user/preferences', (req, res) => {
  res.json(getPreferences());
});

app.put('/api/user/preferences', (req, res) => {
  const newPrefs = updatePreferences(req.body);
  res.json(newPrefs);
});

app.listen(port, () => {
  console.log(`Servidor backend rodando na porta ${port}`);
});
