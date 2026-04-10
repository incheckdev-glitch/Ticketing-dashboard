const Agreements = {
  agreementFields: [
    'agreement_id',
    'agreement_number',
    'created_at',
    'updated_at',
    'proposal_id',
    'deal_id',
    'lead_id',
    'agreement_title',
    'agreement_date',
    'effective_date',
    'service_start_date',
    'agreement_length',
    'account_number',
    'billing_frequency',
    'payment_term',
    'po_number',
    'currency',
    'customer_name',
    'customer_legal_name',
    'customer_address',
    'customer_contact_name',
    'customer_contact_mobile',
    'customer_contact_email',
    'provider_name',
    'provider_legal_name',
    'provider_address',
    'provider_contact_name',
    'provider_contact_mobile',
    'provider_contact_email',
    'status',
    'saas_total',
    'one_time_total',
    'grand_total',
    'terms_conditions',
    'customer_signatory_name',
    'customer_signatory_title',
    'provider_signatory_name_primary',
    'provider_signatory_title_primary',
    'provider_signatory_name_secondary',
    'provider_signatory_title_secondary',
    'provider_sign_date',
    'customer_sign_date',
    'generated_by',
    'notes'
  ],
  state: {
    rows: [],
    filteredRows: [],
    loading: false,
    loadError: '',
    initialized: false,
    search: '',
    status: 'All',
    proposalOrDeal: '',
    formReadOnly: false,
    currentItems: []
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
    const num = this.toNumberSafe(value);
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  },
  normalizeAgreement(raw = {}) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const normalized = {};
    this.agreementFields.forEach(field => {
      const camel = field.replace(/_([a-z])/g, (_, ch) => ch.toUpperCase());
      const value = source[field] ?? source[camel] ?? '';
      normalized[field] = typeof value === 'string' ? value.trim() : value;
    });
    normalized.agreement_id = String(normalized.agreement_id || source.id || '').trim();
    normalized.agreement_number = String(normalized.agreement_number || '').trim();
    normalized.agreement_title = String(normalized.agreement_title || '').trim();
    normalized.customer_name = String(normalized.customer_name || '').trim();
    normalized.status = String(normalized.status || '').trim() || 'Draft';
    normalized.currency = String(normalized.currency || '').trim() || 'USD';
    return normalized;
  },
  normalizeItem(raw = {}, sectionFallback = '') {
    const source = raw && typeof raw === 'object' ? raw : {};
    const pick = (...values) => {
      for (const value of values) {
        if (value !== undefined && value !== null && String(value).trim() !== '') return value;
      }
      return '';
    };
    const section = String(pick(source.section, source.type, sectionFallback)).trim().toLowerCase();
    const normalized = {
      item_id: String(pick(source.item_id, source.itemId, source.id)).trim(),
      agreement_id: String(pick(source.agreement_id, source.agreementId)).trim(),
      section,
      line_no: this.toNumberSafe(pick(source.line_no, source.lineNo, source.line)),
      location_name: String(pick(source.location_name, source.locationName)).trim(),
      location_address: String(pick(source.location_address, source.locationAddress)).trim(),
      service_start_date: String(pick(source.service_start_date, source.serviceStartDate)).trim(),
      service_end_date: String(pick(source.service_end_date, source.serviceEndDate)).trim(),
      item_name: String(pick(source.item_name, source.itemName, source.name)).trim(),
      unit_price: this.toNumberSafe(pick(source.unit_price, source.unitPrice)),
      discount_percent: this.toNumberSafe(pick(source.discount_percent, source.discountPercent)),
      discounted_unit_price: this.toNumberSafe(pick(source.discounted_unit_price, source.discountedUnitPrice)),
      quantity: this.toNumberSafe(pick(source.quantity, source.qty)),
      line_total: this.toNumberSafe(pick(source.line_total, source.lineTotal)),
      capability_name: String(pick(source.capability_name, source.capabilityName)).trim(),
      capability_value: String(pick(source.capability_value, source.capabilityValue)).trim(),
      notes: String(pick(source.notes)).trim(),
      updated_at: String(pick(source.updated_at, source.updatedAt)).trim()
    };
    if (section === 'annual_saas' || section === 'one_time_fee') {
      const discountRatio = normalized.discount_percent > 1 ? normalized.discount_percent / 100 : normalized.discount_percent;
      if (!normalized.discounted_unit_price) normalized.discounted_unit_price = normalized.unit_price * (1 - discountRatio);
      if (!normalized.line_total) normalized.line_total = normalized.discounted_unit_price * (normalized.quantity || 0);
    }
    return normalized;
  },
  groupedItems(items = []) {
    const grouped = { annual_saas: [], one_time_fee: [], capability: [] };
    (Array.isArray(items) ? items : []).forEach(raw => {
      const item = this.normalizeItem(raw);
      if (item.section === 'capability') grouped.capability.push(item);
      else if (item.section === 'one_time_fee') grouped.one_time_fee.push(item);
      else grouped.annual_saas.push({ ...item, section: 'annual_saas' });
    });
    return grouped;
  },
  emptyAgreement() {
    return {
      agreement_id: '', agreement_number: '', proposal_id: '', deal_id: '', lead_id: '', agreement_title: '',
      agreement_date: '', effective_date: '', service_start_date: '', agreement_length: '', account_number: '',
      billing_frequency: '', payment_term: '', po_number: '', currency: 'USD', customer_name: '',
      customer_legal_name: '', customer_address: '', customer_contact_name: '', customer_contact_mobile: '',
      customer_contact_email: '', provider_name: '', provider_legal_name: '', provider_address: '',
      provider_contact_name: '', provider_contact_mobile: '', provider_contact_email: '', status: 'Draft',
      terms_conditions: '', customer_signatory_name: '', customer_signatory_title: '',
      provider_signatory_name_primary: '', provider_signatory_title_primary: '',
      provider_signatory_name_secondary: '', provider_signatory_title_secondary: '', provider_sign_date: '',
      customer_sign_date: '', generated_by: '', notes: ''
    };
  },
  extractRows(response) {
    const candidates = [response, response?.agreements, response?.items, response?.rows, response?.data, response?.result, response?.payload, response?.data?.agreements, response?.result?.agreements, response?.payload?.agreements];
    for (const candidate of candidates) if (Array.isArray(candidate)) return candidate;
    return [];
  },
  extractAgreementAndItems(response, fallbackId = '') {
    const candidates = [response, response?.data, response?.result, response?.payload];
    let agreement = null;
    let items = [];
    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== 'object') continue;
      if (!agreement) {
        if (candidate.agreement && typeof candidate.agreement === 'object') agreement = candidate.agreement;
        else if (candidate.agreement_id || candidate.agreement_number || candidate.agreement_title) agreement = candidate;
      }
      if (!items.length) {
        if (Array.isArray(candidate.items)) items = candidate.items;
        else if (Array.isArray(candidate.agreement_items)) items = candidate.agreement_items;
      }
    }
    return {
      agreement: this.normalizeAgreement(agreement || { agreement_id: fallbackId }),
      items: Array.isArray(items) ? items.map(item => this.normalizeItem(item)) : []
    };
  },
  async listAgreements() { return Api.listAgreements(); },
  async getAgreement(id) { return Api.getAgreement(id); },
  async createAgreement(agreement, items) { return Api.createAgreement(agreement, items); },
  async updateAgreement(id, updates, items) { return Api.updateAgreement(id, updates, items); },
  async deleteAgreement(id) { return Api.deleteAgreement(id); },
  async createAgreementFromProposal(proposalId) { return Api.createAgreementFromProposal(proposalId); },
  async generateAgreementHtml(agreementId) { return Api.generateAgreementHtml(agreementId); },
  applyFilters() {
    const terms = String(this.state.search || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
    const relationTerms = String(this.state.proposalOrDeal || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
    this.state.filteredRows = this.state.rows.filter(row => {
      if (this.state.status !== 'All' && String(row.status || '').trim() !== this.state.status) return false;
      const hay = [row.agreement_id, row.agreement_number, row.customer_name, row.customer_contact_email, row.agreement_title, row.proposal_id, row.deal_id, row.status]
        .filter(Boolean).join(' ').toLowerCase();
      if (terms.length && !terms.every(t => hay.includes(t))) return false;
      if (relationTerms.length) {
        const relationHay = [row.proposal_id, row.deal_id].filter(Boolean).join(' ').toLowerCase();
        if (!relationTerms.every(t => relationHay.includes(t))) return false;
      }
      return true;
    });
  },
  renderSummary() {
    if (!E.agreementsSummary) return;
    const rows = this.state.filteredRows;
    const countBy = fn => rows.filter(fn).length;
    const statusMatch = (row, tokens) => tokens.some(t => this.normalizeText(row.status).includes(t));
    const sentReviewAwaiting = countBy(row => statusMatch(row, ['sent', 'under review', 'awaiting signature']));
    const signedActive = countBy(row => statusMatch(row, ['signed', 'active']));
    const expiredCancelled = countBy(row => statusMatch(row, ['expired', 'cancelled', 'canceled']));
    const totalValue = rows.reduce((sum, row) => sum + this.toNumberSafe(row.grand_total), 0);
    const proposalLinked = countBy(row => String(row.proposal_id || '').trim());
    const draftCount = countBy(row => this.normalizeText(row.status) === 'draft');
    const cards = [
      ['Total Agreements', rows.length],
      ['Draft Agreements', draftCount],
      ['Sent / Under Review / Awaiting Signature', sentReviewAwaiting],
      ['Signed / Active', signedActive],
      ['Expired / Cancelled', expiredCancelled],
      ['Total Contract Value', this.formatMoney(totalValue)],
      ['Proposal-linked Agreements', proposalLinked]
    ];
    E.agreementsSummary.innerHTML = cards.map(([label, value]) => `<div class="card kpi"><div class="label">${U.escapeHtml(label)}</div><div class="value">${U.escapeHtml(String(value))}</div></div>`).join('');
  },
  renderFilters() {
    const statuses = [...new Set(this.state.rows.map(r => String(r.status || '').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
    if (E.agreementsStatusFilter) {
      const options = ['All', ...statuses];
      E.agreementsStatusFilter.innerHTML = options.map(v=>`<option>${U.escapeHtml(v)}</option>`).join('');
      E.agreementsStatusFilter.value = options.includes(this.state.status) ? this.state.status : 'All';
    }
    if (E.agreementsSearchInput) E.agreementsSearchInput.value = this.state.search;
    if (E.agreementsProposalDealFilter) E.agreementsProposalDealFilter.value = this.state.proposalOrDeal;
  },
  render() {
    if (!E.agreementsState || !E.agreementsTbody) return;
    if (this.state.loading) {
      E.agreementsState.textContent = 'Loading agreements…';
      E.agreementsTbody.innerHTML = '<tr><td colspan="15" class="muted" style="text-align:center;">Loading agreements…</td></tr>';
      return;
    }
    if (this.state.loadError) {
      E.agreementsState.textContent = this.state.loadError;
      E.agreementsTbody.innerHTML = `<tr><td colspan="15" class="muted" style="text-align:center;color:#ffb4b4;">${U.escapeHtml(this.state.loadError)}</td></tr>`;
      return;
    }
    const rows = this.state.filteredRows;
    E.agreementsState.textContent = `${rows.length} agreement${rows.length === 1 ? '' : 's'}`;
    this.renderSummary();
    if (!rows.length) {
      E.agreementsTbody.innerHTML = '<tr><td colspan="15" class="muted" style="text-align:center;">No agreements found.</td></tr>';
      return;
    }
    const textCell = value => U.escapeHtml(String(value ?? '').trim() || '—');
    E.agreementsTbody.innerHTML = rows.map(row => {
      const id = U.escapeAttr(row.agreement_id || '');
      return `<tr>
        <td>${textCell(row.agreement_id)}</td><td>${textCell(row.agreement_number)}</td><td>${textCell(row.agreement_title)}</td>
        <td>${textCell(row.customer_name)}</td><td>${textCell(row.proposal_id)}</td><td>${textCell(row.deal_id)}</td>
        <td>${textCell(row.service_start_date)}</td><td>${textCell(row.agreement_length)}</td><td>${textCell(row.billing_frequency)}</td>
        <td>${textCell(row.payment_term)}</td><td>${textCell(row.currency)}</td><td>${textCell(this.formatMoney(row.grand_total))}</td>
        <td>${textCell(row.status)}</td><td>${textCell(row.updated_at)}</td>
        <td><div style="display:flex;gap:6px;flex-wrap:wrap;">
        <button class="btn ghost sm" type="button" data-agreement-view="${id}">View</button>
        <button class="btn ghost sm" type="button" data-agreement-edit="${id}">Edit</button>
        <button class="btn ghost sm" type="button" data-agreement-preview="${id}">View Agreement</button>
        <button class="btn ghost sm" type="button" data-agreement-delete="${id}">Delete</button>
        </div></td></tr>`;
    }).join('');
  },
  collectFormValues() {
    const v = id => String(document.getElementById(id)?.value || '').trim();
    const agreement = {};
    this.agreementFields.forEach(field => {
      const inputId = `agreementForm${field.replace(/(^|_)([a-z])/g, (_, __, ch) => ch.toUpperCase())}`;
      agreement[field] = v(inputId);
    });
    const items = this.collectItems();
    const totals = this.calculateTotals(items);
    agreement.saas_total = totals.saas_total;
    agreement.one_time_total = totals.one_time_total;
    agreement.grand_total = totals.grand_total;
    return { agreement, items };
  },
  calculateTotals(items = []) {
    const safeItems = Array.isArray(items) ? items : [];
    const saas_total = safeItems.filter(i => i.section === 'annual_saas').reduce((sum, i) => sum + this.toNumberSafe(i.line_total), 0);
    const one_time_total = safeItems.filter(i => i.section === 'one_time_fee').reduce((sum, i) => sum + this.toNumberSafe(i.line_total), 0);
    return { saas_total, one_time_total, grand_total: saas_total + one_time_total };
  },
  collectItems() {
    const rows = Array.from(E.agreementForm?.querySelectorAll('tr[data-item-row]') || []);
    return rows.map((tr, index) => {
      const section = String(tr.getAttribute('data-item-row') || '').trim();
      const get = key => String(tr.querySelector(`[data-item-field="${key}"]`)?.value || '').trim();
      const item = this.normalizeItem({
        section,
        line_no: index + 1,
        location_name: get('location_name'),
        location_address: get('location_address'),
        service_start_date: get('service_start_date'),
        service_end_date: get('service_end_date'),
        item_name: get('item_name'),
        unit_price: this.toNumberSafe(get('unit_price')),
        discount_percent: this.toNumberSafe(get('discount_percent')),
        discounted_unit_price: this.toNumberSafe(get('discounted_unit_price')),
        quantity: this.toNumberSafe(get('quantity')),
        line_total: this.toNumberSafe(get('line_total')),
        capability_name: get('capability_name'),
        capability_value: get('capability_value'),
        notes: get('notes')
      }, section);
      if (section === 'annual_saas' || section === 'one_time_fee') {
        const discount = item.discount_percent > 1 ? item.discount_percent / 100 : item.discount_percent;
        item.discounted_unit_price = item.unit_price * (1 - Math.max(0, discount));
        item.line_total = item.discounted_unit_price * (item.quantity || 0);
      }
      return item;
    });
  },
  renderItemRows(items = []) {
    const grouped = this.groupedItems(items);
    const rowHtml = (section, item, index) => {
      if (section === 'capability') {
        return `<tr data-item-row="capability"><td><input class="input" data-item-field="capability_name" value="${U.escapeAttr(item.capability_name || '')}" /></td><td><input class="input" data-item-field="capability_value" value="${U.escapeAttr(item.capability_value || '')}" /></td><td><input class="input" data-item-field="notes" value="${U.escapeAttr(item.notes || '')}" /></td><td><button type="button" class="btn ghost sm" data-item-remove="capability" data-item-index="${index}">Remove</button></td></tr>`;
      }
      return `<tr data-item-row="${section}">
      <td><input class="input" data-item-field="location_name" value="${U.escapeAttr(item.location_name || '')}" /></td>
      <td><input class="input" data-item-field="item_name" value="${U.escapeAttr(item.item_name || '')}" /></td>
      <td><input class="input" data-item-field="unit_price" type="number" step="0.01" value="${U.escapeAttr(item.unit_price || '')}" /></td>
      <td><input class="input" data-item-field="discount_percent" type="number" step="0.01" value="${U.escapeAttr(item.discount_percent || '')}" /></td>
      <td><input class="input" data-item-field="quantity" type="number" step="0.01" value="${U.escapeAttr(item.quantity || '')}" /></td>
      <td><input class="input" data-item-field="discounted_unit_price" type="number" step="0.01" value="${U.escapeAttr(item.discounted_unit_price || '')}" /></td>
      <td><input class="input" data-item-field="line_total" type="number" step="0.01" value="${U.escapeAttr(item.line_total || '')}" /></td>
      <td><button type="button" class="btn ghost sm" data-item-remove="${section}" data-item-index="${index}">Remove</button></td>
      </tr>`;
    };
    if (E.agreementAnnualItemsTbody) E.agreementAnnualItemsTbody.innerHTML = grouped.annual_saas.map((item, idx) => rowHtml('annual_saas', item, idx)).join('');
    if (E.agreementOneTimeItemsTbody) E.agreementOneTimeItemsTbody.innerHTML = grouped.one_time_fee.map((item, idx) => rowHtml('one_time_fee', item, idx)).join('');
    if (E.agreementCapabilityItemsTbody) E.agreementCapabilityItemsTbody.innerHTML = grouped.capability.map((item, idx) => rowHtml('capability', item, idx)).join('');
    const totals = this.calculateTotals(items);
    if (E.agreementSaasTotal) E.agreementSaasTotal.textContent = this.formatMoney(totals.saas_total);
    if (E.agreementOneTimeTotal) E.agreementOneTimeTotal.textContent = this.formatMoney(totals.one_time_total);
    if (E.agreementGrandTotal) E.agreementGrandTotal.textContent = this.formatMoney(totals.grand_total);
  },
  assignFormValues(agreement = {}) {
    const set = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.value = value ?? '';
    };
    this.agreementFields.forEach(field => {
      const id = `agreementForm${field.replace(/(^|_)([a-z])/g, (_, __, ch) => ch.toUpperCase())}`;
      set(id, agreement[field] || '');
    });
  },
  setFormReadOnly(readOnly) {
    if (!E.agreementForm) return;
    E.agreementForm.querySelectorAll('input, select, textarea, button').forEach(el => {
      if (el.id === 'agreementFormAgreementId' || el.id === 'agreementFormAgreementNumber') return;
      if (el.type === 'button' && /Preview|Cancel/i.test(el.textContent || '')) return;
      if (el.id === 'agreementFormPreviewBtn') return;
      if (el.id === 'agreementFormCancelBtn') return;
      if (el.id === 'agreementFormCloseBtn') return;
      if (el.id === 'agreementFormDeleteBtn') el.style.display = readOnly ? 'none' : '';
      if (el.id === 'agreementFormSaveBtn') el.style.display = readOnly ? 'none' : '';
      if ('disabled' in el && !/agreementForm(Delete|Save)Btn/.test(el.id)) el.disabled = readOnly;
    });
  },
  openAgreementForm(agreement = this.emptyAgreement(), items = [], { readOnly = false } = {}) {
    if (!E.agreementFormModal || !E.agreementForm) return;
    this.assignFormValues(agreement);
    this.renderItemRows(items);
    E.agreementForm.dataset.id = agreement.agreement_id || '';
    E.agreementForm.dataset.mode = agreement.agreement_id ? 'edit' : 'create';
    if (E.agreementFormTitle) E.agreementFormTitle.textContent = agreement.agreement_id ? (readOnly ? 'View Agreement' : 'Edit Agreement') : 'Create Agreement';
    this.setFormReadOnly(readOnly);
    E.agreementFormModal.classList.add('open');
    E.agreementFormModal.setAttribute('aria-hidden', 'false');
  },
  closeAgreementForm() {
    if (!E.agreementFormModal || !E.agreementForm) return;
    E.agreementFormModal.classList.remove('open');
    E.agreementFormModal.setAttribute('aria-hidden', 'true');
    E.agreementForm.reset();
    E.agreementForm.dataset.id = '';
    this.renderItemRows([]);
  },
  addRow(section) {
    const items = this.collectItems();
    if (section === 'capability') items.push({ section: 'capability', capability_name: '', capability_value: '', notes: '' });
    else items.push({ section, location_name: '', item_name: '', unit_price: 0, discount_percent: 0, quantity: 1, discounted_unit_price: 0, line_total: 0 });
    this.renderItemRows(items);
  },
  removeRow(section, index) {
    const grouped = this.groupedItems(this.collectItems());
    grouped[section] = grouped[section].filter((_, idx) => idx !== index);
    this.renderItemRows([...grouped.annual_saas, ...grouped.one_time_fee, ...grouped.capability]);
  },
  async openAgreementFormById(agreementId, { readOnly = false } = {}) {
    try {
      const response = await this.getAgreement(agreementId);
      const { agreement, items } = this.extractAgreementAndItems(response, agreementId);
      this.openAgreementForm(agreement, items, { readOnly });
    } catch (error) {
      if (typeof isAuthError === 'function' && isAuthError(error)) {
        handleExpiredSession('Session expired. Please log in again.');
        return;
      }
      UI.toast('Unable to load agreement: ' + (error?.message || 'Unknown error'));
    }
  },
  async submitForm() {
    if (!Permissions.canCreateLead()) {
      UI.toast('Login is required to save agreements.');
      return;
    }
    const id = String(E.agreementForm?.dataset.id || '').trim();
    const { agreement, items } = this.collectFormValues();
    try {
      if (id) await this.updateAgreement(id, agreement, items);
      else await this.createAgreement(agreement, items);
      this.closeAgreementForm();
      await this.loadAndRefresh({ force: true });
      UI.toast(id ? 'Agreement updated.' : 'Agreement created.');
    } catch (error) {
      if (typeof isAuthError === 'function' && isAuthError(error)) {
        handleExpiredSession('Session expired. Please log in again.');
        return;
      }
      UI.toast('Unable to save agreement: ' + (error?.message || 'Unknown error'));
    }
  },
  async deleteById(agreementId) {
    if (!Permissions.canEditDeleteLead()) {
      UI.toast('Insufficient permissions to delete agreements.');
      return;
    }
    const id = String(agreementId || '').trim();
    if (!id || !window.confirm(`Delete agreement ${id}?`)) return;
    try {
      await this.deleteAgreement(id);
      this.closeAgreementForm();
      await this.loadAndRefresh({ force: true });
      UI.toast('Agreement deleted.');
    } catch (error) {
      if (typeof isAuthError === 'function' && isAuthError(error)) {
        handleExpiredSession('Session expired. Please log in again.');
        return;
      }
      UI.toast('Unable to delete agreement: ' + (error?.message || 'Unknown error'));
    }
  },
  async previewAgreementHtml(id) {
    const agreementId = String(id || '').trim();
    if (!agreementId) return;
    try {
      const response = await this.generateAgreementHtml(agreementId);
      const html = String(response?.html || response?.agreement_html || response?.content || response || '').trim();
      if (!html) {
        UI.toast('No agreement HTML was returned by backend.');
        return;
      }
      if (E.agreementPreviewTitle) E.agreementPreviewTitle.textContent = `Agreement Preview · ${agreementId}`;
      if (E.agreementPreviewFrame) E.agreementPreviewFrame.srcdoc = html;
      if (E.agreementPreviewModal) {
        E.agreementPreviewModal.classList.add('open');
        E.agreementPreviewModal.setAttribute('aria-hidden', 'false');
      }
    } catch (error) {
      if (typeof isAuthError === 'function' && isAuthError(error)) {
        handleExpiredSession('Session expired. Please log in again.');
        return;
      }
      UI.toast('Unable to preview agreement: ' + (error?.message || 'Unknown error'));
    }
  },
  closePreviewModal() {
    if (!E.agreementPreviewModal) return;
    E.agreementPreviewModal.classList.remove('open');
    E.agreementPreviewModal.setAttribute('aria-hidden', 'true');
    if (E.agreementPreviewFrame) E.agreementPreviewFrame.srcdoc = '';
  },
  async createFromProposalFlow(proposalId) {
    if (!Permissions.canCreateLead()) {
      UI.toast('Login is required to create agreements from proposals.');
      return;
    }
    const id = String(proposalId || '').trim();
    if (!id) {
      UI.toast('Proposal ID is required.');
      return;
    }
    try {
      const response = await this.createAgreementFromProposal(id);
      const { agreement, items } = this.extractAgreementAndItems(response);
      await this.loadAndRefresh({ force: true });
      const createdAgreementId = String(agreement?.agreement_id || '').trim();
      if (createdAgreementId) {
        this.openAgreementForm(agreement, items, { readOnly: false });
        UI.toast(
          `Agreement ${createdAgreementId} created from proposal ${id}. Review, complete missing fields, and verify details before saving.`
        );
      } else {
        this.openAgreementForm(
          this.normalizeAgreement({ ...this.emptyAgreement(), proposal_id: id }),
          items,
          { readOnly: false }
        );
        UI.toast(
          `Agreement template created from proposal ${id}. Complete missing fields and verify details before saving.`
        );
      }
    } catch (error) {
      if (typeof isAuthError === 'function' && isAuthError(error)) {
        handleExpiredSession('Session expired. Please log in again.');
        return;
      }
      UI.toast('Unable to create from proposal: ' + (error?.message || 'Unknown error'));
    }
  },
  async loadAndRefresh({ force = false } = {}) {
    if (this.state.loading && !force) return;
    this.state.loading = true;
    this.state.loadError = '';
    this.render();
    try {
      const response = await this.listAgreements();
      this.state.rows = this.extractRows(response).map(row => this.normalizeAgreement(row));
    } catch (error) {
      if (typeof isAuthError === 'function' && isAuthError(error)) {
        handleExpiredSession('Session expired. Please log in again.');
        return;
      }
      this.state.rows = [];
      this.state.loadError = String(error?.message || '').trim() || 'Unable to load agreements.';
    } finally {
      this.state.loading = false;
      this.applyFilters();
      this.renderFilters();
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
    bindState(E.agreementsSearchInput, 'search');
    bindState(E.agreementsStatusFilter, 'status');
    bindState(E.agreementsProposalDealFilter, 'proposalOrDeal');

    if (E.agreementsRefreshBtn) E.agreementsRefreshBtn.addEventListener('click', () => this.loadAndRefresh({ force: true }));
    if (E.agreementsCreateBtn) E.agreementsCreateBtn.addEventListener('click', () => this.openAgreementForm());
    if (E.agreementsCreateFromProposalBtn) E.agreementsCreateFromProposalBtn.addEventListener('click', () => this.createFromProposalFlow(E.agreementsCreateFromProposalInput?.value || ''));
    if (E.agreementsTbody) E.agreementsTbody.addEventListener('click', event => {
      const viewId = event.target?.getAttribute('data-agreement-view');
      if (viewId) return this.openAgreementFormById(viewId, { readOnly: true });
      const editId = event.target?.getAttribute('data-agreement-edit');
      if (editId) return this.openAgreementFormById(editId, { readOnly: false });
      const previewId = event.target?.getAttribute('data-agreement-preview');
      if (previewId) return this.previewAgreementHtml(previewId);
      const deleteId = event.target?.getAttribute('data-agreement-delete');
      if (deleteId) return this.deleteById(deleteId);
    });

    if (E.agreementFormCloseBtn) E.agreementFormCloseBtn.addEventListener('click', () => this.closeAgreementForm());
    if (E.agreementFormCancelBtn) E.agreementFormCancelBtn.addEventListener('click', () => this.closeAgreementForm());
    if (E.agreementFormModal) E.agreementFormModal.addEventListener('click', event => {
      if (event.target === E.agreementFormModal) this.closeAgreementForm();
    });
    if (E.agreementForm) {
      E.agreementForm.addEventListener('submit', event => { event.preventDefault(); this.submitForm(); });
      E.agreementForm.addEventListener('click', event => {
        const section = event.target?.getAttribute('data-item-remove');
        const index = Number(event.target?.getAttribute('data-item-index'));
        if (section && Number.isInteger(index) && index >= 0) this.removeRow(section, index);
      });
      E.agreementForm.addEventListener('input', event => {
        if (!event.target?.getAttribute('data-item-field')) return;
        this.renderItemRows(this.collectItems());
      });
    }
    if (E.agreementFormDeleteBtn) E.agreementFormDeleteBtn.addEventListener('click', () => this.deleteById(E.agreementForm?.dataset.id || ''));
    if (E.agreementFormPreviewBtn) E.agreementFormPreviewBtn.addEventListener('click', () => {
      const id = String(E.agreementForm?.dataset.id || '').trim();
      if (!id) return UI.toast('Save the agreement first to preview backend-generated HTML.');
      this.previewAgreementHtml(id);
    });

    if (E.agreementAddAnnualRowBtn) E.agreementAddAnnualRowBtn.addEventListener('click', () => this.addRow('annual_saas'));
    if (E.agreementAddOneTimeRowBtn) E.agreementAddOneTimeRowBtn.addEventListener('click', () => this.addRow('one_time_fee'));
    if (E.agreementAddCapabilityRowBtn) E.agreementAddCapabilityRowBtn.addEventListener('click', () => this.addRow('capability'));
    if (E.agreementPreviewCloseBtn) E.agreementPreviewCloseBtn.addEventListener('click', () => this.closePreviewModal());
    if (E.agreementPreviewModal) E.agreementPreviewModal.addEventListener('click', event => {
      if (event.target === E.agreementPreviewModal) this.closePreviewModal();
    });
    this.state.initialized = true;
  }
};

window.Agreements = Agreements;
