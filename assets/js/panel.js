// ==========================================
// Panel Logic - License Manager
// Mengelola semua halaman dan interaksi
// ==========================================

const Panel = {
    api: null,
    licensesData: null,
    activationsData: null,
    currentPage: 'dashboard',

    // ===== Init =====
    init(api) {
        this.api = api;
        this.bindEvents();
        this.loadData();
    },

    // ===== Bind All Events =====
    bindEvents() {
        // Sidebar navigation
        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', () => {
                this.navigateTo(item.dataset.page);
            });
        });

        // Logout
        document.getElementById('btn-logout').addEventListener('click', () => {
            if (confirm('Yakin ingin logout?')) {
                Auth.logout();
            }
        });

        // Refresh
        document.getElementById('btn-refresh').addEventListener('click', () => {
            this.loadData();
        });

        // Mobile menu
        document.getElementById('mobile-menu-btn').addEventListener('click', () => {
            this.toggleSidebar();
        });

        // License search
        document.getElementById('license-search').addEventListener('input', (e) => {
            this.filterLicenses(e.target.value);
        });

        // Activation search
        document.getElementById('activation-search').addEventListener('input', (e) => {
            this.filterActivations(e.target.value, document.getElementById('activation-filter').value);
        });

        // Activation filter
        document.getElementById('activation-filter').addEventListener('change', (e) => {
            this.filterActivations(document.getElementById('activation-search').value, e.target.value);
        });

        // Add license button
        document.getElementById('btn-add-license').addEventListener('click', () => {
            this.showAddLicenseModal();
        });

        // Generate form
        document.getElementById('generate-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.generateKeys();
        });

        // Copy keys
        document.getElementById('btn-copy-keys').addEventListener('click', () => {
            this.copyGeneratedKeys();
        });

        // Modal close
        document.getElementById('modal-close').addEventListener('click', () => this.closeModal());
        document.getElementById('modal-overlay').addEventListener('click', (e) => {
            if (e.target === document.getElementById('modal-overlay')) this.closeModal();
        });

        // ESC to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeModal();
        });
    },

    // ===== Navigation =====
    navigateTo(page) {
        this.currentPage = page;

        // Update menu active state
        document.querySelectorAll('.menu-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === page);
        });

        // Show/hide pages
        document.querySelectorAll('.page').forEach(p => {
            p.style.display = 'none';
        });
        document.getElementById(`page-${page}`).style.display = 'block';

        // Update title
        const titles = {
            dashboard: 'Dashboard',
            licenses: 'License Keys',
            activations: 'Aktivasi',
            generate: 'Generate Key'
        };
        document.getElementById('page-title').textContent = titles[page] || page;

        // Close mobile sidebar
        document.querySelector('.sidebar').classList.remove('open');

        // Refresh data for specific pages
        if (page === 'licenses' && this.licensesData) {
            this.renderLicenses();
        }
        if (page === 'activations' && this.activationsData) {
            this.renderActivations();
        }
    },

    toggleSidebar() {
        const sidebar = document.querySelector('.sidebar');
        sidebar.classList.toggle('open');
    },

    // ===== Load Data =====
    async loadData() {
        const refreshBtn = document.getElementById('btn-refresh');
        refreshBtn.classList.add('spinning');

        try {
            // Load licenses and activations in parallel
            const [licensesResult, activationsResult] = await Promise.all([
                this.api.getLicenses(),
                this.api.getActivations()
            ]);

            this.licensesData = licensesResult.content;
            this.activationsData = activationsResult.content;

            // Render current page
            this.renderDashboard();
            if (this.currentPage === 'licenses') this.renderLicenses();
            if (this.currentPage === 'activations') this.renderActivations();

            this.updateConnectionStatus(true);
            this.showToast('Data berhasil dimuat', 'success');

        } catch (error) {
            console.error('Load data error:', error);
            this.updateConnectionStatus(false);
            this.showToast('Gagal memuat data: ' + error.message, 'error');
        } finally {
            refreshBtn.classList.remove('spinning');
        }
    },

    // ===== Render Dashboard =====
    renderDashboard() {
        if (!this.licensesData || !this.activationsData) return;

        const licenses = this.licensesData.licenses || [];
        const activations = this.activationsData.activations || [];

        const active = activations.filter(a => a.status === 'active');
        const replaced = activations.filter(a => a.status === 'replaced');
        const revoked = activations.filter(a => a.status === 'revoked');

        // Stats
        document.getElementById('stat-total-keys').textContent = licenses.length;
        document.getElementById('stat-active').textContent = active.length;
        document.getElementById('stat-replaced').textContent = replaced.length;
        document.getElementById('stat-revoked').textContent = revoked.length;

        // Info
        document.getElementById('info-last-updated').textContent = this.activationsData.last_updated || '-';
        document.getElementById('info-total-activations').textContent = activations.length;

        // Recent activations (top 5)
        const recentBody = document.getElementById('recent-activations');
        if (activations.length === 0) {
            recentBody.innerHTML = '<tr><td colspan="4" class="loading-cell">Belum ada data aktivasi</td></tr>';
            return;
        }

        const recent = activations.slice(0, 5);
        recentBody.innerHTML = recent.map(a => `
            <tr>
                <td><span class="serial-key">${this.truncateKey(a.serial_key)}</span></td>
                <td>${a.domain || '-'}</td>
                <td><span class="badge badge-${a.status}">${a.status}</span></td>
                <td>${a.activated_at || '-'}</td>
            </tr>
        `).join('');
    },

    // ===== Render Licenses =====
    renderLicenses() {
        if (!this.licensesData) return;

        const licenses = this.licensesData.licenses || [];
        const activations = this.activationsData?.activations || [];
        const tbody = document.getElementById('licenses-body');

        if (licenses.length === 0) {
            tbody.innerHTML = `
                <tr><td colspan="7">
                    <div class="empty-state">
                        <div class="empty-state-icon"><i class="fa fa-key"></i></div>
                        <div class="empty-state-text">Belum ada license key. Klik "Tambah License" atau "Generate Key".</div>
                    </div>
                </td></tr>`;
            return;
        }

        tbody.innerHTML = licenses.map((lic, idx) => {
            // Cari SEMUA aktivasi aktif untuk key ini (multi-domain support)
            const activeList = activations.filter(a => a.serial_key === lic.serial_key && a.status === 'active');
            const maxD = lic.max_domains || 1;
            const allowMulti = lic.allow_multiple_domains === true;

            let statusHtml;
            if (activeList.length === 0) {
                statusHtml = '<span class="badge badge-revoked">Tidak Aktif</span>';
            } else if (allowMulti && maxD > 1) {
                const domainNames = activeList.map(a => a.domain).join(', ');
                statusHtml = `<span class="badge badge-active" title="${domainNames}">${activeList.length}/${maxD} domain aktif</span>`;
            } else {
                statusHtml = `<span class="badge badge-active">Aktif: ${activeList[0].domain}</span>`;
            }

            return `
                <tr data-key="${lic.serial_key}">
                    <td>${idx + 1}</td>
                    <td><span class="serial-key">${lic.serial_key}</span></td>
                    <td>${maxD > 1 ? maxD + ' domain' : 'Single'}</td>
                    <td>${lic.issued_date || lic.created_at || '-'}</td>
                    <td>${lic.notes || lic.note || '-'}</td>
                    <td>${statusHtml}</td>
                    <td>
                        <div class="action-btns">
                            <button class="btn btn-sm btn-secondary" onclick="Panel.showLicenseDetail('${lic.serial_key}')" title="Detail"><i class="fa fa-eye"></i></button>
                            <button class="btn btn-sm btn-primary" onclick="Panel.showEditLicenseModal('${lic.serial_key}')" title="Edit"><i class="fa fa-edit"></i></button>
                            <button class="btn btn-sm btn-danger" onclick="Panel.confirmDeleteLicense('${lic.serial_key}')" title="Hapus"><i class="fa fa-trash"></i></button>
                        </div>
                    </td>
                </tr>`;
        }).join('');
    },

    // ===== Filter Licenses =====
    filterLicenses(query) {
        const q = query.toLowerCase();
        document.querySelectorAll('#licenses-body tr').forEach(row => {
            const key = row.dataset.key || '';
            const text = row.textContent.toLowerCase();
            row.style.display = (text.includes(q) || key.toLowerCase().includes(q)) ? '' : 'none';
        });
    },

    // ===== Render Activations =====
    renderActivations() {
        if (!this.activationsData) return;

        const activations = this.activationsData.activations || [];
        const tbody = document.getElementById('activations-body');

        if (activations.length === 0) {
            tbody.innerHTML = `
                <tr><td colspan="9">
                    <div class="empty-state">
                        <div class="empty-state-icon"><i class="fa fa-check-circle"></i></div>
                        <div class="empty-state-text">Belum ada riwayat aktivasi.</div>
                    </div>
                </td></tr>`;
            return;
        }

        tbody.innerHTML = activations.map((a, idx) => {
            const actionBtn = a.status === 'active'
                ? `<button class="btn btn-sm btn-danger" onclick="Panel.confirmRevoke('${a.serial_key}', '${a.domain}')" title="Cabut"><i class="fa fa-ban"></i> Cabut</button>`
                : '-';

            return `
                <tr data-key="${a.serial_key}" data-status="${a.status}" data-domain="${a.domain || ''}">
                    <td>${idx + 1}</td>
                    <td><span class="serial-key">${this.truncateKey(a.serial_key)}</span></td>
                    <td>${a.domain || '-'}</td>
                    <td><span class="badge badge-${a.status}">${a.status}</span></td>
                    <td><span class="hw-id" title="${a.hardware_id || ''}">${(a.hardware_id || '-').substring(0, 12)}...</span></td>
                    <td>${a.ip_address || '-'}</td>
                    <td>${a.server_software || '-'}</td>
                    <td>${a.last_validated || '-'}</td>
                    <td>
                        <div class="action-btns">
                            <button class="btn btn-sm btn-secondary" onclick="Panel.showActivationDetail(${idx})" title="Detail"><i class="fa fa-eye"></i></button>
                            ${actionBtn}
                        </div>
                    </td>
                </tr>`;
        }).join('');
    },

    // ===== Filter Activations =====
    filterActivations(query, statusFilter) {
        const q = (query || '').toLowerCase();
        const filter = statusFilter || 'all';

        document.querySelectorAll('#activations-body tr').forEach(row => {
            const key = (row.dataset.key || '').toLowerCase();
            const domain = (row.dataset.domain || '').toLowerCase();
            const status = row.dataset.status || '';
            const text = row.textContent.toLowerCase();

            const matchSearch = !q || text.includes(q) || key.includes(q) || domain.includes(q);
            const matchFilter = filter === 'all' || status === filter;

            row.style.display = (matchSearch && matchFilter) ? '' : 'none';
        });
    },

    // ===== Show Add License Modal =====
    showAddLicenseModal() {
        const modalBody = document.getElementById('modal-body');
        const modalFooter = document.getElementById('modal-footer');

        document.getElementById('modal-title').innerHTML = '<i class="fa fa-plus"></i> Tambah License Key';

        modalBody.innerHTML = `
            <div class="form-group">
                <label>Serial Key</label>
                <div style="display:flex; gap:8px;">
                    <input type="text" id="add-serial-key" class="form-control" placeholder="LSKEY-XXXX-XXXX-XXXX-XXXX" 
                           pattern="^LSKEY-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$" style="flex:1;">
                    <button type="button" class="btn btn-secondary" onclick="document.getElementById('add-serial-key').value = Panel.api.generateSerialKey();"><i class="fa fa-dice"></i> Auto</button>
                </div>
            </div>
            <div class="form-group">
                <label>Max Domain</label>
                <input type="number" id="add-max-domains" value="1" min="1" class="form-control" placeholder="1 = single, lebih dari 1 = multi-domain">
            </div>
            <div class="form-group">
                <label>Catatan (opsional)</label>
                <input type="text" id="add-note" class="form-control" placeholder="Catatan untuk license ini...">
            </div>
        `;

        modalFooter.innerHTML = `
            <button class="btn btn-secondary" onclick="Panel.closeModal()">Batal</button>
            <button class="btn btn-primary" onclick="Panel.addLicense()"><i class="fa fa-save"></i> Simpan</button>
        `;

        this.openModal();
    },

    // ===== Add License =====
    async addLicense() {
        const serialKey = document.getElementById('add-serial-key').value.trim().toUpperCase();
        const note = document.getElementById('add-note').value.trim();

        // Validasi format
        if (!/^LSKEY-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(serialKey)) {
            this.showToast('Format serial key tidak valid! Harus: LSKEY-XXXX-XXXX-XXXX-XXXX', 'error');
            return;
        }

        // Cek duplikat
        if (this.licensesData.licenses.find(l => l.serial_key === serialKey)) {
            this.showToast('Serial key sudah ada!', 'error');
            return;
        }

        try {
            const maxDomains = parseInt(document.getElementById('add-max-domains')?.value || '1');
            const newLicense = {
                serial_key: serialKey,
                type: 'lifetime',
                issued_date: this.api.formatTimestampWIB(),
                max_domains: maxDomains,
                allow_multiple_domains: maxDomains > 1,
                notes: note || `Lifetime license - ${maxDomains > 1 ? maxDomains + ' domains allowed' : '1 domain only'} - Belum ada domain terhubung`
            };

            this.licensesData.licenses.push(newLicense);
            await this.api.saveLicenses(this.licensesData);

            this.closeModal();
            this.showToast(`License ${serialKey} berhasil ditambahkan!`, 'success');
            this.renderDashboard();
            this.renderLicenses();

        } catch (error) {
            this.showToast('Gagal menyimpan: ' + error.message, 'error');
        }
    },

    // ===== Show Edit License Modal =====
    showEditLicenseModal(serialKey) {
        const license = this.licensesData.licenses.find(l => l.serial_key === serialKey);
        if (!license) return;

        document.getElementById('modal-title').innerHTML = '<i class="fa fa-edit"></i> Edit License';
        const modalBody = document.getElementById('modal-body');
        const modalFooter = document.getElementById('modal-footer');

        modalBody.innerHTML = `
            <div class="form-group">
                <label>Serial Key</label>
                <input type="text" class="form-control" value="${license.serial_key}" disabled style="background:#f5f5f5;">
            </div>
            <div class="form-group">
                <label>Max Domain</label>
                <input type="number" id="edit-max-domains" value="${license.max_domains || 1}" min="1" class="form-control" placeholder="1 = single, lebih dari 1 = multi-domain">
            </div>
            <div class="form-group">
                <label>Catatan</label>
                <input type="text" id="edit-note" class="form-control" value="${license.notes || ''}" placeholder="Catatan untuk license ini...">
            </div>
        `;

        modalFooter.innerHTML = `
            <button class="btn btn-secondary" onclick="Panel.closeModal()">Batal</button>
            <button class="btn btn-primary" onclick="Panel.editLicense('${serialKey}')"><i class="fa fa-save"></i> Simpan</button>
        `;

        this.openModal();
    },

    // ===== Edit License =====
    async editLicense(serialKey) {
        try {
            const licIdx = this.licensesData.licenses.findIndex(l => l.serial_key === serialKey);
            if (licIdx === -1) {
                this.showToast('License tidak ditemukan!', 'error');
                return;
            }

            const maxDomains = parseInt(document.getElementById('edit-max-domains').value) || 1;
            const note = document.getElementById('edit-note').value.trim();

            this.licensesData.licenses[licIdx].type = 'lifetime';
            this.licensesData.licenses[licIdx].max_domains = maxDomains;
            this.licensesData.licenses[licIdx].allow_multiple_domains = maxDomains > 1;
            if (note) {
                this.licensesData.licenses[licIdx].notes = note;
            }

            await this.api.saveLicenses(this.licensesData);

            this.closeModal();
            this.showToast(`License ${serialKey} berhasil diperbarui!`, 'success');
            this.renderDashboard();
            this.renderLicenses();

        } catch (error) {
            this.showToast('Gagal menyimpan: ' + error.message, 'error');
        }
    },

    // ===== Show License Detail =====
    showLicenseDetail(serialKey) {
        const license = this.licensesData.licenses.find(l => l.serial_key === serialKey);
        if (!license) return;

        const activeList = (this.activationsData?.activations || []).filter(
            a => a.serial_key === serialKey && a.status === 'active'
        );
        const maxD = license.max_domains || 1;
        const allowMulti = license.allow_multiple_domains === true;

        document.getElementById('modal-title').innerHTML = '<i class="fa fa-key"></i> Detail License';

        let html = `
            <div class="detail-grid">
                <span class="detail-label">Serial Key</span>
                <span class="detail-value serial-key">${license.serial_key}</span>
                
                <span class="detail-label">Tipe</span>
                <span class="detail-value"><span class="badge badge-active">Lifetime</span></span>
                
                <span class="detail-label">Dibuat</span>
                <span class="detail-value">${license.issued_date || license.created_at || '-'}</span>
                
                <span class="detail-label">Max Domain</span>
                <span class="detail-value">${maxD} domain ${allowMulti ? '(multi-domain aktif)' : '(single domain)'}</span>
                
                <span class="detail-label">Domain Aktif</span>
                <span class="detail-value">${activeList.length} / ${maxD}</span>
                
                <span class="detail-label">Catatan</span>
                <span class="detail-value">${license.notes || license.note || '-'}</span>
            </div>
        `;

        if (activeList.length > 0) {
            html += `
                <hr style="margin: 16px 0; border: none; border-top: 1px solid #eee;">
                <h4 style="margin-bottom: 12px;"><i class="fa fa-check-circle" style="color:var(--success)"></i> Aktivasi Aktif (${activeList.length}/${maxD})</h4>
            `;
            activeList.forEach((activation, i) => {
                html += `
                <div style="${i > 0 ? 'margin-top:16px; padding-top:12px; border-top:1px dashed #ddd;' : ''}">
                    <strong style="color: var(--primary);">${i + 1}. ${activation.domain}</strong>
                    <div class="detail-grid" style="margin-top:8px;">
                        <span class="detail-label">Hardware ID</span>
                        <span class="detail-value" style="font-size:11px; font-family:monospace;">${activation.hardware_id || '-'}</span>
                        
                        <span class="detail-label">IP Address</span>
                        <span class="detail-value">${activation.ip_address || '-'}</span>

                        <span class="detail-label">PHP Version</span>
                        <span class="detail-value">${activation.php_version || '-'}</span>

                        <span class="detail-label">CI Version</span>
                        <span class="detail-value">${activation.ci_version || '-'}</span>
                        
                        <span class="detail-label">Server</span>
                        <span class="detail-value">${activation.server_software || '-'}</span>
                        
                        <span class="detail-label">Diaktifkan</span>
                        <span class="detail-value">${activation.activated_at || '-'}</span>
                        
                        <span class="detail-label">Terakhir Validasi</span>
                        <span class="detail-value">${activation.last_validated || '-'}</span>
                    </div>
                </div>
                `;
            });
        } else {
            html += `<p style="margin-top:16px; color:#999; font-style:italic;">License ini belum diaktifkan pada domain manapun.</p>`;
        }

        document.getElementById('modal-body').innerHTML = html;
        document.getElementById('modal-footer').innerHTML = `
            <button class="btn btn-secondary" onclick="Panel.closeModal()">Tutup</button>
        `;

        this.openModal();
    },

    // ===== Show Activation Detail =====
    showActivationDetail(index) {
        const a = this.activationsData.activations[index];
        if (!a) return;

        document.getElementById('modal-title').innerHTML = '<i class="fa fa-list"></i> Detail Aktivasi';

        let html = `
            <div class="detail-grid">
                <span class="detail-label">Serial Key</span>
                <span class="detail-value serial-key">${a.serial_key}</span>
                
                <span class="detail-label">Domain</span>
                <span class="detail-value">${a.domain || '-'}</span>
                
                <span class="detail-label">Status</span>
                <span class="detail-value"><span class="badge badge-${a.status}">${a.status}</span></span>
                
                <span class="detail-label">Hardware ID</span>
                <span class="detail-value" style="font-size:11px; font-family:monospace;">${a.hardware_id || '-'}</span>
                
                <span class="detail-label">IP Address</span>
                <span class="detail-value">${a.ip_address || '-'}</span>
                
                <span class="detail-label">PHP Version</span>
                <span class="detail-value">${a.php_version || '-'}</span>
                
                <span class="detail-label">CI Version</span>
                <span class="detail-value">${a.ci_version || '-'}</span>
                
                <span class="detail-label">Server Software</span>
                <span class="detail-value">${a.server_software || '-'}</span>
                
                <span class="detail-label">Diaktifkan</span>
                <span class="detail-value">${a.activated_at || '-'}</span>
                
                <span class="detail-label">Terakhir Validasi</span>
                <span class="detail-value">${a.last_validated || '-'}</span>
            </div>
        `;

        // Info deaktivasi/revokasi
        if (a.deactivation) {
            html += `
                <hr style="margin: 16px 0; border: none; border-top: 1px solid #eee;">
                <h4 style="margin-bottom: 12px; color: var(--warning);"><i class="fa fa-exchange-alt"></i> Info Penggantian</h4>
                <div class="detail-grid">
                    <span class="detail-label">Diganti Pada</span>
                    <span class="detail-value">${a.deactivation.deactivated_at || '-'}</span>
                    <span class="detail-label">Alasan</span>
                    <span class="detail-value">${a.deactivation.reason || '-'}</span>
                </div>
            `;
        }

        if (a.revocation) {
            html += `
                <hr style="margin: 16px 0; border: none; border-top: 1px solid #eee;">
                <h4 style="margin-bottom: 12px; color: var(--danger);"><i class="fa fa-ban"></i> Info Pencabutan</h4>
                <div class="detail-grid">
                    <span class="detail-label">Dicabut Pada</span>
                    <span class="detail-value">${a.revocation.revoked_at || '-'}</span>
                    <span class="detail-label">Alasan</span>
                    <span class="detail-value">${a.revocation.reason || '-'}</span>
                    <span class="detail-label">Oleh</span>
                    <span class="detail-value">${a.revocation.by || '-'}</span>
                </div>
            `;
        }

        document.getElementById('modal-body').innerHTML = html;
        document.getElementById('modal-footer').innerHTML = `
            <button class="btn btn-secondary" onclick="Panel.closeModal()">Tutup</button>
        `;

        this.openModal();
    },

    // ===== Confirm Delete License =====
    confirmDeleteLicense(serialKey) {
        document.getElementById('modal-title').innerHTML = '<i class="fa fa-exclamation-triangle" style="color:var(--warning)"></i> Konfirmasi Hapus';

        document.getElementById('modal-body').innerHTML = `
            <p>Yakin ingin menghapus license key ini?</p>
            <p style="margin-top:8px;"><strong class="serial-key" style="color:var(--danger);">${serialKey}</strong></p>
            <p style="margin-top:12px; font-size:13px; color:var(--text-muted);">
                Tindakan ini akan menghapus key dari daftar license. 
                Aktivasi yang sudah ada tidak akan dihapus dari riwayat.
            </p>
        `;

        document.getElementById('modal-footer').innerHTML = `
            <button class="btn btn-secondary" onclick="Panel.closeModal()">Batal</button>
            <button class="btn btn-danger" onclick="Panel.deleteLicense('${serialKey}')"><i class="fa fa-trash"></i> Hapus</button>
        `;

        this.openModal();
    },

    // ===== Delete License =====
    async deleteLicense(serialKey) {
        try {
            this.licensesData.licenses = this.licensesData.licenses.filter(l => l.serial_key !== serialKey);
            await this.api.saveLicenses(this.licensesData);

            this.closeModal();
            this.showToast(`License ${serialKey} berhasil dihapus!`, 'success');
            this.renderDashboard();
            this.renderLicenses();

        } catch (error) {
            this.showToast('Gagal menghapus: ' + error.message, 'error');
        }
    },

    // ===== Confirm Revoke Activation =====
    confirmRevoke(serialKey, domain) {
        document.getElementById('modal-title').innerHTML = '<i class="fa fa-ban"></i> Cabut Aktivasi';

        document.getElementById('modal-body').innerHTML = `
            <p>Yakin ingin mencabut aktivasi license ini?</p>
            <div class="detail-grid" style="margin-top:12px;">
                <span class="detail-label">Serial Key</span>
                <span class="detail-value serial-key">${serialKey}</span>
                <span class="detail-label">Domain</span>
                <span class="detail-value">${domain}</span>
            </div>
            <div class="form-group" style="margin-top:16px;">
                <label>Alasan pencabutan (opsional)</label>
                <input type="text" id="revoke-reason" class="form-control" placeholder="Contoh: Masa berlaku habis">
            </div>
            <p style="font-size:13px; color:var(--text-muted);">
                Setelah dicabut, domain tersebut akan diarahkan ke halaman aktivasi ulang dalam waktu kurang dari 5 menit.
            </p>
        `;

        document.getElementById('modal-footer').innerHTML = `
            <button class="btn btn-secondary" onclick="Panel.closeModal()">Batal</button>
            <button class="btn btn-danger" onclick="Panel.revokeActivation('${serialKey}', '${domain}')"><i class="fa fa-ban"></i> Cabut Aktivasi</button>
        `;

        this.openModal();
    },

    // ===== Revoke Activation =====
    async revokeActivation(serialKey, targetDomain) {
        try {
            const reason = document.getElementById('revoke-reason')?.value || 'Dicabut oleh admin via Panel';

            // Multi-domain safe: match by serial_key + domain + status
            const idx = this.activationsData.activations.findIndex(
                a => a.serial_key === serialKey && a.status === 'active' &&
                     (!targetDomain || a.domain === targetDomain)
            );

            if (idx === -1) {
                this.showToast('Aktivasi tidak ditemukan!', 'error');
                return;
            }

            const domain = this.activationsData.activations[idx].domain;

            this.activationsData.activations[idx].status = 'revoked';
            this.activationsData.activations[idx].revocation = {
                revoked_at: this.api.formatTimestampWIB(),
                reason: reason,
                by: 'admin-panel'
            };

            await this.api.saveActivations(this.activationsData);

            // Update notes in licenses.json
            await this.updateLicenseNotesLocal(serialKey);

            this.closeModal();
            this.showToast(`Aktivasi pada ${domain} berhasil dicabut!`, 'success');
            this.renderDashboard();
            this.renderActivations();

        } catch (error) {
            this.showToast('Gagal mencabut: ' + error.message, 'error');
        }
    },

    // ===== Update License Notes (after revoke/manual changes) =====
    async updateLicenseNotesLocal(serialKey) {
        try {
            const licIdx = this.licensesData.licenses.findIndex(l => l.serial_key === serialKey);
            if (licIdx === -1) return;

            const lic = this.licensesData.licenses[licIdx];
            const maxD = lic.max_domains || 1;
            const activeDomains = (this.activationsData?.activations || [])
                .filter(a => a.serial_key === serialKey && a.status === 'active')
                .map(a => a.domain);

            if (activeDomains.length > 0) {
                lic.notes = `${activeDomains.length}/${maxD} domain aktif: ${activeDomains.join(', ')}`;
            } else {
                const typeLabel = lic.allow_multiple_domains
                    ? `${maxD} domains allowed`
                    : '1 domain only';
                lic.notes = `Lifetime license - ${typeLabel} - Belum ada domain terhubung`;
            }

            this.licensesData.licenses[licIdx] = lic;
            this.licensesData.last_updated = this.api.formatTimestampWIB();
            await this.api.saveLicenses(this.licensesData);
        } catch (e) {
            console.error('Failed to update license notes:', e);
        }
    },

    // ===== Generate Keys =====
    async generateKeys() {
        const count = parseInt(document.getElementById('gen-count').value) || 1;
        const note = document.getElementById('gen-note').value.trim();

        if (count < 1 || count > 20) {
            this.showToast('Jumlah key harus antara 1-20', 'error');
            return;
        }

        const generatedKeys = [];
        const existingKeys = new Set(this.licensesData.licenses.map(l => l.serial_key));

        for (let i = 0; i < count; i++) {
            let newKey;
            do {
                newKey = this.api.generateSerialKey();
            } while (existingKeys.has(newKey));

            existingKeys.add(newKey);
            generatedKeys.push(newKey);

            const maxDomains = parseInt(document.getElementById('gen-max-domains')?.value || '1');
            this.licensesData.licenses.push({
                serial_key: newKey,
                type: 'lifetime',
                issued_date: this.api.formatTimestampWIB(),
                max_domains: maxDomains,
                allow_multiple_domains: maxDomains > 1,
                notes: note || `Lifetime license - ${maxDomains > 1 ? maxDomains + ' domains allowed' : '1 domain only'} - Belum ada domain terhubung`
            });
        }

        try {
            await this.api.saveLicenses(this.licensesData);

            // Tampilkan hasil
            const container = document.getElementById('generated-keys');
            container.innerHTML = generatedKeys.map(key => `
                <div class="generated-key-item">
                    <span class="key-text">${key}</span>
                    <button class="copy-btn" onclick="Panel.copyToClipboard('${key}', this)" title="Salin"><i class="fa fa-copy"></i></button>
                </div>
            `).join('');

            document.getElementById('btn-copy-keys').style.display = 'block';
            document.getElementById('btn-copy-keys').dataset.keys = generatedKeys.join('\n');

            this.showToast(`${count} key berhasil dibuat dan disimpan ke GitHub!`, 'success');
            this.renderDashboard();

        } catch (error) {
            // Rollback yang sudah ditambahkan
            this.licensesData.licenses = this.licensesData.licenses.filter(
                l => !generatedKeys.includes(l.serial_key)
            );
            this.showToast('Gagal menyimpan: ' + error.message, 'error');
        }
    },

    // ===== Copy to Clipboard =====
    async copyToClipboard(text, btnElement) {
        try {
            await navigator.clipboard.writeText(text);
            if (btnElement) {
                btnElement.innerHTML = '<i class="fa fa-check" style="color:var(--success)"></i>';
                setTimeout(() => btnElement.innerHTML = '<i class="fa fa-copy"></i>', 1500);
            }
            this.showToast('Disalin ke clipboard!', 'success');
        } catch (e) {
            // Fallback
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            this.showToast('Disalin ke clipboard!', 'success');
        }
    },

    copyGeneratedKeys() {
        const keys = document.getElementById('btn-copy-keys').dataset.keys;
        this.copyToClipboard(keys);
    },

    // ===== Modal =====
    openModal() {
        document.getElementById('modal-overlay').style.display = 'flex';
    },

    closeModal() {
        document.getElementById('modal-overlay').style.display = 'none';
    },

    // ===== Toast Notifications =====
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const icons = { success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span><i class="fa ${icons[type] || 'fa-info-circle'}"></i> ${message}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
        `;

        container.appendChild(toast);

        // Auto remove after 4 seconds
        setTimeout(() => {
            if (toast.parentElement) {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(100%)';
                toast.style.transition = 'all 0.3s ease';
                setTimeout(() => toast.remove(), 300);
            }
        }, 4000);
    },

    // ===== Helpers =====
    truncateKey(key) {
        if (!key) return '-';
        if (key.length <= 20) return key;
        return key;
    },

    updateConnectionStatus(online) {
        const dot = document.querySelector('.status-dot');
        const text = document.querySelector('.status-text');

        if (online) {
            dot.className = 'status-dot online';
            text.textContent = 'Terhubung ke GitHub';
        } else {
            dot.className = 'status-dot offline';
            text.textContent = 'Koneksi terputus';
        }
    }
};

// Make Panel globally accessible
window.Panel = Panel;
