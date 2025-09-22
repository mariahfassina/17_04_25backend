// 1. IMPORTAÇÕES
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { MongoClient } = require('mongodb');
require('dotenv').config();

// ===================================================================
// 2. VERIFICAÇÃO DE VARIÁVEIS DE AMBIENTE (À PROVA DE BALAS)
// ===================================================================
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MONGO_URI_LOGS = process.env.MONGO_URI_LOGS;
const MONGO_URI_HISTORY = process.env.MONGO_URI_HISTORY;
let BUNDLE_URL_FRONTEND = process.env.BUNDLE_URL_FRONTEND;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Define a URL do frontend padrão se não estiver nas variáveis de ambiente
if (!BUNDLE_URL_FRONTEND) {
    console.log("AVISO: BUNDLE_URL_FRONTEND não definida. Usando valor padrão: https://chatbotflashcards.vercel.app" );
    BUNDLE_URL_FRONTEND = 'https://chatbotflashcards.vercel.app';
}

// Adiciona as origens permitidas (localhost + URL do bundle )
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:8080',
    'https://chatbotflashcards.vercel.app',
    'https://chatbotflashcards.vercel.app/',
    BUNDLE_URL_FRONTEND
];

if (!GEMINI_API_KEY ) {
    console.error("ERRO FATAL: Variável de ambiente GEMINI_API_KEY não foi definida!");
    process.exit(1); // Para o servidor imediatamente
}
if (!MONGO_URI_LOGS) {
    console.error("ERRO FATAL: Variável de ambiente MONGO_URI_LOGS não foi definida!");
    process.exit(1);
}
if (!MONGO_URI_HISTORY) {
    console.error("ERRO FATAL: Variável de ambiente MONGO_URI_HISTORY não foi definida!");
    process.exit(1);
}

// 3. CONFIGURAÇÃO INICIAL
const app = express();
const corsOptions = {
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.some(o => origin.startsWith(o))) {
            callback(null, true);
        } else {
            callback(new Error('Origem não permitida pelo CORS'));
        }
    },
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
let dadosRankingVitrine = [];

// ===================================================================
// FUNÇÃO PARA VERIFICAR AUTENTICAÇÃO DE ADMIN
// ===================================================================
function verificarAutenticacaoAdmin(req, res, next) {
    const senhaFornecida = req.headers['x-admin-password'] || req.body.adminPassword;
    
    if (!senhaFornecida || senhaFornecida !== ADMIN_PASSWORD) {
        return res.status(403).json({ error: 'Acesso negado. Senha de administrador incorreta.' });
    }
    
    next();
}

// ===================================================================
// 4. ROTAS DA API
// ===================================================================

// ENDPOINTS DE ADMINISTRAÇÃO
// Endpoint para obter estatísticas do admin
app.get('/api/admin/stats', verificarAutenticacaoAdmin, async (req, res) => {
    const client = new MongoClient(MONGO_URI_HISTORY);
    try {
        await client.connect();
        const db = client.db("MeuChatbotHistory");
        const collection = db.collection("chat_histories");
        
        // Contar total de conversas
        const totalConversas = await collection.countDocuments();
        
        // Contar total de mensagens
        const conversas = await collection.find({}).toArray();
        let totalMensagens = 0;
        conversas.forEach(conversa => {
            if (conversa.conversation && Array.isArray(conversa.conversation)) {
                totalMensagens += conversa.conversation.length;
            }
        });
        
        // Buscar últimas 5 conversas
        const ultimasConversas = await collection.find({})
            .sort({ createdAt: -1 })
            .limit(5)
            .toArray();
        
        const ultimasConversasFormatadas = ultimasConversas.map(conversa => ({
            id: conversa._id,
            titulo: conversa.titulo || 'Conversa sem título',
            dataHora: conversa.createdAt
        }));
        
        res.json({
            totalConversas,
            totalMensagens,
            ultimasConversas: ultimasConversasFormatadas
        });
        
    } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
        res.status(500).json({ error: 'Erro ao buscar estatísticas do sistema.' });
    } finally {
        if (client) await client.close();
    }
});

// Endpoint para obter instrução de sistema atual
app.get('/api/admin/system-instruction', verificarAutenticacaoAdmin, async (req, res) => {
    const client = new MongoClient(MONGO_URI_HISTORY);
    try {
        await client.connect();
        const db = client.db("MeuChatbotHistory");
        const collection = db.collection("system_config");
        
        const config = await collection.findOne({ type: 'system_instruction' });
        
        if (!config) {
            // Retorna a instrução padrão se não houver configuração salva
            const defaultInstruction = `
            Você é um assistente de estudos que cria flash cards. Siga estas regras ESTRITAMENTE.

            REGRA 1: Se a última mensagem do usuário NÃO for "resposta" (ou sinônimos), sua única ação é criar uma PERGUNTA.
            - Formato OBRIGATÓRIO: "❓ [PERGUNTA COM EMOJIS RELEVANTES]"
            - É PROIBIDO incluir a palavra "Resposta" ou o conteúdo da resposta nesta etapa. APENAS a pergunta.

            REGRA 2: Se a última mensagem do usuário for "resposta" (ou sinônimos como "mostre a resposta", "qual a resposta"), sua única ação é revelar a resposta da pergunta anterior.
            - Use o histórico da conversa para saber qual foi a última pergunta.
            - Formato OBRIGATÓRIO: "✅ [RESPOSTA DIRETA E CLARA]"

            REGRA 3: Se o usuário pedir um novo tema, ou disser "próximo", siga a REGRA 1.
            `;
            
            res.json({ instruction: defaultInstruction.trim() });
        } else {
            res.json({ instruction: config.instruction });
        }
        
    } catch (error) {
        console.error('Erro ao buscar instrução de sistema:', error);
        res.status(500).json({ error: 'Erro ao buscar instrução de sistema.' });
    } finally {
        if (client) await client.close();
    }
});

// Endpoint para atualizar instrução de sistema
app.post('/api/admin/system-instruction', verificarAutenticacaoAdmin, async (req, res) => {
    const { instruction } = req.body;
    
    if (!instruction || instruction.trim() === '') {
        return res.status(400).json({ error: 'Instrução de sistema é obrigatória.' });
    }
    
    const client = new MongoClient(MONGO_URI_HISTORY);
    try {
        await client.connect();
        const db = client.db("MeuChatbotHistory");
        const collection = db.collection("system_config");
        
        await collection.replaceOne(
            { type: 'system_instruction' },
            { type: 'system_instruction', instruction: instruction.trim(), updatedAt: new Date() },
            { upsert: true }
        );
        
        res.json({ message: 'Instrução de sistema atualizada com sucesso.' });
        
    } catch (error) {
        console.error('Erro ao atualizar instrução de sistema:', error);
        res.status(500).json({ error: 'Erro ao atualizar instrução de sistema.' });
    } finally {
        if (client) await client.close();
    }
});

// ROTA PRINCIPAL DO CHAT (COM PROMPT DINÂMICO)
app.post('/chat', async (req, res) => {
    try {
        const { message, history } = req.body;
        if (!message) {
            return res.status(400).json({ error: 'Nenhuma mensagem foi fornecida.' });
        }

        // Buscar instrução de sistema configurada pelo admin
        const client = new MongoClient(MONGO_URI_HISTORY);
        let promptDeSistema = `
            Você é um assistente de estudos que cria flash cards. Siga estas regras ESTRITAMENTE.

            REGRA 1: Se a última mensagem do usuário NÃO for "resposta" (ou sinônimos), sua única ação é criar uma PERGUNTA.
            - Formato OBRIGATÓRIO: "❓ [PERGUNTA COM EMOJIS RELEVANTES]"
            - É PROIBIDO incluir a palavra "Resposta" ou o conteúdo da resposta nesta etapa. APENAS a pergunta.

            REGRA 2: Se a última mensagem do usuário for "resposta" (ou sinônimos como "mostre a resposta", "qual a resposta"), sua única ação é revelar a resposta da pergunta anterior.
            - Use o histórico da conversa para saber qual foi a última pergunta.
            - Formato OBRIGATÓRIO: "✅ [RESPOSTA DIRETA E CLARA]"

            REGRA 3: Se o usuário pedir um novo tema, ou disser "próximo", siga a REGRA 1.

            Exemplo de fluxo perfeito:
            Histórico: [
                {role: "user", parts: [{text: "Olá"}]},
                {role: "model", parts: [{text: "Olá! Sobre qual tema você quer um flash card?"}]}
            ]
            Última Mensagem do Usuário: "Sistema Solar"
            Sua Resposta (seguindo REGRA 1): "❓ Qual é o maior planeta do Sistema Solar? 🪐"

            ---

            Histórico: [
                {role: "user", parts: [{text: "Sistema Solar"}]},
                {role: "model", parts: [{text: "❓ Qual é o maior planeta do Sistema Solar? 🪐"}]}
            ]
            Última Mensagem do Usuário: "resposta"
            Sua Resposta (seguindo REGRA 2): "✅ Júpiter."
        `;

        try {
            await client.connect();
            const db = client.db("MeuChatbotHistory");
            const collection = db.collection("system_config");
            const config = await collection.findOne({ type: 'system_instruction' });
            
            if (config && config.instruction) {
                promptDeSistema = config.instruction;
            }
        } catch (dbError) {
            console.error('Erro ao buscar instrução de sistema, usando padrão:', dbError);
        } finally {
            if (client) await client.close();
        }

        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash-latest",
            systemInstruction: promptDeSistema,
        });

        const chat = model.startChat({
            history: history || [],
        });

        const result = await chat.sendMessage(message);
        const response = await result.response;
        const text = response.text();
        
        res.json({ response: text });

    } catch (error) {
        console.error('Erro na rota /chat:', error);
        res.status(500).json({ error: 'Ocorreu um erro no servidor ao processar sua mensagem.' });
    }
});


// ROTA PARA SALVAR LOG DE ACESSO
app.post('/api/log-acesso', async (req, res) => {
    const { ip, acao, nomeBot } = req.body;
    if (!ip || !acao || !nomeBot) {
        return res.status(400).json({ error: "Dados de log incompletos (IP, ação e nomeBot são obrigatórios)." });
    }

    const client = new MongoClient(MONGO_URI_LOGS);
    try {
        await client.connect();
        const db = client.db("IIW2023A_Logs");
        const collection = db.collection("tb_cl_user_log_acess");
        const agora = new Date();
        const dataFormatada = agora.toISOString().split('T')[0];
        const horaFormatada = agora.toTimeString().split(' ')[0];
        const logEntry = { col_data: dataFormatada, col_hora: horaFormatada, col_IP: ip, col_nome_bot: nomeBot, col_acao: acao };
        await collection.insertOne(logEntry);
        res.status(201).json({ message: "Log de acesso registrado com sucesso." });
    } catch (error) {
        console.error("Erro ao registrar log de acesso:", error);
        res.status(500).json({ error: "Erro ao conectar ou inserir no banco de dados de logs." });
    } finally {
        if (client) await client.close();
    }
});

// ROTA PARA RANKING
app.post('/api/ranking/registrar-acesso-bot', (req, res) => {
    const { botId, nomeBot } = req.body;
    if (!botId || !nomeBot) return res.status(400).json({ error: "ID e Nome do Bot são obrigatórios." });
    
    const botExistente = dadosRankingVitrine.find(b => b.botId === botId);
    if (botExistente) {
        botExistente.contagem += 1;
        botExistente.ultimoAcesso = new Date();
    } else {
        dadosRankingVitrine.push({ botId, nomeBot, contagem: 1, ultimoAcesso: new Date() });
    }
    console.log('[Servidor] Dados de ranking atualizados:', dadosRankingVitrine);
    res.status(201).json({ message: `Acesso ao bot ${nomeBot} registrado.` });
});

// ROTA PARA SALVAR HISTÓRICO
app.post('/api/chat/save-history', async (req, res) => {
    const { history } = req.body;
    if (!history || !Array.isArray(history) || history.length === 0) return res.status(400).json({ error: 'Histórico inválido.' });
    
    const client = new MongoClient(MONGO_URI_HISTORY);
    try {
        await client.connect();
        const db = client.db("MeuChatbotHistory");
        const collection = db.collection("chat_histories");
        const historyEntry = { createdAt: new Date(), conversation: history };
        await collection.insertOne(historyEntry);
        res.status(201).json({ message: "Histórico salvo." });
    } catch (error) {
        console.error("Erro ao salvar histórico:", error);
        res.status(500).json({ error: "Erro ao salvar no banco de dados de histórico." });
    } finally {
        if (client) await client.close();
    }
});

// ROTA PARA LISTAR TODOS OS HISTÓRICOS SALVOS (SOMENTE PARA TESTE)
app.get('/api/chat/history', async (req, res) => {
    const client = new MongoClient(MONGO_URI_HISTORY);
    try {
        await client.connect();
        const db = client.db("MeuChatbotHistory");
        const collection = db.collection("chat_histories");
        const histories = await collection.find({}).toArray();
        res.json(histories);
    } catch (error) {
        console.error("Erro ao buscar históricos:", error);
        res.status(500).json({ error: "Erro ao buscar históricos." });
    } finally {
        if (client) await client.close();
    }
});

// ROTA PARA EXCLUIR HISTÓRICO
app.delete('/api/chat/historicos/:id', async (req, res) => {
    const { id } = req.params;
    const client = new MongoClient(MONGO_URI_HISTORY);
    try {
        await client.connect();
        const db = client.db("MeuChatbotHistory");
        const collection = db.collection("chat_histories");
        const { ObjectId } = require('mongodb');
        const result = await collection.findOneAndDelete({ _id: new ObjectId(id) });
        if (!result.value) {
            return res.status(404).json({ error: "Histórico não encontrado." });
        }
        res.status(200).json({ message: "Histórico excluído com sucesso." });
    } catch (error) {
        console.error("Erro ao excluir histórico:", error);
        if (error.name === 'CastError') {
            return res.status(400).json({ error: "ID inválido." });
        }
        res.status(500).json({ error: "Erro ao excluir histórico." });
    } finally {
        if (client) await client.close();
    }
});

// ROTA PARA GERAR TÍTULO INTELIGENTE
app.post('/api/chat/historicos/:id/gerar-titulo', async (req, res) => {
    const { id } = req.params;
    const client = new MongoClient(MONGO_URI_HISTORY);
    try {
        await client.connect();
        const db = client.db("MeuChatbotHistory");
        const collection = db.collection("chat_histories");
        const { ObjectId } = require('mongodb');
        const historico = await collection.findOne({ _id: new ObjectId(id) });
        
        if (!historico) {
            return res.status(404).json({ error: "Histórico não encontrado." });
        }

        const conversaFormatada = historico.conversation.map(msg => 
            `${msg.role === 'user' ? 'Usuário' : 'Bot'}: ${msg.text}`
        ).join('\n');

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        const prompt = `Baseado nesta conversa, sugira um título curto e conciso de no máximo 5 palavras:\n\n${conversaFormatada}`;
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const tituloSugerido = response.text().trim();

        res.status(200).json({ titulo: tituloSugerido });
    } catch (error) {
        console.error("Erro ao gerar título:", error);
        if (error.name === 'CastError') {
            return res.status(400).json({ error: "ID inválido." });
        }
        res.status(500).json({ error: "Erro ao gerar título." });
    } finally {
        if (client) await client.close();
    }
});

// ROTA PARA SALVAR TÍTULO
app.put('/api/chat/historicos/:id', async (req, res) => {
    const { id } = req.params;
    const { titulo } = req.body;
    
    if (!titulo || titulo.trim() === '') {
        return res.status(400).json({ error: "Título é obrigatório." });
    }

    const client = new MongoClient(MONGO_URI_HISTORY);
    try {
        await client.connect();
        const db = client.db("MeuChatbotHistory");
        const collection = db.collection("chat_histories");
        const { ObjectId } = require('mongodb');
        const result = await collection.findOneAndUpdate(
            { _id: new ObjectId(id) },
            { $set: { titulo: titulo.trim() } },
            { returnDocument: 'after' }
        );
        
        if (!result.value) {
            return res.status(404).json({ error: "Histórico não encontrado." });
        }
        
        res.status(200).json(result.value);
    } catch (error) { // ** A CHAVE QUE FALTAVA FOI ADICIONADA AQUI **
        console.error("Erro ao salvar título:", error);
        if (error.name === 'CastError') {
            return res.status(400).json({ error: "ID inválido." });
        }
        res.status(500).json({ error: "Erro ao salvar título." });
    } finally {
        if (client) await client.close();
    }
});

// ROTA PARA TESTAR SE VARIÁVEIS DE AMBIENTE ESTÃO OK
app.get('/api/test-env', (req, res) => {
    res.json({
        GEMINI_API_KEY: GEMINI_API_KEY ? '✅ RECEBIDA' : '❌ NÃO DEFINIDA',
        MONGO_URI_LOGS: MONGO_URI_LOGS ? '✅ RECEBIDA' : '❌ NÃO DEFINIDA',
        MONGO_URI_HISTORY: MONGO_URI_HISTORY ? '✅ RECEBIDA' : '❌ NÃO DEFINIDA',
        BUNDLE_URL_FRONTEND: BUNDLE_URL_FRONTEND || '❌ NÃO DEFINIDA',
        ADMIN_PASSWORD: ADMIN_PASSWORD ? '✅ DEFINIDA' : '❌ NÃO DEFINIDA'
    });
});

// 5. INICIALIZAÇÃO DO SERVIDOR
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
