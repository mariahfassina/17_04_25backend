// admin.js (Versão final corrigida )

document.addEventListener('DOMContentLoaded', () => {
    // Seleciona todos os elementos do HTML pelos IDs corretos
    const loginContainer = document.getElementById('login-container');
    const adminPanel = document.getElementById('admin-panel');
    const passwordInput = document.getElementById('password-input');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const saveInstructionBtn = document.getElementById('save-instruction-btn');

    // URL ATUALIZADA do seu backend no Render.com
    const API_BASE_URL = 'https://one7-04-25backend.onrender.com';

    // --- Funções Principais ---

    const checkLogin = ( ) => {
        const storedPassword = sessionStorage.getItem('adminPassword');
        if (storedPassword) {
            showAdminPanel(storedPassword);
        } else {
            showLogin();
        }
    };

    const showLogin = () => {
        loginContainer.classList.remove('hidden');
        adminPanel.classList.add('hidden');
    };

    const showAdminPanel = (password) => {
        loginContainer.classList.add('hidden');
        adminPanel.classList.remove('hidden');
        fetchAdminData(password);
        fetchSystemInstruction(password);
    };

    const handleLogin = () => {
        const password = passwordInput.value;
        if (!password) {
            alert('Por favor, insira a senha.');
            return;
        }
        sessionStorage.setItem('adminPassword', password);
        showAdminPanel(password);
    };

    const handleLogout = () => {
        sessionStorage.removeItem('adminPassword');
        passwordInput.value = '';
        showLogin();
    };

    // --- Funções de Comunicação com a API ---

    const fetchAdminData = async (password) => {
        try {
            // Note o cabeçalho 'x-admin-password' que o backend espera
            const response = await fetch(`${API_BASE_URL}/api/admin/stats`, {
                headers: { 'x-admin-password': password }
            });

            if (response.status === 403) {
                alert('Senha incorreta. Acesso negado.');
                handleLogout();
                return;
            }
            if (!response.ok) {
                throw new Error('Falha ao buscar dados do servidor.');
            }

            const data = await response.json();
            document.getElementById('total-conversas').innerText = data.totalConversas;
            
            const conversasList = document.getElementById('ultimas-conversas');
            conversasList.innerHTML = '';
            if (data.ultimasConversas && data.ultimasConversas.length > 0) {
                data.ultimasConversas.forEach(conversa => {
                    const li = document.createElement('li');
                    const date = new Date(conversa.createdAt).toLocaleString('pt-BR');
                    li.textContent = `${conversa.title} - ${date}`;
                    conversasList.appendChild(li);
                });
            } else {
                conversasList.innerHTML = '<li>Nenhuma conversa encontrada.</li>';
            }
        } catch (error) {
            console.error('Erro ao carregar métricas:', error);
            alert('Não foi possível carregar as métricas. Verifique o console para detalhes.');
        }
    };

    const fetchSystemInstruction = async (password) => {
        const instructionTextarea = document.getElementById('system-instruction-input');
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/system-instruction`, {
                headers: { 'x-admin-password': password }
            });
            if (!response.ok) throw new Error('Falha ao buscar instrução.');
            const data = await response.json();
            instructionTextarea.value = data.instruction;
        } catch (error) {
            console.error('Erro ao carregar instrução:', error);
            instructionTextarea.value = 'Erro ao carregar a instrução do sistema.';
        }
    };

    const saveSystemInstruction = async () => {
        const password = sessionStorage.getItem('adminPassword');
        const newInstruction = document.getElementById('system-instruction-input').value;
        const saveStatus = document.getElementById('save-status');
        
        saveInstructionBtn.disabled = true;
        saveStatus.textContent = 'Salvando...';
        saveStatus.className = 'status-saving';

        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/system-instruction`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-password': password
                },
                body: JSON.stringify({ newInstruction }) // O backend espera 'newInstruction'
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Erro desconhecido ao salvar.');

            saveStatus.textContent = data.message;
            saveStatus.className = 'status-success';
        } catch (error) {
            saveStatus.textContent = `Erro: ${error.message}`;
            saveStatus.className = 'status-error';
        } finally {
            saveInstructionBtn.disabled = false;
            setTimeout(() => { saveStatus.textContent = ''; }, 4000);
        }
    };

    // --- Adicionando os "Ouvintes de Evento" ---
    // Isso garante que os botões funcionem sem `onclick` no HTML
    
    // Verifica se os elementos existem antes de adicionar o listener
    if (loginBtn) {
        loginBtn.addEventListener('click', handleLogin);
    }
    if (passwordInput) {
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleLogin();
        });
    }
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    if (saveInstructionBtn) {
        saveInstructionBtn.addEventListener('click', saveSystemInstruction);
    }

    // Inicia a verificação de login assim que a página carrega
    checkLogin();
});
