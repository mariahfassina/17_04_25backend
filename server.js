const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getPreferences, updatePreferences } = require('./user_preferences');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

if (!process.env.GEMINI_API_KEY) {
  console.warn("AVISO: A variável de ambiente GEMINI_API_KEY não está definida. A rota /chat falhará.");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "CHAVE_API_AUSENTE");

app.post('/chat', async (req, res) => {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "CHAVE_API_AUSENTE") {
    return res.status(500).json({ error: 'Erro de configuração no servidor: A chave da API do Gemini (GEMINI_API_KEY) não foi definida.' });
  }

  try {
    const { history } = req.body;

    if (!history || history.length === 0) {
      return res.status(400).json({ error: 'Histórico de conversa está vazio ou ausente.' });
    }

    // BLINDAGEM DO BACKEND: Garante que o histórico sempre alterne entre 'user' e 'model'.
    // Isso remove mensagens consecutivas do mesmo "role", que causam erro na API.
    const filteredHistory = history.reduce((acc, current) => {
      if (acc.length === 0 || acc[acc.length - 1].role !== current.role) {
        // A API do Gemini espera 'user' e 'model', então garantimos que o 'role' seja um desses.
        const validRole = current.role === 'bot' ? 'model' : current.role;
        if (validRole === 'user' || validRole === 'model') {
            acc.push({ ...current, role: validRole });
        }
      }
      return acc;
    }, []);
    
    if (filteredHistory.length === 0) {
        return res.status(400).json({ error: 'Histórico de conversa inválido após filtragem.' });
    }

    const lastUserMessage = filteredHistory[filteredHistory.length - 1].parts[0].text;
    const userPreferences = getPreferences();
    const personality = userPreferences.personality;

    const model = genAI.getGenerativeModel({
      model: "gemini-pro",
      systemInstruction: personality,
    });

    // Inicia o chat com o histórico anterior (sem a última mensagem do usuário)
    const chat = model.startChat({
        history: filteredHistory.slice(0, -1)
    });
    
    const result = await chat.sendMessage(lastUserMessage);
    const response = await result.response;
    const text = response.text();
    
    res.json({ response: text });

  } catch (error) {
    console.error("Erro detalhado na rota /chat:", error); 
    res.status(500).json({ error: 'Ocorreu um erro interno ao se comunicar com a API do Gemini.' });
  }
});

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
