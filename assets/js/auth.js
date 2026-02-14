// ==========================================
// Authentication Module
// Login/Logout dengan GitHub Personal Access Token
// ==========================================

const Auth = {
    api: null,
    userInfo: null,

    init() {
        const form = document.getElementById('login-form');
        form.addEventListener('submit', (e) => this.handleLogin(e));

        // Load saved config (bukan token - token tidak disimpan)
        const savedConfig = localStorage.getItem('lsp_config');
        if (savedConfig) {
            try {
                const config = JSON.parse(savedConfig);
                document.getElementById('github-owner').value = config.owner || 'defragtio';
                document.getElementById('github-repo').value = config.repo || 'ls-license';
                document.getElementById('remember-config').checked = true;
            } catch (e) { /* ignore */ }
        }

        // Cek session yang masih aktif
        const session = sessionStorage.getItem('lsp_session');
        if (session) {
            try {
                const sessionData = JSON.parse(session);
                this.api = new GitHubAPI(sessionData.token, sessionData.owner, sessionData.repo);
                this.userInfo = sessionData.userInfo;
                this.showPanel();
            } catch (e) {
                sessionStorage.removeItem('lsp_session');
            }
        }
    },

    async handleLogin(e) {
        e.preventDefault();

        const token = document.getElementById('github-token').value.trim();
        const owner = document.getElementById('github-owner').value.trim();
        const repo = document.getElementById('github-repo').value.trim();
        const remember = document.getElementById('remember-config').checked;
        const errorEl = document.getElementById('login-error');
        const btnText = document.querySelector('.btn-text');
        const btnLoading = document.querySelector('.btn-loading');
        const btnLogin = document.getElementById('btn-login');

        // Validasi
        if (!token || !owner || !repo) {
            this.showLoginError('Semua field wajib diisi.');
            return;
        }

        // Loading state
        btnText.style.display = 'none';
        btnLoading.style.display = 'inline';
        btnLogin.disabled = true;
        errorEl.style.display = 'none';

        try {
            // Test koneksi ke GitHub
            const api = new GitHubAPI(token, owner, repo);
            const result = await api.testConnection();

            if (!result.success) {
                throw new Error(`Koneksi gagal: ${result.error}`);
            }

            // Simpan ke session (akan hilang saat browser ditutup)
            this.api = api;
            this.userInfo = { login: result.user, avatar: result.avatar };

            sessionStorage.setItem('lsp_session', JSON.stringify({
                token: token,
                owner: owner,
                repo: repo,
                userInfo: this.userInfo
            }));

            // Simpan config repo (tanpa token) jika diminta
            if (remember) {
                localStorage.setItem('lsp_config', JSON.stringify({ owner, repo }));
            } else {
                localStorage.removeItem('lsp_config');
            }

            this.showPanel();

        } catch (error) {
            this.showLoginError(error.message);
        } finally {
            btnText.style.display = 'inline';
            btnLoading.style.display = 'none';
            btnLogin.disabled = false;
        }
    },

    showLoginError(message) {
        const errorEl = document.getElementById('login-error');
        errorEl.innerHTML = '<i class="fa fa-times-circle"></i> ' + message;
        errorEl.style.display = 'block';
    },

    showPanel() {
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('panel-container').style.display = 'flex';
        document.body.classList.remove('login-page');

        // Set user info di sidebar
        if (this.userInfo) {
            document.getElementById('sidebar-user').textContent = this.userInfo.login;
        }

        // Set repo info
        const session = JSON.parse(sessionStorage.getItem('lsp_session'));
        document.getElementById('info-repo').textContent = `${session.owner}/${session.repo}`;

        // Init panel
        if (typeof Panel !== 'undefined') {
            Panel.init(this.api);
        }
    },

    logout() {
        sessionStorage.removeItem('lsp_session');
        this.api = null;
        this.userInfo = null;
        
        document.getElementById('panel-container').style.display = 'none';
        document.getElementById('login-container').style.display = 'flex';
        document.body.classList.add('login-page');

        // Clear password field
        document.getElementById('github-token').value = '';
    }
};

// Init on DOM ready
document.addEventListener('DOMContentLoaded', () => Auth.init());
