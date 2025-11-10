const fs = require('fs');
const path = require('path');

// Define o caminho para o arquivo que irá armazenar as configurações
const preferencesFilePath = path.join(__dirname, 'preferences.json');
let userPreferences = {};

/**
 * Carrega as preferências do arquivo 'preferences.json'.
 * Se o arquivo não existir, ele o cria com uma personalidade padrão.
 */
const loadPreferences = () => {
  try {
    // Verifica se o arquivo de preferências já existe
    if (fs.existsSync(preferencesFilePath)) {
      const data = fs.readFileSync(preferencesFilePath, 'utf8');
      userPreferences = JSON.parse(data);
    } else {
      // Se não existir, define um valor padrão e cria o arquivo
      userPreferences = { personality: "Você é um assistente de IA prestativo e amigável." };
      fs.writeFileSync(preferencesFilePath, JSON.stringify(userPreferences, null, 2), 'utf8');
    }
  } catch (error) {
    console.error('Erro ao carregar o arquivo de preferências:', error);
    // Em caso de erro na leitura, usa um valor padrão para não quebrar a aplicação
    userPreferences = { personality: "Você é um assistente de IA prestativo e amigável." };
  }
};

/**
 * Salva o objeto 'userPreferences' atual no arquivo 'preferences.json'.
 */
const savePreferences = () => {
  try {
    // Escreve o objeto de preferências no arquivo, formatando o JSON para melhor leitura
    fs.writeFileSync(preferencesFilePath, JSON.stringify(userPreferences, null, 2), 'utf8');
  } catch (error) {
    console.error('Erro ao salvar o arquivo de preferências:', error);
  }
};

// Carrega as preferências assim que o módulo é iniciado
loadPreferences();

// Retorna as preferências atualmente em memória
const getPreferences = () => userPreferences;

/**
 * Atualiza as preferências com os novos dados e salva no arquivo.
 * @param {object} newPreferences - O novo objeto de preferências.
 * @returns {object} As preferências atualizadas.
 */
const updatePreferences = (newPreferences) => {
  // Mescla as preferências existentes com as novas
  userPreferences = { ...userPreferences, ...newPreferences };
  // Salva as alterações no arquivo para persistência
  savePreferences();
  return userPreferences;
};

// Exporta as funções para serem usadas em outros arquivos (como o server.js)
module.exports = {
  getPreferences,
  updatePreferences,
};
