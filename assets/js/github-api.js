// ==========================================
// GitHub API Wrapper for License Manager
// Komunikasi langsung ke GitHub REST API
// ==========================================

class GitHubAPI {
    constructor(token, owner, repo) {
        this.token = token;
        this.owner = owner;
        this.repo = repo;
        this.baseUrl = `https://api.github.com/repos/${owner}/${repo}`;
        this.headers = {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'User-Agent': 'License-Panel/2.0'
        };
        this.keyPrefix = 'LSKEY'; // default, auto-detected after loadData
    }

    // ===== Detect Key Prefix from Licenses =====
    detectKeyPrefix(licenses) {
        if (!licenses || !licenses.length) return;
        const firstKey = licenses[0].serial_key || '';
        const match = firstKey.match(/^([A-Z]+KEY)-/);
        if (match) {
            this.keyPrefix = match[1];
        }
    }

    // ===== Test Connection =====
    async testConnection() {
        try {
            const response = await fetch(`https://api.github.com/user`, {
                headers: this.headers
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const user = await response.json();

            // Test repo access
            const repoResponse = await fetch(this.baseUrl, {
                headers: this.headers
            });
            if (!repoResponse.ok) throw new Error(`Repo tidak ditemukan: ${repoResponse.status}`);

            return { success: true, user: user.login, avatar: user.avatar_url };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // ===== Read File from Repo =====
    async getFileContent(filePath) {
        const response = await fetch(`${this.baseUrl}/contents/${filePath}`, {
            headers: this.headers
        });

        if (!response.ok) {
            if (response.status === 404) {
                return { exists: false, content: null, sha: null };
            }
            throw new Error(`Gagal membaca ${filePath}: ${response.status}`);
        }

        const data = await response.json();
        const base64Content = data.content.replace(/[\r\n\s]/g, '');
        const decodedContent = decodeURIComponent(
            atob(base64Content).split('').map(c =>
                '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
            ).join('')
        );

        return {
            exists: true,
            content: JSON.parse(decodedContent),
            sha: data.sha
        };
    }

    // ===== Write File to Repo =====
    async saveFileContent(filePath, content, sha, commitMessage) {
        // Encode content to base64 (support UTF-8)
        const jsonString = JSON.stringify(content, null, 2);
        const encoder = new TextEncoder();
        const data = encoder.encode(jsonString);
        let binary = '';
        for (let i = 0; i < data.length; i++) {
            binary += String.fromCharCode(data[i]);
        }
        const base64Content = btoa(binary);

        const body = {
            message: commitMessage || `Update ${filePath}`,
            content: base64Content
        };

        if (sha) {
            body.sha = sha;
        }

        const response = await fetch(`${this.baseUrl}/contents/${filePath}`, {
            method: 'PUT',
            headers: this.headers,
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Gagal menyimpan ${filePath}: ${response.status} - ${errorData.message || ''}`);
        }

        return await response.json();
    }

    // ===== Get Licenses =====
    async getLicenses() {
        const result = await this.getFileContent('licenses.json');
        if (!result.exists) {
            // Buat file default jika belum ada
            const defaultData = { licenses: [], last_updated: this.formatTimestampWIB() };
            await this.saveFileContent('licenses.json', defaultData, null, 'Initialize licenses.json');
            return { content: defaultData, sha: null };
        }
        return result;
    }

    // ===== Get Activations =====
    async getActivations() {
        const result = await this.getFileContent('activations.json');
        if (!result.exists) {
            const defaultData = { activations: [], last_updated: this.formatTimestampWIB() };
            await this.saveFileContent('activations.json', defaultData, null, 'Initialize activations.json');
            return { content: defaultData, sha: null };
        }
        return result;
    }

    // ===== Save Licenses =====
    async saveLicenses(licensesData) {
        // Get fresh SHA to avoid conflicts
        const current = await this.getFileContent('licenses.json');
        licensesData.last_updated = this.formatTimestampWIB();
        return await this.saveFileContent(
            'licenses.json',
            licensesData,
            current.sha,
            `[Panel] Update licenses - ${this.formatTimestampWIB()}`
        );
    }

    // ===== Save Activations =====
    async saveActivations(activationsData) {
        const current = await this.getFileContent('activations.json');
        activationsData.last_updated = this.formatTimestampWIB();
        return await this.saveFileContent(
            'activations.json',
            activationsData,
            current.sha,
            `[Panel] Update activations - ${this.formatTimestampWIB()}`
        );
    }

    // ===== Generate Serial Key =====
    generateSerialKey() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const segment = () => {
            let result = '';
            for (let i = 0; i < 4; i++) {
                result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return result;
        };
        return `${this.keyPrefix}-${segment()}-${segment()}-${segment()}-${segment()}`;
    }

    // ===== Format Timestamp WIB =====
    formatTimestampWIB() {
        const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

        const now = new Date();
        const wibOffset = 7 * 60;
        const wibTime = new Date(now.getTime() + wibOffset * 60 * 1000);

        const day = String(wibTime.getUTCDate()).padStart(2, '0');
        const month = months[wibTime.getUTCMonth()];
        const year = wibTime.getUTCFullYear();
        const hours = String(wibTime.getUTCHours()).padStart(2, '0');
        const minutes = String(wibTime.getUTCMinutes()).padStart(2, '0');
        const seconds = String(wibTime.getUTCSeconds()).padStart(2, '0');

        return `${day} ${month} ${year} ${hours}:${minutes}:${seconds} WIB`;
    }
}

// Export for use in other files
window.GitHubAPI = GitHubAPI;
