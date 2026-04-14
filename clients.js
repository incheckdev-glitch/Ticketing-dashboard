const Clients = {
  clientFields: [
    'client_id',
    'client_code',
    'customer_name',
    'customer_legal_name',
    'normalized_company_key',
    'primary_contact_name',
    'primary_contact_email',
    'phone',
    'country',
    'address',
    'billing_address',
    'tax_number',
    'industry',
    'status',
    'notes',
    'source',
    'created_at',
    'updated_at'
  ],
  state: {
    rows: [],
    filteredRows: [],
    selectedClientId: '',
    agreements: [],
    invoices: [],
    receipts: [],
    loading: false,
    loadError: '',
    search: '',
    status: 'All',
    sort: 'due_desc'
  },
  normalizeText(value) {
    return String(value || '').trim().toLowerCase();
  },
  toNumberSafe(value) {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const parsed = Number(String(value).replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : 0;
  },
  normalizeCompanyKey(value = '') {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\b(inc|llc|ltd|co|corp|corporation|company|the)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
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
    for (const candidate of candidates) if (Array.isArray(candidate)) return candidate;
    return [];
  },
  normalizeClient(raw = {}) {
    const customerName = String(raw.customer_name || raw.customerName || '').trim();
    const legalName = String(raw.customer_legal_name || raw.customerLegalName || '').trim();
    const normalized = {
      client_id: String(raw.client_id || raw.clientId || raw.id || '').trim(),
      client_code: String(raw.client_code || raw.clientCode || '').trim(),
      customer_name: customerName,
      customer_legal_name: legalName,
      normalized_company_key: String(raw.normalized_company_key || raw.normalizedCompanyKey || '').trim(),
      primary_contact_name: String(raw.primary_contact_name || raw.primaryContactName || raw.customer_contact_name || '').trim(),
      primary_contact_email: String(raw.primary_contact_email || raw.primaryContactEmail || raw.customer_contact_email || '').trim(),
      phone: String(raw.phone || raw.customer_contact_mobile || '').trim(),
      country: String(raw.country || '').trim(),
      address: String(raw.address || raw.company_address || raw.customer_address || '').trim(),
      billing_address: String(raw.billing_address || raw.billingAddress || '').trim(),
      tax_number: String(raw.tax_number || raw.taxNumber || '').trim(),
      industry: String(raw.industry || '').trim(),
      status: String(raw.status || raw.account_status || 'Active').trim(),
      notes: String(raw.notes || '').trim(),
      source: String(raw.source || '').trim(),
      created_at: String(raw.created_at || raw.createdAt || '').trim(),
      updated_at: String(raw.updated_at || raw.updatedAt || '').trim()
    };
    if (!normalized.normalized_company_key) {
      normalized.normalized_company_key = this.normalizeCompanyKey(legalName || customerName);
    }
    return normalized;
  },
  normalizeAgreement(raw = {}) {
    return {
      agreement_id: String(raw.agreement_id || raw.agreementId || raw.id || '').trim(),
      agreement_number: String(raw.agreement_number || raw.agreementNumber || '').trim(),
      customer_name: String(raw.customer_name || raw.customerName || '').trim(),
      customer_legal_name: String(raw.customer_legal_name || raw.customerLegalName || '').trim(),
      status: String(raw.status || '').trim(),
      grand_total: this.toNumberSafe(raw.grand_total ?? raw.grandTotal),
      updated_at: String(raw.updated_at || raw.updatedAt || '').trim(),
      service_start_date: String(raw.service_start_date || raw.serviceStartDate || raw.effective_date || '').trim(),
      service_end_date: String(raw.service_end_date || raw.serviceEndDate || '').trim(),
      end_date: String(raw.end_date || raw.endDate || '').trim(),
      customer_sign_date: String(raw.customer_sign_date || raw.customerSignDate || '').trim(),
      agreement_date: String(raw.agreement_date || raw.agreementDate || '').trim(),
      location_name: String(raw.location_name || raw.locationName || '').trim()
    };
  },
  normalizeInvoice(raw = {}) {
    return {
      invoice_id: String(raw.invoice_id || raw.invoiceId || raw.id || '').trim(),
      invoice_number: String(raw.invoice_number || raw.invoiceNumber || '').trim(),
      agreement_id: String(raw.agreement_id || raw.agreementId || '').trim(),
      client_id: String(raw.client_id || raw.clientId || '').trim(),
      customer_name: String(raw.customer_name || raw.customerName || '').trim(),
      customer_legal_name: String(raw.customer_legal_name || raw.customerLegalName || '').trim(),
      status: String(raw.status || raw.payment_state || '').trim(),
      grand_total: this.toNumberSafe(raw.grand_total ?? raw.grandTotal),
      amount_paid: this.toNumberSafe(raw.amount_paid ?? raw.amountPaid),
      pending_amount: this.toNumberSafe(raw.pending_amount ?? raw.pendingAmount),
      updated_at: String(raw.updated_at || raw.updatedAt || '').trim(),
      issued_date: String(raw.issued_date || raw.invoice_date || '').trim(),
      location_name: String(raw.location_name || raw.locationName || '').trim()
    };
  },
  normalizeReceipt(raw = {}) {
    return {
      receipt_id: String(raw.receipt_id || raw.receiptId || raw.id || '').trim(),
      receipt_number: String(raw.receipt_number || raw.receiptNumber || '').trim(),
      invoice_id: String(raw.invoice_id || raw.invoiceId || '').trim(),
      client_id: String(raw.client_id || raw.clientId || '').trim(),
      customer_name: String(raw.customer_name || raw.customerName || '').trim(),
      customer_legal_name: String(raw.customer_legal_name || raw.customerLegalName || '').trim(),
      payment_state: String(raw.payment_state || raw.status || '').trim(),
      received_amount: this.toNumberSafe(raw.received_amount ?? raw.receivedAmount ?? raw.amount_paid),
      pending_amount: this.toNumberSafe(raw.pending_amount ?? raw.pendingAmount),
      updated_at: String(raw.updated_at || raw.updatedAt || '').trim(),
      receipt_date: String(raw.receipt_date || raw.received_date || '').trim()
    };
  },
  matchesClient_(record = {}, client = {}) {
    const clientId = String(client.client_id || '').trim();
    if (clientId && String(record.client_id || '').trim() === clientId) return true;
    const recordLegal = this.normalizeCompanyKey(record.customer_legal_name);
    const recordCompany = this.normalizeCompanyKey(record.customer_name);
    const clientLegal = this.normalizeCompanyKey(client.customer_legal_name);
    const clientCompany = this.normalizeCompanyKey(client.customer_name);
    return Boolean((recordLegal && (recordLegal === clientLegal || recordLegal === clientCompany)) || (recordCompany && (recordCompany === clientLegal || recordCompany === clientCompany)));
  },
  listClientRelatedAgreements_(clientId) {
    const client = this.state.rows.find(row => row.client_id === clientId);
    if (!client) return [];
    return this.state.agreements.filter(item => this.matchesClient_(item, client));
  },
  listClientRelatedInvoices_(clientId) {
    const client = this.state.rows.find(row => row.client_id === clientId);
    if (!client) return [];
    return this.state.invoices.filter(item => this.matchesClient_(item, client));
  },
  listClientRelatedReceipts_(clientId) {
    const client = this.state.rows.find(row => row.client_id === clientId);
    if (!client) return [];
    return this.state.receipts.filter(item => this.matchesClient_(item, client));
  },
  isSignedAgreement(agreement = {}) {
    return this.normalizeText(agreement.status).includes('signed');
  },
  isActiveAgreement(agreement = {}) {
    const token = this.normalizeText(agreement.status);
    return token.includes('active') || token.includes('signed');
  },
  findOrCreateClientFromSignedAgreement_(agreement = {}) {
    if (!this.isSignedAgreement(agreement)) return null;
    const key = this.normalizeCompanyKey(agreement.customer_legal_name || agreement.customer_name);
    let existing = this.state.rows.find(client => this.normalizeCompanyKey(client.customer_legal_name) === key);
    if (!existing) {
      existing = this.state.rows.find(client => this.normalizeCompanyKey(client.customer_name) === key);
    }
    if (existing) {
      if (!existing.customer_legal_name && agreement.customer_legal_name) existing.customer_legal_name = agreement.customer_legal_name;
      existing.updated_at = agreement.updated_at || existing.updated_at;
      return existing;
    }
    const fallbackName = String(agreement.customer_name || agreement.customer_legal_name || '').trim();
    const created = this.normalizeClient({
      client_id: `virtual-${key || Date.now()}`,
      customer_name: fallbackName,
      customer_legal_name: String(agreement.customer_legal_name || '').trim(),
      normalized_company_key: key,
      status: 'Active',
      source: 'signed_agreement',
      updated_at: agreement.updated_at,
      created_at: agreement.customer_sign_date || agreement.agreement_date
    });
    this.state.rows.push(created);
    return created;
  },
  maxDate(...values) {
    const valid = values
      .map(value => String(value || '').trim())
      .filter(Boolean)
      .map(value => new Date(value))
      .filter(date => !Number.isNaN(date.getTime()));
    if (!valid.length) return '';
    return new Date(Math.max(...valid.map(date => date.getTime()))).toISOString();
  },
  computeClientAnalytics_(client) {
    const agreements = this.listClientRelatedAgreements_(client.client_id);
    const invoices = this.listClientRelatedInvoices_(client.client_id);
    const receipts = this.listClientRelatedReceipts_(client.client_id);
    const signedAgreements = agreements.filter(item => this.isSignedAgreement(item));
    const activeAgreements = agreements.filter(item => this.isActiveAgreement(item));

    const locationSet = new Set();
    const activeLocationSet = new Set();
    signedAgreements.forEach(item => {
      const key = this.normalizeCompanyKey(item.location_name);
      if (key) locationSet.add(key);
    });
    invoices.forEach(item => {
      const key = this.normalizeCompanyKey(item.location_name);
      if (key) locationSet.add(key);
    });
    activeAgreements.forEach(item => {
      const key = this.normalizeCompanyKey(item.location_name);
      if (key) activeLocationSet.add(key);
    });

    const totalAgreementValue = signedAgreements.reduce((sum, item) => sum + this.toNumberSafe(item.grand_total), 0);
    const totalInvoicedValue = invoices.reduce((sum, item) => sum + this.toNumberSafe(item.grand_total), 0);
    const totalReceiptsValue = receipts.reduce((sum, item) => sum + this.toNumberSafe(item.received_amount), 0);
    const paidByInvoices = invoices.reduce((sum, item) => sum + this.toNumberSafe(item.amount_paid), 0);
    const totalPaidAmount = Math.max(paidByInvoices, totalReceiptsValue);
    const totalDueAmount = invoices.reduce((sum, item) => sum + this.toNumberSafe(item.pending_amount), 0);

    const latestAgreementDate = this.maxDate(...agreements.map(item => item.updated_at || item.customer_sign_date || item.agreement_date));
    const latestInvoiceDate = this.maxDate(...invoices.map(item => item.updated_at || item.issued_date));
    const latestReceiptDate = this.maxDate(...receipts.map(item => item.updated_at || item.receipt_date));

    const now = Date.now();
    const renewalCandidates = activeAgreements
      .map(item => item.end_date || item.service_end_date)
      .filter(Boolean)
      .map(value => new Date(value))
      .filter(date => !Number.isNaN(date.getTime()) && date.getTime() > now)
      .sort((a, b) => a.getTime() - b.getTime());

    const paymentBucket = invoices.reduce(
      (bucket, invoice) => {
        const due = this.toNumberSafe(invoice.pending_amount);
        const paid = this.toNumberSafe(invoice.amount_paid);
        if (due <= 0 && paid > 0) bucket.paid += 1;
        else if (paid > 0 && due > 0) bucket.partial += 1;
        else bucket.unpaid += 1;
        return bucket;
      },
      { unpaid: 0, partial: 0, paid: 0 }
    );

    return {
      total_locations: locationSet.size,
      active_locations: activeLocationSet.size,
      total_agreements: agreements.length,
      signed_agreements: signedAgreements.length,
      total_agreement_value: totalAgreementValue,
      total_invoiced_value: totalInvoicedValue,
      total_paid_amount: totalPaidAmount,
      total_due_amount: totalDueAmount,
      total_receipts_value: totalReceiptsValue,
      unpaid_invoices_count: paymentBucket.unpaid,
      partially_paid_invoices_count: paymentBucket.partial,
      paid_invoices_count: paymentBucket.paid,
      latest_agreement_date: latestAgreementDate,
      latest_invoice_date: latestInvoiceDate,
      latest_receipt_date: latestReceiptDate,
      latest_activity_date: this.maxDate(latestAgreementDate, latestInvoiceDate, latestReceiptDate),
      next_renewal_date: renewalCandidates.length ? renewalCandidates[0].toISOString() : ''
    };
  },
  buildTimeline_(clientId) {
    const events = [];
    this.listClientRelatedAgreements_(clientId).forEach(item => {
      events.push({ type: 'signed_agreement', date: item.updated_at || item.customer_sign_date || item.agreement_date, label: `Agreement ${item.agreement_number || item.agreement_id || '—'} ${item.status || ''}`.trim() });
    });
    this.listClientRelatedInvoices_(clientId).forEach(item => {
      events.push({ type: 'issued_invoice', date: item.updated_at || item.issued_date, label: `Invoice ${item.invoice_number || item.invoice_id || '—'} ${item.status || ''}`.trim() });
      if (this.toNumberSafe(item.amount_paid) > 0) {
        events.push({ type: 'payment_update', date: item.updated_at || item.issued_date, label: `Payment updated (${U.fmtNumber(item.amount_paid)}) for ${item.invoice_number || item.invoice_id || 'invoice'}` });
      }
    });
    this.listClientRelatedReceipts_(clientId).forEach(item => {
      events.push({ type: 'receipt_created', date: item.updated_at || item.receipt_date, label: `Receipt ${item.receipt_number || item.receipt_id || '—'} ${item.payment_state || ''}`.trim() });
    });
    return events
      .filter(item => item.date)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20);
  },
  applyFilters() {
    const terms = String(this.state.search || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
    const status = String(this.state.status || 'All');
    const sorted = this.state.rows
      .filter(client => {
        if (status !== 'All' && String(client.status || '').trim() !== status) return false;
        if (!terms.length) return true;
        const haystack = [client.customer_name, client.customer_legal_name, client.primary_contact_name, client.primary_contact_email]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return terms.every(term => haystack.includes(term));
      })
      .sort((a, b) => {
        const aAnalytics = a.analytics || {};
        const bAnalytics = b.analytics || {};
        if (this.state.sort === 'paid_desc') return this.toNumberSafe(bAnalytics.total_paid_amount) - this.toNumberSafe(aAnalytics.total_paid_amount);
        if (this.state.sort === 'agreement_desc') return this.toNumberSafe(bAnalytics.total_agreement_value) - this.toNumberSafe(aAnalytics.total_agreement_value);
        return this.toNumberSafe(bAnalytics.total_due_amount) - this.toNumberSafe(aAnalytics.total_due_amount);
      });
    this.state.filteredRows = sorted;
  },
  badgeClassFromInvoice_(invoice = {}) {
    const due = this.toNumberSafe(invoice.pending_amount);
    const paid = this.toNumberSafe(invoice.amount_paid);
    if (due <= 0 && paid > 0) return 'online';
    if (paid > 0 && due > 0) return 'offline';
    return '';
  },
  renderList() {
    if (!E.clientsTbody) return;
    if (this.state.loadError) {
      E.clientsTbody.innerHTML = `<tr><td colspan="9" class="muted" style="text-align:center;color:#ffb4b4;">${U.escapeHtml(this.state.loadError)}</td></tr>`;
      return;
    }
    if (!this.state.filteredRows.length) {
      E.clientsTbody.innerHTML = '<tr><td colspan="9" class="muted" style="text-align:center;">No clients found.</td></tr>';
      return;
    }
    E.clientsTbody.innerHTML = this.state.filteredRows
      .map(client => {
        const analytics = client.analytics || {};
        const activeClass = this.state.selectedClientId === client.client_id ? ' style="background:rgba(59,130,246,.08);"' : '';
        return `<tr data-client-row="${U.escapeAttr(client.client_id)}"${activeClass}>
          <td>${U.escapeHtml(client.customer_name || '—')}</td>
          <td>${U.escapeHtml(client.customer_legal_name || '—')}</td>
          <td>${U.escapeHtml(String(analytics.total_locations ?? 0))}</td>
          <td>${U.escapeHtml(String(analytics.total_agreements ?? 0))}</td>
          <td>${U.escapeHtml(U.fmtNumber(analytics.total_invoiced_value || 0))}</td>
          <td>${U.escapeHtml(U.fmtNumber(analytics.total_paid_amount || 0))}</td>
          <td>${U.escapeHtml(U.fmtNumber(analytics.total_due_amount || 0))}</td>
          <td><span class="chip">${U.escapeHtml(client.status || 'Unknown')}</span></td>
          <td>${U.escapeHtml(U.fmtDate(analytics.latest_activity_date) || '—')}</td>
        </tr>`;
      })
      .join('');
  },
  renderDetail() {
    const client = this.state.rows.find(row => row.client_id === this.state.selectedClientId);
    if (!client) {
      if (E.clientsDetailEmpty) E.clientsDetailEmpty.style.display = '';
      if (E.clientsDetailPanel) E.clientsDetailPanel.style.display = 'none';
      return;
    }
    if (E.clientsDetailEmpty) E.clientsDetailEmpty.style.display = 'none';
    if (E.clientsDetailPanel) E.clientsDetailPanel.style.display = '';
    const analytics = client.analytics || {};
    if (E.clientDetailName) E.clientDetailName.textContent = client.customer_name || '—';
    if (E.clientDetailMeta) E.clientDetailMeta.textContent = `${client.customer_legal_name || 'No legal name'} • ${client.primary_contact_name || 'No contact'} • ${client.primary_contact_email || 'No email'}`;
    if (E.clientDetailStatus) E.clientDetailStatus.textContent = client.status || 'Unknown';
    if (E.clientDetailOverview) {
      E.clientDetailOverview.textContent = `Phone: ${client.phone || '—'} | Country: ${client.country || '—'} | Address: ${client.address || '—'} | Billing: ${client.billing_address || '—'} | Tax: ${client.tax_number || '—'} | Industry: ${client.industry || '—'} | Source: ${client.source || '—'} | Notes: ${client.notes || '—'}`;
    }

    const analyticsCards = [
      ['Locations', `${analytics.total_locations || 0} (${analytics.active_locations || 0} active)`],
      ['Agreements', `${analytics.total_agreements || 0} (${analytics.signed_agreements || 0} signed)`],
      ['Agreement Value', U.fmtNumber(analytics.total_agreement_value || 0)],
      ['Total Invoiced', U.fmtNumber(analytics.total_invoiced_value || 0)],
      ['Total Paid', U.fmtNumber(analytics.total_paid_amount || 0)],
      ['Total Due', U.fmtNumber(analytics.total_due_amount || 0)],
      ['Receipts', U.fmtNumber(analytics.total_receipts_value || 0)],
      ['Next Renewal', U.fmtDate(analytics.next_renewal_date) || '—']
    ];
    if (E.clientAnalyticsCards) {
      E.clientAnalyticsCards.innerHTML = analyticsCards
        .map(([label, value]) => `<div class="card kpi"><div class="label">${U.escapeHtml(label)}</div><div class="value">${U.escapeHtml(String(value))}</div></div>`)
        .join('');
    }

    const agreements = this.listClientRelatedAgreements_(client.client_id);
    const invoices = this.listClientRelatedInvoices_(client.client_id);
    const receipts = this.listClientRelatedReceipts_(client.client_id);
    if (E.clientRelatedAgreementsTbody) {
      E.clientRelatedAgreementsTbody.innerHTML = agreements.length
        ? agreements
            .map(item => `<tr>
              <td>${U.escapeHtml(item.agreement_number || item.agreement_id || '—')}</td>
              <td>${U.escapeHtml(item.status || '—')}</td>
              <td>${U.escapeHtml(U.fmtNumber(item.grand_total || 0))}</td>
              <td>${U.escapeHtml(U.fmtDate(item.service_start_date) || '—')}</td>
              <td>${U.escapeHtml(U.fmtDate(item.end_date || item.service_end_date) || '—')}</td>
              <td>${item.agreement_id ? `<button class="btn ghost sm" type="button" data-agreement-view="${U.escapeAttr(item.agreement_id)}">Open</button>` : '—'}</td>
            </tr>`)
            .join('')
        : '<tr><td colspan="6" class="muted" style="text-align:center;">No agreements.</td></tr>';
    }
    if (E.clientRelatedInvoicesTbody) {
      E.clientRelatedInvoicesTbody.innerHTML = invoices.length
        ? invoices
            .map(item => `<tr>
              <td>${U.escapeHtml(item.invoice_number || item.invoice_id || '—')}</td>
              <td><span class="chip ${this.badgeClassFromInvoice_(item)}">${U.escapeHtml(item.status || '—')}</span></td>
              <td>${U.escapeHtml(U.fmtNumber(item.grand_total || 0))}</td>
              <td>${U.escapeHtml(U.fmtNumber(item.amount_paid || 0))}</td>
              <td>${U.escapeHtml(U.fmtNumber(item.pending_amount || 0))}</td>
              <td>${item.invoice_id ? `<button class="btn ghost sm" type="button" data-invoice-view="${U.escapeAttr(item.invoice_id)}">Open</button>` : '—'}</td>
            </tr>`)
            .join('')
        : '<tr><td colspan="6" class="muted" style="text-align:center;">No invoices.</td></tr>';
    }
    if (E.clientRelatedReceiptsTbody) {
      E.clientRelatedReceiptsTbody.innerHTML = receipts.length
        ? receipts
            .map(item => `<tr>
              <td>${U.escapeHtml(item.receipt_number || item.receipt_id || '—')}</td>
              <td>${U.escapeHtml(item.payment_state || '—')}</td>
              <td>${U.escapeHtml(U.fmtNumber(item.received_amount || 0))}</td>
              <td>${U.escapeHtml(U.fmtNumber(item.pending_amount || 0))}</td>
              <td>${item.receipt_id ? `<button class="btn ghost sm" type="button" data-receipt-view="${U.escapeAttr(item.receipt_id)}">Open</button>` : '—'}</td>
            </tr>`)
            .join('')
        : '<tr><td colspan="5" class="muted" style="text-align:center;">No receipts.</td></tr>';
    }

    if (E.clientTimeline) {
      const timeline = this.buildTimeline_(client.client_id);
      E.clientTimeline.innerHTML = timeline.length
        ? timeline.map(item => `<li><strong>${U.escapeHtml(U.fmtDate(item.date))}</strong> — ${U.escapeHtml(item.label)}</li>`).join('')
        : '<li class="muted">No timeline activity yet.</li>';
    }
  },
  render() {
    this.applyFilters();
    this.renderList();
    this.renderDetail();
    if (E.clientsState) {
      E.clientsState.textContent = this.state.loadError || `Loaded ${this.state.filteredRows.length} of ${this.state.rows.length} clients.`;
    }
    if (E.clientsStatusFilter) {
      const statuses = ['All', ...new Set(this.state.rows.map(item => item.status).filter(Boolean))];
      E.clientsStatusFilter.innerHTML = statuses.map(status => `<option>${U.escapeHtml(status)}</option>`).join('');
      E.clientsStatusFilter.value = statuses.includes(this.state.status) ? this.state.status : 'All';
    }
  },
  async loadAndRefresh(options = {}) {
    if (this.state.loading && !options.force) return;
    if (!Permissions.canViewClients()) return;
    this.state.loading = true;
    this.state.loadError = '';
    if (E.clientsState) E.clientsState.textContent = 'Loading client intelligence…';
    try {
      const [clientsRes, agreementsRes, invoicesRes, receiptsRes] = await Promise.all([
        Api.listClients(),
        Api.listAgreements(),
        Api.listInvoices(),
        Api.listReceipts()
      ]);
      this.state.rows = this.extractRows(clientsRes).map(item => this.normalizeClient(item));
      this.state.agreements = this.extractRows(agreementsRes).map(item => this.normalizeAgreement(item));
      this.state.invoices = this.extractRows(invoicesRes).map(item => this.normalizeInvoice(item));
      this.state.receipts = this.extractRows(receiptsRes).map(item => this.normalizeReceipt(item));

      this.state.agreements.forEach(agreement => {
        this.findOrCreateClientFromSignedAgreement_(agreement);
      });
      this.state.rows.forEach(client => {
        client.analytics = this.computeClientAnalytics_(client);
      });
      if (!this.state.selectedClientId && this.state.rows[0]?.client_id) {
        this.state.selectedClientId = this.state.rows[0].client_id;
      }
      this.render();
    } catch (error) {
      this.state.rows = [];
      this.state.loadError = error?.message || 'Failed to load clients.';
      this.render();
    } finally {
      this.state.loading = false;
    }
  },
  collectNewClientFormData() {
    if (!E.newClientForm) return null;
    const fd = new FormData(E.newClientForm);
    const payload = {};
    this.clientFields.forEach(field => {
      const value = String(fd.get(field) || '').trim();
      if (value) payload[field] = value;
    });
    payload.customer_name = String(fd.get('customer_name') || '').trim();
    payload.customer_legal_name = String(fd.get('customer_legal_name') || '').trim();
    payload.primary_contact_name = String(fd.get('primary_contact_name') || '').trim();
    payload.primary_contact_email = String(fd.get('primary_contact_email') || '').trim();
    payload.normalized_company_key = this.normalizeCompanyKey(payload.customer_legal_name || payload.customer_name);
    payload.source = String(payload.source || 'manual').trim();
    return payload;
  },
  openNewClientModal() {
    if (!E.newClientModal) return;
    E.newClientModal.classList.add('open');
    E.newClientModal.setAttribute('aria-hidden', 'false');
  },
  closeNewClientModal() {
    if (!E.newClientModal) return;
    E.newClientModal.classList.remove('open');
    E.newClientModal.setAttribute('aria-hidden', 'true');
    if (E.newClientForm) E.newClientForm.reset();
  },
  async runClientAction(action) {
    const clientId = String(this.state.selectedClientId || '').trim();
    if (!clientId) {
      UI.toast('Select a client first.');
      return;
    }
    const client = this.state.rows.find(item => item.client_id === clientId);
    if (!client) return;
    try {
      if (action === 'proposal') {
        await Api.createProposalFromClient(clientId, { prefill: client });
        UI.toast('Proposal draft created from client.');
      } else if (action === 'agreement') {
        await Api.createAgreementFromClient(clientId, { prefill: client });
        UI.toast('Agreement draft created from client.');
      } else if (action === 'invoice') {
        const agreements = this.listClientRelatedAgreements_(clientId);
        const agreementId = agreements.length
          ? window.prompt('Optional Agreement ID for invoice prefill (leave blank for blank invoice):', agreements[0].agreement_id || '')
          : '';
        await Api.createInvoiceFromClient(clientId, { agreement_id: String(agreementId || '').trim(), prefill: client });
        UI.toast('Invoice created from client.');
      } else if (action === 'clone') {
        const agreements = this.listClientRelatedAgreements_(clientId);
        if (!agreements.length) {
          UI.toast('No previous agreements found for this client.');
          return;
        }
        const selected = window.prompt('Enter agreement ID to duplicate:', agreements[0].agreement_id || '');
        if (!selected) return;
        await Api.createFromPreviousAgreement(clientId, selected, 'agreement');
        UI.toast('Created new draft from previous agreement.');
      }
    } catch (error) {
      UI.toast(error?.message || 'Client quick action failed.');
    }
  },
  wire() {
    if (E.clientsRefreshBtn) E.clientsRefreshBtn.addEventListener('click', () => this.loadAndRefresh({ force: true }));
    if (E.clientsSearchInput) {
      E.clientsSearchInput.addEventListener('input', () => {
        this.state.search = E.clientsSearchInput.value;
        this.render();
      });
    }
    if (E.clientsStatusFilter) {
      E.clientsStatusFilter.addEventListener('change', () => {
        this.state.status = E.clientsStatusFilter.value;
        this.render();
      });
    }
    if (E.clientsSortSelect) {
      E.clientsSortSelect.addEventListener('change', () => {
        this.state.sort = E.clientsSortSelect.value;
        this.render();
      });
    }
    if (E.clientsTbody) {
      E.clientsTbody.addEventListener('click', event => {
        const row = event.target?.closest?.('[data-client-row]');
        if (row) {
          this.state.selectedClientId = String(row.getAttribute('data-client-row') || '').trim();
          this.render();
        }
      });
    }
    if (E.clientsCreateBtn) E.clientsCreateBtn.addEventListener('click', () => this.openNewClientModal());
    if (E.newClientCloseBtn) E.newClientCloseBtn.addEventListener('click', () => this.closeNewClientModal());
    if (E.newClientCancelBtn) E.newClientCancelBtn.addEventListener('click', () => this.closeNewClientModal());
    if (E.newClientModal) {
      E.newClientModal.addEventListener('click', event => {
        if (event.target === E.newClientModal) this.closeNewClientModal();
      });
    }
    if (E.newClientForm) {
      E.newClientForm.addEventListener('submit', async event => {
        event.preventDefault();
        const payload = this.collectNewClientFormData();
        if (!payload?.customer_name) {
          UI.toast('Company Name is required.');
          return;
        }
        try {
          await Api.createClientFromPayload(payload);
          this.closeNewClientModal();
          await this.loadAndRefresh({ force: true });
          UI.toast('Client created successfully.');
        } catch (error) {
          UI.toast(error?.message || 'Failed to create client.');
        }
      });
    }
    if (E.clientActionProposalBtn) E.clientActionProposalBtn.addEventListener('click', () => this.runClientAction('proposal'));
    if (E.clientActionAgreementBtn) E.clientActionAgreementBtn.addEventListener('click', () => this.runClientAction('agreement'));
    if (E.clientActionInvoiceBtn) E.clientActionInvoiceBtn.addEventListener('click', () => this.runClientAction('invoice'));
    if (E.clientActionCloneBtn) E.clientActionCloneBtn.addEventListener('click', () => this.runClientAction('clone'));
  }
};

window.Clients = Clients;
