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
    items: []
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
  normalizeItem(raw = {}) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const pick = (...values) => {
      for (const value of values) {
        if (value !== undefined && value !== null && String(value).trim() !== '') return value;
      }
      return '';
    };
    return {
      section: String(pick(source.section)).trim(),
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
      notes: String(pick(source.notes)).trim()
    };
  },
  extractRows(response) {
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
    for (const candidate of candidates) if (Array.isArray(candidate)) return candidate;
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
      invoice_number: '',
      agreement_id: '',
      invoice_date: '',
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
    E.invoicesState.textContent = `${rows.length} invoice${rows.length === 1 ? '' : 's'}`;
    if (!rows.length) {
      E.invoicesTbody.innerHTML = '<tr><td colspan="10" class="muted" style="text-align:center;">No invoices found.</td></tr>';
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
  renderItems(items = []) {
    if (!E.invoiceItemsTbody) return;
    E.invoiceItemsTbody.innerHTML = items
      .map(
        (item, idx) => `<tr data-item-index="${idx}">
        <td><input class="input" data-item-field="section" value="${U.escapeAttr(item.section || '')}" /></td>
        <td><input class="input" data-item-field="location_name" value="${U.escapeAttr(item.location_name || '')}" /></td>
        <td><input class="input" data-item-field="location_address" value="${U.escapeAttr(item.location_address || '')}" /></td>
        <td><input class="input" type="date" data-item-field="service_start_date" value="${U.escapeAttr(item.service_start_date || '')}" /></td>
        <td><input class="input" type="date" data-item-field="service_end_date" value="${U.escapeAttr(item.service_end_date || '')}" /></td>
        <td><input class="input" data-item-field="item_name" value="${U.escapeAttr(item.item_name || '')}" /></td>
        <td><input class="input" type="number" step="0.01" data-item-field="unit_price" value="${U.escapeAttr(item.unit_price || '')}" /></td>
        <td><input class="input" type="number" step="0.01" data-item-field="discount_percent" value="${U.escapeAttr(item.discount_percent || '')}" /></td>
        <td><input class="input" type="number" step="0.01" data-item-field="discounted_unit_price" value="${U.escapeAttr(item.discounted_unit_price || '')}" /></td>
        <td><input class="input" type="number" step="0.01" data-item-field="quantity" value="${U.escapeAttr(item.quantity || '')}" /></td>
        <td><input class="input" type="number" step="0.01" data-item-field="line_total" value="${U.escapeAttr(item.line_total || '')}" /></td>
        <td><input class="input" data-item-field="notes" value="${U.escapeAttr(item.notes || '')}" /></td>
        <td><button type="button" class="btn ghost sm" data-item-remove="${idx}">Remove</button></td>
      </tr>`
      )
      .join('');
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
  collectItems() {
    const rows = Array.from(E.invoiceItemsTbody?.querySelectorAll('tr') || []);
    return rows.map(row => {
      const get = key => String(row.querySelector(`[data-item-field="${key}"]`)?.value || '').trim();
      const item = this.normalizeItem({
        section: get('section'),
        location_name: get('location_name'),
        location_address: get('location_address'),
        service_start_date: get('service_start_date'),
        service_end_date: get('service_end_date'),
        item_name: get('item_name'),
        unit_price: get('unit_price'),
        discount_percent: get('discount_percent'),
        discounted_unit_price: get('discounted_unit_price'),
        quantity: get('quantity'),
        line_total: get('line_total'),
        notes: get('notes')
      });
      const discount = item.discount_percent > 1 ? item.discount_percent / 100 : item.discount_percent;
      if (!item.discounted_unit_price) item.discounted_unit_price = item.unit_price * (1 - Math.max(0, discount));
      if (!item.line_total) item.line_total = item.discounted_unit_price * (item.quantity || 0);
      return item;
    });
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
    this.state.items = Array.isArray(items) ? items.map(item => this.normalizeItem(item)) : [];
    this.assignFormValues(this.state.selectedInvoice);
    this.renderItems(this.state.items);
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
    if (E.invoiceAddItemRowBtn) E.invoiceAddItemRowBtn.style.display = readOnly ? 'none' : '';
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
    try {
      if (id) {
        if (!Permissions.canUpdateInvoice()) return UI.toast('You do not have permission to update invoices.');
        await Api.updateInvoice(id, invoice, items);
        UI.toast('Invoice updated.');
      } else {
        if (!Permissions.canCreateInvoice()) return UI.toast('You do not have permission to create invoices.');
        await Api.createInvoice(invoice, items);
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
      const response = await Api.listInvoices({ status: this.state.status, search: this.state.search });
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
        const index = Number(removeBtn.getAttribute('data-item-remove'));
        if (!Number.isInteger(index) || index < 0) return;
        const items = this.collectItems().filter((_, idx) => idx !== index);
        this.renderItems(items);
      });
    }
    if (E.invoiceAddItemRowBtn) {
      E.invoiceAddItemRowBtn.addEventListener('click', () => {
        const items = this.collectItems();
        items.push(this.normalizeItem({ section: 'subscription', quantity: 1 }));
        this.renderItems(items);
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
  }
};

window.Invoices = Invoices;
