const fs = require('fs');
const path = require('path');

const PREFERENCES_FILE = path.join(__dirname, 'preferences.json');

// Simulação de um ID de usuário logado (já que não há login real)
const STATIC_USER_ID = "user_logged_in";

let userPreferences = {};

/**
 * Carrega as preferências do arquivo JSON.
 */
function loadPreferences() {
    try {
        if (fs.existsSync(PREFERENCES_FILE)) {
            const data = fs.readFileSync(PREFERENCES_FILE, 'utf8');
            userPreferences = JSON.parse(data);
        } else {
            userPreferences = {};
        }
    } catch (error) {
        console.error("Erro ao carregar preferências:", error);
        userPreferences = {};
    }
}

/**
 * Salva as preferências no arquivo JSON.
 */
function savePreferences() {
    try {
        fs.writeFileSync(PREFERENCES_FILE, JSON.stringify(userPreferences, null, 2), 'utf8');
    } catch (error) {
        console.error("Erro ao salvar preferências:", error);
    }
}

// Carrega as preferências ao iniciar o módulo
loadPreferences();

/**
 * Busca a instrução de sistema personalizada para o usuário.
 * @param {string} userId O ID do usuário.
 * @returns {string | undefined} A instrução personalizada ou undefined.
 */
function getCustomInstruction(userId) {
    return userPreferences[userId]?.systemInstruction;
}

/**
 * Salva a instrução de sistema personalizada para o usuário e persiste no arquivo.
 * @param {string} userId O ID do usuário.
 * @param {string} instruction A nova instrução de sistema.
 * @returns {void}
 */
function saveCustomInstruction(userId, instruction) {
    userPreferences[userId] = { systemInstruction: instruction };
    savePreferences(); // Persiste a alteração
}

module.exports = {
    getCustomInstruction,
    saveCustomInstruction,
    STATIC_USER_ID
};
