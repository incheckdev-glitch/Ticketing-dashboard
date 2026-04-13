const Clients = {
  state: {
    rows: [],
    loading: false,
    loadError: ''
  },
  extractRows(response) {
    const candidates = [
      response,
      response?.clients,
      response?.items,
      response?.rows,
      response?.data,
      response?.result,
      response?.payload,
      response?.data?.clients,
      response?.result?.clients,
      response?.payload?.clients
    ];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return candidate;
    }
    return [];
  },
  normalizeClient(raw = {}) {
    return {
      client_id: String(raw.client_id || raw.clientId || raw.id || '').trim(),
      customer_name: String(raw.customer_name || raw.customerName || '').trim(),
      customer_legal_name: String(raw.customer_legal_name || raw.customerLegalName || '').trim(),
      customer_contact_name: String(raw.customer_contact_name || raw.customerContactName || '').trim(),
      customer_contact_email: String(raw.customer_contact_email || raw.customerContactEmail || '').trim(),
      account_status: String(raw.account_status || raw.accountStatus || '').trim(),
      contract_term: String(raw.contract_term || raw.contractTerm || '').trim(),
      billing_frequency: String(raw.billing_frequency || raw.billingFrequency || '').trim(),
      currency: String(raw.currency || '').trim(),
      latest_signed_date: String(raw.latest_signed_date || raw.latestSignedDate || '').trim(),
      total_signed_value: raw.total_signed_value ?? raw.totalSignedValue ?? ''
    };
  },
  async listClients() {
    return Api.listClients();
  },
  render() {
    if (!E.clientsTbody) return;

    if (this.state.loadError) {
      E.clientsTbody.innerHTML = `<tr><td colspan="11" class="muted" style="text-align:center;color:#ffb4b4;">${U.escapeHtml(
        this.state.loadError
      )}</td></tr>`;
      if (E.clientsState) E.clientsState.textContent = this.state.loadError;
      return;
    }

    if (!this.state.rows.length) {
      E.clientsTbody.innerHTML = '<tr><td colspan="11" class="muted" style="text-align:center;">No clients found.</td></tr>';
      if (E.clientsState) E.clientsState.textContent = 'No clients found.';
      return;
    }

    E.clientsTbody.innerHTML = this.state.rows
      .map(
        row => `<tr>
          <td>${U.escapeHtml(row.client_id || '—')}</td>
          <td>${U.escapeHtml(row.customer_name || '—')}</td>
          <td>${U.escapeHtml(row.customer_legal_name || '—')}</td>
          <td>${U.escapeHtml(row.customer_contact_name || '—')}</td>
          <td>${U.escapeHtml(row.customer_contact_email || '—')}</td>
          <td>${U.escapeHtml(row.account_status || '—')}</td>
          <td>${U.escapeHtml(row.contract_term || '—')}</td>
          <td>${U.escapeHtml(row.billing_frequency || '—')}</td>
          <td>${U.escapeHtml(row.currency || '—')}</td>
          <td>${U.escapeHtml(U.fmtDate(row.latest_signed_date) || '—')}</td>
          <td>${U.escapeHtml(U.fmtNumber(row.total_signed_value) || '0')}</td>
        </tr>`
      )
      .join('');

    if (E.clientsState) {
      E.clientsState.textContent = `Loaded ${this.state.rows.length} client${this.state.rows.length === 1 ? '' : 's'}.`;
    }
  },
  async loadAndRefresh(options = {}) {
    if (this.state.loading && !options.force) return;
    if (!Permissions.canViewClients()) return;

    this.state.loading = true;
    this.state.loadError = '';
    if (E.clientsState) E.clientsState.textContent = 'Loading clients…';
    try {
      const response = await this.listClients();
      this.state.rows = this.extractRows(response).map(raw => this.normalizeClient(raw));
      this.render();
    } catch (error) {
      this.state.rows = [];
      this.state.loadError = error?.message || 'Failed to load clients.';
      this.render();
    } finally {
      this.state.loading = false;
    }
  },
  wire() {
    if (E.clientsRefreshBtn) {
      E.clientsRefreshBtn.addEventListener('click', () => this.loadAndRefresh({ force: true }));
    }
  }
};

window.Clients = Clients;
