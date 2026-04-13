const Receipts = {
  receiptFields: [
    'receipt_id',
    'receipt_number',
    'invoice_id',
    'invoice_number',
    'agreement_id',
    'customer_name',
    'customer_legal_name',
    'customer_address',
    'customer_contact_name',
    'customer_contact_email',
    'receipt_date',
    'currency',
    'subtotal_locations',
    'subtotal_one_time',
    'grand_total',
    'amount_in_words',
    'payment_notes',
    'provider_legal_name',
    'provider_address',
    'support_email',
    'status',
    'generated_by',
    'created_at',
    'updated_at'
  ],
  state: {
    rows: [],
    filteredRows: [],
    loading: false,
    loadError: '',
    initialized: false,
    search: '',
    invoiceNumber: '',
    customerName: '',
    status: 'All',
    selectedReceipt: null,
    items: []
  },
  toNumberSafe(value) {
    const parsed = Number(String(value ?? '').replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : 0;
  },
  formatMoney(value) {
    return this.toNumberSafe(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
  },
  normalizeText(value) {
    return String(value ?? '').trim().toLowerCase();
  },
  normalizeReceipt(raw = {}) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const normalized = {};
    this.receiptFields.forEach(field => {
      const camel = field.replace(/_([a-z])/g, (_, ch) => ch.toUpperCase());
      const value = source[field] ?? source[camel] ?? '';
      normalized[field] = typeof value === 'string' ? value.trim() : value;
    });
    normalized.receipt_id = String(normalized.receipt_id || source.id || '').trim();
    normalized.receipt_number = String(normalized.receipt_number || '').trim();
    normalized.currency = String(normalized.currency || '').trim() || 'USD';
    normalized.status = String(normalized.status || '').trim() || 'Issued';
    return normalized;
  },
  normalizeItem(raw = {}) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const pick = (...values) => values.find(v => v !== undefined && v !== null && String(v).trim() !== '') || '';
    const rawSection = String(pick(source.section, source.item_section, source.itemSection)).trim().toLowerCase();
    const section = rawSection === 'one_time_fee' ? 'one_time_fee' : 'location_details';
    return {
      receipt_item_id: String(pick(source.receipt_item_id, source.receiptItemId)).trim(),
      receipt_id: String(pick(source.receipt_id, source.receiptId)).trim(),
      section,
      line_no: this.toNumberSafe(pick(source.line_no, source.lineNo, source.line)),
      location_name: String(pick(source.location_name, source.locationName)).trim(),
      location_address: String(pick(source.location_address, source.locationAddress)).trim(),
      service_start_date: String(pick(source.service_start_date, source.serviceStartDate)).trim(),
      service_end_date: String(pick(source.service_end_date, source.serviceEndDate)).trim(),
      modules: String(pick(source.modules, source.item_name, source.itemName)).trim(),
      item_name: String(pick(source.item_name, source.itemName)).trim(),
      unit_price: this.toNumberSafe(pick(source.unit_price, source.unitPrice)),
      discount_percent: this.toNumberSafe(pick(source.discount_percent, source.discountPercent)),
      quantity: this.toNumberSafe(pick(source.quantity, source.qty)),
      line_total: this.toNumberSafe(pick(source.line_total, source.lineTotal)),
      notes: String(pick(source.notes)).trim()
    };
  },
  extractRows(response) {
    const candidates = [response, response?.receipts, response?.items, response?.rows, response?.data, response?.result, response?.payload];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return candidate;
    }
    return [];
  },
  extractReceiptAndItems(response) {
    const candidate = response?.receipt || response?.data?.receipt || response?.result?.receipt || response?.payload?.receipt || response || {};
    const items = response?.items || candidate?.items || response?.data?.items || response?.result?.items || [];
    return {
      receipt: this.normalizeReceipt(candidate),
      items: (Array.isArray(items) ? items : []).map(item => this.normalizeItem(item))
    };
  },
  applyFilters() {
    const q = this.normalizeText(this.state.search);
    const invoiceQ = this.normalizeText(this.state.invoiceNumber);
    const customerQ = this.normalizeText(this.state.customerName);
    this.state.filteredRows = this.state.rows.filter(row => {
      if (this.state.status !== 'All' && String(row.status || '').trim() !== this.state.status) return false;
      if (q && !this.normalizeText(row.receipt_number).includes(q)) return false;
      if (invoiceQ && !this.normalizeText(row.invoice_number).includes(invoiceQ)) return false;
      if (customerQ && !this.normalizeText(row.customer_name).includes(customerQ)) return false;
      return true;
    });
  },
  renderSummary() {
    if (!E.receiptSummary) return;
    const total = this.state.rows.length;
    const issued = this.state.rows.filter(r => this.normalizeText(r.status) === 'issued').length;
    const paid = this.state.rows.filter(r => this.normalizeText(r.status) === 'paid').length;
    const totalAmount = this.state.rows.reduce((sum, row) => sum + this.toNumberSafe(row.grand_total), 0);
    E.receiptSummary.innerHTML = [
      { label: 'Total Receipts', value: total },
      { label: 'Issued', value: issued },
      { label: 'Paid', value: paid },
      { label: 'Grand Total', value: this.formatMoney(totalAmount) }
    ]
      .map(card => `<div class="card kpi"><div class="label">${U.escapeHtml(card.label)}</div><div class="value">${U.escapeHtml(String(card.value))}</div></div>`)
      .join('');
  },
  renderFilters() {
    if (!E.receiptsStatusFilter) return;
    const statuses = ['All', ...new Set(this.state.rows.map(row => String(row.status || '').trim()).filter(Boolean))];
    E.receiptsStatusFilter.innerHTML = statuses.map(v => `<option>${U.escapeHtml(v)}</option>`).join('');
    E.receiptsStatusFilter.value = statuses.includes(this.state.status) ? this.state.status : 'All';
  },
  render() {
    if (!E.receiptsTbody || !E.receiptsState) return;
    if (this.state.loading) {
      E.receiptsState.textContent = 'Loading receipts…';
      E.receiptsTbody.innerHTML = '<tr><td colspan="9" class="muted" style="text-align:center;">Loading receipts…</td></tr>';
      return;
    }
    if (this.state.loadError) {
      E.receiptsState.textContent = this.state.loadError;
      E.receiptsTbody.innerHTML = `<tr><td colspan="9" class="muted" style="text-align:center;color:#ffb4b4;">${U.escapeHtml(this.state.loadError)}</td></tr>`;
      return;
    }
    this.renderSummary();
    const rows = this.state.filteredRows;
    E.receiptsState.textContent = `${rows.length} of ${this.state.rows.length} receipts`;
    if (!rows.length) {
      E.receiptsTbody.innerHTML = '<tr><td colspan="9" class="muted" style="text-align:center;">No receipts found.</td></tr>';
      return;
    }
    E.receiptsTbody.innerHTML = rows
      .map(row => {
        const id = U.escapeAttr(row.receipt_id || '');
        return `<tr>
          <td>${U.escapeHtml(row.receipt_number || row.receipt_id || '—')}</td>
          <td>${U.escapeHtml(row.invoice_number || '—')}</td>
          <td>${U.escapeHtml(row.customer_name || '—')}</td>
          <td>${U.escapeHtml(row.receipt_date || '—')}</td>
          <td>${U.escapeHtml(row.currency || '—')}</td>
          <td>${this.formatMoney(row.grand_total)}</td>
          <td>${U.escapeHtml(row.status || '—')}</td>
          <td>${U.escapeHtml(row.updated_at || '—')}</td>
          <td><div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button class="btn ghost sm" type="button" data-receipt-view="${id}">View</button>
            ${Permissions.canUpdateReceipt() ? `<button class="btn ghost sm" type="button" data-receipt-edit="${id}">Edit</button>` : ''}
            ${Permissions.canPreviewReceipt() ? `<button class="btn ghost sm" type="button" data-receipt-preview="${id}">Preview</button>` : ''}
            ${Permissions.canDeleteReceipt() ? `<button class="btn ghost sm" type="button" data-receipt-delete="${id}">Delete</button>` : ''}
          </div></td>
        </tr>`;
      })
      .join('');
  },
  renderItems(items = []) {
    const locations = items.filter(item => item.section === 'location_details');
    const oneTime = items.filter(item => item.section === 'one_time_fee');
    if (E.receiptLocationItemsTbody) {
      E.receiptLocationItemsTbody.innerHTML = locations.length
        ? locations
            .map(item => `<tr><td>${U.escapeHtml(item.location_name || '—')}</td><td>${U.escapeHtml(item.location_address || '—')}</td><td>${U.escapeHtml(item.service_start_date || '—')}</td><td>${U.escapeHtml(item.service_end_date || '—')}</td><td>${U.escapeHtml(item.modules || item.item_name || '—')}</td><td>${this.formatMoney(item.line_total)}</td><td>${U.escapeHtml(item.notes || '—')}</td></tr>`)
            .join('')
        : '<tr><td colspan="7" class="muted" style="text-align:center;">No location detail rows.</td></tr>';
    }
    if (E.receiptOneTimeItemsTbody) {
      E.receiptOneTimeItemsTbody.innerHTML = oneTime.length
        ? oneTime
            .map(item => `<tr><td>${U.escapeHtml(item.item_name || item.modules || '—')}</td><td>${U.escapeHtml(String(item.quantity || 0))}</td><td>${this.formatMoney(item.unit_price)}</td><td>${U.escapeHtml(String(item.discount_percent || 0))}</td><td>${this.formatMoney(item.line_total)}</td><td>${U.escapeHtml(item.notes || '—')}</td></tr>`)
            .join('')
        : '<tr><td colspan="6" class="muted" style="text-align:center;">No one-time fee rows.</td></tr>';
    }
  },
  populateForm(receipt, items, readOnly = false) {
    const set = (id, value) => {
      const el = E[id];
      if (el) el.value = value ?? '';
    };
    set('receiptFormReceiptId', receipt.receipt_id);
    set('receiptFormReceiptNumber', receipt.receipt_number);
    set('receiptFormInvoiceId', receipt.invoice_id);
    set('receiptFormInvoiceNumber', receipt.invoice_number);
    set('receiptFormReceiptDate', receipt.receipt_date);
    set('receiptFormCustomerName', receipt.customer_name);
    set('receiptFormCustomerLegalName', receipt.customer_legal_name);
    set('receiptFormCustomerAddress', receipt.customer_address);
    set('receiptFormCurrency', receipt.currency);
    set('receiptFormStatus', receipt.status);
    set('receiptFormAmountInWords', receipt.amount_in_words);
    set('receiptFormPaymentNotes', receipt.payment_notes);
    set('receiptFormSupportEmail', receipt.support_email);
    if (E.receiptForm) E.receiptForm.dataset.id = receipt.receipt_id || '';
    if (E.receiptFormTitle) E.receiptFormTitle.textContent = receipt.receipt_id ? `Receipt · ${receipt.receipt_id}` : 'Create Receipt';
    if (E.receiptFormDeleteBtn) E.receiptFormDeleteBtn.style.display = !readOnly && receipt.receipt_id && Permissions.canDeleteReceipt() ? '' : 'none';
    if (E.receiptFormSaveBtn) E.receiptFormSaveBtn.style.display = !readOnly && Permissions.canUpdateReceipt() ? '' : 'none';
    this.renderItems(items);
    if (E.receiptForm) {
      E.receiptForm.querySelectorAll('input, textarea').forEach(el => {
        if (el.id === 'receiptFormReceiptId') return;
        el.disabled = readOnly;
      });
    }
    if (E.receiptFormModal) {
      E.receiptFormModal.classList.add('open');
      E.receiptFormModal.setAttribute('aria-hidden', 'false');
    }
  },
  closeForm() {
    if (E.receiptFormModal) {
      E.receiptFormModal.classList.remove('open');
      E.receiptFormModal.setAttribute('aria-hidden', 'true');
    }
  },
  async openReceiptById(receiptId, { readOnly = false } = {}) {
    if (!receiptId) return;
    try {
      const response = await Api.getReceipt(receiptId);
      const { receipt, items } = this.extractReceiptAndItems(response);
      this.state.selectedReceipt = receipt;
      this.state.items = items;
      this.populateForm(receipt, items, readOnly);
    } catch (error) {
      UI.toast('Unable to load receipt: ' + (error?.message || 'Unknown error'));
    }
  },
  collectUpdates() {
    const get = id => String(E[id]?.value || '').trim();
    return {
      receipt_number: get('receiptFormReceiptNumber'),
      invoice_id: get('receiptFormInvoiceId'),
      invoice_number: get('receiptFormInvoiceNumber'),
      receipt_date: get('receiptFormReceiptDate'),
      customer_name: get('receiptFormCustomerName'),
      customer_legal_name: get('receiptFormCustomerLegalName'),
      customer_address: get('receiptFormCustomerAddress'),
      currency: get('receiptFormCurrency'),
      status: get('receiptFormStatus'),
      amount_in_words: get('receiptFormAmountInWords'),
      payment_notes: get('receiptFormPaymentNotes'),
      support_email: get('receiptFormSupportEmail')
    };
  },
  async saveForm() {
    const id = String(E.receiptForm?.dataset.id || '').trim();
    if (!id) return;
    try {
      await Api.updateReceipt(id, this.collectUpdates());
      UI.toast(`Receipt ${id} saved.`);
      this.closeForm();
      await this.refresh(true);
    } catch (error) {
      UI.toast('Unable to save receipt: ' + (error?.message || 'Unknown error'));
    }
  },
  async deleteReceipt(receiptId) {
    const id = String(receiptId || '').trim();
    if (!id) return;
    if (!window.confirm(`Delete receipt ${id}? This cannot be undone.`)) return;
    try {
      await Api.deleteReceipt(id);
      UI.toast(`Receipt ${id} deleted.`);
      await this.refresh(true);
      if (String(E.receiptForm?.dataset.id || '').trim() === id) this.closeForm();
    } catch (error) {
      UI.toast('Unable to delete receipt: ' + (error?.message || 'Unknown error'));
    }
  },
  formatReceiptPreviewHtml(html) {
    const branded = U.addIncheckDocumentLogo(html);
    if (!branded || /data-incheck360-receipt-style/i.test(branded)) return branded;

    const styleTag = `<style data-incheck360-receipt-style>
      body{font-family:Inter,Segoe UI,Arial,sans-serif;line-height:1.45;color:#0f172a;padding:24px;}
      h1,h2,h3,h4{margin:0 0 10px;color:#0f172a;}
      p{margin:0 0 8px;}
      table{width:100%;border-collapse:collapse;margin:14px 0 18px;}
      th,td{border:1px solid #dbe2ea;padding:8px 10px;vertical-align:top;text-align:left;}
      th{background:#f8fafc;font-weight:600;}
      .section,.block,.panel{margin-bottom:14px;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;}
    </style>`;

    if (/<\/head>/i.test(branded)) return branded.replace(/<\/head>/i, `${styleTag}</head>`);
    return `${styleTag}${branded}`;
  },
  async previewReceipt(receiptId) {
    const id = String(receiptId || '').trim();
    if (!id) return;
    try {
      const response = await Api.previewReceipt(id);
      const html = String(response?.html || response?.receipt_html || response?.content || response || '').trim();
      if (!html) return UI.toast('No receipt HTML was returned by backend.');
      const formattedHtml = this.formatReceiptPreviewHtml(html);
      if (E.receiptPreviewTitle) E.receiptPreviewTitle.textContent = `RECEIPT VOUCHER · ${id}`;
      if (E.receiptPreviewFrame) E.receiptPreviewFrame.srcdoc = formattedHtml;
      if (E.receiptPreviewModal) {
        E.receiptPreviewModal.classList.add('open');
        E.receiptPreviewModal.setAttribute('aria-hidden', 'false');
      }
    } catch (error) {
      UI.toast('Unable to preview receipt: ' + (error?.message || 'Unknown error'));
    }
  },
  closePreview() {
    if (!E.receiptPreviewModal) return;
    E.receiptPreviewModal.classList.remove('open');
    E.receiptPreviewModal.setAttribute('aria-hidden', 'true');
    if (E.receiptPreviewFrame) E.receiptPreviewFrame.srcdoc = '';
  },
  async refresh(force = false) {
    if (this.state.loading && !force) return;
    if (!Permissions.canViewReceipts()) {
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
      if (this.state.search) filters.receipt_number = this.state.search;
      if (this.state.invoiceNumber) filters.invoice_number = this.state.invoiceNumber;
      if (this.state.customerName) filters.customer_name = this.state.customerName;
      if (this.state.status && this.state.status !== 'All') filters.status = this.state.status;
      const response = await Api.listReceipts(filters);
      this.state.rows = this.extractRows(response).map(row => this.normalizeReceipt(row));
    } catch (error) {
      this.state.rows = [];
      this.state.loadError = String(error?.message || '').trim() || 'Unable to load receipts.';
    } finally {
      this.state.loading = false;
      this.applyFilters();
      this.renderFilters();
      this.render();
    }
  },
  init() {
    if (this.state.initialized) return;
    const bind = (el, key) => {
      if (!el) return;
      const sync = () => {
        this.state[key] = String(el.value || '').trim();
        this.applyFilters();
        this.render();
      };
      el.addEventListener('input', sync);
      el.addEventListener('change', sync);
    };
    bind(E.receiptsSearchInput, 'search');
    bind(E.receiptsInvoiceFilter, 'invoiceNumber');
    bind(E.receiptsCustomerFilter, 'customerName');
    bind(E.receiptsStatusFilter, 'status');

    if (E.receiptsRefreshBtn) E.receiptsRefreshBtn.addEventListener('click', () => this.refresh(true));
    if (E.receiptsTbody) {
      E.receiptsTbody.addEventListener('click', event => {
        const trigger = event.target?.closest?.('button[data-receipt-view],button[data-receipt-edit],button[data-receipt-preview],button[data-receipt-delete]');
        if (!trigger) return;
        const viewId = trigger.getAttribute('data-receipt-view');
        if (viewId) return this.openReceiptById(viewId, { readOnly: true });
        const editId = trigger.getAttribute('data-receipt-edit');
        if (editId) return this.openReceiptById(editId, { readOnly: false });
        const previewId = trigger.getAttribute('data-receipt-preview');
        if (previewId) return this.previewReceipt(previewId);
        const deleteId = trigger.getAttribute('data-receipt-delete');
        if (deleteId) return this.deleteReceipt(deleteId);
      });
    }
    if (E.receiptForm) {
      E.receiptForm.addEventListener('submit', event => {
        event.preventDefault();
        this.saveForm();
      });
    }
    if (E.receiptFormCloseBtn) E.receiptFormCloseBtn.addEventListener('click', () => this.closeForm());
    if (E.receiptFormCancelBtn) E.receiptFormCancelBtn.addEventListener('click', () => this.closeForm());
    if (E.receiptFormDeleteBtn) E.receiptFormDeleteBtn.addEventListener('click', () => this.deleteReceipt(E.receiptForm?.dataset.id || ''));
    if (E.receiptFormPreviewBtn) E.receiptFormPreviewBtn.addEventListener('click', () => this.previewReceipt(E.receiptForm?.dataset.id || ''));
    if (E.receiptFormModal) E.receiptFormModal.addEventListener('click', event => {
      if (event.target === E.receiptFormModal) this.closeForm();
    });
    if (E.receiptPreviewCloseBtn) E.receiptPreviewCloseBtn.addEventListener('click', () => this.closePreview());
    if (E.receiptPreviewModal) E.receiptPreviewModal.addEventListener('click', event => {
      if (event.target === E.receiptPreviewModal) this.closePreview();
    });
    this.state.initialized = true;
  }
};

window.Receipts = Receipts;
