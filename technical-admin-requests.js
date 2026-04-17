const TechnicalAdminRequests = {
  state: {
    rows: [],
    filteredRows: [],
    loadError: '',
    isLoading: false,
    initialized: false,
    search: '',
    requestStatus: 'All',
    assignedTo: 'All',
    pendingRequestId: ''
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
      technical_request_id: String(this.pick(source.technical_request_id, source.technicalRequestId, source.id)).trim(),
      agreement_id: String(this.pick(source.agreement_id, source.agreementId)).trim(),
      onboarding_id: String(this.pick(source.onboarding_id, source.onboardingId)).trim(),
      agreement_number: String(this.pick(source.agreement_number, source.agreementNumber)).trim(),
      client_name: String(this.pick(source.client_name, source.clientName, source.customer_name, source.customerName)).trim(),
      request_type: String(this.pick(source.request_type, source.requestType)).trim(),
      request_details: String(this.pick(source.request_details, source.requestDetails)).trim(),
      request_status: String(this.pick(source.request_status, source.requestStatus)).trim(),
      priority: String(this.pick(source.priority)).trim(),
      requested_by: String(this.pick(source.requested_by, source.requestedBy)).trim(),
      requested_at: String(this.pick(source.requested_at, source.requestedAt, source.created_at, source.createdAt)).trim(),
      technical_admin_assigned_to: String(this.pick(source.technical_admin_assigned_to, source.technicalAdminAssignedTo, source.assigned_to, source.assignedTo)).trim(),
      notes: String(this.pick(source.notes)).trim()
    };
  },
  canManage() {
    return Permissions.canManageTechnicalAdminRequests() && !Permissions.isViewer();
  },
  extractRows(response) {
    const candidates = [response, response?.rows, response?.items, response?.data, response?.result, response?.payload, response?.data?.rows];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return candidate;
    }
    return [];
  },
  applyFilters() {
    const search = String(this.state.search || '').trim().toLowerCase();
    const terms = search ? search.split(/\s+/).filter(Boolean) : [];
    this.state.filteredRows = this.state.rows.filter(row => {
      if (this.state.requestStatus !== 'All' && row.request_status !== this.state.requestStatus) return false;
      if (this.state.assignedTo !== 'All' && row.technical_admin_assigned_to !== this.state.assignedTo) return false;
      if (!terms.length) return true;
      const hay = [
        row.technical_request_id,
        row.agreement_id,
        row.onboarding_id,
        row.agreement_number,
        row.client_name,
        row.request_type,
        row.request_details,
        row.request_status,
        row.priority,
        row.requested_by,
        row.technical_admin_assigned_to,
        row.notes
      ].join(' ').toLowerCase();
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
    fill(E.technicalAdminStatusFilter, buildOptions(this.state.rows.map(r => r.request_status)), this.state.requestStatus);
    fill(E.technicalAdminAssignedFilter, buildOptions(this.state.rows.map(r => r.technical_admin_assigned_to)), this.state.assignedTo);
    if (E.technicalAdminSearchInput) E.technicalAdminSearchInput.value = this.state.search;
  },
  renderSummary() {
    if (!E.technicalAdminSummary) return;
    const rows = this.state.filteredRows;
    const countStatus = status => rows.filter(row => String(row.request_status || '').toLowerCase() === status).length;
    E.technicalAdminSummary.innerHTML = [
      ['Total Requests', rows.length],
      ['Requested', countStatus('requested')],
      ['In Progress', countStatus('in_progress') + countStatus('in progress')],
      ['Done', countStatus('done')],
      ['Blocked', countStatus('blocked')]
    ]
      .map(([label, value]) => `<div class="card kpi"><div class="label">${U.escapeHtml(label)}</div><div class="value">${U.escapeHtml(String(value))}</div></div>`)
      .join('');
  },
  render() {
    if (!E.technicalAdminTbody || !E.technicalAdminState) return;
    if (this.state.isLoading) {
      E.technicalAdminState.textContent = 'Loading technical admin requests…';
      E.technicalAdminTbody.innerHTML = '<tr><td colspan="12" class="muted" style="text-align:center;">Loading technical admin requests…</td></tr>';
      return;
    }
    if (this.state.loadError) {
      E.technicalAdminState.textContent = this.state.loadError;
      E.technicalAdminTbody.innerHTML = `<tr><td colspan="12" class="muted" style="text-align:center;color:#ffb4b4;">${U.escapeHtml(this.state.loadError)}</td></tr>`;
      return;
    }
    const rows = this.state.filteredRows;
    this.renderSummary();
    E.technicalAdminState.textContent = `${rows.length} technical request${rows.length === 1 ? '' : 's'}`;
    if (!rows.length) {
      E.technicalAdminTbody.innerHTML = '<tr><td colspan="12" class="muted" style="text-align:center;">No technical requests found.</td></tr>';
      return;
    }
    const text = value => U.escapeHtml(String(value || '—'));
    const canManage = this.canManage();
    E.technicalAdminTbody.innerHTML = rows
      .map(row => {
        const requestId = U.escapeAttr(row.technical_request_id);
        return `<tr>
          <td>${text(row.technical_request_id)}</td><td>${text(row.agreement_number)}</td><td>${text(row.client_name)}</td><td>${text(row.request_type)}</td><td>${text(row.request_details)}</td>
          <td>${text(row.request_status)}</td><td>${text(row.priority)}</td><td>${text(row.requested_by)}</td><td>${text(row.requested_at)}</td><td>${text(row.technical_admin_assigned_to)}</td><td>${text(row.notes)}</td>
          <td><div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button class="btn ghost sm" type="button" data-tech-view="${requestId}">View</button>
            ${canManage ? `<button class="btn ghost sm" type="button" data-tech-status="in_progress" data-tech-id="${requestId}">Mark In Progress</button>
            <button class="btn ghost sm" type="button" data-tech-status="done" data-tech-id="${requestId}">Mark Done</button>
            <button class="btn ghost sm" type="button" data-tech-status="blocked" data-tech-id="${requestId}">Mark Blocked</button>
            <button class="btn ghost sm" type="button" data-tech-update="${requestId}">Update</button>` : ''}
          </div></td>
        </tr>`;
      })
      .join('');
  },
  upsertRow(raw = {}) {
    const normalized = this.normalizeRow(raw);
    const id = String(normalized.technical_request_id || '').trim();
    if (!id) return;
    const idx = this.state.rows.findIndex(row => String(row.technical_request_id || '') === id);
    if (idx === -1) this.state.rows.unshift(normalized);
    else this.state.rows[idx] = { ...this.state.rows[idx], ...normalized };
    this.applyFilters();
    this.renderFilters();
    this.render();
  },
  async loadAndRefresh({ force = false } = {}) {
    if (this.state.isLoading && !force) return;
    this.state.isLoading = true;
    this.state.loadError = '';
    this.render();
    try {
      const response = await Api.listTechnicalAdminRequests({
        search: this.state.search,
        request_status: this.state.requestStatus !== 'All' ? this.state.requestStatus : '',
        technical_admin_assigned_to: this.state.assignedTo !== 'All' ? this.state.assignedTo : ''
      });
      this.state.rows = this.extractRows(response).map(row => this.normalizeRow(row));
    } catch (error) {
      this.state.rows = [];
      this.state.loadError = String(error?.message || '').trim() || 'Unable to load technical admin requests.';
    } finally {
      this.state.isLoading = false;
      this.applyFilters();
      this.renderFilters();
      this.render();
    }
  },
  closeModal() {
    if (!E.technicalAdminUpdateModal) return;
    E.technicalAdminUpdateModal.classList.remove('open');
    E.technicalAdminUpdateModal.setAttribute('aria-hidden', 'true');
  },
  async openView(requestId) {
    try {
      const response = await Api.getTechnicalAdminRequest({ technical_request_id: requestId });
      this.upsertRow(response?.item || response?.data || response);
      this.openUpdateModal(requestId, true);
    } catch (error) {
      UI.toast('Unable to load technical request: ' + (error?.message || 'Unknown error'));
    }
  },
  openUpdateModal(requestId, readOnly = false) {
    const row = this.state.rows.find(item => String(item.technical_request_id || '') === String(requestId || ''));
    if (!row) return UI.toast('Technical request not found.');
    this.state.pendingRequestId = row.technical_request_id;
    if (E.technicalAdminUpdateRequestId) E.technicalAdminUpdateRequestId.value = row.technical_request_id;
    if (E.technicalAdminUpdateStatus) E.technicalAdminUpdateStatus.value = row.request_status || '';
    if (E.technicalAdminUpdateAssignedTo) E.technicalAdminUpdateAssignedTo.value = row.technical_admin_assigned_to || '';
    if (E.technicalAdminUpdateNotes) E.technicalAdminUpdateNotes.value = row.notes || '';
    if (E.technicalAdminUpdateStatus) E.technicalAdminUpdateStatus.disabled = readOnly;
    if (E.technicalAdminUpdateAssignedTo) E.technicalAdminUpdateAssignedTo.disabled = readOnly;
    if (E.technicalAdminUpdateNotes) E.technicalAdminUpdateNotes.disabled = readOnly;
    if (E.technicalAdminUpdateForm?.querySelector('button[type="submit"]')) {
      E.technicalAdminUpdateForm.querySelector('button[type="submit"]').style.display = readOnly ? 'none' : '';
    }
    if (E.technicalAdminUpdateModal) {
      E.technicalAdminUpdateModal.classList.add('open');
      E.technicalAdminUpdateModal.setAttribute('aria-hidden', 'false');
    }
  },
  async quickStatusUpdate(requestId, requestStatus) {
    if (!this.canManage()) return UI.toast('Insufficient permissions.');
    try {
      await Api.updateTechnicalAdminRequest(requestId, { request_status: requestStatus });
      this.upsertRow({ technical_request_id: requestId, request_status: requestStatus });
      UI.toast('Technical request updated.');
    } catch (error) {
      UI.toast('Unable to update technical request: ' + (error?.message || 'Unknown error'));
    }
  },
  async submitUpdate() {
    if (!this.canManage()) return UI.toast('Insufficient permissions.');
    const requestId = String(this.state.pendingRequestId || '').trim();
    if (!requestId) return UI.toast('Technical request ID is required.');
    const updates = {
      request_status: E.technicalAdminUpdateStatus?.value || '',
      technical_admin_assigned_to: E.technicalAdminUpdateAssignedTo?.value || '',
      notes: E.technicalAdminUpdateNotes?.value || ''
    };
    try {
      await Api.updateTechnicalAdminRequest(requestId, updates);
      this.upsertRow({ technical_request_id: requestId, ...updates });
      this.closeModal();
      UI.toast('Technical request saved.');
    } catch (error) {
      UI.toast('Unable to save technical request: ' + (error?.message || 'Unknown error'));
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
    bind(E.technicalAdminSearchInput, 'search');
    bind(E.technicalAdminStatusFilter, 'requestStatus');
    bind(E.technicalAdminAssignedFilter, 'assignedTo');

    if (E.technicalAdminRefreshBtn) E.technicalAdminRefreshBtn.addEventListener('click', () => this.loadAndRefresh({ force: true }));
    if (E.technicalAdminTbody)
      E.technicalAdminTbody.addEventListener('click', event => {
        const trigger = event.target?.closest?.('button');
        if (!trigger) return;
        if (trigger.hasAttribute('data-tech-view')) return this.openView(trigger.getAttribute('data-tech-view'));
        if (trigger.hasAttribute('data-tech-update')) return this.openUpdateModal(trigger.getAttribute('data-tech-update'));
        if (trigger.hasAttribute('data-tech-status')) {
          return this.quickStatusUpdate(trigger.getAttribute('data-tech-id'), trigger.getAttribute('data-tech-status'));
        }
      });
    if (E.technicalAdminUpdateCloseBtn) E.technicalAdminUpdateCloseBtn.addEventListener('click', () => this.closeModal());
    if (E.technicalAdminUpdateCancelBtn) E.technicalAdminUpdateCancelBtn.addEventListener('click', () => this.closeModal());
    if (E.technicalAdminUpdateModal)
      E.technicalAdminUpdateModal.addEventListener('click', event => {
        if (event.target === E.technicalAdminUpdateModal) this.closeModal();
      });
    if (E.technicalAdminUpdateForm)
      E.technicalAdminUpdateForm.addEventListener('submit', event => {
        event.preventDefault();
        this.submitUpdate();
      });

    this.state.initialized = true;
  }
};

window.TechnicalAdminRequests = TechnicalAdminRequests;
