const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
// Importa as funções de gerenciamento de preferências
const { getPreferences, updatePreferences } = require('./user_preferences');

const app = express();
const port = process.env.PORT || 3000;

// Middlewares para habilitar CORS e o parsing de JSON no corpo das requisições
app.use(cors());
app.use(express.json());

// Validação da chave de API na inicialização do servidor
if (!process.env.GEMINI_API_KEY) {
  console.warn("AVISO: A variável de ambiente GEMINI_API_KEY não está definida. A rota /chat retornará um erro 500.");
}

// Instancia o cliente da API do Gemini. Se a chave não existir, usa um valor placeholder para evitar que o SDK quebre na inicialização.
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "CHAVE_API_AUSENTE");

// Rota principal do chat
app.post('/chat', async (req, res) => {
  // Verifica novamente a chave de API a cada requisição
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Erro de configuração no servidor: A chave da API do Gemini (GEMINI_API_KEY) não foi definida.' });
  }

  try {
    const { history } = req.body; // Pega o histórico da conversa do corpo da requisição
    const userPreferences = getPreferences(); // Carrega as preferências salvas
    const personality = userPreferences.personality || 'Você é um assistente prestativo.'; // Define a personalidade

    // Configura o modelo, passando a personalidade como uma instrução de sistema
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: personality,
    });

    // Inicia uma nova sessão de chat com o histórico fornecido
    const chat = model.startChat({
      history: history,
      generationConfig: {
        maxOutputTokens: 500, // Limita o tamanho da resposta
      },
    });

    // Extrai a última mensagem enviada pelo usuário para enviar à API
    const lastMessage = history[history.length - 1].parts[0].text;
    const result = await chat.sendMessage(lastMessage);
    const response = await result.response;
    const text = response.text();
    
    // Retorna a resposta do modelo como JSON
    res.json({ response: text });

  } catch (error) {
    console.error("Erro na rota /chat:", error);
    res.status(500).json({ error: 'Ocorreu um erro interno ao se comunicar com a API do Gemini.' });
  }
});

// Rota para obter as configurações de personalidade atuais
app.get('/api/user/preferences', (req, res) => {
  res.json(getPreferences());
});

// Rota para atualizar as configurações de personalidade
app.put('/api/user/preferences', (req, res) => {
  const newPrefs = updatePreferences(req.body);
  res.json(newPrefs);
});

// Inicia o servidor
app.listen(port, () => {
  console.log(`Servidor backend rodando na porta ${port}`);
});
