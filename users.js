const fs = require('fs');
const path = require('path');

// Caminho para o arquivo que simula o banco de dados de usuários
const usersFilePath = path.join(__dirname, 'users.json');

// Instrução de sistema global padrão
const GLOBAL_INSTRUCTION = "Você é um assistente de IA focado em criar flashcards para estudos. Sempre que o usuário pedir um tema, crie uma pergunta (com o emoji ❓ no final) e, em uma nova linha, a resposta (com o emoji 💡 no final), mas esconda a resposta. Apenas indique que a resposta está pronta.";

let usersData = {};

/**
 * Carrega os dados dos usuários do arquivo 'users.json'.
 * Se o arquivo não existir, ele o cria com dados iniciais.
 */
const loadUsers = () => {
  try {
    if (fs.existsSync(usersFilePath)) {
      const data = fs.readFileSync(usersFilePath, 'utf8');
      usersData = JSON.parse(data);
    } else {
      // Dados iniciais para simular usuários logados (Cenários 1, 2 e 3)
      usersData = {
        "user123": { // Usuário 1 (para customização)
          id: "user123",
          username: "usuario_teste_1",
          systemInstruction: "" // Vazio para usar a global por padrão
        },
        "user456": { // Usuário 2 (para isolamento)
          id: "user456",
          username: "usuario_teste_2",
          systemInstruction: ""
        },
        "admin001": { // Usuário Admin (para a instrução global)
          id: "admin001",
          username: "admin",
          systemInstruction: GLOBAL_INSTRUCTION
        }
      };
      fs.writeFileSync(usersFilePath, JSON.stringify(usersData, null, 2), 'utf8');
    }
  } catch (error) {
    console.error('Erro ao carregar o arquivo de usuários:', error);
    usersData = {};
  }
};

/**
 * Salva o objeto 'usersData' atual no arquivo 'users.json'.
 */
const saveUsers = () => {
  try {
    fs.writeFileSync(usersFilePath, JSON.stringify(usersData, null, 2), 'utf8');
  } catch (error) {
    console.error('Erro ao salvar o arquivo de usuários:', error);
  }
};

// Carrega os dados dos usuários assim que o módulo é iniciado
loadUsers();

/**
 * Simula a busca de um usuário pelo ID.
 */
const findUserById = (userId) => {
  return usersData[userId] || null;
};

/**
 * Simula a atualização da instrução de sistema de um usuário.
 */
const updateUserInstruction = (userId, newInstruction) => {
  const user = findUserById(userId);
  if (user) {
    user.systemInstruction = newInstruction.trim();
    saveUsers();
    return user;
  }
  return null;
};

/**
 * Retorna a instrução de sistema global (do admin).
 */
const getGlobalInstruction = () => {
    const adminUser = findUserById("admin001");
    return adminUser ? adminUser.systemInstruction : GLOBAL_INSTRUCTION;
};

// Para fins de simulação de login, usaremos um ID fixo para o usuário logado
const LOGGED_IN_USER_ID = "user123"; 

module.exports = {
  findUserById,
  updateUserInstruction,
  getGlobalInstruction,
  LOGGED_IN_USER_ID
};
