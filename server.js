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

app.post('/chat', async (req, res) => {
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Erro de configuração no servidor: A chave da API do Gemini (GEMINI_API_KEY) não foi definida.' });
  }

  try {
    const { history } = req.body;
    const userPreferences = getPreferences();
    const personality = userPreferences.personality || 'Você é um assistente prestativo.';

    // --- CORREÇÃO APLICADA AQUI ---
    // Trocamos 'gemini-1.5-flash' por 'gemini-pro', que é o modelo padrão e mais estável para chat.
    const model = genAI.getGenerativeModel({
      model: "gemini-pro", 
      systemInstruction: personality,
    });

    const chat = model.startChat({
      history: history,
      generationConfig: {
        maxOutputTokens: 500,
      },
    });

    const lastMessage = history[history.length - 1].parts[0].text;
    const result = await chat.sendMessage(lastMessage);
    const response = await result.response;
    const text = response.text();
    
    res.json({ response: text });

  } catch (error) {
    // Agora vamos logar o erro completo no servidor para facilitar futuras depurações
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
