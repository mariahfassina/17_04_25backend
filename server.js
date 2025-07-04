const express = require('express');
const cors = require('cors');

const app = express();

// CORS SUPER PERMISSIVO PARA TESTE
app.use(cors());

// Middleware para ver o que chega
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] Recebida requisição: ${req.method} ${req.url}`);
    next();
});

// Endpoint de teste de LOG
app.post('/api/log-acesso', (req, res) => {
    console.log('Endpoint /api/log-acesso chamado com sucesso!');
    res.status(200).json({ message: 'Log de teste recebido!' });
});

// Endpoint de teste de CHAT
app.post('/chat', (req, res) => {
    console.log('Endpoint /chat chamado com sucesso!');
    res.status(200).json({ response: 'Olá! O backend de teste está funcionando!' });
});

// Endpoint de teste de HISTÓRICO
app.post('/api/chat/save-history', (req, res) => {
    console.log('Endpoint /api/chat/save-history chamado com sucesso!');
    res.status(200).json({ message: 'Histórico de teste recebido!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`SERVIDOR DE TESTE rodando na porta ${PORT}. Sem MongoDB, sem Gemini.`);
});
