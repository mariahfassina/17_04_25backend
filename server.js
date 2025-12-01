const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { findUserById, updateUserInstruction, getGlobalInstruction, LOGGED_IN_USER_ID } = require('./users');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

if (!process.env.GEMINI_API_KEY) {
  console.warn("AVISO: A variável de ambiente GEMINI_API_KEY não está definida. A rota /chat falhará.");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "CHAVE_API_AUSENTE");

const authenticateUser = (req, res, next) => {
    req.userId = LOGGED_IN_USER_ID; 
    const user = findUserById(req.userId);

    if (!user) {
        return res.status(401).json({ error: 'Não autorizado. Usuário não logado ou sessão expirada.' });
    }
    req.user = user;
    next();
};

app.post('/chat', authenticateUser, async (req, res) => {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "CHAVE_API_AUSENTE") {
    return res.status(500).json({ error: 'Erro de configuração no servidor: A chave da API do Gemini (GEMINI_API_KEY) não foi definida.' });
  }

  try {
    const { history } = req.body;

    if (!history || history.length === 0) {
      return res.status(400).json({ error: 'Histórico de conversa está vazio ou ausente.' });
    }

    let personality = req.user.systemInstruction;
    
    if (!personality || personality.trim() === "") {
        personality = getGlobalInstruction();
    }
    
    if (!personality || personality.trim() === "") {
        personality = "Você é um assistente prestativo.";
    }

    const filteredHistory = history.reduce((acc, current) => {
      if (acc.length === 0 || acc[acc.length - 1].role !== current.role) {
        const validRole = current.role === 'model' ? 'model' : current.role;
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

    const model = genAI.getGenerativeModel({
      model: "gemini-pro",
      systemInstruction: personality,
    });

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

app.get('/api/user/preferences', authenticateUser, (req, res) => {
    res.json({ systemInstruction: req.user.systemInstruction });
});

app.put('/api/user/preferences', authenticateUser, (req, res) => {
    const { newInstruction } = req.body;

    if (typeof newInstruction !== 'string') {
        return res.status(400).json({ error: 'Instrução inválida.' });
    }

    const updatedUser = updateUserInstruction(req.userId, newInstruction);

    if (updatedUser) {
        res.json({ 
            message: 'Personalidade salva com sucesso!', 
            systemInstruction: updatedUser.systemInstruction 
        });
    } else {
        res.status(500).json({ error: 'Erro ao salvar a personalidade.' });
    }
});

app.get('/api/admin/system-instruction', (req, res) => {
    if (req.headers['x-admin-password'] !== 'admin123') {
        return res.status(403).json({ error: 'Acesso negado. Credenciais de administrador ausentes ou inválidas.' });
    }
    res.json({ instruction: getGlobalInstruction() });
});

app.listen(port, () => {
  console.log(`Servidor backend rodando na porta ${port}`);
});
