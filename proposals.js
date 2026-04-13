const Proposals = {
  proposalFields: [
    'proposal_id',
    'ref_number',
    'created_at',
    'deal_id',
    'lead_id',
    'proposal_title',
    'proposal_date',
    'valid_until',
    'customer_name',
    'customer_address',
    'customer_contact_name',
    'customer_contact_mobile',
    'customer_contact_email',
    'provider_contact_name',
    'provider_contact_mobile',
    'provider_contact_email',
    'service_start_date',
    'contract_term',
    'account_number',
    'billing_frequency',
    'payment_term',
    'po_number',
    'currency',
    'saas_total',
    'one_time_total',
    'grand_total',
    'terms_conditions',
    'customer_signatory_name',
    'customer_signatory_title',
    'provider_signatory_name',
    'provider_signatory_title',
    'provider_sign_date',
    'status',
    'generated_by',
    'updated_at'
  ],
  state: {
    rows: [],
    filteredRows: [],
    loading: false,
    loadError: '',
    initialized: false,
    search: '',
    customer: '',
    status: 'All',
    formMode: 'create',
    formReadOnly: false,
    currentProposalId: '',
    currentItems: [],
    catalogLoading: false
  },
  toNumberSafe(value) {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const parsed = Number(String(value).replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : 0;
  },
  normalizeDiscount(value) {
    const raw = this.toNumberSafe(value);
    if (raw > 1) return raw / 100;
    if (raw < 0) return 0;
    return raw;
  },
  formatMoney(value) {
    const num = this.toNumberSafe(value);
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  },
  normalizeText(value) {
    return String(value ?? '').trim().toLowerCase();
  },
  generateRefNumber() {
    return `${Date.now()}${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0')}`;
  },
  sanitizeRefNumber(value = '') {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    if (/^\d+(?:\.0+)?$/.test(raw)) return raw.split('.')[0];
    const digitsOnly = raw.replace(/\D+/g, '');
    return digitsOnly;
  },
  ensureRefNumber(value = '') {
    const sanitized = this.sanitizeRefNumber(value);
    return sanitized || this.generateRefNumber();
  },
  normalizeProposal(raw = {}) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const normalized = {};
    this.proposalFields.forEach(field => {
      const camel = field.replace(/_([a-z])/g, (_, ch) => ch.toUpperCase());
      const value = source[field] ?? source[camel] ?? '';
      normalized[field] = typeof value === 'string' ? value.trim() : value;
    });
    normalized.proposal_id = String(normalized.proposal_id || source.id || '').trim();
    normalized.ref_number = this.ensureRefNumber(normalized.ref_number || '');
    normalized.proposal_title = String(normalized.proposal_title || '').trim();
    normalized.customer_name = String(normalized.customer_name || '').trim();
    normalized.status = String(normalized.status || '').trim();
    normalized.currency = String(normalized.currency || '').trim();
    normalized.deal_id = String(normalized.deal_id || '').trim();
    normalized.generated_by = String(normalized.generated_by || '').trim();
    return normalized;
  },
  proposalDraftFromDeal(rawDeal = {}) {
    const deal = rawDeal && typeof rawDeal === 'object' ? rawDeal : {};
    const companyName = String(deal.company_name || deal.companyName || '').trim();
    const fullName = String(deal.full_name || deal.fullName || '').trim();
    const serviceInterest = String(deal.service_interest || deal.serviceInterest || '').trim();
    const titleParts = [companyName || fullName, serviceInterest].filter(Boolean);
    return {
      ...this.emptyProposal(),
      deal_id: String(deal.deal_id || deal.dealId || '').trim(),
      proposal_title: titleParts.length ? `${titleParts.join(' · ')} Proposal` : '',
      customer_name: companyName || fullName,
      customer_contact_name: fullName,
      customer_contact_mobile: String(deal.phone || '').trim(),
      customer_contact_email: String(deal.email || '').trim(),
      currency: String(deal.currency || '').trim() || 'USD'
    };
  },
  async resolveDealForProposal(dealId) {
    const trimmedDealId = String(dealId || '').trim();
    if (!trimmedDealId) return null;

    const localRows = Array.isArray(window.Deals?.state?.rows) ? window.Deals.state.rows : [];
    const localMatch = localRows.find(row => String(row?.deal_id || '').trim() === trimmedDealId);
    if (localMatch) return localMatch;

    if (typeof window.Deals?.getDeal === 'function') {
      try {
        const response = await window.Deals.getDeal(trimmedDealId);
        const candidate = response?.deal || response?.data?.deal || response?.result?.deal || response;
        if (candidate && typeof window.Deals.normalizeDeal === 'function') {
          return window.Deals.normalizeDeal(candidate);
        }
        return candidate && typeof candidate === 'object' ? candidate : null;
      } catch (_) {
        return null;
      }
    }
    return null;
  },
  normalizeItem(raw = {}, sectionFallback = '') {
    const source = raw && typeof raw === 'object' ? raw : {};
    const pick = (...values) => {
      for (const value of values) {
        if (value !== undefined && value !== null && String(value).trim() !== '') return value;
      }
      return '';
    };
    const section = String(
      pick(source.section, source.item_section, source.type, sectionFallback)
    )
      .trim()
      .toLowerCase();
    const normalized = {
      item_id: String(pick(source.item_id, source.itemId, source.id)).trim(),
      proposal_id: String(pick(source.proposal_id, source.proposalId)).trim(),
      catalog_item_id: String(pick(source.catalog_item_id, source.catalogItemId)).trim(),
      section,
      line_no: this.toNumberSafe(pick(source.line_no, source.lineNo, source.line)) || 0,
      location_name: String(pick(source.location_name, source.locationName)).trim(),
      item_name: String(pick(source.item_name, source.itemName, source.name)).trim(),
      unit_price: this.toNumberSafe(pick(source.unit_price, source.unitPrice)),
      discount_percent: this.toNumberSafe(pick(source.discount_percent, source.discountPercent)),
      discounted_unit_price: this.toNumberSafe(
        pick(source.discounted_unit_price, source.discountedUnitPrice)
      ),
      quantity: this.toNumberSafe(pick(source.quantity, source.qty, source.count)),
      line_total: this.toNumberSafe(pick(source.line_total, source.lineTotal)),
      capability_name: String(pick(source.capability_name, source.capabilityName)).trim(),
      capability_value: String(pick(source.capability_value, source.capabilityValue)).trim(),
      notes: String(pick(source.notes)).trim(),
      updated_at: pick(source.updated_at, source.updatedAt)
    };

    if (section === 'annual_saas' || section === 'one_time_fee') {
      const discountRatio = this.normalizeDiscount(normalized.discount_percent);
      if (!normalized.discounted_unit_price) {
        normalized.discounted_unit_price = normalized.unit_price * (1 - discountRatio);
      }
      if (!normalized.line_total) {
        normalized.line_total = normalized.discounted_unit_price * (normalized.quantity || 0);
      }
    }

    return normalized;
  },
  extractRows(response) {
    const candidates = [
      response,
      response?.proposals,
      response?.items,
      response?.rows,
      response?.data,
      response?.result,
      response?.payload,
      response?.data?.proposals,
      response?.result?.proposals,
      response?.payload?.proposals
    ];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return candidate;
    }
    return [];
  },
  extractProposalAndItems(response, fallbackId = '') {
    const parseJsonIfNeeded = value => {
      if (typeof value !== 'string') return value;
      const trimmed = value.trim();
      if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return value;
      try { return JSON.parse(trimmed); } catch { return value; }
    };

    const candidates = [
      response,
      response?.data,
      response?.result,
      response?.payload,
      response?.item,
      response?.proposal
    ];

    let proposal = null;
    let items = [];

    for (const rawCandidate of candidates) {
      const candidate = parseJsonIfNeeded(rawCandidate);
      if (!candidate) continue;

      if (Array.isArray(candidate)) {
        const first = candidate[0];
        if (!proposal && first && typeof first === 'object') {
          proposal = first;
        }
        if (!items.length && Array.isArray(first?.items)) {
          items = first.items;
        }
        continue;
      }

      if (typeof candidate !== 'object') continue;

      if (!proposal) {
        if (candidate.item && typeof candidate.item === 'object') proposal = candidate.item;
        else if (candidate.proposal && typeof candidate.proposal === 'object') proposal = candidate.proposal;
        else if (Array.isArray(candidate.data) && candidate.data[0] && typeof candidate.data[0] === 'object') proposal = candidate.data[0];
        else if (candidate.data && typeof candidate.data === 'object' && !Array.isArray(candidate.data)) proposal = candidate.data;
        else if (candidate.proposal_id || candidate.ref_number || candidate.proposal_title) proposal = candidate;
      }

      if (!items.length) {
        if (Array.isArray(candidate.items)) items = candidate.items;
        else if (Array.isArray(candidate.proposal_items)) items = candidate.proposal_items;
        else if (candidate.item && Array.isArray(candidate.item.items)) items = candidate.item.items;
        else if (candidate.proposal && Array.isArray(candidate.proposal.items)) items = candidate.proposal.items;
        else if (Array.isArray(candidate.data) && Array.isArray(candidate.data[0]?.items)) items = candidate.data[0].items;
        else if (candidate.data && Array.isArray(candidate.data.items)) items = candidate.data.items;
      }
    }

    return {
      proposal: this.normalizeProposal(proposal || { proposal_id: fallbackId }),
      items: Array.isArray(items) ? items.map(item => this.normalizeItem(item)) : []
    };
  },
  async listProposals(options = {}) {
    return Api.postAuthenticatedCached('proposals', 'list', {}, { forceRefresh: options.forceRefresh === true });
  },
  async getProposal(proposalId) {
    return Api.postAuthenticated('proposals', 'get', { proposal_id: proposalId });
  },
  async createProposal(proposal, items) {
    return Api.postAuthenticated('proposals', 'create', { proposal, items });
  },
  async saveProposal(proposal, items) {
    return Api.postAuthenticated('proposals', 'save', { proposal, items });
  },
  async updateProposal(proposalId, updates, items) {
    return Api.postAuthenticated('proposals', 'update', {
      proposal_id: proposalId,
      updates,
      items
    });
  },
  async deleteProposal(proposalId) {
    return Api.postAuthenticated('proposals', 'delete', { proposal_id: proposalId });
  },
  async createFromDeal(dealId) {
    return Api.postAuthenticated('proposals', 'create_from_deal', { deal_id: dealId });
  },
  async generateProposalHtml(proposalId) {
    return Api.postAuthenticated('proposals', 'generate_proposal_html', { proposal_id: proposalId });
  },
  applyFilters() {
    const terms = String(this.state.search || '')
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const customerTerms = String(this.state.customer || '')
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    this.state.filteredRows = this.state.rows.filter(row => {
      const status = String(row?.status || '').trim();
      if (this.state.status !== 'All' && status !== this.state.status) return false;

      const hay = [
        row.proposal_id,
        row.ref_number,
        row.proposal_title,
        row.customer_name,
        row.deal_id,
        row.status,
        row.currency,
        row.generated_by
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (terms.length && !terms.every(term => hay.includes(term))) return false;
      if (
        customerTerms.length &&
        !customerTerms.every(term => String(row.customer_name || '').toLowerCase().includes(term))
      )
        return false;
      return true;
    });
  },
  renderFilters() {
    const statusValues = [...new Set(this.state.rows.map(row => String(row.status || '').trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));

    if (E.proposalsStatusFilter) {
      const options = ['All', ...statusValues];
      E.proposalsStatusFilter.innerHTML = options.map(v => `<option>${U.escapeHtml(v)}</option>`).join('');
      E.proposalsStatusFilter.value = options.includes(this.state.status) ? this.state.status : 'All';
    }
    if (E.proposalsSearchInput) E.proposalsSearchInput.value = this.state.search;
    if (E.proposalsCustomerFilter) E.proposalsCustomerFilter.value = this.state.customer;
  },
  render() {
    if (!E.proposalsState || !E.proposalsTbody) return;

    if (this.state.loading) {
      E.proposalsState.textContent = 'Loading proposals…';
      E.proposalsTbody.innerHTML = '<tr><td colspan="14" class="muted" style="text-align:center;">Loading proposals…</td></tr>';
      return;
    }

    if (this.state.loadError) {
      E.proposalsState.textContent = this.state.loadError;
      E.proposalsTbody.innerHTML = `<tr><td colspan="14" class="muted" style="text-align:center;color:#ffb4b4;">${U.escapeHtml(
        this.state.loadError
      )}</td></tr>`;
      return;
    }

    const rows = this.state.filteredRows;
    E.proposalsState.textContent = `${rows.length} proposal${rows.length === 1 ? '' : 's'}`;
    if (!rows.length) {
      E.proposalsTbody.innerHTML =
        '<tr><td colspan="14" class="muted" style="text-align:center;">No proposals found.</td></tr>';
      return;
    }

    const textCell = value => U.escapeHtml(String(value ?? '').trim() || '—');

    E.proposalsTbody.innerHTML = rows
      .map(row => {
        const id = U.escapeAttr(row.proposal_id || '');
        return `<tr>
          <td>${textCell(row.proposal_id)}</td>
          <td>${textCell(row.ref_number)}</td>
          <td>${textCell(row.proposal_title)}</td>
          <td>${textCell(row.customer_name)}</td>
          <td>${textCell(row.deal_id)}</td>
          <td>${textCell(row.status)}</td>
          <td>${textCell(row.currency)}</td>
          <td>${this.formatMoney(row.saas_total)}</td>
          <td>${this.formatMoney(row.one_time_total)}</td>
          <td>${this.formatMoney(row.grand_total)}</td>
          <td>${textCell(row.proposal_date)}</td>
          <td>${textCell(row.valid_until)}</td>
          <td>${textCell(row.generated_by)}</td>
          <td>
            <button class="btn ghost sm" type="button" data-proposal-view="${id}">View</button>
            ${Permissions.canUpdateProposal() ? `<button class="btn ghost sm" type="button" data-proposal-edit="${id}">Edit</button>` : ''}
            ${Permissions.canGenerateProposalHtml() ? `<button class="btn ghost sm" type="button" data-proposal-preview="${id}">Preview</button>` : ''}
            ${Permissions.canCreateAgreementFromProposal() ? `<button class="btn ghost sm" type="button" data-proposal-convert-agreement="${id}">Convert to Agreement</button>` : ''}
            ${Permissions.canDeleteProposal() ? `<button class="btn ghost sm" type="button" data-proposal-delete="${id}">Delete</button>` : ''}
          </td>
        </tr>`;
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
      const response = await this.listProposals({ forceRefresh: force });
      this.state.rows = this.extractRows(response).map(raw => this.normalizeProposal(raw));
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
      this.state.loadError = String(error?.message || '').trim() || 'Unable to load proposals.';
      this.render();
      UI.toast(this.state.loadError);
    } finally {
      this.state.loading = false;
      this.render();
    }
  },
  emptyProposal() {
    return {
      proposal_title: '',
      deal_id: '',
      proposal_date: '',
      valid_until: '',
      status: 'Draft',
      currency: 'USD',
      customer_name: '',
      customer_address: '',
      customer_contact_name: '',
      customer_contact_mobile: '',
      customer_contact_email: '',
      provider_contact_name: '',
      provider_contact_mobile: '',
      provider_contact_email: '',
      service_start_date: '',
      contract_term: '',
      account_number: '',
      billing_frequency: '',
      payment_term: '',
      po_number: '',
      customer_signatory_name: '',
      customer_signatory_title: '',
      provider_signatory_name: '',
      provider_signatory_title: '',
      provider_sign_date: '',
      terms_conditions: ''
    };
  },
  generateAccountNumber() {
    const now = new Date();
    const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
      now.getDate()
    ).padStart(2, '0')}`;
    const randomPart = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    return `ACC-${datePart}-${randomPart}`;
  },
  ensureAccountNumber(value = '') {
    const trimmed = String(value || '').trim();
    return trimmed || this.generateAccountNumber();
  },
  resetForm() {
    if (!E.proposalForm) return;
    E.proposalForm.reset();
    if (E.proposalFormProposalId) E.proposalFormProposalId.value = '';
    E.proposalForm.dataset.refNumber = '';
    this.state.currentProposalId = '';
    this.state.currentItems = [];
    if (E.proposalFormDeleteBtn) E.proposalFormDeleteBtn.style.display = 'none';
    if (E.proposalFormSaveBtn) E.proposalFormSaveBtn.disabled = false;
    if (E.proposalFormPreviewBtn) E.proposalFormPreviewBtn.disabled = false;
  },
  setFormReadOnly(readOnly) {
    this.state.formReadOnly = !!readOnly;
    if (!E.proposalForm) return;
    E.proposalForm.querySelectorAll('input, select, textarea').forEach(el => {
      if (el.id === 'proposalFormProposalId') return;
      el.disabled = !!readOnly;
    });
    [E.proposalAddAnnualRowBtn, E.proposalAddOneTimeRowBtn, E.proposalAddCapabilityRowBtn].forEach(btn => {
      if (!btn) return;
      btn.style.display = readOnly ? 'none' : '';
    });
    E.proposalForm?.querySelectorAll('[data-item-remove]').forEach(btn => {
      btn.style.display = readOnly ? 'none' : '';
    });
    if (E.proposalFormSaveBtn) E.proposalFormSaveBtn.style.display = readOnly ? 'none' : '';
    if (E.proposalFormDeleteBtn && readOnly) E.proposalFormDeleteBtn.style.display = 'none';
  },
  assignFormValues(proposal = {}) {
    const set = (el, value) => {
      if (el) el.value = String(value ?? '');
    };
    set(E.proposalFormProposalId, proposal.proposal_id || '');
    set(E.proposalFormTitleField, proposal.proposal_title || '');
    set(E.proposalFormDealId, proposal.deal_id || '');
    set(E.proposalFormProposalDate, proposal.proposal_date || '');
    set(E.proposalFormValidUntil, proposal.valid_until || '');
    set(E.proposalFormStatus, proposal.status || 'Draft');
    set(E.proposalFormCurrency, proposal.currency || 'USD');
    set(E.proposalFormCustomerName, proposal.customer_name || '');
    set(E.proposalFormCustomerAddress, proposal.customer_address || '');
    set(E.proposalFormCustomerContactName, proposal.customer_contact_name || '');
    set(E.proposalFormCustomerContactMobile, proposal.customer_contact_mobile || '');
    set(E.proposalFormCustomerContactEmail, proposal.customer_contact_email || '');
    set(E.proposalFormProviderContactName, proposal.provider_contact_name || '');
    set(E.proposalFormProviderContactMobile, proposal.provider_contact_mobile || '');
    set(E.proposalFormProviderContactEmail, proposal.provider_contact_email || '');
    set(E.proposalFormServiceStartDate, proposal.service_start_date || '');
    set(E.proposalFormContractTerm, proposal.contract_term || '');
    set(E.proposalFormAccountNumber, proposal.account_number || '');
    set(E.proposalFormBillingFrequency, proposal.billing_frequency || '');
    set(E.proposalFormPaymentTerm, proposal.payment_term || '');
    set(E.proposalFormPoNumber, proposal.po_number || '');
    set(E.proposalFormCustomerSignatoryName, proposal.customer_signatory_name || '');
    set(E.proposalFormCustomerSignatoryTitle, proposal.customer_signatory_title || '');
    set(E.proposalFormProviderSignatoryName, proposal.provider_signatory_name || '');
    set(E.proposalFormProviderSignatoryTitle, proposal.provider_signatory_title || '');
    set(E.proposalFormProviderSignDate, proposal.provider_sign_date || '');
    set(E.proposalFormTerms, proposal.terms_conditions || '');
  },
  computeCommercialRow(item) {
    const unit = this.toNumberSafe(item.unit_price);
    const discountRatio = this.normalizeDiscount(item.discount_percent);
    const qty = this.toNumberSafe(item.quantity);
    const discounted = unit * (1 - discountRatio);
    const lineTotal = discounted * qty;
    return {
      ...item,
      discounted_unit_price: discounted,
      line_total: lineTotal
    };
  },
  getCatalogRowsForSection(section) {
    const rows = Array.isArray(window.ProposalCatalog?.state?.rows)
      ? window.ProposalCatalog.state.rows
      : [];
    return rows
      .filter(row => row?.is_active !== false && String(row?.section || '').trim().toLowerCase() === section)
      .sort((a, b) => {
        const aSort = Number.isFinite(Number(a?.sort_order)) ? Number(a.sort_order) : Number.MAX_SAFE_INTEGER;
        const bSort = Number.isFinite(Number(b?.sort_order)) ? Number(b.sort_order) : Number.MAX_SAFE_INTEGER;
        if (aSort !== bSort) return aSort - bSort;
        return String(a?.item_name || '').localeCompare(String(b?.item_name || ''));
      });
  },
  renderCatalogOptionList(section) {
    const listEl = document.getElementById(`proposalCatalogOptions-${section}`);
    if (!listEl) return;
    const rows = this.getCatalogRowsForSection(section);
    const seen = new Set();
    listEl.innerHTML = rows
      .filter(row => {
        const key = String(row?.item_name || '').trim().toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map(row => {
        const itemName = String(row?.item_name || '').trim();
        const category = String(row?.category || '').trim();
        const location = String(row?.default_location_name || '').trim();
        const meta = [category, location].filter(Boolean).join(' · ');
        return `<option value="${U.escapeAttr(itemName)}">${U.escapeHtml(meta)}</option>`;
      })
      .join('');
  },
  renderCatalogOptionLists() {
    this.renderCatalogOptionList('annual_saas');
    this.renderCatalogOptionList('one_time_fee');
  },
  getCatalogItemByName(section, itemName) {
    const target = this.normalizeText(itemName);
    if (!target) return null;
    return (
      this.getCatalogRowsForSection(section).find(
        row => this.normalizeText(row?.item_name) === target
      ) || null
    );
  },
  applyCatalogSelectionToRow(tr, section) {
    if (!tr || section === 'capability') return;
    const itemInput = tr.querySelector('[data-item-field="item_name"]');
    const unitPriceInput = tr.querySelector('[data-item-field="unit_price"]');
    const locationInput = tr.querySelector('[data-item-field="location_name"]');
    if (!itemInput || !unitPriceInput) return;

    const selected = this.getCatalogItemByName(section, itemInput.value);
    if (!selected) {
      unitPriceInput.readOnly = false;
      unitPriceInput.removeAttribute('title');
      tr.dataset.priceLocked = 'false';
      return;
    }

    if (selected.unit_price !== null && selected.unit_price !== undefined) {
      unitPriceInput.value = String(selected.unit_price);
    }
    unitPriceInput.readOnly = true;
    unitPriceInput.title = 'Unit price is set from the proposal catalog.';
    tr.dataset.priceLocked = 'true';

    if (locationInput && !String(locationInput.value || '').trim() && selected.default_location_name) {
      locationInput.value = String(selected.default_location_name);
    }
  },
  async ensureCatalogLoaded() {
    this.renderCatalogOptionLists();
    const hasRows = this.getCatalogRowsForSection('annual_saas').length || this.getCatalogRowsForSection('one_time_fee').length;
    if (hasRows) return;
    if (this.state.catalogLoading || typeof window.ProposalCatalog?.loadAndRefresh !== 'function') return;

    this.state.catalogLoading = true;
    try {
      await window.ProposalCatalog.loadAndRefresh();
      this.renderCatalogOptionLists();
    } catch (_) {
      // Non-blocking: proposal form still allows manual item entry when catalog load fails.
    } finally {
      this.state.catalogLoading = false;
    }
  },
  groupedItems(items = []) {
    const groups = {
      annual_saas: [],
      one_time_fee: [],
      capability: []
    };
    (Array.isArray(items) ? items : []).forEach((item, idx) => {
      const normalized = this.normalizeItem(item);
      const section = ['annual_saas', 'one_time_fee', 'capability'].includes(normalized.section)
        ? normalized.section
        : 'annual_saas';
      normalized.line_no = normalized.line_no || idx + 1;
      groups[section].push(normalized);
    });
    return groups;
  },
  renderSectionRows(section, rows = []) {
    const tbody =
      section === 'annual_saas'
        ? E.proposalAnnualItemsTbody
        : section === 'one_time_fee'
        ? E.proposalOneTimeItemsTbody
        : E.proposalCapabilityItemsTbody;
    if (!tbody) return;

    const safeRows = Array.isArray(rows) ? rows : [];
    if (!safeRows.length) {
      const colspan = section === 'capability' ? 3 : 8;
      tbody.innerHTML = `<tr><td colspan="${colspan}" class="muted" style="text-align:center;">No rows yet.</td></tr>`;
      return;
    }

    if (section === 'capability') {
      tbody.innerHTML = safeRows
        .map((row, index) => `<tr data-item-row="${section}">
          <td><input class="input" data-item-field="capability_name" value="${U.escapeAttr(row.capability_name || '')}" /></td>
          <td><input class="input" data-item-field="capability_value" value="${U.escapeAttr(row.capability_value || '')}" /></td>
          <td>
            <button class="btn ghost sm" type="button" data-item-remove="${section}" data-item-index="${index}">Remove</button>
          </td>
        </tr>`)
        .join('');
      return;
    }

    tbody.innerHTML = safeRows
      .map((row, index) => {
        const computed = this.computeCommercialRow(row);
        return `<tr data-item-row="${section}">
          <td><input class="input" data-item-field="location_name" value="${U.escapeAttr(computed.location_name || '')}" /></td>
          <td><input class="input" data-item-field="item_name" list="proposalCatalogOptions-${section}" value="${U.escapeAttr(computed.item_name || '')}" /></td>
          <td><input class="input" type="number" step="0.01" data-item-field="unit_price" value="${U.escapeAttr(computed.unit_price || '')}" /></td>
          <td><input class="input" type="number" step="0.01" data-item-field="discount_percent" value="${U.escapeAttr(computed.discount_percent || '')}" /></td>
          <td><input class="input" type="number" step="0.01" data-item-field="quantity" value="${U.escapeAttr(computed.quantity || '')}" /></td>
          <td><span data-item-display="discounted_unit_price">${this.formatMoney(computed.discounted_unit_price)}</span></td>
          <td><span data-item-display="line_total">${this.formatMoney(computed.line_total)}</span></td>
          <td>
            <button class="btn ghost sm" type="button" data-item-remove="${section}" data-item-index="${index}">Remove</button>
          </td>
        </tr>`;
      })
      .join('');
    [...tbody.querySelectorAll('tr[data-item-row]')].forEach(tr => this.applyCatalogSelectionToRow(tr, section));
  },
  renderProposalItems(items = []) {
    this.renderCatalogOptionLists();
    const groups = this.groupedItems(items);
    this.renderSectionRows('annual_saas', groups.annual_saas);
    this.renderSectionRows('one_time_fee', groups.one_time_fee);
    this.renderSectionRows('capability', groups.capability);
    this.renderTotalsPreview();
    this.setFormReadOnly(this.state.formReadOnly);
  },
  collectSectionItems(section) {
    const tbody =
      section === 'annual_saas'
        ? E.proposalAnnualItemsTbody
        : section === 'one_time_fee'
        ? E.proposalOneTimeItemsTbody
        : E.proposalCapabilityItemsTbody;
    if (!tbody) return [];
    const rows = [...tbody.querySelectorAll('tr[data-item-row]')];
    return rows
      .map((tr, idx) => {
        const get = field => tr.querySelector(`[data-item-field="${field}"]`)?.value ?? '';
        if (section === 'capability') {
          const capabilityName = String(get('capability_name')).trim();
          const capabilityValue = String(get('capability_value')).trim();
          if (!capabilityName && !capabilityValue) return null;
          return {
            section,
            line_no: idx + 1,
            capability_name: capabilityName,
            capability_value: capabilityValue
          };
        }
        const unitPrice = this.toNumberSafe(get('unit_price'));
        const discountPercent = this.toNumberSafe(get('discount_percent'));
        const quantity = this.toNumberSafe(get('quantity'));
        const computed = this.computeCommercialRow({ unit_price: unitPrice, discount_percent: discountPercent, quantity });
        if (!get('item_name') && !get('location_name') && !unitPrice && !quantity) return null;
        return {
          section,
          line_no: idx + 1,
          location_name: String(get('location_name')).trim(),
          item_name: String(get('item_name')).trim(),
          unit_price: unitPrice,
          discount_percent: discountPercent,
          quantity,
          discounted_unit_price: computed.discounted_unit_price,
          line_total: computed.line_total
        };
      })
      .filter(Boolean);
  },
  collectProposalItems() {
    return [
      ...this.collectSectionItems('annual_saas'),
      ...this.collectSectionItems('one_time_fee'),
      ...this.collectSectionItems('capability')
    ];
  },
  collectProposalFormData() {
    const existingRefNumber = String(E.proposalForm?.dataset.refNumber || '').trim();
    return {
      proposal_id: String(E.proposalFormProposalId?.value || '').trim(),
      ref_number: this.ensureRefNumber(existingRefNumber),
      proposal_title: String(E.proposalFormTitleField?.value || '').trim(),
      deal_id: String(E.proposalFormDealId?.value || '').trim(),
      proposal_date: String(E.proposalFormProposalDate?.value || '').trim(),
      valid_until: String(E.proposalFormValidUntil?.value || '').trim(),
      status: String(E.proposalFormStatus?.value || '').trim(),
      currency: String(E.proposalFormCurrency?.value || '').trim(),
      customer_name: String(E.proposalFormCustomerName?.value || '').trim(),
      customer_address: String(E.proposalFormCustomerAddress?.value || '').trim(),
      customer_contact_name: String(E.proposalFormCustomerContactName?.value || '').trim(),
      customer_contact_mobile: String(E.proposalFormCustomerContactMobile?.value || '').trim(),
      customer_contact_email: String(E.proposalFormCustomerContactEmail?.value || '').trim(),
      provider_contact_name: String(E.proposalFormProviderContactName?.value || '').trim(),
      provider_contact_mobile: String(E.proposalFormProviderContactMobile?.value || '').trim(),
      provider_contact_email: String(E.proposalFormProviderContactEmail?.value || '').trim(),
      service_start_date: String(E.proposalFormServiceStartDate?.value || '').trim(),
      contract_term: String(E.proposalFormContractTerm?.value || '').trim(),
      account_number: this.ensureAccountNumber(E.proposalFormAccountNumber?.value),
      billing_frequency: String(E.proposalFormBillingFrequency?.value || '').trim(),
      payment_term: String(E.proposalFormPaymentTerm?.value || '').trim(),
      po_number: String(E.proposalFormPoNumber?.value || '').trim(),
      customer_signatory_name: String(E.proposalFormCustomerSignatoryName?.value || '').trim(),
      customer_signatory_title: String(E.proposalFormCustomerSignatoryTitle?.value || '').trim(),
      provider_signatory_name: String(E.proposalFormProviderSignatoryName?.value || '').trim(),
      provider_signatory_title: String(E.proposalFormProviderSignatoryTitle?.value || '').trim(),
      provider_sign_date: String(E.proposalFormProviderSignDate?.value || '').trim(),
      terms_conditions: String(E.proposalFormTerms?.value || '').trim()
    };
  },
  renderTotalsPreview() {
    const items = this.collectProposalItems();
    const saasTotal = items
      .filter(item => item.section === 'annual_saas')
      .reduce((sum, item) => sum + this.toNumberSafe(item.line_total), 0);
    const oneTimeTotal = items
      .filter(item => item.section === 'one_time_fee')
      .reduce((sum, item) => sum + this.toNumberSafe(item.line_total), 0);
    const grandTotal = saasTotal + oneTimeTotal;

    if (E.proposalSaasTotal) E.proposalSaasTotal.textContent = this.formatMoney(saasTotal);
    if (E.proposalOneTimeTotal) E.proposalOneTimeTotal.textContent = this.formatMoney(oneTimeTotal);
    if (E.proposalGrandTotal) E.proposalGrandTotal.textContent = this.formatMoney(grandTotal);
  },
  async openProposalFormById(proposalId, { readOnly = false } = {}) {
    if (!proposalId) return;
    try {
      const response = await this.getProposal(proposalId);
      const { proposal, items } = this.extractProposalAndItems(response, proposalId);
      this.openProposalForm(proposal, items, { readOnly });
    } catch (error) {
      if (typeof isAuthError === 'function' && isAuthError(error)) {
        handleExpiredSession('Session expired. Please log in again.');
        return;
      }
      UI.toast('Unable to load proposal details: ' + (error?.message || 'Unknown error'));
    }
  },
  openProposalForm(proposal = null, items = [], { readOnly = false } = {}) {
    if (!E.proposalFormModal || !E.proposalForm) return;
    const base = proposal ? this.normalizeProposal(proposal) : this.emptyProposal();
    const mode = base.proposal_id ? 'edit' : 'create';
    this.resetForm();
    this.state.formMode = mode;
    this.state.formReadOnly = !!readOnly;
    this.state.currentProposalId = base.proposal_id || '';
    this.state.currentItems = Array.isArray(items) ? items.map(item => this.normalizeItem(item)) : [];

    E.proposalForm.dataset.mode = mode;
    E.proposalForm.dataset.id = base.proposal_id || '';
    E.proposalForm.dataset.refNumber = base.ref_number || '';
    this.assignFormValues(base);
    if (!readOnly && mode === 'create' && E.proposalFormAccountNumber) {
      E.proposalFormAccountNumber.value = this.ensureAccountNumber(E.proposalFormAccountNumber.value);
    }
    this.renderProposalItems(this.state.currentItems);
    this.ensureCatalogLoaded();

    if (E.proposalFormTitle) {
      if (readOnly) E.proposalFormTitle.textContent = 'View Proposal';
      else E.proposalFormTitle.textContent = mode === 'edit' ? 'Edit Proposal' : 'Create Proposal';
    }
    if (E.proposalFormDeleteBtn)
      E.proposalFormDeleteBtn.style.display = mode === 'edit' && !readOnly && Permissions.canDeleteProposal() ? '' : 'none';
    if (E.proposalFormSaveBtn) {
      const canSave = mode === 'edit' ? Permissions.canUpdateProposal() : Permissions.canCreateProposal();
      E.proposalFormSaveBtn.style.display = !readOnly && canSave ? '' : 'none';
    }

    this.setFormReadOnly(readOnly);

    E.proposalFormModal.style.display = 'flex';
    E.proposalFormModal.setAttribute('aria-hidden', 'false');
  },
  closeProposalForm() {
    if (!E.proposalFormModal) return;
    E.proposalFormModal.style.display = 'none';
    E.proposalFormModal.setAttribute('aria-hidden', 'true');
  },
  setFormBusy(value) {
    const busy = !!value;
    if (E.proposalFormSaveBtn) E.proposalFormSaveBtn.disabled = busy;
    if (E.proposalFormDeleteBtn) E.proposalFormDeleteBtn.disabled = busy;
    if (E.proposalFormPreviewBtn) E.proposalFormPreviewBtn.disabled = busy;
  },
  async submitForm() {
    const mode = E.proposalForm?.dataset.mode === 'edit' ? 'edit' : 'create';
    if (mode === 'edit' && !Permissions.canUpdateProposal()) {
      UI.toast('You do not have permission to update proposals.');
      return;
    }
    if (mode !== 'edit' && !Permissions.canCreateProposal()) {
      UI.toast('Login is required to manage proposals.');
      return;
    }
    const proposalId = String(E.proposalForm?.dataset.id || '').trim();
    const proposal = this.collectProposalFormData();
    const items = this.collectProposalItems();
    const currentRecord = this.state.rows.find(row => String(row.proposal_id || '') === proposalId) || {};
    const requestedDiscount = items.reduce((max, item) => Math.max(max, this.toNumberSafe(item.discount_percent)), 0);
    const workflowCheck = await window.WorkflowEngine?.enforceBeforeSave?.('proposals', currentRecord, {
      proposal_id: proposalId,
      current_status: currentRecord?.status || '',
      requested_status: proposal.status || '',
      discount_percent: requestedDiscount,
      requested_changes: { proposal, items }
    });
    if (workflowCheck && !workflowCheck.allowed) {
      UI.toast(window.WorkflowEngine.composeDeniedMessage(workflowCheck, 'Proposal save blocked.'));
      return;
    }

    if (!proposal.proposal_title) {
      UI.toast('Proposal title is required.');
      return;
    }

    this.setFormBusy(true);
    try {
      let response;
      if (mode === 'edit' && proposalId) {
        response = await this.updateProposal(proposalId, proposal, items);
      } else {
        response = await this.createProposal(proposal, items);
      }

      const parsed = this.extractProposalAndItems(response, proposalId);
      const savedId = parsed.proposal?.proposal_id || proposalId;
      UI.toast(mode === 'edit' ? 'Proposal updated.' : 'Proposal created.');
      await this.loadAndRefresh({ force: true });

      if (savedId) {
        await this.openProposalFormById(savedId);
      } else {
        this.closeProposalForm();
      }
    } catch (error) {
      if (typeof isAuthError === 'function' && isAuthError(error)) {
        handleExpiredSession('Session expired. Please log in again.');
        return;
      }
      UI.toast('Unable to save proposal: ' + (error?.message || 'Unknown error'));
    } finally {
      this.setFormBusy(false);
    }
  },
  async deleteById(proposalId) {
    if (!Permissions.canDeleteProposal()) {
      UI.toast('You do not have permission to delete proposals.');
      return;
    }
    if (!proposalId) return;
    const confirmed = window.confirm(`Delete proposal ${proposalId}?`);
    if (!confirmed) return;

    this.setFormBusy(true);
    try {
      await this.deleteProposal(proposalId);
      UI.toast('Proposal deleted.');
      this.closeProposalForm();
      await this.loadAndRefresh({ force: true });
    } catch (error) {
      if (typeof isAuthError === 'function' && isAuthError(error)) {
        handleExpiredSession('Session expired. Please log in again.');
        return;
      }
      UI.toast('Unable to delete proposal: ' + (error?.message || 'Unknown error'));
    } finally {
      this.setFormBusy(false);
    }
  },
  extractHtml(response) {
    const candidates = [
      response,
      response?.html,
      response?.proposal_html,
      response?.data,
      response?.data?.html,
      response?.result,
      response?.result?.html,
      response?.payload,
      response?.payload?.html
    ];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) return candidate;
      if (candidate && typeof candidate === 'object') {
        if (typeof candidate.html === 'string' && candidate.html.trim()) return candidate.html;
        if (typeof candidate.proposal_html === 'string' && candidate.proposal_html.trim())
          return candidate.proposal_html;
      }
    }
    return '';
  },
  closePreviewModal() {
    if (!E.proposalPreviewModal) return;
    E.proposalPreviewModal.style.display = 'none';
    E.proposalPreviewModal.setAttribute('aria-hidden', 'true');
    if (E.proposalPreviewFrame) E.proposalPreviewFrame.srcdoc = '';
  },
  exportPreviewPdf() {
    const frame = E.proposalPreviewFrame;
    const previewTitle = String(E.proposalPreviewTitle?.textContent || 'Proposal Preview').trim();
    if (!frame || !String(frame.srcdoc || '').trim()) {
      UI.toast('Open proposal preview first to extract PDF.');
      return;
    }
    const frameWindow = frame.contentWindow;
    if (!frameWindow) {
      UI.toast('Unable to access proposal preview content.');
      return;
    }
    frameWindow.focus();
    frameWindow.print();
    UI.toast(`Print dialog opened for ${previewTitle}. Choose "Save as PDF" to extract.`);
  },
  async previewProposalHtml(proposalId) {
    if (!proposalId) {
      UI.toast('Missing proposal ID for preview.');
      return;
    }
    if (!Permissions.canGenerateProposalHtml()) {
      UI.toast('You do not have permission to preview proposals.');
      return;
    }
    try {
      const response = await this.generateProposalHtml(proposalId);
      const html = this.extractHtml(response);
      if (!html) {
        UI.toast('Backend did not return proposal HTML.');
        return;
      }
      const brandedHtml = U.addIncheckDocumentLogo(html);
      if (E.proposalPreviewFrame) E.proposalPreviewFrame.srcdoc = brandedHtml;
      if (E.proposalPreviewTitle) E.proposalPreviewTitle.textContent = `Proposal Preview · ${proposalId}`;
      if (E.proposalPreviewModal) {
        E.proposalPreviewModal.style.display = 'flex';
        E.proposalPreviewModal.setAttribute('aria-hidden', 'false');
      }
    } catch (error) {
      if (typeof isAuthError === 'function' && isAuthError(error)) {
        handleExpiredSession('Session expired. Please log in again.');
        return;
      }
      UI.toast('Unable to preview proposal: ' + (error?.message || 'Unknown error'));
    }
  },
  getCreatedProposalId(response) {
    const candidates = [
      response?.proposal,
      response?.data?.proposal,
      response?.result?.proposal,
      response?.payload?.proposal,
      response?.created_proposal,
      response?.createdProposal,
      response
    ];
    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== 'object') continue;
      const id = String(candidate.proposal_id || candidate.id || '').trim();
      if (id) return id;
    }
    return '';
  },
  async createFromDealFlow(dealId, { openAfterCreate = true } = {}) {
    if (!Permissions.canCreateProposalFromDeal()) {
      UI.toast('You do not have permission to create proposals from deals.');
      return;
    }
    const trimmedDealId = String(dealId || '').trim();
    if (!trimmedDealId) {
      UI.toast('Deal ID is required.');
      return;
    }
    if (!openAfterCreate) return;

    const deal = await this.resolveDealForProposal(trimmedDealId);
    const draft = this.proposalDraftFromDeal({ ...(deal || {}), deal_id: trimmedDealId });

    this.openProposalForm(draft, [], { readOnly: false });
    UI.toast(
      'Proposal template opened. Review and complete missing details, then save to create the proposal.'
    );
  },
  addRow(section) {
    const groups = this.groupedItems(this.collectProposalItems());
    if (section === 'capability') {
      groups.capability.push({ section: 'capability', capability_name: '', capability_value: '' });
    } else {
      groups[section].push({
        section,
        location_name: '',
        item_name: '',
        unit_price: 0,
        discount_percent: 0,
        quantity: 1,
        discounted_unit_price: 0,
        line_total: 0
      });
    }
    this.renderProposalItems([...groups.annual_saas, ...groups.one_time_fee, ...groups.capability]);
  },
  removeRow(section, index) {
    const groups = this.groupedItems(this.collectProposalItems());
    if (!groups[section]) return;
    groups[section] = groups[section].filter((_, idx) => idx !== index);
    this.renderProposalItems([...groups.annual_saas, ...groups.one_time_fee, ...groups.capability]);
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

    bindState(E.proposalsSearchInput, 'search');
    bindState(E.proposalsCustomerFilter, 'customer');
    bindState(E.proposalsStatusFilter, 'status');

    if (E.proposalsRefreshBtn) {
      E.proposalsRefreshBtn.addEventListener('click', () => this.loadAndRefresh({ force: true }));
    }
    if (E.proposalsCreateBtn) {
      E.proposalsCreateBtn.addEventListener('click', () => {
        if (!Permissions.canCreateProposal()) return UI.toast('Login is required to manage proposals.');
        this.openProposalForm();
      });
    }

    if (E.proposalsTbody) {
      E.proposalsTbody.addEventListener('click', event => {
        const getActionValue = action => event.target?.closest?.(`[${action}]`)?.getAttribute(action) || '';
        const viewId = getActionValue('data-proposal-view');
        if (viewId) {
          this.openProposalFormById(viewId, { readOnly: true });
          return;
        }
        const editId = getActionValue('data-proposal-edit');
        if (editId) {
          if (!Permissions.canUpdateProposal()) return UI.toast('You do not have permission to edit proposals.');
          this.openProposalFormById(editId, { readOnly: false });
          return;
        }
        const previewId = getActionValue('data-proposal-preview');
        if (previewId) {
          this.previewProposalHtml(previewId);
          return;
        }
        const convertAgreementId = getActionValue('data-proposal-convert-agreement');
        if (convertAgreementId) {
          if (typeof setActiveView === 'function') setActiveView('agreements');
          if (window.Agreements?.createFromProposalFlow) {
            window.Agreements.createFromProposalFlow(convertAgreementId);
          } else {
            UI.toast('Agreements module is unavailable.');
          }
          return;
        }
        const deleteId = getActionValue('data-proposal-delete');
        if (deleteId) this.deleteById(deleteId);
      });
    }

    if (E.proposalFormCloseBtn) E.proposalFormCloseBtn.addEventListener('click', () => this.closeProposalForm());
    if (E.proposalFormCancelBtn) E.proposalFormCancelBtn.addEventListener('click', () => this.closeProposalForm());
    if (E.proposalFormModal) {
      E.proposalFormModal.addEventListener('click', event => {
        if (event.target === E.proposalFormModal) this.closeProposalForm();
      });
    }
    if (E.proposalForm) {
      E.proposalForm.addEventListener('submit', event => {
        event.preventDefault();
        this.submitForm();
      });
      E.proposalForm.addEventListener('input', event => {
        const field = event.target?.getAttribute('data-item-field');
        if (field) {
          const tr = event.target.closest('tr[data-item-row]');
          if (tr) {
            const section = tr.getAttribute('data-item-row');
            if (section !== 'capability') {
              if (field === 'item_name') this.applyCatalogSelectionToRow(tr, section);
              const get = key => tr.querySelector(`[data-item-field="${key}"]`)?.value ?? '';
              const computed = this.computeCommercialRow({
                unit_price: get('unit_price'),
                discount_percent: get('discount_percent'),
                quantity: get('quantity')
              });
              const discountedEl = tr.querySelector('[data-item-display="discounted_unit_price"]');
              const lineTotalEl = tr.querySelector('[data-item-display="line_total"]');
              if (discountedEl) discountedEl.textContent = this.formatMoney(computed.discounted_unit_price);
              if (lineTotalEl) lineTotalEl.textContent = this.formatMoney(computed.line_total);
            }
          }
          this.renderTotalsPreview();
        }
      });
      E.proposalForm.addEventListener('change', event => {
        const field = event.target?.getAttribute('data-item-field');
        if (field !== 'item_name') return;
        const tr = event.target.closest('tr[data-item-row]');
        const section = tr?.getAttribute('data-item-row');
        if (!tr || !section || section === 'capability') return;
        this.applyCatalogSelectionToRow(tr, section);
        const get = key => tr.querySelector(`[data-item-field="${key}"]`)?.value ?? '';
        const computed = this.computeCommercialRow({
          unit_price: get('unit_price'),
          discount_percent: get('discount_percent'),
          quantity: get('quantity')
        });
        const discountedEl = tr.querySelector('[data-item-display="discounted_unit_price"]');
        const lineTotalEl = tr.querySelector('[data-item-display="line_total"]');
        if (discountedEl) discountedEl.textContent = this.formatMoney(computed.discounted_unit_price);
        if (lineTotalEl) lineTotalEl.textContent = this.formatMoney(computed.line_total);
        this.renderTotalsPreview();
      });
      E.proposalForm.addEventListener('click', event => {
        const section = event.target?.getAttribute('data-item-remove');
        const index = Number(event.target?.getAttribute('data-item-index'));
        if (section && Number.isInteger(index) && index >= 0) {
          this.removeRow(section, index);
        }
      });
    }

    if (E.proposalFormDeleteBtn) {
      E.proposalFormDeleteBtn.addEventListener('click', () => {
        const id = String(E.proposalForm?.dataset.id || '').trim();
        if (id) this.deleteById(id);
      });
    }
    if (E.proposalFormPreviewBtn) {
      E.proposalFormPreviewBtn.addEventListener('click', () => {
        const id = String(E.proposalForm?.dataset.id || '').trim();
        if (!id) {
          UI.toast('Save the proposal first to preview backend-generated HTML.');
          return;
        }
        this.previewProposalHtml(id);
      });
    }

    if (E.proposalAddAnnualRowBtn)
      E.proposalAddAnnualRowBtn.addEventListener('click', () => this.addRow('annual_saas'));
    if (E.proposalAddOneTimeRowBtn)
      E.proposalAddOneTimeRowBtn.addEventListener('click', () => this.addRow('one_time_fee'));
    if (E.proposalAddCapabilityRowBtn)
      E.proposalAddCapabilityRowBtn.addEventListener('click', () => this.addRow('capability'));

    if (E.proposalPreviewCloseBtn) E.proposalPreviewCloseBtn.addEventListener('click', () => this.closePreviewModal());
    if (E.proposalPreviewExportPdfBtn) {
      E.proposalPreviewExportPdfBtn.addEventListener('click', () => this.exportPreviewPdf());
    }
    if (E.proposalPreviewModal) {
      E.proposalPreviewModal.addEventListener('click', event => {
        if (event.target === E.proposalPreviewModal) this.closePreviewModal();
      });
    }

    this.state.initialized = true;
  }
};

window.Proposals = Proposals;
