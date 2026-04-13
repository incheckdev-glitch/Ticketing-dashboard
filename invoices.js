const Invoices = {
  invoiceFields: [
    'invoice_id',
    'invoice_number',
    'agreement_id',
    'invoice_date',
    'due_date',
    'customer_name',
    'customer_legal_name',
    'customer_address',
    'customer_contact_name',
    'customer_contact_email',
    'payment_term',
    'currency',
    'status',
    'subtotal_subscription',
    'subtotal_one_time',
    'grand_total',
    'amount_in_words',
    'notes',
    'updated_at'
  ],
  state: {
    rows: [],
    filteredRows: [],
    loading: false,
    loadError: '',
    initialized: false,
    search: '',
    status: 'All',
    selectedInvoice: null,
    items: [],
    catalogLoading: false
  },
  statusOptions: ['Draft', 'Issued', 'Paid', 'Overdue', 'Cancelled'],
  toNumberSafe(value) {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const parsed = Number(String(value).replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : 0;
  },
  formatMoney(value) {
    return this.toNumberSafe(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
  },
  normalizeText(value) {
    return String(value ?? '').trim().toLowerCase();
  },
  normalizeInvoice(raw = {}) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const normalized = {};
    this.invoiceFields.forEach(field => {
      const camel = field.replace(/_([a-z])/g, (_, ch) => ch.toUpperCase());
      const value = source[field] ?? source[camel] ?? '';
      normalized[field] = typeof value === 'string' ? value.trim() : value;
    });
    normalized.invoice_id = String(normalized.invoice_id || source.id || '').trim();
    normalized.invoice_number = String(normalized.invoice_number || '').trim();
    normalized.status = String(normalized.status || '').trim() || 'Draft';
    normalized.currency = String(normalized.currency || '').trim() || 'USD';
    return normalized;
  },
  normalizeSection(value) {
    const raw = String(value ?? '')
      .trim()
      .toLowerCase();
    if (!raw) return '';
    if (['subscription', 'annual', 'annual_saas', 'annual saas', 'saas'].includes(raw)) return 'annual_saas';
    if (['one_time', 'one-time_fee', 'one_time_fee', 'one-time', 'one-time fee', 'one time fee', 'onetime'].includes(raw))
      return 'one_time_fee';
    if (raw === 'capability') return 'capability';
    return raw;
  },
  normalizeItem(raw = {}) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const pick = (...values) => {
      for (const value of values) {
        if (value !== undefined && value !== null && String(value).trim() !== '') return value;
      }
      return '';
    };
    const section = this.normalizeSection(
      pick(source.section, source.item_section, source.itemSection, source.type, source.item_type, source.itemType)
    );
    return {
      catalog_item_id: String(pick(source.catalog_item_id, source.catalogItemId)).trim(),
      section,
      line_no: this.toNumberSafe(pick(source.line_no, source.lineNo, source.line)) || 0,
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
      notes: String(pick(source.notes)).trim()
    };
  },
  normalizeCatalogItem(raw = {}) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const pick = (...values) => {
      for (const value of values) {
        if (value !== undefined && value !== null && String(value).trim() !== '') return value;
      }
      return '';
    };
    return {
      catalog_item_id: String(pick(source.catalog_item_id, source.catalogItemId, source.id)).trim(),
      section: this.normalizeSection(pick(source.section, source.item_section, source.type)),
      item_name: String(pick(source.item_name, source.itemName, source.name)).trim(),
      unit_price: this.toNumberSafe(pick(source.unit_price, source.unitPrice)),
      discount_percent: this.toNumberSafe(pick(source.discount_percent, source.discountPercent)),
      quantity: this.toNumberSafe(pick(source.quantity, source.qty)),
      notes: String(pick(source.notes)).trim()
    };
  },
  async getProposalCatalogLookup() {
    try {
      const response = await Api.listProposalCatalogItems();
      const rows = Array.isArray(response)
        ? response
        : response?.items || response?.rows || response?.data || response?.result || [];
      const normalized = (Array.isArray(rows) ? rows : []).map(item => this.normalizeCatalogItem(item));
      const byId = new Map();
      const byName = new Map();
      normalized.forEach(item => {
        if (item.catalog_item_id) byId.set(item.catalog_item_id, item);
        if (item.item_name) byName.set(item.item_name.toLowerCase(), item);
      });
      return { byId, byName, names: normalized.map(item => item.item_name).filter(Boolean) };
    } catch (_error) {
      return { byId: new Map(), byName: new Map(), names: [] };
    }
  },
  mergeCatalogItem(invoiceItem = {}, catalogLookup = { byId: new Map(), byName: new Map() }) {
    const byId = catalogLookup?.byId instanceof Map ? catalogLookup.byId : new Map();
    const byName = catalogLookup?.byName instanceof Map ? catalogLookup.byName : new Map();
    const catalogItemId = String(invoiceItem.catalog_item_id || '').trim();
    const itemName = String(invoiceItem.item_name || '').trim().toLowerCase();
    const catalogMatch = (catalogItemId && byId.get(catalogItemId)) || (itemName && byName.get(itemName)) || null;
    const base = this.normalizeItem(invoiceItem);
    const merged = this.normalizeItem({
      ...base,
      ...(catalogMatch || {}),
      catalog_item_id: catalogItemId || catalogMatch?.catalog_item_id || '',
      section: this.normalizeSection(base.section || catalogMatch?.section),
      item_name: base.item_name || catalogMatch?.item_name || '',
      notes: base.notes || catalogMatch?.notes || ''
    });
    const discountRatio =
      merged.discount_percent > 1 ? merged.discount_percent / 100 : Math.max(0, merged.discount_percent);
    merged.discounted_unit_price = merged.unit_price * (1 - discountRatio);
    merged.line_total = merged.discounted_unit_price * (merged.quantity || 0);
    return merged;
  },
  calculateInvoiceTotals(items = []) {
    return (Array.isArray(items) ? items : []).reduce(
      (acc, rawItem) => {
        const item = this.normalizeItem(rawItem);
        const lineTotal = this.toNumberSafe(item.line_total);
        if (this.normalizeSection(item.section) === 'annual_saas') acc.subtotal_subscription += lineTotal;
        else if (this.normalizeSection(item.section) === 'one_time_fee') acc.subtotal_one_time += lineTotal;
        acc.grand_total += lineTotal;
        return acc;
      },
      { subtotal_subscription: 0, subtotal_one_time: 0, grand_total: 0 }
    );
  },
  applyTotalsToForm(totals = {}) {
    const set = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.value = this.toNumberSafe(value);
    };
    set('invoiceFormSubtotalSubscription', totals.subtotal_subscription);
    set('invoiceFormSubtotalOneTime', totals.subtotal_one_time);
    set('invoiceFormGrandTotal', totals.grand_total);
  },
  todayIso() {
    return new Date().toISOString().slice(0, 10);
  },
  generateInvoiceNumber() {
    const now = new Date();
    const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const randomPart = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `INV-${datePart}-${randomPart}`;
  },
  ensureInvoiceNumber(value = '') {
    const existing = String(value || '').trim();
    return existing || this.generateInvoiceNumber();
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
    const list = document.getElementById(`invoiceCatalogOptions-${section}`);
    if (!list) return;
    const seen = new Set();
    list.innerHTML = this.getCatalogRowsForSection(section)
      .filter(row => {
        const key = String(row?.item_name || '').trim().toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map(row => `<option value="${U.escapeAttr(String(row?.item_name || '').trim())}"></option>`)
      .join('');
  },
  renderCatalogOptionLists() {
    this.renderCatalogOptionList('annual_saas');
    this.renderCatalogOptionList('one_time_fee');
  },
  async ensureCatalogLoaded() {
    this.renderCatalogOptionLists();
    const hasRows =
      this.getCatalogRowsForSection('annual_saas').length || this.getCatalogRowsForSection('one_time_fee').length;
    if (hasRows) return;
    if (this.state.catalogLoading || typeof window.ProposalCatalog?.loadAndRefresh !== 'function') return;
    this.state.catalogLoading = true;
    try {
      await window.ProposalCatalog.loadAndRefresh();
      this.renderCatalogOptionLists();
    } catch (_) {
      // Non-blocking: invoice form still allows manual item entry when catalog load fails.
    } finally {
      this.state.catalogLoading = false;
    }
  },
  extractRows(response) {
    const parseJsonIfNeeded = value => {
      if (typeof value !== 'string') return value;
      const trimmed = value.trim();
      if (!(trimmed.startsWith('[') || trimmed.startsWith('{'))) return value;
      try {
        return JSON.parse(trimmed);
      } catch (_error) {
        return value;
      }
    };
    const coerceRows = value => {
      const parsed = parseJsonIfNeeded(value);
      if (Array.isArray(parsed)) return parsed;
      if (!parsed || typeof parsed !== 'object') return [];
      const values = Object.values(parsed).filter(Boolean);
      if (!values.length || !values.every(item => item && typeof item === 'object')) return [];
      const hasInvoiceLikeShape = values.some(
        item =>
          'invoice_id' in item ||
          'invoiceId' in item ||
          'invoice_number' in item ||
          'invoiceNumber' in item ||
          'agreement_id' in item ||
          'agreementId' in item
      );
      return hasInvoiceLikeShape ? values : [];
    };
    const candidates = [
      response,
      response?.invoices,
      response?.items,
      response?.rows,
      response?.data,
      response?.result,
      response?.payload,
      response?.data?.invoices,
      response?.result?.invoices,
      response?.payload?.invoices
    ];
    for (const candidate of candidates) {
      const rows = coerceRows(candidate);
      if (rows.length) return rows;
    }
    return [];
  },
  extractInvoiceAndItems(response, fallbackId = '') {
    const candidates = [response, response?.data, response?.result, response?.payload];
    let invoice = null;
    let items = [];
    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== 'object') continue;
      if (!invoice) {
        if (candidate.invoice && typeof candidate.invoice === 'object') invoice = candidate.invoice;
        else if (candidate.invoice_id || candidate.invoice_number) invoice = candidate;
      }
      if (!items.length) {
        if (Array.isArray(candidate.items)) items = candidate.items;
        else if (Array.isArray(candidate.invoice_items)) items = candidate.invoice_items;
      }
    }
    return {
      invoice: this.normalizeInvoice(invoice || { invoice_id: fallbackId }),
      items: Array.isArray(items) ? items.map(item => this.normalizeItem(item)) : []
    };
  },
  emptyInvoice() {
    return {
      invoice_id: '',
      invoice_number: this.generateInvoiceNumber(),
      agreement_id: '',
      invoice_date: this.todayIso(),
      due_date: '',
      customer_name: '',
      customer_legal_name: '',
      customer_address: '',
      customer_contact_name: '',
      customer_contact_email: '',
      payment_term: '',
      currency: 'USD',
      status: 'Draft',
      subtotal_subscription: '',
      subtotal_one_time: '',
      grand_total: '',
      amount_in_words: '',
      notes: ''
    };
  },
  applyFilters() {
    const terms = String(this.state.search || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
    this.state.filteredRows = this.state.rows.filter(row => {
      if (this.state.status !== 'All' && String(row.status || '').trim() !== this.state.status) return false;
      const hay = [row.invoice_id, row.invoice_number, row.customer_name, row.agreement_id, row.status, row.currency]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (terms.length && !terms.every(term => hay.includes(term))) return false;
      return true;
    });
  },
  renderSummary() {
    if (!E.invoiceSummary) return;
    const rows = this.state.filteredRows;
    const count = label => rows.filter(row => this.normalizeText(row.status) === label.toLowerCase()).length;
    const cards = [
      ['Total Invoices', rows.length],
      ['Draft', count('draft')],
      ['Issued', count('issued')],
      ['Paid', count('paid')],
      ['Overdue', count('overdue')]
    ];
    E.invoiceSummary.innerHTML = cards
      .map(([label, value]) => `<div class="card kpi"><div class="label">${U.escapeHtml(label)}</div><div class="value">${U.escapeHtml(String(value))}</div></div>`)
      .join('');
  },
  renderFilters() {
    if (E.invoicesSearchInput) E.invoicesSearchInput.value = this.state.search;
    if (E.invoicesStatusFilter) {
      const seen = [...new Set(this.state.rows.map(row => String(row.status || '').trim()).filter(Boolean))];
      const options = ['All', ...this.statusOptions, ...seen.filter(v => !this.statusOptions.includes(v))];
      E.invoicesStatusFilter.innerHTML = [...new Set(options)].map(v => `<option>${U.escapeHtml(v)}</option>`).join('');
      E.invoicesStatusFilter.value = options.includes(this.state.status) ? this.state.status : 'All';
    }
  },
  render() {
    if (!E.invoicesState || !E.invoicesTbody) return;
    if (this.state.loading) {
      E.invoicesState.textContent = 'Loading invoices…';
      E.invoicesTbody.innerHTML = '<tr><td colspan="10" class="muted" style="text-align:center;">Loading invoices…</td></tr>';
      return;
    }
    if (this.state.loadError) {
      E.invoicesState.textContent = this.state.loadError;
      E.invoicesTbody.innerHTML = `<tr><td colspan="10" class="muted" style="text-align:center;color:#ffb4b4;">${U.escapeHtml(this.state.loadError)}</td></tr>`;
      return;
    }
    this.renderSummary();
    const rows = this.state.filteredRows;
    const totalRows = this.state.rows.length;
    E.invoicesState.textContent = `${rows.length} of ${totalRows} invoice${totalRows === 1 ? '' : 's'}`;
    if (!rows.length) {
      const emptyMessage = totalRows
        ? 'No invoices match the current search or filters.'
        : 'No invoices found. Create your first invoice to get started.';
      E.invoicesTbody.innerHTML = `<tr><td colspan="10" class="muted" style="text-align:center;">${U.escapeHtml(emptyMessage)}</td></tr>`;
      return;
    }
    const textCell = value => U.escapeHtml(String(value ?? '').trim() || '—');
    E.invoicesTbody.innerHTML = rows
      .map(row => {
        const id = U.escapeAttr(row.invoice_id || '');
        return `<tr>
          <td>${textCell(row.invoice_number || row.invoice_id)}</td>
          <td>${textCell(row.customer_name)}</td>
          <td>${textCell(row.agreement_id)}</td>
          <td>${textCell(row.invoice_date)}</td>
          <td>${textCell(row.due_date)}</td>
          <td>${textCell(row.currency)}</td>
          <td>${this.formatMoney(row.grand_total)}</td>
          <td>${textCell(row.status)}</td>
          <td>${textCell(row.updated_at)}</td>
          <td><div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button class="btn ghost sm" type="button" data-invoice-view="${id}">Open</button>
            ${Permissions.canUpdateInvoice() ? `<button class="btn ghost sm" type="button" data-invoice-edit="${id}">Edit</button>` : ''}
            ${Permissions.canPreviewInvoice() ? `<button class="btn ghost sm" type="button" data-invoice-preview="${id}">Preview</button>` : ''}
            ${Permissions.canDeleteInvoice() ? `<button class="btn ghost sm" type="button" data-invoice-delete="${id}">Delete</button>` : ''}
          </div></td>
        </tr>`;
      })
      .join('');
  },
  computeCommercialRow(item = {}) {
    const unit = this.toNumberSafe(item.unit_price);
    const discount = this.toNumberSafe(item.discount_percent);
    const qty = this.toNumberSafe(item.quantity);
    const discountRatio = discount > 1 ? discount / 100 : Math.max(0, discount);
    const discounted = unit * (1 - discountRatio);
    const lineTotal = discounted * qty;
    return {
      ...item,
      discounted_unit_price: discounted,
      line_total: lineTotal
    };
  },
  groupedItems(items = []) {
    const groups = { annual_saas: [], one_time_fee: [], capability: [] };
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
  getCatalogItemByName(section, itemName) {
    const target = this.normalizeText(itemName);
    if (!target) return null;
    return (
      this.getCatalogRowsForSection(section).find(row => this.normalizeText(row?.item_name) === target) || null
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
  renderSectionRows(section, rows = []) {
    const tbody =
      section === 'annual_saas'
        ? E.invoiceAnnualItemsTbody
        : section === 'one_time_fee'
        ? E.invoiceOneTimeItemsTbody
        : E.invoiceCapabilityItemsTbody;
    if (!tbody) return;

    const safeRows = Array.isArray(rows) ? rows : [];
    if (!safeRows.length) {
      const colspan = section === 'capability' ? 4 : 12;
      tbody.innerHTML = `<tr><td colspan="${colspan}" class="muted" style="text-align:center;">No rows yet.</td></tr>`;
      return;
    }

    if (section === 'capability') {
      tbody.innerHTML = safeRows
        .map(
          (row, index) => `<tr data-item-row="${section}">
          <td><input class="input" data-item-field="capability_name" value="${U.escapeAttr(row.capability_name || '')}" /></td>
          <td><input class="input" data-item-field="capability_value" value="${U.escapeAttr(row.capability_value || '')}" /></td>
          <td><input class="input" data-item-field="notes" value="${U.escapeAttr(row.notes || '')}" /></td>
          <td><button class="btn ghost sm" type="button" data-item-remove="${section}" data-item-index="${index}">Remove</button></td>
        </tr>`
        )
        .join('');
      return;
    }

    tbody.innerHTML = safeRows
      .map((row, index) => {
        const computed = this.computeCommercialRow(row);
        return `<tr data-item-row="${section}">
          <td><input class="input" data-item-field="location_name" value="${U.escapeAttr(computed.location_name || '')}" /></td>
          <td><input class="input" data-item-field="location_address" value="${U.escapeAttr(computed.location_address || '')}" /></td>
          <td><input class="input" type="date" data-item-field="service_start_date" value="${U.escapeAttr(computed.service_start_date || '')}" /></td>
          <td><input class="input" type="date" data-item-field="service_end_date" value="${U.escapeAttr(computed.service_end_date || '')}" /></td>
          <td><input class="input" data-item-field="item_name" list="invoiceCatalogOptions-${section}" value="${U.escapeAttr(computed.item_name || '')}" /></td>
          <td><input class="input" type="number" step="0.01" data-item-field="unit_price" value="${U.escapeAttr(computed.unit_price || '')}" /></td>
          <td><input class="input" type="number" step="0.01" data-item-field="discount_percent" value="${U.escapeAttr(computed.discount_percent || '')}" /></td>
          <td><input class="input" type="number" step="0.01" data-item-field="quantity" value="${U.escapeAttr(computed.quantity || '')}" /></td>
          <td><span data-item-display="discounted_unit_price">${this.formatMoney(computed.discounted_unit_price)}</span></td>
          <td><span data-item-display="line_total">${this.formatMoney(computed.line_total)}</span></td>
          <td><input class="input" data-item-field="notes" value="${U.escapeAttr(computed.notes || '')}" /></td>
          <td><button class="btn ghost sm" type="button" data-item-remove="${section}" data-item-index="${index}">Remove</button></td>
        </tr>`;
      })
      .join('');
    [...tbody.querySelectorAll('tr[data-item-row]')].forEach(tr => this.applyCatalogSelectionToRow(tr, section));
  },
  renderItems(items = []) {
    this.renderCatalogOptionLists();
    const groups = this.groupedItems(items);
    this.renderSectionRows('annual_saas', groups.annual_saas);
    this.renderSectionRows('one_time_fee', groups.one_time_fee);
    this.renderSectionRows('capability', groups.capability);
  },
  assignFormValues(invoice = {}) {
    const set = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.value = value ?? '';
    };
    this.invoiceFields.forEach(field => {
      const id = `invoiceForm${field.replace(/(^|_)([a-z])/g, (_, __, ch) => ch.toUpperCase())}`;
      set(id, invoice[field] || '');
    });
  },
  collectSectionItems(section) {
    const tbody =
      section === 'annual_saas'
        ? E.invoiceAnnualItemsTbody
        : section === 'one_time_fee'
        ? E.invoiceOneTimeItemsTbody
        : E.invoiceCapabilityItemsTbody;
    if (!tbody) return [];
    const rows = [...tbody.querySelectorAll('tr[data-item-row]')];
    return rows
      .map((tr, idx) => {
        const get = field => tr.querySelector(`[data-item-field="${field}"]`)?.value ?? '';
        if (section === 'capability') {
          const capabilityName = String(get('capability_name')).trim();
          const capabilityValue = String(get('capability_value')).trim();
          const notes = String(get('notes')).trim();
          if (!capabilityName && !capabilityValue && !notes) return null;
          return { section, line_no: idx + 1, capability_name: capabilityName, capability_value: capabilityValue, notes };
        }
        const unitPrice = this.toNumberSafe(get('unit_price'));
        const discountPercent = this.toNumberSafe(get('discount_percent'));
        const quantity = this.toNumberSafe(get('quantity'));
        const computed = this.computeCommercialRow({ unit_price: unitPrice, discount_percent: discountPercent, quantity });
        if (!get('item_name') && !get('location_name') && !unitPrice && !quantity && !get('notes')) return null;
        return this.normalizeItem({
          section,
          line_no: idx + 1,
          location_name: String(get('location_name')).trim(),
          location_address: String(get('location_address')).trim(),
          service_start_date: String(get('service_start_date')).trim(),
          service_end_date: String(get('service_end_date')).trim(),
          item_name: String(get('item_name')).trim(),
          unit_price: unitPrice,
          discount_percent: discountPercent,
          quantity,
          discounted_unit_price: computed.discounted_unit_price,
          line_total: computed.line_total,
          notes: String(get('notes')).trim()
        });
      })
      .filter(Boolean);
  },
  collectItems() {
    return [
      ...this.collectSectionItems('annual_saas'),
      ...this.collectSectionItems('one_time_fee'),
      ...this.collectSectionItems('capability')
    ];
  },
  collectFormValues() {
    const get = id => String(document.getElementById(id)?.value || '').trim();
    const invoice = {};
    this.invoiceFields.forEach(field => {
      const id = `invoiceForm${field.replace(/(^|_)([a-z])/g, (_, __, ch) => ch.toUpperCase())}`;
      invoice[field] = get(id);
    });
    const items = this.collectItems();
    return { invoice, items };
  },
  openInvoice(invoice = this.emptyInvoice(), items = [], { readOnly = false } = {}) {
    if (!E.invoiceFormModal || !E.invoiceForm) return;
    this.state.selectedInvoice = this.normalizeInvoice(invoice);
    this.state.selectedInvoice.invoice_number = this.ensureInvoiceNumber(this.state.selectedInvoice.invoice_number);
    if (!this.state.selectedInvoice.invoice_date) this.state.selectedInvoice.invoice_date = this.todayIso();
    this.state.items = Array.isArray(items) ? items.map(item => this.normalizeItem(item)) : [];
    this.assignFormValues(this.state.selectedInvoice);
    this.renderItems(this.state.items);
    if (this.state.items.length) {
      this.applyTotalsToForm(this.calculateInvoiceTotals(this.state.items));
    }
    E.invoiceForm.dataset.id = this.state.selectedInvoice.invoice_id || '';
    if (E.invoiceFormTitle) {
      E.invoiceFormTitle.textContent = this.state.selectedInvoice.invoice_id
        ? readOnly
          ? 'Invoice Details'
          : 'Edit Invoice'
        : 'Create Invoice';
    }
    const canSave = this.state.selectedInvoice.invoice_id
      ? Permissions.canUpdateInvoice()
      : Permissions.canCreateInvoice();
    if (E.invoiceFormDeleteBtn) E.invoiceFormDeleteBtn.style.display = !readOnly && this.state.selectedInvoice.invoice_id && Permissions.canDeleteInvoice() ? '' : 'none';
    if (E.invoiceFormSaveBtn) E.invoiceFormSaveBtn.style.display = !readOnly && canSave ? '' : 'none';
    E.invoiceForm.querySelectorAll('input, select, textarea').forEach(el => {
      if (el.id === 'invoiceFormInvoiceId') {
        el.disabled = true;
        return;
      }
      el.disabled = readOnly;
    });
    if (E.invoiceAddAnnualRowBtn) E.invoiceAddAnnualRowBtn.style.display = readOnly ? 'none' : '';
    if (E.invoiceAddOneTimeRowBtn) E.invoiceAddOneTimeRowBtn.style.display = readOnly ? 'none' : '';
    if (E.invoiceAddCapabilityRowBtn) E.invoiceAddCapabilityRowBtn.style.display = readOnly ? 'none' : '';
    this.ensureCatalogLoaded();
    E.invoiceFormModal.classList.add('open');
    E.invoiceFormModal.setAttribute('aria-hidden', 'false');
  },
  closeForm() {
    if (!E.invoiceFormModal || !E.invoiceForm) return;
    E.invoiceFormModal.classList.remove('open');
    E.invoiceFormModal.setAttribute('aria-hidden', 'true');
    E.invoiceForm.reset();
    E.invoiceForm.dataset.id = '';
    this.state.selectedInvoice = null;
    this.state.items = [];
    this.renderItems([]);
  },
  extractAgreementAndItems(response, fallbackId = '') {
    const candidates = [
      response,
      response?.data,
      response?.rows,
      response?.items,
      response?.result,
      response?.payload,
      response?.agreement,
      response?.signed_agreement,
      response?.data?.agreement,
      response?.data?.signed_agreement,
      response?.result?.agreement,
      response?.result?.signed_agreement,
      response?.payload?.agreement,
      response?.payload?.signed_agreement
    ];
    let agreement = null;
    let items = [];
    for (const candidate of candidates) {
      if (!candidate) continue;
      if (Array.isArray(candidate)) {
        if (!items.length) items = candidate;
        continue;
      }
      if (typeof candidate !== 'object') continue;
      if (!agreement) {
        if (candidate.signed_agreement && typeof candidate.signed_agreement === 'object') agreement = candidate.signed_agreement;
        else if (candidate.agreement && typeof candidate.agreement === 'object') agreement = candidate.agreement;
        else if (
          candidate.agreement_id ||
          candidate.agreementId ||
          candidate.agreement_number ||
          candidate.agreementNumber ||
          candidate.customer_name ||
          candidate.customerName
        )
          agreement = candidate;
      }
      if (!items.length) {
        if (Array.isArray(candidate.signed_agreement_items)) items = candidate.signed_agreement_items;
        else if (Array.isArray(candidate.signedAgreementItems)) items = candidate.signedAgreementItems;
        else if (Array.isArray(candidate.agreement_items)) items = candidate.agreement_items;
        else if (Array.isArray(candidate.agreementItems)) items = candidate.agreementItems;
        else if (Array.isArray(candidate.items)) items = candidate.items;
        else if (Array.isArray(candidate.agreement?.items)) items = candidate.agreement.items;
        else if (Array.isArray(candidate.signed_agreement?.items)) items = candidate.signed_agreement.items;
      }
    }
    const agreementStatus = this.normalizeText(agreement?.status || '');
    const isSignedAgreement = !agreementStatus || agreementStatus.includes('signed');
    return {
      agreement: agreement || { agreement_id: fallbackId },
      items: isSignedAgreement && Array.isArray(items) ? items : []
    };
  },
  async hydrateFromAgreement(agreementId) {
    const id = String(agreementId || '').trim();
    if (!id) return;
    try {
      const response = await Api.getAgreement(id);
      const { agreement, items } = this.extractAgreementAndItems(response, id);
      const pickAgreementValue = (...values) => {
        for (const value of values) {
          if (value !== undefined && value !== null && String(value).trim() !== '') return value;
        }
        return '';
      };
      const mappedInvoice = this.normalizeInvoice({
        ...this.collectFormValues().invoice,
        agreement_id: id,
        customer_name: pickAgreementValue(agreement.customer_name, agreement.customerName, agreement.customer?.name),
        customer_legal_name: pickAgreementValue(
          agreement.customer_legal_name,
          agreement.customerLegalName,
          agreement.customer?.legal_name,
          agreement.customer?.legalName
        ),
        customer_address: pickAgreementValue(
          agreement.customer_address,
          agreement.customerAddress,
          agreement.customer?.address
        ),
        customer_contact_name: pickAgreementValue(
          agreement.customer_contact_name,
          agreement.customerContactName,
          agreement.customer?.contact_name,
          agreement.customer?.contactName
        ),
        customer_contact_email: pickAgreementValue(
          agreement.customer_contact_email,
          agreement.customerContactEmail,
          agreement.customer?.contact_email,
          agreement.customer?.contactEmail
        ),
        payment_term: pickAgreementValue(
          agreement.payment_term,
          agreement.payment_terms,
          agreement.paymentTerm,
          agreement.paymentTerms
        ),
        currency: pickAgreementValue(agreement.currency, agreement.customer?.currency),
        subtotal_subscription: pickAgreementValue(
          agreement.saas_total,
          agreement.saasTotal,
          agreement.subtotal_subscription,
          agreement.subtotalSubscription
        ),
        subtotal_one_time: pickAgreementValue(
          agreement.one_time_total,
          agreement.oneTimeTotal,
          agreement.subtotal_one_time,
          agreement.subtotalOneTime
        ),
        grand_total: pickAgreementValue(agreement.grand_total, agreement.grandTotal),
        notes: agreement.notes
      });
      mappedInvoice.invoice_number = this.ensureInvoiceNumber(mappedInvoice.invoice_number);
      this.assignFormValues(mappedInvoice);
      const catalogLookup = await this.getProposalCatalogLookup();
      const normalizedItems = items.map(item => this.mergeCatalogItem(item, catalogLookup));
      this.renderItems(normalizedItems);
      const totals = this.calculateInvoiceTotals(normalizedItems);
      this.applyTotalsToForm(totals);
    } catch (error) {
      UI.toast('Unable to auto-fill from agreement: ' + (error?.message || 'Unknown error'));
    }
  },
  async openInvoiceById(invoiceId, { readOnly = false } = {}) {
    const id = String(invoiceId || '').trim();
    if (!id) return;
    try {
      const response = await Api.getInvoice(id);
      const { invoice, items } = this.extractInvoiceAndItems(response, id);
      this.openInvoice(invoice, items, { readOnly });
    } catch (error) {
      UI.toast('Unable to load invoice: ' + (error?.message || 'Unknown error'));
    }
  },
  async saveForm() {
    const id = String(E.invoiceForm?.dataset.id || '').trim();
    const { invoice, items } = this.collectFormValues();
    const totals = this.calculateInvoiceTotals(items);
    const payloadInvoice = this.normalizeInvoice({
      ...invoice,
      subtotal_subscription: totals.subtotal_subscription,
      subtotal_one_time: totals.subtotal_one_time,
      grand_total: totals.grand_total
    });
    this.assignFormValues(payloadInvoice);
    try {
      if (id) {
        if (!Permissions.canUpdateInvoice()) return UI.toast('You do not have permission to update invoices.');
        await Api.updateInvoice(id, payloadInvoice, items);
        UI.toast('Invoice updated.');
      } else {
        if (!Permissions.canCreateInvoice()) return UI.toast('You do not have permission to create invoices.');
        await Api.createInvoice(payloadInvoice, items);
        UI.toast('Invoice created.');
      }
      this.closeForm();
      await this.refresh(true);
    } catch (error) {
      UI.toast('Unable to save invoice: ' + (error?.message || 'Unknown error'));
    }
  },
  async deleteInvoice(invoiceId) {
    if (!Permissions.canDeleteInvoice()) return UI.toast('Insufficient permissions to delete invoices.');
    const id = String(invoiceId || '').trim();
    if (!id || !window.confirm(`Delete invoice ${id}?`)) return;
    try {
      await Api.deleteInvoice(id);
      UI.toast('Invoice deleted.');
      this.closeForm();
      await this.refresh(true);
    } catch (error) {
      UI.toast('Unable to delete invoice: ' + (error?.message || 'Unknown error'));
    }
  },
  async previewInvoice(invoiceId) {
    const id = String(invoiceId || '').trim();
    if (!id) return;
    if (!Permissions.canPreviewInvoice()) return UI.toast('You do not have permission to preview invoices.');
    try {
      const response = await Api.generateInvoiceHtml(id);
      const html = String(response?.html || response?.invoice_html || response?.content || response || '').trim();
      if (!html) return UI.toast('No invoice HTML was returned by backend.');
      if (E.invoicePreviewTitle) E.invoicePreviewTitle.textContent = `Invoice Preview · ${id}`;
      if (E.invoicePreviewFrame) E.invoicePreviewFrame.srcdoc = html;
      if (E.invoicePreviewModal) {
        E.invoicePreviewModal.classList.add('open');
        E.invoicePreviewModal.setAttribute('aria-hidden', 'false');
      }
    } catch (error) {
      UI.toast('Unable to preview invoice: ' + (error?.message || 'Unknown error'));
    }
  },
  closePreview() {
    if (!E.invoicePreviewModal) return;
    E.invoicePreviewModal.classList.remove('open');
    E.invoicePreviewModal.setAttribute('aria-hidden', 'true');
    if (E.invoicePreviewFrame) E.invoicePreviewFrame.srcdoc = '';
  },
  async openCreateFromAgreementResult(invoice) {
    const normalized = this.normalizeInvoice(invoice || {});
    if (typeof setActiveView === 'function') setActiveView('invoices');
    await this.refresh(true);
    if (normalized.invoice_id) {
      await this.openInvoiceById(normalized.invoice_id, { readOnly: false });
    }
  },
  async openCreateFromAgreementTemplate(agreementId) {
    const id = String(agreementId || '').trim();
    if (!id) return;
    this.openInvoice(this.normalizeInvoice({ ...this.emptyInvoice(), agreement_id: id }), [], { readOnly: false });
    await this.hydrateFromAgreement(id);
  },
  async refresh(force = false) {
    if (this.state.loading && !force) return;
    if (!Permissions.canViewInvoices()) {
      this.state.rows = [];
      this.state.filteredRows = [];
      this.render();
      return;
    }
    this.state.loading = true;
    this.state.loadError = '';
    this.render();
    try {
      const filters = {};
      const status = String(this.state.status || '').trim();
      const search = String(this.state.search || '').trim();
      if (status && status !== 'All') filters.status = status;
      if (search) filters.search = search;
      const response = await Api.listInvoices(filters);
      this.state.rows = this.extractRows(response).map(row => this.normalizeInvoice(row));
    } catch (error) {
      this.state.rows = [];
      this.state.loadError = String(error?.message || '').trim() || 'Unable to load invoices.';
    } finally {
      this.state.loading = false;
      this.applyFilters();
      this.renderFilters();
      this.render();
    }
  },
  init() {
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
    bindState(E.invoicesSearchInput, 'search');
    bindState(E.invoicesStatusFilter, 'status');

    if (E.invoicesRefreshBtn) E.invoicesRefreshBtn.addEventListener('click', () => this.refresh(true));
    if (E.invoicesCreateBtn) {
      E.invoicesCreateBtn.addEventListener('click', () => {
        if (!Permissions.canCreateInvoice()) return UI.toast('You do not have permission to create invoices.');
        this.openInvoice(this.emptyInvoice(), [], { readOnly: false });
      });
    }
    if (E.invoicesTbody) {
      E.invoicesTbody.addEventListener('click', event => {
        const trigger = event.target?.closest?.('button[data-invoice-view], button[data-invoice-edit], button[data-invoice-preview], button[data-invoice-delete]');
        if (!trigger) return;
        const viewId = trigger.getAttribute('data-invoice-view');
        if (viewId) return this.openInvoiceById(viewId, { readOnly: true });
        const editId = trigger.getAttribute('data-invoice-edit');
        if (editId) return this.openInvoiceById(editId, { readOnly: false });
        const previewId = trigger.getAttribute('data-invoice-preview');
        if (previewId) return this.previewInvoice(previewId);
        const deleteId = trigger.getAttribute('data-invoice-delete');
        if (deleteId) return this.deleteInvoice(deleteId);
      });
    }
    if (E.invoiceForm) {
      E.invoiceForm.addEventListener('submit', event => {
        event.preventDefault();
        this.saveForm();
      });
      E.invoiceForm.addEventListener('click', event => {
        const removeBtn = event.target?.closest?.('button[data-item-remove]');
        if (!removeBtn) return;
        const section = removeBtn.getAttribute('data-item-remove');
        const index = Number(removeBtn.getAttribute('data-item-index'));
        if (!section || !Number.isInteger(index) || index < 0) return;
        const groups = this.groupedItems(this.collectItems());
        if (!groups[section]) return;
        groups[section] = groups[section].filter((_, idx) => idx !== index);
        const items = [...groups.annual_saas, ...groups.one_time_fee, ...groups.capability];
        this.renderItems(items);
        this.applyTotalsToForm(this.calculateInvoiceTotals(items));
      });
      E.invoiceForm.addEventListener('input', event => {
        const field = event.target?.getAttribute('data-item-field');
        if (!field) return;
        const tr = event.target.closest('tr[data-item-row]');
        const section = tr?.getAttribute('data-item-row');
        if (!tr || !section || section === 'capability') {
          this.applyTotalsToForm(this.calculateInvoiceTotals(this.collectItems()));
          return;
        }
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
        this.applyTotalsToForm(this.calculateInvoiceTotals(this.collectItems()));
      });
      E.invoiceForm.addEventListener('change', event => {
        const field = event.target?.getAttribute('data-item-field');
        if (field !== 'item_name') return;
        const tr = event.target.closest('tr[data-item-row]');
        const section = tr?.getAttribute('data-item-row');
        if (!tr || !section || section === 'capability') return;
        this.applyCatalogSelectionToRow(tr, section);
      });
    }
    if (E.invoiceAddAnnualRowBtn) {
      E.invoiceAddAnnualRowBtn.addEventListener('click', () => {
        const items = this.collectItems();
        items.push(this.normalizeItem({ section: 'annual_saas', quantity: 1 }));
        this.renderItems(items);
        this.applyTotalsToForm(this.calculateInvoiceTotals(items));
      });
    }
    if (E.invoiceAddOneTimeRowBtn) {
      E.invoiceAddOneTimeRowBtn.addEventListener('click', () => {
        const items = this.collectItems();
        items.push(this.normalizeItem({ section: 'one_time_fee', quantity: 1 }));
        this.renderItems(items);
        this.applyTotalsToForm(this.calculateInvoiceTotals(items));
      });
    }
    if (E.invoiceAddCapabilityRowBtn) {
      E.invoiceAddCapabilityRowBtn.addEventListener('click', () => {
        const items = this.collectItems();
        items.push(this.normalizeItem({ section: 'capability', capability_name: '', capability_value: '' }));
        this.renderItems(items);
        this.applyTotalsToForm(this.calculateInvoiceTotals(items));
      });
    }
    if (E.invoiceFormAgreementId) {
      E.invoiceFormAgreementId.addEventListener('change', () => {
        this.hydrateFromAgreement(E.invoiceFormAgreementId?.value || '');
      });
      E.invoiceFormAgreementId.addEventListener('blur', () => {
        this.hydrateFromAgreement(E.invoiceFormAgreementId?.value || '');
      });
    }
    if (E.invoiceFormCloseBtn) E.invoiceFormCloseBtn.addEventListener('click', () => this.closeForm());
    if (E.invoiceFormCancelBtn) E.invoiceFormCancelBtn.addEventListener('click', () => this.closeForm());
    if (E.invoiceFormDeleteBtn) E.invoiceFormDeleteBtn.addEventListener('click', () => this.deleteInvoice(E.invoiceForm?.dataset.id || ''));
    if (E.invoiceFormPreviewBtn) E.invoiceFormPreviewBtn.addEventListener('click', () => this.previewInvoice(E.invoiceForm?.dataset.id || ''));
    if (E.invoiceFormModal) E.invoiceFormModal.addEventListener('click', event => {
      if (event.target === E.invoiceFormModal) this.closeForm();
    });
    if (E.invoicePreviewCloseBtn) E.invoicePreviewCloseBtn.addEventListener('click', () => this.closePreview());
    if (E.invoicePreviewModal) E.invoicePreviewModal.addEventListener('click', event => {
      if (event.target === E.invoicePreviewModal) this.closePreview();
    });

    this.state.initialized = true;
    this.renderCatalogOptionLists();
  }
};

window.Invoices = Invoices;
