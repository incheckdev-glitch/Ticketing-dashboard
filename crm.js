
const CRMManager = {
  state: {
    activeSection: 'leads',
    search: '',
    status: 'All',
    owner: 'All'
  },
  leads: [],
  deals: [],
  loaded: false,
  isLoading: false,
  isSaving: false,
  loadError: '',
  extractRows(payload) {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.data)) return payload.data;
    return [];
  },
  normalizeLead(raw = {}) {
    return {
      id: String(raw.id || '').trim(),
      leadName: String(raw.lead_name || raw.leadName || raw.name || '').trim(),
      company: String(raw.company || '').trim(),
      contactName: String(raw.contact_name || raw.contactName || '').trim(),
      contactEmail: String(raw.contact_email || raw.contactEmail || raw.email || '').trim(),
      contactPhone: String(raw.contact_phone || raw.contactPhone || raw.phone || '').trim(),
      source: String(raw.source || '').trim(),
      stage: String(raw.stage || raw.status || 'New').trim() || 'New',
      owner: String(raw.owner || '').trim(),
      notes: String(raw.notes || '').trim(),
      createdAt: String(raw.created_at || raw.createdAt || '').trim(),
      updatedAt: String(raw.updated_at || raw.updatedAt || '').trim()
    };
  },
  normalizeDeal(raw = {}) {
    return {
      id: String(raw.id || '').trim(),
      dealName: String(raw.deal_name || raw.dealName || raw.name || '').trim(),
      company: String(raw.company || '').trim(),
      contactName: String(raw.contact_name || raw.contactName || '').trim(),
      contactEmail: String(raw.contact_email || raw.contactEmail || raw.email || '').trim(),
      amount: Number.parseFloat(raw.amount ?? 0) || 0,
      currency: String(raw.currency || 'USD').trim() || 'USD',
      stage: String(raw.stage || raw.status || 'Qualification').trim() || 'Qualification',
      owner: String(raw.owner || '').trim(),
      closeDate: String(raw.close_date || raw.closeDate || '').trim(),
      notes: String(raw.notes || '').trim(),
      createdAt: String(raw.created_at || raw.createdAt || '').trim(),
      updatedAt: String(raw.updated_at || raw.updatedAt || '').trim()
    };
  },
  leadToBackend(record = {}) {
    return {
      id: String(record.id || '').trim(),
      lead_name: String(record.leadName || '').trim(),
      company: String(record.company || '').trim(),
      contact_name: String(record.contactName || '').trim(),
      contact_email: String(record.contactEmail || '').trim(),
      contact_phone: String(record.contactPhone || '').trim(),
      source: String(record.source || '').trim(),
      stage: String(record.stage || '').trim(),
      owner: String(record.owner || '').trim(),
      notes: String(record.notes || '').trim()
    };
  },
  dealToBackend(record = {}) {
    return {
      id: String(record.id || '').trim(),
      deal_name: String(record.dealName || '').trim(),
      company: String(record.company || '').trim(),
      contact_name: String(record.contactName || '').trim(),
      contact_email: String(record.contactEmail || '').trim(),
      amount: Number(record.amount) || 0,
      currency: String(record.currency || '').trim(),
      stage: String(record.stage || '').trim(),
      owner: String(record.owner || '').trim(),
      close_date: String(record.closeDate || '').trim(),
      notes: String(record.notes || '').trim()
    };
  },
  canCreate() {
    return Session.isAuthenticated();
  },
  canEditDelete() {
    return Permissions.canManageCrm();
  },
  async loadAndRefresh(options = {}) {
    const force = !!options.force;
    if (this.isLoading) return;
    if (this.loaded && !force) {
      this.refresh();
      return;
    }
    this.isLoading = true;
    this.loadError = '';
    this.refresh();
    try {
      const [leadPayload, dealPayload] = await Promise.all([
        Api.postAuthenticated('crm', 'list', { entity: 'leads' }, { requireAuth: true }),
        Api.postAuthenticated('crm', 'list', { entity: 'deals' }, { requireAuth: true })
      ]);
      this.leads = this.extractRows(leadPayload).map(row => this.normalizeLead(row));
      this.deals = this.extractRows(dealPayload).map(row => this.normalizeDeal(row));
      this.loaded = true;
      this.hydrateFilters();
      this.refresh();
    } catch (error) {
      if (isAuthError(error)) {
        await handleExpiredSession('Session expired while loading CRM.');
        return;
      }
      this.loadError = String(error?.message || 'Unknown backend error');
      this.leads = [];
      this.deals = [];
      this.loaded = false;
      this.hydrateFilters();
      this.refresh();
      UI.toast('Error loading CRM: ' + this.loadError);
    } finally {
      this.isLoading = false;
      this.refresh();
    }
  },
  get activeRows() {
    return this.state.activeSection === 'deals' ? this.deals : this.leads;
  },
  filteredRows(entity = this.state.activeSection) {
    const list = entity === 'deals' ? this.deals : this.leads;
    const search = String(this.state.search || '').trim().toLowerCase();
    const status = String(this.state.status || 'All').trim().toLowerCase();
    const owner = String(this.state.owner || 'All').trim().toLowerCase();

    return list.filter(row => {
      if (status !== 'all' && String(row.stage || '').trim().toLowerCase() !== status) return false;
      if (owner !== 'all' && String(row.owner || '').trim().toLowerCase() !== owner) return false;
      if (!search) return true;
      const haystack = [
        row.id,
        row.leadName,
        row.dealName,
        row.company,
        row.contactName,
        row.contactEmail,
        row.contactPhone,
        row.source,
        row.stage,
        row.owner,
        row.notes,
        row.currency,
        row.closeDate
      ].join(' ').toLowerCase();
      return haystack.includes(search);
    });
  },
  hydrateFilters() {
    const rows = this.activeRows;
    const statuses = [...new Set(rows.map(row => String(row.stage || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const owners = [...new Set(rows.map(row => String(row.owner || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const assign = (el, values, selected) => {
      if (!el) return;
      el.innerHTML = ['All', ...values].map(v => `<option value="${U.escapeAttr(v)}">${U.escapeHtml(v)}</option>`).join('');
      setIfOptionExists(el, selected || 'All');
    };
    assign(E.crmStatusFilter, statuses, this.state.status);
    assign(E.crmOwnerFilter, owners, this.state.owner);
  },
  setSubtab(section) {
    this.state.activeSection = section === 'deals' ? 'deals' : 'leads';
    if (E.crmLeadSubtab) E.crmLeadSubtab.classList.toggle('active', this.state.activeSection === 'leads');
    if (E.crmDealSubtab) E.crmDealSubtab.classList.toggle('active', this.state.activeSection === 'deals');
    if (E.crmLeadsPanel) E.crmLeadsPanel.style.display = this.state.activeSection === 'leads' ? '' : 'none';
    if (E.crmDealsPanel) E.crmDealsPanel.style.display = this.state.activeSection === 'deals' ? '' : 'none';
    this.hydrateFilters();
    this.refresh();
    if (typeof updatePrimaryActionButton === 'function' && E.crmView?.classList.contains('active')) {
      updatePrimaryActionButton('crm');
    }
  },
  refresh() {
    const leads = this.filteredRows('leads');
    const deals = this.filteredRows('deals');
    if (E.crmLeadCount) E.crmLeadCount.textContent = `${this.leads.length} leads`;
    if (E.crmDealCount) E.crmDealCount.textContent = `${this.deals.length} deals`;
    if (E.crmVisibleCount) {
      const active = this.state.activeSection === 'deals' ? deals.length : leads.length;
      E.crmVisibleCount.textContent = `${active} visible`;
    }
    this.renderLeadTable(leads);
    this.renderDealTable(deals);
  },
  renderLeadTable(list) {
    if (!E.crmLeadTableBody) return;
    if (this.isLoading) {
      E.crmLeadTableBody.innerHTML = '<tr><td colspan="9" class="muted" style="text-align:center;">Loading leads…</td></tr>';
      return;
    }
    if (this.loadError) {
      E.crmLeadTableBody.innerHTML = `<tr><td colspan="9" class="muted" style="text-align:center;color:#ffb4b4;">${U.escapeHtml(this.loadError)}</td></tr>`;
      return;
    }
    if (!list.length) {
      E.crmLeadTableBody.innerHTML = '<tr><td colspan="9" class="muted" style="text-align:center;">No leads match the current filters.</td></tr>';
      return;
    }
    E.crmLeadTableBody.innerHTML = list.map(row => `
      <tr>
        <td>${U.escapeHtml(row.id || '—')}</td>
        <td>${U.escapeHtml(row.leadName || '—')}</td>
        <td>${U.escapeHtml(row.company || '—')}</td>
        <td>${U.escapeHtml(row.contactEmail || '—')}</td>
        <td>${U.escapeHtml(row.source || '—')}</td>
        <td>${U.escapeHtml(row.stage || '—')}</td>
        <td>${U.escapeHtml(row.owner || '—')}</td>
        <td>${U.escapeHtml(row.createdAt || '—')}</td>
        <td>${this.canEditDelete() ? `<button class="btn ghost sm" type="button" data-crm-edit="leads:${U.escapeAttr(row.id)}">Edit</button> <button class="btn ghost sm" type="button" data-crm-delete="leads:${U.escapeAttr(row.id)}">Delete</button>` : '<span class="muted">—</span>'}</td>
      </tr>
    `).join('');
  },
  renderDealTable(list) {
    if (!E.crmDealTableBody) return;
    if (this.isLoading) {
      E.crmDealTableBody.innerHTML = '<tr><td colspan="9" class="muted" style="text-align:center;">Loading deals…</td></tr>';
      return;
    }
    if (this.loadError) {
      E.crmDealTableBody.innerHTML = `<tr><td colspan="9" class="muted" style="text-align:center;color:#ffb4b4;">${U.escapeHtml(this.loadError)}</td></tr>`;
      return;
    }
    if (!list.length) {
      E.crmDealTableBody.innerHTML = '<tr><td colspan="9" class="muted" style="text-align:center;">No deals match the current filters.</td></tr>';
      return;
    }
    E.crmDealTableBody.innerHTML = list.map(row => `
      <tr>
        <td>${U.escapeHtml(row.id || '—')}</td>
        <td>${U.escapeHtml(row.dealName || '—')}</td>
        <td>${U.escapeHtml(row.company || '—')}</td>
        <td>${row.amount ? `${Math.round(row.amount)} ${U.escapeHtml(row.currency || '')}` : '—'}</td>
        <td>${U.escapeHtml(row.stage || '—')}</td>
        <td>${U.escapeHtml(row.owner || '—')}</td>
        <td>${U.escapeHtml(row.closeDate || '—')}</td>
        <td>${U.escapeHtml(row.updatedAt || row.createdAt || '—')}</td>
        <td>${this.canEditDelete() ? `<button class="btn ghost sm" type="button" data-crm-edit="deals:${U.escapeAttr(row.id)}">Edit</button> <button class="btn ghost sm" type="button" data-crm-delete="deals:${U.escapeAttr(row.id)}">Delete</button>` : '<span class="muted">—</span>'}</td>
      </tr>
    `).join('');
  },
  openForm(record = null, entity = null) {
    if (!this.canCreate()) {
      UI.toast('Login is required to create CRM items.');
      return;
    }
    const type = entity || this.state.activeSection || 'leads';
    const isDeal = type === 'deals';
    const item = record || null;
    if (E.crmFormModal) {
      E.crmFormModal.classList.add('show');
      E.crmFormModal.setAttribute('aria-hidden', 'false');
    }
    if (E.crmFormTitle) E.crmFormTitle.textContent = item ? `Edit ${isDeal ? 'Deal' : 'Lead'}` : `Create ${isDeal ? 'Deal' : 'Lead'}`;
    if (E.crmFormEntity) E.crmFormEntity.value = type;
    if (E.crmFormId) E.crmFormId.value = item?.id || '';
    if (E.crmFormNameLabel) E.crmFormNameLabel.textContent = isDeal ? 'Deal Name *' : 'Lead Name *';
    if (E.crmFormName) E.crmFormName.value = item ? (isDeal ? item.dealName : item.leadName) : '';
    if (E.crmFormCompany) E.crmFormCompany.value = item?.company || '';
    if (E.crmFormContactName) E.crmFormContactName.value = item?.contactName || '';
    if (E.crmFormContactEmail) E.crmFormContactEmail.value = item?.contactEmail || '';
    if (E.crmFormContactPhoneWrap) E.crmFormContactPhoneWrap.style.display = isDeal ? 'none' : '';
    if (E.crmFormSourceWrap) E.crmFormSourceWrap.style.display = isDeal ? 'none' : '';
    if (E.crmFormAmountWrap) E.crmFormAmountWrap.style.display = isDeal ? '' : 'none';
    if (E.crmFormCurrencyWrap) E.crmFormCurrencyWrap.style.display = isDeal ? '' : 'none';
    if (E.crmFormCloseDateWrap) E.crmFormCloseDateWrap.style.display = isDeal ? '' : 'none';
    if (E.crmFormContactPhone) E.crmFormContactPhone.value = item?.contactPhone || '';
    if (E.crmFormSource) E.crmFormSource.value = item?.source || '';
    if (E.crmFormAmount) E.crmFormAmount.value = isDeal ? String(item?.amount || '') : '';
    if (E.crmFormCurrency) E.crmFormCurrency.value = isDeal ? (item?.currency || 'USD') : 'USD';
    if (E.crmFormStage) E.crmFormStage.value = item?.stage || (isDeal ? 'Qualification' : 'New');
    if (E.crmFormOwner) E.crmFormOwner.value = item?.owner || '';
    if (E.crmFormCloseDate) E.crmFormCloseDate.value = isDeal ? (item?.closeDate || '') : '';
    if (E.crmFormNotes) E.crmFormNotes.value = item?.notes || '';
    if (E.crmFormDeleteBtn) {
      E.crmFormDeleteBtn.style.display = item && this.canEditDelete() ? '' : 'none';
      E.crmFormDeleteBtn.dataset.entity = type;
      E.crmFormDeleteBtn.dataset.id = item?.id || '';
    }
  },
  closeForm() {
    if (E.crmFormModal) {
      E.crmFormModal.classList.remove('show');
      E.crmFormModal.setAttribute('aria-hidden', 'true');
    }
    if (E.crmForm) E.crmForm.reset();
    if (E.crmFormId) E.crmFormId.value = '';
  },
  getRecordById(entity, id) {
    const list = entity === 'deals' ? this.deals : this.leads;
    return list.find(row => row.id === id) || null;
  },
  async submitForm() {
    if (!E.crmForm) return;
    const entity = E.crmFormEntity?.value === 'deals' ? 'deals' : 'leads';
    const isDeal = entity === 'deals';
    const id = String(E.crmFormId?.value || '').trim();
    const record = {
      id,
      company: String(E.crmFormCompany?.value || '').trim(),
      contactName: String(E.crmFormContactName?.value || '').trim(),
      contactEmail: String(E.crmFormContactEmail?.value || '').trim(),
      stage: String(E.crmFormStage?.value || '').trim(),
      owner: String(E.crmFormOwner?.value || '').trim(),
      notes: String(E.crmFormNotes?.value || '').trim()
    };
    if (isDeal) {
      record.dealName = String(E.crmFormName?.value || '').trim();
      record.amount = Number(E.crmFormAmount?.value || 0) || 0;
      record.currency = String(E.crmFormCurrency?.value || 'USD').trim() || 'USD';
      record.closeDate = String(E.crmFormCloseDate?.value || '').trim();
    } else {
      record.leadName = String(E.crmFormName?.value || '').trim();
      record.contactPhone = String(E.crmFormContactPhone?.value || '').trim();
      record.source = String(E.crmFormSource?.value || '').trim();
    }

    if (!(isDeal ? record.dealName : record.leadName)) {
      UI.toast(isDeal ? 'Deal name is required.' : 'Lead name is required.');
      return;
    }

    try {
      this.isSaving = true;
      if (E.crmFormSaveBtn) {
        E.crmFormSaveBtn.disabled = true;
        E.crmFormSaveBtn.textContent = 'Saving…';
      }
      const payload = isDeal ? this.dealToBackend(record) : this.leadToBackend(record);
      await Api.postAuthenticated('crm', 'save', { entity, record: payload }, { requireAuth: true });
      this.closeForm();
      await this.loadAndRefresh({ force: true });
      UI.toast(`${isDeal ? 'Deal' : 'Lead'} saved.`);
    } catch (error) {
      if (isAuthError(error)) {
        await handleExpiredSession('Session expired while saving CRM.');
        return;
      }
      UI.toast('Unable to save CRM item: ' + String(error?.message || error));
    } finally {
      this.isSaving = false;
      if (E.crmFormSaveBtn) {
        E.crmFormSaveBtn.disabled = false;
        E.crmFormSaveBtn.textContent = 'Save';
      }
    }
  },
  async deleteRecord(entity, id) {
    if (!this.canEditDelete()) {
      UI.toast('Only admin or HOO can delete CRM items.');
      return;
    }
    if (!id) return;
    const label = entity === 'deals' ? 'deal' : 'lead';
    const ok = window.confirm(`Delete this ${label}?`);
    if (!ok) return;
    try {
      await Api.postAuthenticated('crm', 'delete', { entity, id }, { requireAuth: true });
      this.closeForm();
      await this.loadAndRefresh({ force: true });
      UI.toast(`${label.charAt(0).toUpperCase() + label.slice(1)} deleted.`);
    } catch (error) {
      if (isAuthError(error)) {
        await handleExpiredSession('Session expired while deleting CRM.');
        return;
      }
      UI.toast('Unable to delete CRM item: ' + String(error?.message || error));
    }
  }
};

function wireCRMManager() {
  if (E.crmLeadSubtab) {
    E.crmLeadSubtab.addEventListener('click', () => CRMManager.setSubtab('leads'));
  }
  if (E.crmDealSubtab) {
    E.crmDealSubtab.addEventListener('click', () => CRMManager.setSubtab('deals'));
  }
  if (E.crmSearchInput) {
    E.crmSearchInput.addEventListener('input', () => {
      CRMManager.state.search = E.crmSearchInput.value || '';
      CRMManager.refresh();
    });
  }
  if (E.crmStatusFilter) {
    E.crmStatusFilter.addEventListener('change', () => {
      CRMManager.state.status = E.crmStatusFilter.value || 'All';
      CRMManager.refresh();
    });
  }
  if (E.crmOwnerFilter) {
    E.crmOwnerFilter.addEventListener('change', () => {
      CRMManager.state.owner = E.crmOwnerFilter.value || 'All';
      CRMManager.refresh();
    });
  }
  if (E.crmRefreshBtn) {
    E.crmRefreshBtn.addEventListener('click', () => CRMManager.loadAndRefresh({ force: true }));
  }
  if (E.crmLeadTableBody) {
    E.crmLeadTableBody.addEventListener('click', event => {
      const edit = event.target.closest('[data-crm-edit]');
      const del = event.target.closest('[data-crm-delete]');
      if (edit) {
        const [entity, id] = String(edit.dataset.crmEdit || '').split(':');
        const row = CRMManager.getRecordById(entity, id);
        if (row) CRMManager.openForm(row, entity);
      }
      if (del) {
        const [entity, id] = String(del.dataset.crmDelete || '').split(':');
        CRMManager.deleteRecord(entity, id);
      }
    });
  }
  if (E.crmDealTableBody) {
    E.crmDealTableBody.addEventListener('click', event => {
      const edit = event.target.closest('[data-crm-edit]');
      const del = event.target.closest('[data-crm-delete]');
      if (edit) {
        const [entity, id] = String(edit.dataset.crmEdit || '').split(':');
        const row = CRMManager.getRecordById(entity, id);
        if (row) CRMManager.openForm(row, entity);
      }
      if (del) {
        const [entity, id] = String(del.dataset.crmDelete || '').split(':');
        CRMManager.deleteRecord(entity, id);
      }
    });
  }
  if (E.crmFormCloseBtn) E.crmFormCloseBtn.addEventListener('click', () => CRMManager.closeForm());
  if (E.crmFormCancelBtn) E.crmFormCancelBtn.addEventListener('click', () => CRMManager.closeForm());
  if (E.crmFormModal) {
    E.crmFormModal.addEventListener('click', event => {
      if (event.target === E.crmFormModal) CRMManager.closeForm();
    });
  }
  if (E.crmForm) {
    E.crmForm.addEventListener('submit', event => {
      event.preventDefault();
      CRMManager.submitForm();
    });
  }
  if (E.crmFormDeleteBtn) {
    E.crmFormDeleteBtn.addEventListener('click', () => {
      CRMManager.deleteRecord(E.crmFormDeleteBtn.dataset.entity, E.crmFormDeleteBtn.dataset.id);
    });
  }

  CRMManager.setSubtab('leads');
}

window.CRMManager = CRMManager;
