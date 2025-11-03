// Simulação de armazenamento de preferências de usuário em memória
// Chave: userId (simulado), Valor: { systemInstruction: string }

const userPreferences = {};

// Simulação de um ID de usuário logado (já que não há login real)
// Em um cenário estático, podemos usar um ID fixo para simular o "usuário logado"
const STATIC_USER_ID = "user_logged_in";

/**
 * Busca a instrução de sistema personalizada para o usuário.
 * @param {string} userId O ID do usuário.
 * @returns {string | undefined} A instrução personalizada ou undefined.
 */
function getCustomInstruction(userId) {
    return userPreferences[userId]?.systemInstruction;
}

/**
 * Salva a instrução de sistema personalizada para o usuário.
 * @param {string} userId O ID do usuário.
 * @param {string} instruction A nova instrução de sistema.
 * @returns {void}
 */
function saveCustomInstruction(userId, instruction) {
    userPreferences[userId] = { systemInstruction: instruction };
}

module.exports = {
    getCustomInstruction,
    saveCustomInstruction,
    STATIC_USER_ID
};
