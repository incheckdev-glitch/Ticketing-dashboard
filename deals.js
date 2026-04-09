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
  formDropdownDefaults: {
    lead_source: ['Website', 'Referral', 'LinkedIn', 'Email', 'Call', 'WhatsApp', 'Event', 'Other'],
    service_interest: ['Software', 'Other', 'Consulting'],
    stage: ['Qualified', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'],
    status: ['Open', 'Won', 'Lost', 'On Hold'],
    priority: ['High', 'Medium', 'Low'],
    currency: ['USD', 'EUR', 'GBP', 'AED']
  },
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
    if (['true', '1', 'yes', 'y'].includes(normalized)) return 'yes';
    if (['false', '0', 'no', 'n'].includes(normalized)) return 'no';
    return '';
  },
  boolLabel(value) {
    if (value === 'yes') return 'Yes';
    if (value === 'no') return 'No';
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
      lead_source: String(
        pick(source.lead_source, source.leadSource, lead.lead_source, lead.leadSource)
      ).trim(),
      service_interest: String(
        pick(source.service_interest, source.serviceInterest, lead.service_interest, lead.serviceInterest)
      ).trim(),
      stage: String(pick(source.stage)).trim(),
      status: String(pick(source.status, lead.status)).trim(),
      priority: String(pick(source.priority, lead.priority)).trim(),
      estimated_value: pick(
        source.estimated_value,
        source.estimatedValue,
        lead.estimated_value,
        lead.estimatedValue
      ),
      currency: String(pick(source.currency, lead.currency)).trim(),
      assigned_to: String(pick(source.assigned_to, source.assignedTo, lead.assigned_to, lead.assignedTo)).trim(),
      proposal_needed: this.normalizeBool(
        pick(source.proposal_needed, source.proposalNeeded, lead.proposal_needed, lead.proposalNeeded)
      ),
      agreement_needed: this.normalizeBool(
        pick(source.agreement_needed, source.agreementNeeded, lead.agreement_needed, lead.agreementNeeded)
      ),
      converted_at: pick(source.converted_at, source.convertedAt, lead.converted_at, lead.convertedAt),
      converted_by: String(
        pick(source.converted_by, source.convertedBy, lead.converted_by, lead.convertedBy)
      ).trim(),
      notes: String(pick(source.notes, lead.notes)).trim()
    };
  },
  backendDeal(deal) {
    return {
      lead_id: deal.lead_id,
      full_name: deal.full_name,
      company_name: deal.company_name,
      phone: deal.phone,
      email: deal.email,
      country: deal.country,
      lead_source: deal.lead_source,
      service_interest: deal.service_interest,
      stage: deal.stage,
      status: deal.status,
      priority: deal.priority,
      estimated_value: deal.estimated_value === '' ? '' : Number(deal.estimated_value),
      currency: deal.currency,
      assigned_to: deal.assigned_to,
      proposal_needed: deal.proposal_needed === 'yes',
      agreement_needed: deal.agreement_needed === 'yes',
      notes: deal.notes
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
    return Api.postAuthenticated('deals', 'list', {
      sheetName: CONFIG.DEALS_SHEET_NAME,
      tabName: CONFIG.DEALS_SHEET_NAME
    });
  },
  async getDeal(id) {
    return Api.postAuthenticated('deals', 'get', { id });
  },
  async createDeal(deal) {
    return Api.postAuthenticated('deals', 'create', {
      deal: this.backendDeal(deal)
    });
  },
  async updateDeal(dealId, updates) {
    return Api.postAuthenticated('deals', 'update', {
      deal_id: dealId,
      updates: this.backendDeal(updates)
    });
  },
  async deleteDeal(dealId) {
    return Api.postAuthenticated('deals', 'delete', {
      deal_id: dealId
    });
  },
  formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return U.escapeHtml(String(value));
    return U.escapeHtml(date.toLocaleString());
  },
  canCreate() {
    return Permissions.canCreateLead();
  },
  canEditDelete() {
    return Permissions.canEditDeleteLead();
  },
  uniqueSorted(values = []) {
    return [...new Set(values.filter(Boolean).map(value => String(value).trim()))].sort((a, b) =>
      a.localeCompare(b)
    );
  },
  syncDealFormDropdowns(selected = {}) {
    const assign = (el, options = [], selectedValue = '') => {
      if (!el) return;
      const values = this.uniqueSorted(options);
      const finalOptions = ['', ...values];
      el.innerHTML = finalOptions
        .map(value => `<option value="${U.escapeAttr(value)}">${U.escapeHtml(value || '—')}</option>`)
        .join('');
      if (finalOptions.includes(selectedValue)) {
        el.value = selectedValue;
        return;
      }
      if (selectedValue) {
        el.innerHTML += `<option value="${U.escapeAttr(selectedValue)}">${U.escapeHtml(selectedValue)}</option>`;
        el.value = selectedValue;
      }
    };

    const sourceValues = this.formDropdownDefaults.lead_source.concat(
      this.state.rows.map(row => row.lead_source)
    );
    const serviceValues = this.formDropdownDefaults.service_interest.concat(
      this.state.rows.map(row => row.service_interest)
    );
    const stageValues = this.formDropdownDefaults.stage.concat(this.state.rows.map(row => row.stage));
    const statusValues = this.formDropdownDefaults.status.concat(this.state.rows.map(row => row.status));
    const priorityValues = this.formDropdownDefaults.priority.concat(
      this.state.rows.map(row => row.priority)
    );
    const currencyValues = this.formDropdownDefaults.currency.concat(
      this.state.rows.map(row => row.currency)
    );

    assign(E.dealFormLeadSource, sourceValues, selected.lead_source || '');
    assign(E.dealFormServiceInterest, serviceValues, selected.service_interest || '');
    assign(E.dealFormStage, stageValues, selected.stage || '');
    assign(E.dealFormStatus, statusValues, selected.status || '');
    assign(E.dealFormPriority, priorityValues, selected.priority || '');
    assign(E.dealFormCurrency, currencyValues, selected.currency || '');
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
      E.dealsTbody.innerHTML = '<tr><td colspan="21" class="muted" style="text-align:center;">Loading deals…</td></tr>';
      return;
    }

    if (this.state.loadError) {
      E.dealsState.textContent = this.state.loadError;
      E.dealsTbody.innerHTML = `<tr><td colspan="21" class="muted" style="text-align:center;color:#ffb4b4;">${U.escapeHtml(
        this.state.loadError
      )}</td></tr>`;
      return;
    }

    const rows = this.state.filteredRows;
    E.dealsState.textContent = `${rows.length} deal${rows.length === 1 ? '' : 's'}`;

    if (!rows.length) {
      E.dealsTbody.innerHTML = '<tr><td colspan="21" class="muted" style="text-align:center;">No deals found.</td></tr>';
      return;
    }

    const renderCell = (row, column) => {
      if (column === 'converted_at') return this.formatDate(row[column]);
      if (column === 'proposal_needed' || column === 'agreement_needed') return U.escapeHtml(this.boolLabel(row[column]));
      const value = row[column];
      return U.escapeHtml(value === '' || value == null ? '—' : String(value));
    };

    E.dealsTbody.innerHTML = rows
      .map(row => {
        const actionButtons = [];
        if (this.canEditDelete()) {
          actionButtons.push(
            `<button class="btn ghost sm" type="button" data-deal-edit="${U.escapeAttr(row.deal_id)}">Edit</button>`
          );
          actionButtons.push(
            `<button class="btn ghost sm" type="button" data-deal-delete="${U.escapeAttr(row.deal_id)}">Delete</button>`
          );
        }
        const actions = actionButtons.length ? actionButtons.join(' ') : '<span class="muted">—</span>';
        return `<tr>${this.columns
          .map(column => `<td>${renderCell(row, column)}</td>`)
          .join('')}<td>${actions}</td></tr>`;
      })
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
      this.syncDealFormDropdowns();
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
  setFormBusy(v) {
    if (E.dealFormSaveBtn) E.dealFormSaveBtn.disabled = !!v;
    if (E.dealFormDeleteBtn) E.dealFormDeleteBtn.disabled = !!v;
  },
  resetForm() {
    if (!E.dealForm) return;
    E.dealForm.reset();
    if (E.dealFormDealId) E.dealFormDealId.value = '';
    if (E.dealFormConvertedAt) E.dealFormConvertedAt.value = '';
    if (E.dealFormProposalNeeded) E.dealFormProposalNeeded.value = '';
    if (E.dealFormAgreementNeeded) E.dealFormAgreementNeeded.value = '';
    this.syncDealFormDropdowns();
  },
  openForm(row = null) {
    if (!E.dealFormModal || !E.dealForm) return;
    const isEdit = !!row;
    E.dealForm.dataset.mode = isEdit ? 'edit' : 'create';
    E.dealForm.dataset.id = row?.deal_id || '';
    if (E.dealFormTitle) E.dealFormTitle.textContent = isEdit ? 'Edit Deal' : 'Create Deal';
    this.resetForm();

    if (row) {
      if (E.dealFormDealId) E.dealFormDealId.value = row.deal_id || '';
      if (E.dealFormLeadId) E.dealFormLeadId.value = row.lead_id || '';
      if (E.dealFormFullName) E.dealFormFullName.value = row.full_name || '';
      if (E.dealFormCompanyName) E.dealFormCompanyName.value = row.company_name || '';
      if (E.dealFormPhone) E.dealFormPhone.value = row.phone || '';
      if (E.dealFormEmail) E.dealFormEmail.value = row.email || '';
      if (E.dealFormCountry) E.dealFormCountry.value = row.country || '';
      if (E.dealFormLeadSource) E.dealFormLeadSource.value = row.lead_source || '';
      if (E.dealFormServiceInterest) E.dealFormServiceInterest.value = row.service_interest || '';
      if (E.dealFormStage) E.dealFormStage.value = row.stage || '';
      if (E.dealFormStatus) E.dealFormStatus.value = row.status || '';
      if (E.dealFormPriority) E.dealFormPriority.value = row.priority || '';
      if (E.dealFormEstimatedValue) {
        E.dealFormEstimatedValue.value = row.estimated_value === '' ? '' : String(row.estimated_value);
      }
      if (E.dealFormCurrency) E.dealFormCurrency.value = row.currency || '';
      if (E.dealFormAssignedTo) E.dealFormAssignedTo.value = row.assigned_to || '';
      if (E.dealFormProposalNeeded) E.dealFormProposalNeeded.value = row.proposal_needed || '';
      if (E.dealFormAgreementNeeded) E.dealFormAgreementNeeded.value = row.agreement_needed || '';
      if (E.dealFormConvertedBy) E.dealFormConvertedBy.value = row.converted_by || '';
      if (E.dealFormConvertedAt) E.dealFormConvertedAt.value = row.converted_at || '';
      if (E.dealFormNotes) E.dealFormNotes.value = row.notes || '';
      this.syncDealFormDropdowns({
        lead_source: row.lead_source || '',
        service_interest: row.service_interest || '',
        stage: row.stage || '',
        status: row.status || '',
        priority: row.priority || '',
        currency: row.currency || ''
      });
    } else {
      if (E.dealFormDealId) E.dealFormDealId.value = 'Auto-generated';
      if (E.dealFormConvertedAt) E.dealFormConvertedAt.value = new Date().toLocaleString();
      this.syncDealFormDropdowns();
    }

    if (E.dealFormDeleteBtn) E.dealFormDeleteBtn.style.display = isEdit && this.canEditDelete() ? '' : 'none';
    if (E.dealFormSaveBtn) E.dealFormSaveBtn.disabled = false;
    E.dealFormModal.style.display = 'flex';
    E.dealFormModal.setAttribute('aria-hidden', 'false');
  },
  closeForm() {
    if (!E.dealFormModal) return;
    E.dealFormModal.style.display = 'none';
    E.dealFormModal.setAttribute('aria-hidden', 'true');
  },
  collectFormData() {
    return {
      lead_id: String(E.dealFormLeadId?.value || '').trim(),
      full_name: String(E.dealFormFullName?.value || '').trim(),
      company_name: String(E.dealFormCompanyName?.value || '').trim(),
      phone: String(E.dealFormPhone?.value || '').trim(),
      email: String(E.dealFormEmail?.value || '').trim(),
      country: String(E.dealFormCountry?.value || '').trim(),
      lead_source: String(E.dealFormLeadSource?.value || '').trim(),
      service_interest: String(E.dealFormServiceInterest?.value || '').trim(),
      stage: String(E.dealFormStage?.value || '').trim(),
      status: String(E.dealFormStatus?.value || '').trim(),
      priority: String(E.dealFormPriority?.value || '').trim(),
      estimated_value: String(E.dealFormEstimatedValue?.value || '').trim(),
      currency: String(E.dealFormCurrency?.value || '').trim(),
      assigned_to: String(E.dealFormAssignedTo?.value || '').trim(),
      proposal_needed: this.normalizeBool(E.dealFormProposalNeeded?.value || ''),
      agreement_needed: this.normalizeBool(E.dealFormAgreementNeeded?.value || ''),
      converted_by: String(E.dealFormConvertedBy?.value || '').trim(),
      notes: String(E.dealFormNotes?.value || '').trim()
    };
  },
  async submitForm() {
    if (!this.canCreate()) {
      UI.toast('Login is required to manage deals.');
      return;
    }
    const mode = E.dealForm?.dataset.mode === 'edit' ? 'edit' : 'create';
    if (mode === 'edit' && !this.canEditDelete()) {
      UI.toast('Only admin/dev can update deals.');
      return;
    }

    const dealId = String(E.dealForm?.dataset.id || '').trim();
    const deal = this.collectFormData();
    if (!deal.full_name && !deal.company_name) {
      UI.toast('Full name or company name is required.');
      return;
    }

    this.setFormBusy(true);
    try {
      if (mode === 'edit') {
        const latest = await this.getDeal(dealId);
        const resolved = this.normalizeDeal(latest?.deal || latest?.data?.deal || latest || { deal_id: dealId });
        const id = resolved.deal_id || dealId;
        await this.updateDeal(id, deal);
        UI.toast('Deal updated.');
      } else {
        await this.createDeal(deal);
        UI.toast('Deal created.');
      }
      this.closeForm();
      await this.loadAndRefresh({ force: true });
    } catch (error) {
      if (isAuthError(error)) {
        handleExpiredSession('Session expired. Please log in again.');
        return;
      }
      UI.toast('Unable to save deal: ' + (error?.message || 'Unknown error'));
    } finally {
      this.setFormBusy(false);
    }
  },
  async deleteDealById(dealId) {
    if (!this.canEditDelete()) {
      UI.toast('Only admin/dev can delete deals.');
      return;
    }
    const confirmed = window.confirm(`Delete deal ${dealId}?`);
    if (!confirmed) return;

    this.setFormBusy(true);
    try {
      await this.deleteDeal(dealId);
      UI.toast('Deal deleted.');
      this.closeForm();
      await this.loadAndRefresh({ force: true });
    } catch (error) {
      if (isAuthError(error)) {
        handleExpiredSession('Session expired. Please log in again.');
        return;
      }
      UI.toast('Unable to delete deal: ' + (error?.message || 'Unknown error'));
    } finally {
      this.setFormBusy(false);
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

    if (E.dealsCreateBtn) {
      E.dealsCreateBtn.addEventListener('click', () => {
        if (!this.canCreate()) {
          UI.toast('Login is required to create deals.');
          return;
        }
        this.openForm();
      });
    }

    if (E.dealsTbody) {
      E.dealsTbody.addEventListener('click', event => {
        const editId = event.target?.getAttribute('data-deal-edit');
        if (editId) {
          const row = this.state.rows.find(item => item.deal_id === editId);
          if (row) this.openForm(row);
          return;
        }
        const deleteId = event.target?.getAttribute('data-deal-delete');
        if (deleteId) this.deleteDealById(deleteId);
      });
    }

    if (E.dealFormCloseBtn) E.dealFormCloseBtn.addEventListener('click', () => this.closeForm());
    if (E.dealFormCancelBtn) E.dealFormCancelBtn.addEventListener('click', () => this.closeForm());
    if (E.dealFormModal) {
      E.dealFormModal.addEventListener('click', event => {
        if (event.target === E.dealFormModal) this.closeForm();
      });
    }
    if (E.dealForm) {
      E.dealForm.addEventListener('submit', event => {
        event.preventDefault();
        this.submitForm();
      });
    }
    if (E.dealFormDeleteBtn) {
      E.dealFormDeleteBtn.addEventListener('click', () => {
        const id = String(E.dealForm?.dataset.id || '').trim();
        if (id) this.deleteDealById(id);
      });
    }

    this.state.initialized = true;
  }
};

window.Deals = Deals;
