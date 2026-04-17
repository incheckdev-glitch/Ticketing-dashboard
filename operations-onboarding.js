const OperationsOnboarding = {
  state: {
    rows: [],
    filteredRows: [],
    loading: false,
    loadError: '',
    loaded: false,
    initialized: false,
    search: '',
    onboardingStatus: 'All',
    technicalRequestStatus: 'All',
    assignedCsm: 'All',
    pendingAgreementId: '',
    postSubmitHook: null
  },
  pick(...values) {
    for (const value of values) {
      if (value !== undefined && value !== null && String(value).trim() !== '') return value;
    }
    return '';
  },
  normalizeRow(raw = {}) {
    const source = raw && typeof raw === 'object' ? raw : {};
    return {
      onboarding_id: String(this.pick(source.onboarding_id, source.onboardingId, source.id)).trim(),
      agreement_id: String(this.pick(source.agreement_id, source.agreementId)).trim(),
      agreement_number: String(this.pick(source.agreement_number, source.agreementNumber)).trim(),
      client_name: String(this.pick(source.client_name, source.clientName, source.customer_name, source.customerName)).trim(),
      signed_date: String(this.pick(source.signed_date, source.signedDate, source.customer_sign_date, source.customerSignDate)).trim(),
      onboarding_status: String(this.pick(source.onboarding_status, source.onboardingStatus)).trim(),
      technical_request_type: String(this.pick(source.technical_request_type, source.technicalRequestType, source.request_type, source.requestType)).trim(),
      technical_request_status: String(this.pick(source.technical_request_status, source.technicalRequestStatus)).trim(),
      csm_assigned_to: String(this.pick(source.csm_assigned_to, source.csmAssignedTo)).trim(),
      priority: String(this.pick(source.priority)).trim(),
      service_start_date: String(this.pick(source.service_start_date, source.serviceStartDate)).trim(),
      service_end_date: String(this.pick(source.service_end_date, source.serviceEndDate)).trim(),
      billing_frequency: String(this.pick(source.billing_frequency, source.billingFrequency)).trim(),
      payment_term: String(this.pick(source.payment_term, source.paymentTerm)).trim(),
      updated_at: String(this.pick(source.updated_at, source.updatedAt)).trim(),
      request_details: String(this.pick(source.request_details, source.requestDetails)).trim()
    };
  },
  canWrite() {
    return !Permissions.isViewer() && Permissions.canManageOperationsOnboarding();
  },
  extractRows(response) {
    const candidates = [response, response?.items, response?.rows, response?.data, response?.result, response?.payload, response?.data?.rows];
    for (const candidate of candidates) if (Array.isArray(candidate)) return candidate;
    return [];
  },
  applyFilters() {
    const search = String(this.state.search || '').trim().toLowerCase();
    const terms = search ? search.split(/\s+/).filter(Boolean) : [];
    this.state.filteredRows = this.state.rows.filter(row => {
      if (this.state.onboardingStatus !== 'All' && row.onboarding_status !== this.state.onboardingStatus) return false;
      if (this.state.technicalRequestStatus !== 'All' && row.technical_request_status !== this.state.technicalRequestStatus) return false;
      if (this.state.assignedCsm !== 'All' && row.csm_assigned_to !== this.state.assignedCsm) return false;
      if (!terms.length) return true;
      const hay = [
        row.onboarding_id,
        row.agreement_id,
        row.agreement_number,
        row.client_name,
        row.onboarding_status,
        row.technical_request_status,
        row.csm_assigned_to
      ]
        .join(' ')
        .toLowerCase();
      return terms.every(term => hay.includes(term));
    });
  },
  renderFilters() {
    const buildOptions = values => ['All', ...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const fill = (el, options, selected) => {
      if (!el) return;
      el.innerHTML = options.map(v => `<option>${U.escapeHtml(v)}</option>`).join('');
      el.value = options.includes(selected) ? selected : 'All';
    };
    fill(E.operationsOnboardingStatusFilter, buildOptions(this.state.rows.map(r => r.onboarding_status)), this.state.onboardingStatus);
    fill(E.operationsOnboardingTechStatusFilter, buildOptions(this.state.rows.map(r => r.technical_request_status)), this.state.technicalRequestStatus);
    fill(E.operationsOnboardingCsmFilter, buildOptions(this.state.rows.map(r => r.csm_assigned_to)), this.state.assignedCsm);
    if (E.operationsOnboardingSearchInput) E.operationsOnboardingSearchInput.value = this.state.search;
  },
  renderSummary() {
    if (!E.operationsOnboardingSummary) return;
    const rows = this.state.filteredRows;
    const count = fn => rows.filter(fn).length;
    E.operationsOnboardingSummary.innerHTML = [
      ['Total', rows.length],
      ['Pending Technical', count(row => String(row.technical_request_status || '').toLowerCase().includes('pending'))],
      ['In Progress', count(row => String(row.onboarding_status || '').toLowerCase().includes('progress'))],
      ['Completed', count(row => String(row.onboarding_status || '').toLowerCase().includes('complete'))]
    ]
      .map(([label, value]) => `<div class="card kpi"><div class="label">${U.escapeHtml(label)}</div><div class="value">${U.escapeHtml(String(value))}</div></div>`)
      .join('');
  },
  render() {
    if (!E.operationsOnboardingTbody || !E.operationsOnboardingState) return;
    if (this.state.loading) {
      E.operationsOnboardingState.textContent = 'Loading operations onboarding…';
      E.operationsOnboardingTbody.innerHTML = '<tr><td colspan="16" class="muted" style="text-align:center;">Loading operations onboarding…</td></tr>';
      return;
    }
    if (this.state.loadError) {
      E.operationsOnboardingState.textContent = this.state.loadError;
      E.operationsOnboardingTbody.innerHTML = `<tr><td colspan="16" class="muted" style="text-align:center;color:#ffb4b4;">${U.escapeHtml(this.state.loadError)}</td></tr>`;
      return;
    }
    const rows = this.state.filteredRows;
    this.renderSummary();
    E.operationsOnboardingState.textContent = `${rows.length} onboarding row${rows.length === 1 ? '' : 's'}`;
    if (!rows.length) {
      E.operationsOnboardingTbody.innerHTML = '<tr><td colspan="16" class="muted" style="text-align:center;">No onboarding rows found.</td></tr>';
      return;
    }
    const text = value => U.escapeHtml(String(value || '—'));
    const canWrite = this.canWrite();
    E.operationsOnboardingTbody.innerHTML = rows
      .map(row => {
        const agreementId = U.escapeAttr(row.agreement_id);
        const onboardingId = U.escapeAttr(row.onboarding_id);
        return `<tr>
          <td>${text(row.onboarding_id)}</td><td>${text(row.agreement_id)}</td><td>${text(row.agreement_number)}</td><td>${text(row.client_name)}</td><td>${text(row.signed_date)}</td><td>${text(row.onboarding_status)}</td>
          <td>${text(row.technical_request_type)}</td><td>${text(row.technical_request_status)}</td><td>${text(row.csm_assigned_to)}</td><td>${text(row.priority)}</td><td>${text(row.service_start_date)}</td><td>${text(row.service_end_date)}</td><td>${text(row.billing_frequency)}</td><td>${text(row.payment_term)}</td><td>${text(row.updated_at)}</td>
          <td><div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button class="btn ghost sm" type="button" data-op-open-agreement="${agreementId}">Open Agreement</button>
            <button class="btn ghost sm" type="button" data-op-open-details="${onboardingId}">Open Onboarding Details</button>
            ${canWrite ? `<button class="btn ghost sm" type="button" data-op-request-tech="${agreementId}">Request Technical Admin</button>
            <button class="btn ghost sm" type="button" data-op-assign-csm="${agreementId}">Assign CSM</button>
            <button class="btn ghost sm" type="button" data-op-mark-progress="${agreementId}">Mark In Progress</button>
            <button class="btn ghost sm" type="button" data-op-mark-completed="${agreementId}">Mark Completed</button>` : ''}
          </div></td>
        </tr>`;
      })
      .join('');
  },
  async loadAndRefresh({ force = false } = {}) {
    if (this.state.loading && !force) return;
    this.state.loading = true;
    this.state.loadError = '';
    this.render();
    try {
      const response = await Api.listOperationsOnboarding({
        onboarding_status: this.state.onboardingStatus !== 'All' ? this.state.onboardingStatus : '',
        technical_request_status: this.state.technicalRequestStatus !== 'All' ? this.state.technicalRequestStatus : '',
        csm_assigned_to: this.state.assignedCsm !== 'All' ? this.state.assignedCsm : '',
        search: this.state.search
      });
      this.state.rows = this.extractRows(response).map(row => this.normalizeRow(row));
      this.state.loaded = true;
    } catch (error) {
      this.state.rows = [];
      this.state.loadError = String(error?.message || '').trim() || 'Unable to load operations onboarding.';
    } finally {
      this.state.loading = false;
      this.applyFilters();
      this.renderFilters();
      this.render();
    }
  },
  upsertByAgreement(agreementId, patch = {}) {
    const id = String(agreementId || '').trim();
    if (!id) return;
    const idx = this.state.rows.findIndex(row => String(row.agreement_id || '') === id);
    if (idx === -1) return;
    this.state.rows[idx] = this.normalizeRow({ ...this.state.rows[idx], ...patch, agreement_id: id });
    this.applyFilters();
    this.render();
  },
  async openOnboardingDetails(onboardingId = '', agreementId = '') {
    try {
      const response = await Api.getOperationsOnboarding(onboardingId ? { onboarding_id: onboardingId } : { agreement_id: agreementId });
      const detail = this.normalizeRow(response?.onboarding || response?.item || response?.data || response);
      if (!E.operationsOnboardingDetailsContent || !E.operationsOnboardingDetailsModal) return;
      E.operationsOnboardingDetailsContent.innerHTML = `
        <div class="grid" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;">
          <div><span class="muted">Onboarding ID:</span> ${U.escapeHtml(detail.onboarding_id || '—')}</div>
          <div><span class="muted">Agreement ID:</span> ${U.escapeHtml(detail.agreement_id || '—')}</div>
          <div><span class="muted">Status:</span> ${U.escapeHtml(detail.onboarding_status || '—')}</div>
          <div><span class="muted">Technical Status:</span> ${U.escapeHtml(detail.technical_request_status || '—')}</div>
          <div><span class="muted">Request Type:</span> ${U.escapeHtml(detail.technical_request_type || '—')}</div>
          <div><span class="muted">Assigned CSM:</span> ${U.escapeHtml(detail.csm_assigned_to || '—')}</div>
          <div style="grid-column:1/-1;"><span class="muted">Request Details:</span> ${U.escapeHtml(detail.request_details || '—')}</div>
        </div>`;
      E.operationsOnboardingDetailsModal.classList.add('open');
      E.operationsOnboardingDetailsModal.setAttribute('aria-hidden', 'false');
    } catch (error) {
      UI.toast('Unable to load onboarding details: ' + (error?.message || 'Unknown error'));
    }
  },
  closeModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.remove('open');
    modalEl.setAttribute('aria-hidden', 'true');
  },
  openTechnicalRequestModal(agreementId, onDone) {
    if (!this.canWrite()) return UI.toast('Insufficient permissions.');
    this.state.pendingAgreementId = String(agreementId || '').trim();
    this.state.postSubmitHook = typeof onDone === 'function' ? onDone : null;
    if (E.operationsTechnicalRequestForm) E.operationsTechnicalRequestForm.reset();
    if (E.operationsTechnicalRequestPriority) E.operationsTechnicalRequestPriority.value = 'normal';
    if (E.operationsTechnicalRequestModal) {
      E.operationsTechnicalRequestModal.classList.add('open');
      E.operationsTechnicalRequestModal.setAttribute('aria-hidden', 'false');
    }
  },
  openAssignCsmModal(agreementId, onDone) {
    if (!this.canWrite()) return UI.toast('Insufficient permissions.');
    this.state.pendingAgreementId = String(agreementId || '').trim();
    this.state.postSubmitHook = typeof onDone === 'function' ? onDone : null;
    if (E.operationsAssignCsmForm) E.operationsAssignCsmForm.reset();
    if (E.operationsAssignCsmModal) {
      E.operationsAssignCsmModal.classList.add('open');
      E.operationsAssignCsmModal.setAttribute('aria-hidden', 'false');
    }
  },
  openUpdateStatusModal(agreementId, onDone) {
    if (!this.canWrite()) return UI.toast('Insufficient permissions.');
    this.state.pendingAgreementId = String(agreementId || '').trim();
    this.state.postSubmitHook = typeof onDone === 'function' ? onDone : null;
    if (E.operationsUpdateStatusForm) E.operationsUpdateStatusForm.reset();
    if (E.operationsUpdateStatusModal) {
      E.operationsUpdateStatusModal.classList.add('open');
      E.operationsUpdateStatusModal.setAttribute('aria-hidden', 'false');
    }
  },
  async submitTechnicalRequest() {
    const agreementId = this.state.pendingAgreementId;
    if (!agreementId) return UI.toast('Agreement ID is required.');
    try {
      await Api.requestAgreementTechnicalAdmin(agreementId, {
        request_type: E.operationsTechnicalRequestType?.value || 'other',
        request_details: E.operationsTechnicalRequestDetails?.value || '',
        priority: E.operationsTechnicalRequestPriority?.value || 'normal'
      });
      this.upsertByAgreement(agreementId, {
        technical_request_type: E.operationsTechnicalRequestType?.value || 'other',
        technical_request_status: 'Requested',
        priority: E.operationsTechnicalRequestPriority?.value || 'normal',
        request_details: E.operationsTechnicalRequestDetails?.value || ''
      });
      this.closeModal(E.operationsTechnicalRequestModal);
      UI.toast('Technical admin request submitted.');
      if (window.TechnicalAdminRequests?.loadAndRefresh) window.TechnicalAdminRequests.loadAndRefresh({ force: true });
      if (this.state.postSubmitHook) await this.state.postSubmitHook();
    } catch (error) {
      UI.toast('Unable to request technical admin: ' + (error?.message || 'Unknown error'));
    }
  },
  async submitAssignCsm() {
    const agreementId = this.state.pendingAgreementId;
    if (!agreementId) return UI.toast('Agreement ID is required.');
    try {
      await Api.assignAgreementCsm(agreementId, {
        csm_assigned_to: E.operationsAssignCsmName?.value || '',
        handover_note: E.operationsAssignCsmHandoverNote?.value || ''
      });
      this.upsertByAgreement(agreementId, { csm_assigned_to: E.operationsAssignCsmName?.value || '' });
      this.closeModal(E.operationsAssignCsmModal);
      UI.toast('CSM assigned.');
      if (this.state.postSubmitHook) await this.state.postSubmitHook();
    } catch (error) {
      UI.toast('Unable to assign CSM: ' + (error?.message || 'Unknown error'));
    }
  },
  async submitUpdateStatus() {
    const agreementId = this.state.pendingAgreementId;
    if (!agreementId) return UI.toast('Agreement ID is required.');
    try {
      await Api.updateAgreementOnboardingStatus(agreementId, {
        onboarding_status: E.operationsUpdateStatusValue?.value || '',
        notes: E.operationsUpdateStatusNotes?.value || ''
      });
      this.upsertByAgreement(agreementId, { onboarding_status: E.operationsUpdateStatusValue?.value || '' });
      this.closeModal(E.operationsUpdateStatusModal);
      UI.toast('Onboarding status updated.');
      if (this.state.postSubmitHook) await this.state.postSubmitHook();
    } catch (error) {
      UI.toast('Unable to update onboarding status: ' + (error?.message || 'Unknown error'));
    }
  },
  wire() {
    if (this.state.initialized) return;
    const bind = (el, stateKey) => {
      if (!el) return;
      const update = () => {
        this.state[stateKey] = String(el.value || '').trim() || 'All';
        if (stateKey === 'search') this.state[stateKey] = String(el.value || '').trim();
        this.applyFilters();
        this.render();
      };
      el.addEventListener('input', update);
      el.addEventListener('change', update);
    };
    bind(E.operationsOnboardingSearchInput, 'search');
    bind(E.operationsOnboardingStatusFilter, 'onboardingStatus');
    bind(E.operationsOnboardingTechStatusFilter, 'technicalRequestStatus');
    bind(E.operationsOnboardingCsmFilter, 'assignedCsm');
    if (E.operationsOnboardingRefreshBtn) E.operationsOnboardingRefreshBtn.addEventListener('click', () => this.loadAndRefresh({ force: true }));

    if (E.operationsOnboardingTbody)
      E.operationsOnboardingTbody.addEventListener('click', event => {
        const trigger = event.target?.closest?.('button');
        if (!trigger) return;
        const agreementId = trigger.getAttribute('data-op-open-agreement') || trigger.getAttribute('data-op-request-tech') || trigger.getAttribute('data-op-assign-csm') || trigger.getAttribute('data-op-mark-progress') || trigger.getAttribute('data-op-mark-completed') || '';
        const onboardingId = trigger.getAttribute('data-op-open-details') || '';
        if (trigger.hasAttribute('data-op-open-agreement')) {
          if (typeof setActiveView === 'function') setActiveView('agreements');
          return window.Agreements?.openAgreementFormById?.(agreementId, { readOnly: !this.canWrite() });
        }
        if (trigger.hasAttribute('data-op-open-details')) return this.openOnboardingDetails(onboardingId, agreementId);
        if (trigger.hasAttribute('data-op-request-tech')) return this.openTechnicalRequestModal(agreementId);
        if (trigger.hasAttribute('data-op-assign-csm')) return this.openAssignCsmModal(agreementId);
        if (trigger.hasAttribute('data-op-mark-progress')) {
          this.openUpdateStatusModal(agreementId);
          if (E.operationsUpdateStatusValue) E.operationsUpdateStatusValue.value = 'In Progress';
          return;
        }
        if (trigger.hasAttribute('data-op-mark-completed')) {
          this.openUpdateStatusModal(agreementId);
          if (E.operationsUpdateStatusValue) E.operationsUpdateStatusValue.value = 'Completed';
        }
      });

    if (E.operationsOnboardingDetailsCloseBtn) E.operationsOnboardingDetailsCloseBtn.addEventListener('click', () => this.closeModal(E.operationsOnboardingDetailsModal));
    if (E.operationsOnboardingDetailsModal)
      E.operationsOnboardingDetailsModal.addEventListener('click', event => {
        if (event.target === E.operationsOnboardingDetailsModal) this.closeModal(E.operationsOnboardingDetailsModal);
      });

    if (E.operationsTechnicalRequestCloseBtn) E.operationsTechnicalRequestCloseBtn.addEventListener('click', () => this.closeModal(E.operationsTechnicalRequestModal));
    if (E.operationsTechnicalRequestCancelBtn) E.operationsTechnicalRequestCancelBtn.addEventListener('click', () => this.closeModal(E.operationsTechnicalRequestModal));
    if (E.operationsTechnicalRequestForm)
      E.operationsTechnicalRequestForm.addEventListener('submit', event => {
        event.preventDefault();
        this.submitTechnicalRequest();
      });

    if (E.operationsAssignCsmCloseBtn) E.operationsAssignCsmCloseBtn.addEventListener('click', () => this.closeModal(E.operationsAssignCsmModal));
    if (E.operationsAssignCsmCancelBtn) E.operationsAssignCsmCancelBtn.addEventListener('click', () => this.closeModal(E.operationsAssignCsmModal));
    if (E.operationsAssignCsmForm)
      E.operationsAssignCsmForm.addEventListener('submit', event => {
        event.preventDefault();
        this.submitAssignCsm();
      });

    if (E.operationsUpdateStatusCloseBtn) E.operationsUpdateStatusCloseBtn.addEventListener('click', () => this.closeModal(E.operationsUpdateStatusModal));
    if (E.operationsUpdateStatusCancelBtn) E.operationsUpdateStatusCancelBtn.addEventListener('click', () => this.closeModal(E.operationsUpdateStatusModal));
    if (E.operationsUpdateStatusForm)
      E.operationsUpdateStatusForm.addEventListener('submit', event => {
        event.preventDefault();
        this.submitUpdateStatus();
      });

    this.state.initialized = true;
  }
};

window.OperationsOnboarding = OperationsOnboarding;
