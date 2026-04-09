const Deals = {
  columns: [
    'deal_id',
    'lead_id',
    'full_name',
    'company_name',
    'phone',
    'email',
    'country',
    'lead_source',
    'service_interest',
    'stage',
    'status',
    'priority',
    'estimated_value',
    'currency',
    'assigned_to',
    'proposal_needed',
    'agreement_needed',
    'converted_at',
    'converted_by',
    'notes'
  ],
  state: {
    rows: [],
    filteredRows: [],
    loading: false,
    loadError: '',
    initialized: false,
    search: ''
  },
  normalizeBool(value) {
    const normalized = String(value ?? '')
      .trim()
      .toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) return 'Yes';
    if (['false', '0', 'no', 'n'].includes(normalized)) return 'No';
    return '—';
  },
  normalizeDeal(raw = {}) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const lead = source.lead && typeof source.lead === 'object' ? source.lead : {};
    const pick = (...values) => {
      for (const value of values) {
        if (value !== undefined && value !== null && String(value).trim() !== '') return value;
      }
      return '';
    };

    const dealId = String(raw.deal_id || raw.dealId || raw.id || '').trim();
    return {
      deal_id: dealId,
      lead_id: String(pick(source.lead_id, source.leadId, lead.lead_id, lead.leadId)).trim(),
      full_name: String(pick(source.full_name, source.fullName, lead.full_name, lead.fullName)).trim(),
      company_name: String(
        pick(source.company_name, source.companyName, lead.company_name, lead.companyName)
      ).trim(),
      phone: String(pick(source.phone, lead.phone)).trim(),
      email: String(pick(source.email, lead.email)).trim(),
      country: String(pick(source.country, lead.country)).trim(),
      lead_source: String(pick(source.lead_source, source.leadSource, lead.lead_source, lead.leadSource)).trim(),
      service_interest: String(
        pick(source.service_interest, source.serviceInterest, lead.service_interest, lead.serviceInterest)
      ).trim(),
      stage: String(pick(source.stage)).trim(),
      status: String(pick(source.status, lead.status)).trim(),
      priority: String(pick(source.priority, lead.priority)).trim(),
      estimated_value: pick(source.estimated_value, source.estimatedValue, lead.estimated_value, lead.estimatedValue),
      currency: String(pick(source.currency, lead.currency)).trim(),
      assigned_to: String(pick(source.assigned_to, source.assignedTo, lead.assigned_to, lead.assignedTo)).trim(),
      proposal_needed: this.normalizeBool(
        pick(source.proposal_needed, source.proposalNeeded, lead.proposal_needed, lead.proposalNeeded)
      ),
      agreement_needed: this.normalizeBool(
        pick(source.agreement_needed, source.agreementNeeded, lead.agreement_needed, lead.agreementNeeded)
      ),
      converted_at: pick(source.converted_at, source.convertedAt, lead.converted_at, lead.convertedAt),
      converted_by: String(pick(source.converted_by, source.convertedBy, lead.converted_by, lead.convertedBy)).trim(),
      notes: String(pick(source.notes, lead.notes)).trim()
    };
  },
  extractRows(response) {
    const candidates = [
      response,
      response?.deals,
      response?.items,
      response?.rows,
      response?.data,
      response?.result,
      response?.payload,
      response?.data?.deals,
      response?.result?.deals,
      response?.payload?.deals
    ];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return candidate;
    }
    return [];
  },
  async listDeals() {
    return Api.postAuthenticated('deals', 'list', {});
  },
  formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return U.escapeHtml(String(value));
    return U.escapeHtml(date.toLocaleString());
  },
  applyFilters() {
    const searchTerms = String(this.state.search || '')
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    if (!searchTerms.length) {
      this.state.filteredRows = [...this.state.rows];
      return;
    }

    this.state.filteredRows = this.state.rows.filter(row => {
      const hay = this.columns
        .map(column => String(row[column] ?? ''))
        .join(' ')
        .toLowerCase();
      return searchTerms.every(term => hay.includes(term));
    });
  },
  render() {
    if (!E.dealsState || !E.dealsTbody) return;

    if (this.state.loading) {
      E.dealsState.textContent = 'Loading deals…';
      E.dealsTbody.innerHTML = '<tr><td colspan="20" class="muted" style="text-align:center;">Loading deals…</td></tr>';
      return;
    }

    if (this.state.loadError) {
      E.dealsState.textContent = this.state.loadError;
      E.dealsTbody.innerHTML = `<tr><td colspan="20" class="muted" style="text-align:center;color:#ffb4b4;">${U.escapeHtml(
        this.state.loadError
      )}</td></tr>`;
      return;
    }

    const rows = this.state.filteredRows;
    E.dealsState.textContent = `${rows.length} deal${rows.length === 1 ? '' : 's'}`;

    if (!rows.length) {
      E.dealsTbody.innerHTML = '<tr><td colspan="20" class="muted" style="text-align:center;">No deals found.</td></tr>';
      return;
    }

    const renderCell = (row, column) => {
      if (column === 'converted_at') return this.formatDate(row[column]);
      if (column === 'proposal_needed' || column === 'agreement_needed') return U.escapeHtml(row[column] || '—');
      const value = row[column];
      return U.escapeHtml(value === '' || value == null ? '—' : String(value));
    };

    E.dealsTbody.innerHTML = rows
      .map(
        row => `<tr>${this.columns
          .map(column => `<td>${renderCell(row, column)}</td>`)
          .join('')}</tr>`
      )
      .join('');
  },
  async loadAndRefresh({ force = false } = {}) {
    if (!Session.isAuthenticated()) return;
    if (this.state.loading && !force) return;
    this.state.loading = true;
    this.state.loadError = '';
    this.render();

    try {
      const response = await this.listDeals();
      this.state.rows = this.extractRows(response).map(item => this.normalizeDeal(item));
      this.applyFilters();
      this.render();
    } catch (error) {
      if (isAuthError(error)) {
        handleExpiredSession('Session expired. Please log in again.');
        return;
      }
      this.state.rows = [];
      this.state.filteredRows = [];
      this.state.loadError = String(error?.message || '').trim() || 'Unable to load deals right now.';
      this.render();
      UI.toast(this.state.loadError);
    } finally {
      this.state.loading = false;
      this.render();
    }
  },
  wire() {
    if (this.state.initialized) return;

    if (E.dealsSearchInput) {
      const sync = () => {
        this.state.search = String(E.dealsSearchInput.value || '').trim();
        this.applyFilters();
        this.render();
      };
      E.dealsSearchInput.addEventListener('input', sync);
      E.dealsSearchInput.addEventListener('change', sync);
    }

    if (E.dealsRefreshBtn) {
      E.dealsRefreshBtn.addEventListener('click', () => this.loadAndRefresh({ force: true }));
    }

    this.state.initialized = true;
  }
};

window.Deals = Deals;
