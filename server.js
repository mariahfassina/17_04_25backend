// server.js
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const port = 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_KEY = "AIzaSyAXkyX793mDPtGVT10ur0Zy-vN2zyKVBPk"; // Sua chave real

let genAI; // Declaração ÚNICA

try {
  if (!API_KEY || API_KEY.trim() === "") {
    console.error("ERRO CRÍTICO: A variável API_KEY está vazia ou não foi definida corretamente em server.js.");
    console.error("Por favor, certifique-se de que sua chave real do Google AI Studio está na variável API_KEY.");
    process.exit(1);
  }
  genAI = new GoogleGenerativeAI(API_KEY);
  console.log("LOG: Instância GoogleGenerativeAI criada com sucesso.");
} catch (e) {
  console.error("LOG: FALHA AO INICIAR GoogleGenerativeAI.");
  console.error("Verifique se a API Key fornecida é válida, se a API Generative Language está habilitada no seu projeto Google Cloud e se não há problemas de cota ou faturamento.");
  console.error("Detalhes do erro original:", e.message);
  process.exit(1);
}

// --- Definição da Ferramenta ---
const getCurrentTimeTool = {
  name: "getCurrentTime",
  description: "Obtém a data e hora atuais do sistema. Retorna um objeto com uma propriedade 'currentTime' que é uma string representando a data e hora formatada (ex: '17/04/2024, 14:30:55').",
  parameters: {
    type: "object",
    properties: {},
    required: []
  },
};

const tools = [{ functionDeclarations: [getCurrentTimeTool] }];

// --- Implementação da Lógica da Ferramenta ---
function getCurrentTime() {
  console.log("LOG: Executando getCurrentTime (Node.js)");
  const now = new Date();
  const dateTimeString = `${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR', { hour12: false })}`;
  const resultObject = { currentTime: dateTimeString };
  console.log("LOG: Resultado da função getCurrentTime:", JSON.stringify(resultObject));
  return resultObject;
}

const availableFunctions = {
  getCurrentTime: getCurrentTime,
};

// --- Configuração de Segurança ---
const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

// --- Configuração do Modelo ---
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash-latest",
  tools: tools,
  safetySettings: safetySettings // Usando as configurações de segurança definidas
});

// --- Middleware Básico ---
app.use(cors());
app.use(bodyParser.json());

// --- Rota de Chat ---
app.post("/chat", async (req, res) => {
  console.log("LOG: Rota /chat POST");
  const userMessage = req.body.mensagem;
  let history = req.body.historico || [];

  console.log("LOG: Mensagem User:", userMessage);

  if (!userMessage) {
    return res.status(400).json({ erro: "Mensagem é obrigatória." });
  }

  try {
    const chat = model.startChat({ history: history });

    console.log("LOG: Enviando mensagem para Gemini:", userMessage);
    let result = await chat.sendMessage(userMessage);
    let modelResponse = result.response;

    while (modelResponse.functionCalls() && modelResponse.functionCalls().length > 0) {
      const functionCall = modelResponse.functionCalls()[0];
      console.log(`LOG: Gemini solicitou Function Call: ${functionCall.name}`);

      if (availableFunctions[functionCall.name]) {
        const functionToCall = availableFunctions[functionCall.name];
        const functionArgs = functionCall.args;
        console.log(`LOG: Argumentos para ${functionCall.name}:`, JSON.stringify(functionArgs));
        const functionResult = functionToCall(functionArgs);
        console.log(`LOG: Resultado de ${functionCall.name} (JS):`, JSON.stringify(functionResult));

        result = await chat.sendMessage([{
          functionResponse: {
            name: functionCall.name,
            response: functionResult
          }
        }]);
        modelResponse = result.response;
      } else {
        console.error(`LOG: Função ${functionCall.name} solicitada pelo Gemini não encontrada em availableFunctions.`);
        break;
      }
    }

    let botResponseText = "";
    if (modelResponse.candidates && modelResponse.candidates.length > 0 && modelResponse.candidates[0].content && modelResponse.candidates[0].content.parts) {
      botResponseText = modelResponse.candidates[0].content.parts
        .filter(part => part.text != null)
        .map(part => part.text)
        .join("");
    } else {
      botResponseText = "Desculpe, não consegui gerar uma resposta textual no momento.";
      console.warn("LOG: Resposta do Gemini não continha partes de texto esperadas:", JSON.stringify(modelResponse));
    }

    console.log("LOG: Resposta final do Bot (texto):", botResponseText);
    const currentHistory = await chat.getHistory(); // Movido para cá para garantir que é o histórico mais recente
    res.json({ resposta: botResponseText, historico: currentHistory });

  } catch (error) {
    console.error("LOG: Erro GERAL na rota /chat:", error.message); // Loga a mensagem de erro
    console.error("LOG: StackTrace do erro:", error.stack); // Loga o stack trace completo
    let errorMessage = "Erro ao comunicar com o chatbot.";
    res.status(500).json({ erro: errorMessage, details: error.message || error.toString() });
  }
});

app.get('/favicon.ico', (req, res) => res.status(204).end());
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.use((req, res, next) => {
    console.log(`LOG: Rota não encontrada - 404: ${req.method} ${req.originalUrl}`);
    if (!res.headersSent) {
      if (req.accepts('json') && !req.accepts('html')) {
        res.status(404).json({ error: "Recurso não encontrado" });
      } else {
        res.status(404).send("<h1>404 - Página não encontrada</h1>");
      }
    }
});
app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
  console.log(`Para testar, abra: http://localhost:${port}/`);
  console.log(`Certifique-se que seus arquivos HTML e client.js estão na pasta 'public'.`);
});
