const Clients = {
  clientFields: [
    'client_id',
    'created_at',
    'updated_at',
    'customer_name',
    'customer_legal_name',
    'customer_contact_name',
    'customer_contact_email',
    'customer_contact_mobile',
    'company_phone',
    'company_address',
    'country',
    'tax_registration_number',
    'account_status',
    'contract_term',
    'billing_frequency',
    'payment_terms',
    'currency',
    'latest_grand_total',
    'total_signed_value',
    'agreements_count',
    'signed_agreements_count',
    'active_agreements_count',
    'first_signed_date',
    'latest_signed_date',
    'first_agreement_id',
    'latest_agreement_id',
    'latest_proposal_id',
    'latest_deal_id',
    'latest_lead_id',
    'notes'
  ],
  editableFields: [
    'customer_name',
    'customer_legal_name',
    'customer_contact_name',
    'customer_contact_email',
    'customer_contact_mobile',
    'company_phone',
    'company_address',
    'country',
    'tax_registration_number',
    'account_status',
    'contract_term',
    'billing_frequency',
    'payment_terms',
    'currency',
    'notes'
  ],
  state: {
    rows: [],
    filteredRows: [],
    loading: false,
    loadError: '',
    initialized: false,
    search: '',
    accountStatus: 'All',
    country: 'All',
    sort: 'updated_at_desc',
    formReadOnly: false
  },
  toNumberSafe(value) {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const parsed = Number(String(value).replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : 0;
  },
  normalizeText(value) {
    return String(value ?? '').trim().toLowerCase();
  },
  formatMoney(value) {
    return this.toNumberSafe(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
  },
  formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      const raw = String(value || '').trim();
      return raw || '—';
    }
    return U.fmtTS(date);
  },
  normalizeClient(raw = {}) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const normalized = {};
    this.clientFields.forEach(field => {
      const camel = field.replace(/_([a-z])/g, (_, ch) => ch.toUpperCase());
      const value = source[field] ?? source[camel] ?? '';
      normalized[field] = typeof value === 'string' ? value.trim() : value;
    });
    normalized.client_id = String(normalized.client_id || source.id || '').trim();
    normalized.customer_name = String(normalized.customer_name || '').trim();
    normalized.customer_legal_name = String(normalized.customer_legal_name || '').trim();
    normalized.customer_contact_name = String(normalized.customer_contact_name || '').trim();
    normalized.customer_contact_email = String(normalized.customer_contact_email || '').trim();
    normalized.country = String(normalized.country || '').trim();
    normalized.account_status = String(normalized.account_status || '').trim();
    normalized.billing_frequency = String(normalized.billing_frequency || '').trim();
    normalized.payment_terms = String(normalized.payment_terms || '').trim();
    normalized.currency = String(normalized.currency || '').trim();
    return normalized;
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
  extractClient(response, fallbackId = '') {
    const candidates = [response, response?.client, response?.data, response?.result, response?.payload];
    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== 'object') continue;
      if (candidate.client && typeof candidate.client === 'object') {
        return this.normalizeClient(candidate.client);
      }
      if (candidate.client_id || candidate.customer_name || candidate.customer_legal_name) {
        return this.normalizeClient(candidate);
      }
    }
    return this.normalizeClient({ client_id: fallbackId });
  },
  computeClientAnalytics(clients = []) {
    const rows = Array.isArray(clients) ? clients : [];
    const activeClients = rows.filter(client => this.normalizeText(client.account_status) === 'active').length;
    const signedClients = rows.filter(client => this.normalizeText(client.account_status) === 'signed').length;
    const totalSignedValue = rows.reduce((sum, client) => sum + this.toNumberSafe(client.total_signed_value), 0);
    const activeAgreementsCount = rows.reduce(
      (sum, client) => sum + this.toNumberSafe(client.active_agreements_count),
      0
    );
    const uniqueCountries = new Set(
      rows.map(client => String(client.country || '').trim()).filter(Boolean)
    ).size;
    return {
      totalClients: rows.length,
      activeClients,
      signedClients,
      totalSignedValue,
      activeAgreementsCount,
      uniqueCountries
    };
  },
  async listClients() {
    return Api.listClients();
  },
  async getClient(clientId) {
    return Api.getClient(clientId);
  },
  async createClient(client) {
    return Api.createClient(client);
  },
  async updateClient(clientId, updates) {
    return Api.updateClient(clientId, updates);
  },
  async deleteClient(clientId) {
    return Api.deleteClient(clientId);
  },
  applyFilters() {
    const terms = this.normalizeText(this.state.search).split(/\s+/).filter(Boolean);
    const parseDate = value => {
      const date = value ? new Date(value) : null;
      return date && !Number.isNaN(date.getTime()) ? date.getTime() : Number.NEGATIVE_INFINITY;
    };

    const filtered = this.state.rows.filter(client => {
      if (
        this.state.accountStatus !== 'All' &&
        String(client.account_status || '').trim() !== this.state.accountStatus
      )
        return false;
      if (this.state.country !== 'All' && String(client.country || '').trim() !== this.state.country) return false;
      if (!terms.length) return true;
      const hay = [
        client.customer_name,
        client.customer_legal_name,
        client.customer_contact_name,
        client.customer_contact_email
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return terms.every(term => hay.includes(term));
    });

    const sorted = [...filtered].sort((a, b) => {
      if (this.state.sort === 'latest_signed_date_desc') {
        return parseDate(b.latest_signed_date) - parseDate(a.latest_signed_date);
      }
      if (this.state.sort === 'customer_name_asc') {
        return String(a.customer_name || '').localeCompare(String(b.customer_name || ''), undefined, {
          sensitivity: 'base'
        });
      }
      return parseDate(b.updated_at) - parseDate(a.updated_at);
    });

    this.state.filteredRows = sorted;
  },
  renderFilters() {
    const uniqSorted = values =>
      [...new Set(values.filter(Boolean).map(value => String(value).trim()))].sort((a, b) =>
        a.localeCompare(b)
      );
    const accountStatuses = uniqSorted(this.state.rows.map(client => client.account_status));
    const countries = uniqSorted(this.state.rows.map(client => client.country));

    const assignSelect = (el, selected, values, allLabel = 'All') => {
      if (!el) return;
      const options = [allLabel, ...values];
      el.innerHTML = options.map(option => `<option value="${U.escapeAttr(option)}">${U.escapeHtml(option)}</option>`).join('');
      el.value = options.includes(selected) ? selected : allLabel;
    };

    if (E.clientsSearchInput) E.clientsSearchInput.value = this.state.search;
    assignSelect(E.clientsStatusFilter, this.state.accountStatus, accountStatuses, 'All');
    assignSelect(E.clientsCountryFilter, this.state.country, countries, 'All');
    if (E.clientsSortFilter) E.clientsSortFilter.value = this.state.sort;
  },
  renderSummary() {
    if (!E.clientsSummary) return;
    const analytics = this.computeClientAnalytics(this.state.filteredRows);
    const cards = [
      ['Total Clients', analytics.totalClients],
      ['Active Clients', analytics.activeClients],
      ['Signed Clients', analytics.signedClients],
      ['Total Signed Value', this.formatMoney(analytics.totalSignedValue)],
      ['Active Agreements Count', analytics.activeAgreementsCount],
      ['Unique Countries', analytics.uniqueCountries]
    ];
    E.clientsSummary.innerHTML = cards
      .map(
        ([label, value]) =>
          `<div class="card kpi"><div class="label">${U.escapeHtml(label)}</div><div class="value">${U.escapeHtml(
            String(value)
          )}</div></div>`
      )
      .join('');
  },
  render() {
    if (!E.clientsState || !E.clientsTbody) return;

    if (this.state.loading) {
      E.clientsState.textContent = 'Loading clients…';
      E.clientsTbody.innerHTML =
        '<tr><td colspan="18" class="muted" style="text-align:center;">Loading clients…</td></tr>';
      this.renderSummary();
      return;
    }

    if (this.state.loadError) {
      E.clientsState.textContent = this.state.loadError;
      E.clientsTbody.innerHTML = `<tr><td colspan="18" class="muted" style="text-align:center;color:#ffb4b4;">${U.escapeHtml(
        this.state.loadError
      )}</td></tr>`;
      this.renderSummary();
      return;
    }

    const rows = this.state.filteredRows;
    E.clientsState.textContent = `${rows.length} client${rows.length === 1 ? '' : 's'}`;
    this.renderSummary();

    if (!rows.length) {
      E.clientsTbody.innerHTML =
        '<tr><td colspan="18" class="muted" style="text-align:center;">No clients found.</td></tr>';
      return;
    }

    const textCell = value => U.escapeHtml(String(value ?? '').trim() || '—');

    E.clientsTbody.innerHTML = rows
      .map(row => {
        const id = U.escapeAttr(row.client_id || '');
        return `<tr>
          <td>${textCell(row.client_id)}</td>
          <td>${textCell(row.customer_name)}</td>
          <td>${textCell(row.customer_legal_name)}</td>
          <td>${textCell(row.customer_contact_name)}</td>
          <td>${textCell(row.customer_contact_email)}</td>
          <td>${textCell(row.customer_contact_mobile)}</td>
          <td>${textCell(row.country)}</td>
          <td>${textCell(row.account_status || '-')}</td>
          <td>${textCell(row.billing_frequency)}</td>
          <td>${textCell(row.payment_terms)}</td>
          <td>${textCell(row.currency)}</td>
          <td>${textCell(this.formatMoney(row.latest_grand_total))}</td>
          <td>${textCell(this.toNumberSafe(row.agreements_count))}</td>
          <td>${textCell(this.toNumberSafe(row.signed_agreements_count))}</td>
          <td>${textCell(this.toNumberSafe(row.active_agreements_count))}</td>
          <td>${textCell(this.formatDate(row.latest_signed_date))}</td>
          <td>${textCell(row.latest_agreement_id)}</td>
          <td>
            <button class="btn ghost sm" type="button" data-client-view="${id}">View</button>
            <button class="btn ghost sm" type="button" data-client-edit="${id}">Edit</button>
            ${Permissions.canEditDeleteLead() ? `<button class="btn ghost sm" type="button" data-client-delete="${id}">Delete</button>` : ''}
          </td>
        </tr>`;
      })
      .join('');
  },
  resetForm() {
    if (!E.clientForm) return;
    E.clientForm.reset();
    if (E.clientFormClientId) E.clientFormClientId.value = '';
    E.clientForm.dataset.id = '';
    if (E.clientFormDeleteBtn) E.clientFormDeleteBtn.style.display = 'none';
    if (E.clientFormSaveBtn) E.clientFormSaveBtn.style.display = '';
  },
  setFormReadOnly(readOnly) {
    this.state.formReadOnly = !!readOnly;
    if (!E.clientForm) return;
    E.clientForm.querySelectorAll('input, select, textarea').forEach(el => {
      if (el.id === 'clientFormClientId') return;
      el.disabled = !!readOnly;
    });
    if (E.clientFormSaveBtn) E.clientFormSaveBtn.style.display = readOnly ? 'none' : '';
    if (E.clientFormDeleteBtn) E.clientFormDeleteBtn.style.display = readOnly ? 'none' : E.clientFormDeleteBtn.style.display;
  },
  assignFormValues(client = {}) {
    const set = (el, value) => {
      if (el) el.value = String(value ?? '');
    };
    set(E.clientFormClientId, client.client_id || '');
    set(E.clientFormCustomerName, client.customer_name);
    set(E.clientFormCustomerLegalName, client.customer_legal_name);
    set(E.clientFormCustomerContactName, client.customer_contact_name);
    set(E.clientFormCustomerContactEmail, client.customer_contact_email);
    set(E.clientFormCustomerContactMobile, client.customer_contact_mobile);
    set(E.clientFormCompanyPhone, client.company_phone);
    set(E.clientFormCompanyAddress, client.company_address);
    set(E.clientFormCountry, client.country);
    set(E.clientFormTaxRegistrationNumber, client.tax_registration_number);
    set(E.clientFormAccountStatus, client.account_status);
    set(E.clientFormContractTerm, client.contract_term);
    set(E.clientFormBillingFrequency, client.billing_frequency);
    set(E.clientFormPaymentTerms, client.payment_terms);
    set(E.clientFormCurrency, client.currency);
    set(E.clientFormNotes, client.notes);
  },
  collectFormValues() {
    const get = el => String(el?.value || '').trim();
    return {
      customer_name: get(E.clientFormCustomerName),
      customer_legal_name: get(E.clientFormCustomerLegalName),
      customer_contact_name: get(E.clientFormCustomerContactName),
      customer_contact_email: get(E.clientFormCustomerContactEmail),
      customer_contact_mobile: get(E.clientFormCustomerContactMobile),
      company_phone: get(E.clientFormCompanyPhone),
      company_address: get(E.clientFormCompanyAddress),
      country: get(E.clientFormCountry),
      tax_registration_number: get(E.clientFormTaxRegistrationNumber),
      account_status: get(E.clientFormAccountStatus),
      contract_term: get(E.clientFormContractTerm),
      billing_frequency: get(E.clientFormBillingFrequency),
      payment_terms: get(E.clientFormPaymentTerms),
      currency: get(E.clientFormCurrency),
      notes: get(E.clientFormNotes)
    };
  },
  openForm(client = {}, { readOnly = false, mode = 'edit' } = {}) {
    if (!E.clientFormModal || !E.clientForm) return;
    this.resetForm();
    this.assignFormValues(client);
    const clientId = String(client.client_id || '').trim();
    E.clientForm.dataset.id = clientId;
    if (E.clientFormTitle)
      E.clientFormTitle.textContent = readOnly
        ? `Client ${clientId || ''}`.trim()
        : mode === 'create'
        ? 'Create Client'
        : `Edit Client ${clientId || ''}`.trim();
    if (E.clientFormDeleteBtn)
      E.clientFormDeleteBtn.style.display =
        !readOnly && Permissions.canEditDeleteLead() && !!clientId ? '' : 'none';
    this.setFormReadOnly(readOnly);
    E.clientFormModal.style.display = 'flex';
    E.clientFormModal.setAttribute('aria-hidden', 'false');
  },
  closeForm() {
    if (!E.clientFormModal) return;
    E.clientFormModal.style.display = 'none';
    E.clientFormModal.setAttribute('aria-hidden', 'true');
  },
  async openFormById(clientId, { readOnly = false } = {}) {
    const id = String(clientId || '').trim();
    if (!id) return;
    try {
      UI.spinner(true);
      const response = await this.getClient(id);
      const client = this.extractClient(response, id);
      this.openForm(client, { readOnly, mode: 'edit' });
    } catch (error) {
      if (typeof isAuthError === 'function' && isAuthError(error)) {
        handleExpiredSession('Session expired. Please log in again.');
        return;
      }
      UI.toast('Unable to load client: ' + (error?.message || 'Unknown error'));
    } finally {
      UI.spinner(false);
    }
  },
  async submitForm() {
    if (this.state.formReadOnly) {
      this.closeForm();
      return;
    }
    const clientId = String(E.clientForm?.dataset.id || '').trim();
    const payload = this.collectFormValues();

    try {
      UI.spinner(true);
      if (clientId) await this.updateClient(clientId, payload);
      else await this.createClient(payload);
      UI.toast(clientId ? 'Client updated.' : 'Client created.');
      this.closeForm();
      await this.loadAndRefresh({ force: true });
    } catch (error) {
      if (typeof isAuthError === 'function' && isAuthError(error)) {
        handleExpiredSession('Session expired. Please log in again.');
        return;
      }
      UI.toast('Unable to save client: ' + (error?.message || 'Unknown error'));
    } finally {
      UI.spinner(false);
    }
  },
  async deleteById(clientId) {
    const id = String(clientId || '').trim();
    if (!id) return;
    if (!Permissions.canEditDeleteLead()) {
      UI.toast('Only admin/dev can delete clients.');
      return;
    }
    if (!window.confirm(`Delete client ${id}? This cannot be undone.`)) return;

    try {
      UI.spinner(true);
      await this.deleteClient(id);
      UI.toast('Client deleted.');
      this.closeForm();
      await this.loadAndRefresh({ force: true });
    } catch (error) {
      if (typeof isAuthError === 'function' && isAuthError(error)) {
        handleExpiredSession('Session expired. Please log in again.');
        return;
      }
      UI.toast('Unable to delete client: ' + (error?.message || 'Unknown error'));
    } finally {
      UI.spinner(false);
    }
  },
  async loadAndRefresh({ force = false } = {}) {
    if (!Session.isAuthenticated()) return;
    if (this.state.loading && !force) return;

    this.state.loading = true;
    this.state.loadError = '';
    this.render();

    try {
      const response = await this.listClients();
      this.state.rows = this.extractRows(response).map(raw => this.normalizeClient(raw));
      this.renderFilters();
      this.applyFilters();
      this.render();
    } catch (error) {
      if (typeof isAuthError === 'function' && isAuthError(error)) {
        handleExpiredSession('Session expired. Please log in again.');
        return;
      }
      this.state.rows = [];
      this.state.filteredRows = [];
      this.state.loadError = String(error?.message || '').trim() || 'Unable to load clients.';
      this.render();
      UI.toast(this.state.loadError);
    } finally {
      this.state.loading = false;
      this.render();
    }
  },
  wire() {
    if (this.state.initialized) return;

    const bindState = (el, key) => {
      if (!el) return;
      const sync = () => {
        this.state[key] = String(el.value || '').trim();
        this.applyFilters();
        this.render();
      };
      el.addEventListener('input', sync);
      el.addEventListener('change', sync);
    };

    bindState(E.clientsSearchInput, 'search');
    bindState(E.clientsStatusFilter, 'accountStatus');
    bindState(E.clientsCountryFilter, 'country');
    bindState(E.clientsSortFilter, 'sort');

    if (E.clientsRefreshBtn) {
      E.clientsRefreshBtn.addEventListener('click', () => this.loadAndRefresh({ force: true }));
    }
    if (E.clientsCreateBtn) {
      E.clientsCreateBtn.addEventListener('click', () => this.openForm({}, { mode: 'create' }));
    }

    if (E.clientsTbody) {
      E.clientsTbody.addEventListener('click', event => {
        const getActionValue = action => event.target?.closest?.(`[${action}]`)?.getAttribute(action) || '';
        const viewId = getActionValue('data-client-view');
        if (viewId) {
          this.openFormById(viewId, { readOnly: true });
          return;
        }
        const editId = getActionValue('data-client-edit');
        if (editId) {
          this.openFormById(editId, { readOnly: false });
          return;
        }
        const deleteId = getActionValue('data-client-delete');
        if (deleteId) this.deleteById(deleteId);
      });
    }

    if (E.clientFormCloseBtn) E.clientFormCloseBtn.addEventListener('click', () => this.closeForm());
    if (E.clientFormCancelBtn) E.clientFormCancelBtn.addEventListener('click', () => this.closeForm());
    if (E.clientFormModal) {
      E.clientFormModal.addEventListener('click', event => {
        if (event.target === E.clientFormModal) this.closeForm();
      });
    }
    if (E.clientForm) {
      E.clientForm.addEventListener('submit', event => {
        event.preventDefault();
        this.submitForm();
      });
    }
    if (E.clientFormDeleteBtn) {
      E.clientFormDeleteBtn.addEventListener('click', () => {
        const id = String(E.clientForm?.dataset.id || '').trim();
        if (id) this.deleteById(id);
      });
    }

    this.state.initialized = true;
  }
};

window.Clients = Clients;
