const WorkflowEngine = {
  toBool(value) {
    if (typeof value === 'boolean') return value;
    const normalized = String(value || '').trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n'].includes(normalized)) return false;
    return false;
  },
  toNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  },
  async validateWorkflowTransition(resource, record, requestedChanges = {}) {
    return Api.validateWorkflowTransition({ resource, record, requested_changes: requestedChanges });
  },
  async enforceBeforeSave(resource, record, requestedChanges = {}) {
    try {
      const validation = await this.validateWorkflowTransition(resource, record, requestedChanges);
      const allowed = this.toBool(validation?.allowed ?? validation?.is_allowed ?? true);
      const approvalCreated = this.toBool(validation?.approval_created);
      return {
        allowed,
        approvalCreated,
        pendingApproval: this.toBool(validation?.pending_approval),
        reason: String(validation?.reason || '').trim(),
        requestedDiscount: this.toNumber(validation?.requested_discount_percent ?? requestedChanges?.discount_percent),
        userDiscountLimit: validation?.user_discount_limit,
        hardStopDiscountLimit: validation?.hard_stop_discount_percent,
        response: validation
      };
    } catch (error) {
      const reason = String(error?.message || 'Workflow validation failed.').trim();
      const authzError = /forbidden|unauthorized|permission/i.test(reason);
      if (authzError) {
        console.warn('Workflow validation skipped due to missing permission.', error);
        return {
          allowed: true,
          approvalCreated: false,
          pendingApproval: false,
          skipped: true,
          reason: '',
          response: null
        };
      }
      return {
        allowed: false,
        approvalCreated: false,
        pendingApproval: false,
        reason,
        response: null
      };
    }
  },
  getWorkflowBadgeHtml(status) {
    const raw = String(status || '').trim() || 'Unknown';
    const normalized = raw.toLowerCase();
    const css =
      normalized.includes('pending') ? 'warning' : normalized.includes('approved') ? 'success' : normalized.includes('reject') ? 'danger' : normalized.includes('escalat') ? 'info' : 'muted';
    return `<span class="pill ${css}">${U.escapeHtml(raw)}</span>`;
  },
  composeDeniedMessage(result, fallbackPrefix = 'Action blocked by workflow rules.') {
    const reason = String(result?.reason || '').trim();
    const hasDiscountData = result && result.requestedDiscount != null && result.userDiscountLimit != null;
    const discountPart = hasDiscountData
      ? ` Your limit: ${result.userDiscountLimit}% · requested: ${result.requestedDiscount}%.`
      : '';
    const approvalPart = result?.approvalCreated
      ? ' Approval request was created and is pending review.'
      : '';
    return `${fallbackPrefix}${reason ? ` ${reason}` : ''}${discountPart}${approvalPart}`.trim();
  }
};

const Workflow = {
  state: {
    rules: [],
    approvals: [],
    audit: [],
    loading: false
  },
  resourceOptions: ['proposals', 'agreements', 'invoices', 'receipts'],
  resourceStatusOptions: {
    proposals: ['Draft', 'Pending Approval', 'Sent', 'Viewed', 'Under Discussion', 'Accepted', 'Rejected', 'Expired'],
    agreements: ['Draft', 'Sent', 'Under Review', 'Revision Required', 'Approved', 'Signed', 'Rejected', 'Expired', 'Cancelled'],
    invoices: ['Draft', 'Issued', 'Sent', 'Unpaid', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled'],
    receipts: ['Issued', 'Partially Paid', 'Paid', 'Cancelled']
  },
  resourceFieldOptions: {
    proposals: ['title', 'status', 'customer_name', 'subtotal', 'discount_percent', 'tax_percent', 'total_amount', 'valid_until', 'notes'],
    agreements: ['status', 'customer_name', 'start_date', 'end_date', 'payment_terms', 'total_amount', 'notes'],
    invoices: ['status', 'customer_name', 'issue_date', 'due_date', 'subtotal', 'discount_percent', 'tax_percent', 'total_amount', 'amount_paid', 'notes'],
    receipts: ['status', 'customer_name', 'receipt_date', 'payment_method', 'reference_number', 'amount', 'notes']
  },
  normalizeRows(response) {
    const candidates = [response, response?.items, response?.rows, response?.data, response?.result, response?.payload];
    for (const item of candidates) {
      if (Array.isArray(item)) return item;
    }
    return [];
  },
  getRulePayloadFromForm() {
    const get = id => String(E[id]?.value || '').trim();
    return {
      workflow_rule_id: get('workflowRuleId'),
      resource: get('workflowResource').toLowerCase(),
      current_status: get('workflowCurrentStatus'),
      next_status: get('workflowNextStatus'),
      allowed_roles: [get('workflowAllowedRoles').toLowerCase()].filter(Boolean),
      requires_approval: String(get('workflowRequiresApproval')) === 'true',
      approval_role: get('workflowApprovalRole').toLowerCase(),
      max_discount_percent: Number(get('workflowMaxDiscount') || 0),
      hard_stop_discount_percent: Number(get('workflowHardStopDiscount') || 0),
      editable_fields: this.getMultiSelectValues(E.workflowEditableFields),
      required_fields: this.getMultiSelectValues(E.workflowRequiredFields),
      require_comment: String(get('workflowRequireComment')) === 'true',
      require_attachment: String(get('workflowRequireAttachment')) === 'true',
      is_active: String(get('workflowIsActive')) !== 'false'
    };
  },
  fillRuleForm(rule = {}) {
    const editableFields = Array.isArray(rule.editable_fields) ? rule.editable_fields : String(rule.editable_fields || '').split(',');
    const requiredFields = Array.isArray(rule.required_fields) ? rule.required_fields : String(rule.required_fields || '').split(',');
    if (E.workflowRuleId) E.workflowRuleId.value = rule.workflow_rule_id || '';
    if (E.workflowResource) E.workflowResource.value = rule.resource || '';
    if (E.workflowCurrentStatus) E.workflowCurrentStatus.value = rule.current_status || '';
    if (E.workflowNextStatus) E.workflowNextStatus.value = rule.next_status || '';
    if (E.workflowAllowedRoles) {
      const firstRole = Array.isArray(rule.allowed_roles)
        ? rule.allowed_roles[0]
        : String(rule.allowed_roles || rule.allowed_roles_csv || '').split(',').map(v => v.trim()).filter(Boolean)[0];
      E.workflowAllowedRoles.value = firstRole || '';
    }
    if (E.workflowRequiresApproval) E.workflowRequiresApproval.value = String(WorkflowEngine.toBool(rule.requires_approval));
    if (E.workflowApprovalRole) E.workflowApprovalRole.value = rule.approval_role || '';
    if (E.workflowMaxDiscount) E.workflowMaxDiscount.value = rule.max_discount_percent ?? '';
    if (E.workflowHardStopDiscount) E.workflowHardStopDiscount.value = rule.hard_stop_discount_percent ?? '';
    if (E.workflowRequireComment) E.workflowRequireComment.value = String(WorkflowEngine.toBool(rule.require_comment));
    if (E.workflowRequireAttachment) E.workflowRequireAttachment.value = String(WorkflowEngine.toBool(rule.require_attachment));
    if (E.workflowIsActive) E.workflowIsActive.value = String(rule.is_active !== false);
    this.populateRuleSelects();
    this.setMultiSelectValues(E.workflowEditableFields, editableFields);
    this.setMultiSelectValues(E.workflowRequiredFields, requiredFields);
  },
  resetRuleForm() {
    if (E.workflowRuleForm) E.workflowRuleForm.reset();
    if (E.workflowRuleId) E.workflowRuleId.value = '';
    this.populateRuleSelects();
  },
  setSelectOptions(selectEl, values = [], placeholder = '') {
    if (!selectEl) return;
    const currentValue = String(selectEl.value || '').trim();
    const uniq = [...new Set(values.map(v => String(v || '').trim()).filter(Boolean))];
    selectEl.innerHTML = [placeholder ? `<option value="">${U.escapeHtml(placeholder)}</option>` : '', ...uniq.map(value => `<option value="${U.escapeAttr(value)}">${U.escapeHtml(value)}</option>`)]
      .filter(Boolean)
      .join('');
    if (currentValue && uniq.includes(currentValue)) selectEl.value = currentValue;
  },
  getStatusesForResource(resourceValue = '') {
    const resource = String(resourceValue || '').trim().toLowerCase();
    const statuses = new Set();
    (this.resourceStatusOptions[resource] || []).forEach(status => statuses.add(status));
    if (resource === 'invoices' && Array.isArray(window.Invoices?.statusOptions)) {
      window.Invoices.statusOptions.forEach(status => statuses.add(String(status || '').trim()));
    }
    this.state.rules
      .filter(rule => String(rule.resource || '').trim().toLowerCase() === resource)
      .forEach(rule => {
        if (rule.current_status) statuses.add(String(rule.current_status).trim());
        if (rule.next_status) statuses.add(String(rule.next_status).trim());
      });
    const moduleStateRows = {
      proposals: window.Proposals?.state?.rows,
      agreements: window.Agreements?.state?.rows,
      invoices: window.Invoices?.state?.rows,
      receipts: window.Receipts?.state?.rows
    }[resource];
    if (Array.isArray(moduleStateRows)) {
      moduleStateRows.forEach(row => {
        const status = String(row?.status || '').trim();
        if (status) statuses.add(status);
      });
    }
    return [...statuses].sort((a, b) => a.localeCompare(b));
  },
  getSystemRoles() {
    const roleMap = new Map();
    (window.RolesAdmin?.state?.roles || []).forEach(role => {
      const key = String(role?.role_key || role?.key || role?.role || '').trim().toLowerCase();
      if (!key) return;
      const display = String(role?.display_name || role?.name || '').trim();
      roleMap.set(key, display || key);
    });
    this.state.rules.forEach(rule => {
      const roles = Array.isArray(rule.allowed_roles)
        ? rule.allowed_roles
        : String(rule.allowed_roles || rule.allowed_roles_csv || '').split(',');
      roles.map(v => String(v || '').trim().toLowerCase()).filter(Boolean).forEach(role => {
        if (!roleMap.has(role)) roleMap.set(role, role);
      });
      const approvalRole = String(rule.approval_role || '').trim().toLowerCase();
      if (approvalRole && !roleMap.has(approvalRole)) roleMap.set(approvalRole, approvalRole);
    });
    return [...roleMap.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => String(a.label || a.value).localeCompare(String(b.label || b.value)));
  },
  setRoleSelectOptions(selectEl, roles = [], placeholder = '') {
    if (!selectEl) return;
    const currentValue = String(selectEl.value || '').trim().toLowerCase();
    const options = roles
      .map(item => ({
        value: String(item?.value || '').trim().toLowerCase(),
        label: String(item?.label || item?.value || '').trim()
      }))
      .filter(item => item.value)
      .filter((item, idx, arr) => arr.findIndex(candidate => candidate.value === item.value) === idx);
    selectEl.innerHTML = [
      placeholder ? `<option value="">${U.escapeHtml(placeholder)}</option>` : '',
      ...options.map(({ value, label }) => `<option value="${U.escapeAttr(value)}">${U.escapeHtml(label)}</option>`)
    ]
      .filter(Boolean)
      .join('');
    if (currentValue && options.some(option => option.value === currentValue)) selectEl.value = currentValue;
  },
  getMultiSelectValues(selectEl) {
    if (!selectEl) return [];
    return Array.from(selectEl.selectedOptions || [])
      .map(option => String(option.value || '').trim())
      .filter(Boolean);
  },
  setMultiSelectValues(selectEl, values = []) {
    if (!selectEl) return;
    const normalized = new Set(
      (Array.isArray(values) ? values : [values])
        .map(value => String(value || '').trim())
        .filter(Boolean)
    );
    Array.from(selectEl.options || []).forEach(option => {
      option.selected = normalized.has(String(option.value || '').trim());
    });
  },
  setMultiSelectOptions(selectEl, values = []) {
    if (!selectEl) return;
    const selected = new Set(this.getMultiSelectValues(selectEl));
    const options = [...new Set(values.map(v => String(v || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    selectEl.innerHTML = options.map(value => `<option value="${U.escapeAttr(value)}">${U.escapeHtml(value)}</option>`).join('');
    Array.from(selectEl.options || []).forEach(option => {
      option.selected = selected.has(String(option.value || '').trim());
    });
  },
  getFieldsForResource(resourceValue = '') {
    const resource = String(resourceValue || '').trim().toLowerCase();
    const fields = new Set(this.resourceFieldOptions[resource] || []);
    this.state.rules
      .filter(rule => String(rule.resource || '').trim().toLowerCase() === resource)
      .forEach(rule => {
        const editable = Array.isArray(rule.editable_fields) ? rule.editable_fields : String(rule.editable_fields || '').split(',');
        const required = Array.isArray(rule.required_fields) ? rule.required_fields : String(rule.required_fields || '').split(',');
        [...editable, ...required]
          .map(field => String(field || '').trim())
          .filter(Boolean)
          .forEach(field => fields.add(field));
      });
    const moduleStateRows = {
      proposals: window.Proposals?.state?.rows,
      agreements: window.Agreements?.state?.rows,
      invoices: window.Invoices?.state?.rows,
      receipts: window.Receipts?.state?.rows
    }[resource];
    if (Array.isArray(moduleStateRows)) {
      moduleStateRows.slice(0, 10).forEach(row => {
        Object.keys(row || {}).forEach(key => {
          const field = String(key || '').trim();
          if (!field || field.endsWith('_id') || field === 'id') return;
          fields.add(field);
        });
      });
    }
    return [...fields];
  },
  populateRuleSelects() {
    this.setSelectOptions(E.workflowResource, this.resourceOptions, 'Select resource');
    const selectedResource = String(E.workflowResource?.value || '').trim().toLowerCase();
    const statusOptions = selectedResource ? this.getStatusesForResource(selectedResource) : [];
    this.setSelectOptions(E.workflowCurrentStatus, statusOptions, 'Select current status');
    this.setSelectOptions(E.workflowNextStatus, statusOptions, 'Select next status');
    const roles = this.getSystemRoles();
    this.setRoleSelectOptions(E.workflowAllowedRoles, roles, 'Select allowed role');
    this.setRoleSelectOptions(E.workflowApprovalRole, roles, 'Select approval role');
    const fieldOptions = selectedResource ? this.getFieldsForResource(selectedResource) : [];
    this.setMultiSelectOptions(E.workflowEditableFields, fieldOptions);
    this.setMultiSelectOptions(E.workflowRequiredFields, fieldOptions);
  },
  renderRules() {
    if (!E.workflowRulesTbody) return;
    const resourceFilter = String(E.workflowResourceFilter?.value || '').trim().toLowerCase();
    const rows = this.state.rules.filter(rule => !resourceFilter || String(rule.resource || '').toLowerCase() === resourceFilter);
    E.workflowRulesTbody.innerHTML = rows.map(rule => `
      <tr>
        <td>${U.escapeHtml(rule.resource || '—')}</td>
        <td>${U.escapeHtml(rule.current_status || '—')}</td>
        <td>${U.escapeHtml(rule.next_status || '—')}</td>
        <td>${U.escapeHtml(Array.isArray(rule.allowed_roles) ? rule.allowed_roles.join(', ') : String(rule.allowed_roles || rule.allowed_roles_csv || '—'))}</td>
        <td>${WorkflowEngine.toBool(rule.requires_approval) ? U.escapeHtml(rule.approval_role || 'required') : 'No'}</td>
        <td>${U.escapeHtml(String(rule.max_discount_percent ?? '—'))}</td>
        <td>${U.escapeHtml(String(rule.hard_stop_discount_percent ?? '—'))}</td>
        <td>${WorkflowEngine.toBool(rule.is_active) ? 'Yes' : 'No'}</td>
        <td><button class="chip-btn" data-rule-edit="${U.escapeHtml(rule.workflow_rule_id || '')}">Edit</button> <button class="chip-btn" data-rule-delete="${U.escapeHtml(rule.workflow_rule_id || '')}">Delete</button></td>
      </tr>`).join('') || '<tr><td colspan="9" class="muted" style="text-align:center;">No workflow rules.</td></tr>';
  },
  renderDiscountPolicy() {
    if (!E.workflowDiscountPolicyTbody) return;
    const rows = [];
    this.state.rules.forEach(rule => {
      const allowedRoles = Array.isArray(rule.allowed_roles) ? rule.allowed_roles : String(rule.allowed_roles || '').split(',').map(v => v.trim()).filter(Boolean);
      allowedRoles.forEach(role => rows.push({ resource: rule.resource, role, max: rule.max_discount_percent, hardStop: rule.hard_stop_discount_percent }));
    });
    E.workflowDiscountPolicyTbody.innerHTML = rows.map(row => `<tr><td>${U.escapeHtml(row.resource || '—')}</td><td>${U.escapeHtml(row.role || '—')}</td><td>${U.escapeHtml(String(row.max ?? '—'))}</td><td>${U.escapeHtml(String(row.hardStop ?? '—'))}</td></tr>`).join('') || '<tr><td colspan="4" class="muted" style="text-align:center;">No discount policy found.</td></tr>';
  },
  renderApprovals() {
    if (!E.workflowApprovalsTbody) return;
    E.workflowApprovalsTbody.innerHTML = this.state.approvals.map(item => `
      <tr>
        <td>${U.escapeHtml(item.resource || '—')}</td><td>${U.escapeHtml(item.record_number || item.record_id || '—')}</td><td>${U.escapeHtml(item.company_name || '—')}</td><td>${U.escapeHtml(item.requested_by_name || '—')}</td>
        <td>${U.escapeHtml(item.current_status || '—')}</td><td>${U.escapeHtml(item.requested_status || '—')}</td><td>${U.escapeHtml(String(item.discount_percent ?? '0'))}%</td><td>${U.escapeHtml(item.approval_role || '—')}</td>
        <td>${WorkflowEngine.getWorkflowBadgeHtml(item.status || 'Pending Approval')}</td>
        <td><button class="chip-btn" data-approval-action="approve" data-approval-id="${U.escapeHtml(item.approval_id || '')}">Approve</button> <button class="chip-btn" data-approval-action="reject" data-approval-id="${U.escapeHtml(item.approval_id || '')}">Reject</button></td>
      </tr>
    `).join('') || '<tr><td colspan="10" class="muted" style="text-align:center;">No pending approvals.</td></tr>';
  },
  renderAudit() {
    if (!E.workflowAuditTbody) return;
    const query = String(E.workflowAuditSearch?.value || '').trim().toLowerCase();
    const resource = String(E.workflowAuditResourceFilter?.value || '').trim().toLowerCase();
    const allowedFilter = String(E.workflowAuditAllowedFilter?.value || '').trim();
    const rows = this.state.audit.filter(item => {
      if (resource && String(item.resource || '').toLowerCase() !== resource) return false;
      if (allowedFilter && String(item.allowed) !== allowedFilter) return false;
      if (!query) return true;
      const hay = [item.resource, item.record_id, item.action, item.user_name, item.reason, item.old_status, item.new_status].join(' ').toLowerCase();
      return hay.includes(query);
    });
    E.workflowAuditTbody.innerHTML = rows.map(item => `<tr><td>${U.escapeHtml(U.fmtTS(item.created_at) || item.created_at || '—')}</td><td>${U.escapeHtml(item.resource || '—')}</td><td>${U.escapeHtml(String(item.record_id || '—'))}</td><td>${U.escapeHtml(item.action || '—')}</td><td>${U.escapeHtml(item.old_status || '—')}</td><td>${U.escapeHtml(item.new_status || '—')}</td><td>${U.escapeHtml(item.user_name || '—')}</td><td>${WorkflowEngine.toBool(item.allowed) ? '✅' : '❌'}</td><td>${U.escapeHtml(item.reason || '—')}</td></tr>`).join('') || '<tr><td colspan="9" class="muted" style="text-align:center;">No audit entries.</td></tr>';
  },
  renderMatrix() {
    if (!E.workflowMatrixContainer) return;
    const resource = String(E.workflowMatrixResource?.value || 'proposals').trim().toLowerCase();
    const rules = this.state.rules.filter(rule => String(rule.resource || '').toLowerCase() === resource);
    const statuses = [...new Set(rules.flatMap(rule => [rule.current_status, rule.next_status]).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b)));
    if (!statuses.length) {
      E.workflowMatrixContainer.innerHTML = '<div class="muted">No status transitions configured for this resource.</div>';
      return;
    }
    const cells = statuses.map(from => `<tr><th>${U.escapeHtml(from)}</th>${statuses.map(to => {
      const matched = rules.find(rule => String(rule.current_status||'').toLowerCase()===String(from).toLowerCase() && String(rule.next_status||'').toLowerCase()===String(to).toLowerCase());
      return `<td><button class="chip-btn" data-matrix-from="${U.escapeHtml(from)}" data-matrix-to="${U.escapeHtml(to)}">${matched ? 'Configured' : '—'}</button></td>`;
    }).join('')}</tr>`).join('');
    E.workflowMatrixContainer.innerHTML = `<table><thead><tr><th>From \ To</th>${statuses.map(s=>`<th>${U.escapeHtml(s)}</th>`).join('')}</tr></thead><tbody>${cells}</tbody></table>`;
  },
  async loadAndRefresh(force = false) {
    if (this.state.loading && !force) return;
    this.state.loading = true;
    try {
      if (window.RolesAdmin?.ensureRolesLoaded) await window.RolesAdmin.ensureRolesLoaded(force);
      const [rulesRes, approvalsRes, auditRes] = await Promise.all([
        Api.listWorkflowRules(),
        Api.listPendingWorkflowApprovals(),
        Api.listWorkflowAudit()
      ]);
      this.state.rules = this.normalizeRows(rulesRes);
      this.state.approvals = this.normalizeRows(approvalsRes);
      this.state.audit = this.normalizeRows(auditRes);
      this.renderRules();
      this.renderDiscountPolicy();
      this.renderApprovals();
      this.renderAudit();
      this.renderMatrix();
      this.populateRuleSelects();
    } catch (error) {
      UI.toast('Unable to load workflow data: ' + (error?.message || 'Unknown error'));
    } finally {
      this.state.loading = false;
    }
  },
  async saveRule() {
    const payload = this.getRulePayloadFromForm();
    if (!payload.resource || !payload.current_status || !payload.next_status || !payload.allowed_roles.length) {
      return UI.toast('resource, current status, next status, and allowed roles are required.');
    }
    await Api.saveWorkflowRule(payload);
    UI.toast(payload.workflow_rule_id ? 'Workflow rule updated.' : 'Workflow rule created.');
    this.resetRuleForm();
    await this.loadAndRefresh(true);
  },
  async deleteRule(workflowRuleId) {
    const id = String(workflowRuleId || '').trim();
    if (!id) return;
    if (!window.confirm(`Delete workflow rule ${id}?`)) return;
    await Api.deleteWorkflowRule(id);
    UI.toast('Workflow rule deleted.');
    await this.loadAndRefresh(true);
  },
  async actOnApproval(action, approvalId) {
    const id = String(approvalId || '').trim();
    if (!id) return;
    const reviewer_comment = window.prompt(`${action === 'approve' ? 'Approval' : 'Rejection'} comment`, '') || '';
    if (action === 'approve') await Api.approveWorkflowRequest({ approval_id: id, reviewer_comment });
    else await Api.rejectWorkflowRequest({ approval_id: id, reviewer_comment });
    UI.toast(`Approval ${action}d.`);
    await this.loadAndRefresh(true);
  },
  wire() {
    if (E.workflowRuleForm) {
      E.workflowRuleForm.addEventListener('submit', async e => {
        e.preventDefault();
        if (!Permissions.canManageWorkflow()) return UI.toast('Forbidden.');
        try {
          await this.saveRule();
        } catch (error) {
          UI.toast(error?.message || 'Unable to save workflow rule.');
        }
      });
    }
    if (E.workflowRuleResetBtn) E.workflowRuleResetBtn.addEventListener('click', () => this.resetRuleForm());
    if (E.workflowRefreshBtn) E.workflowRefreshBtn.addEventListener('click', () => this.loadAndRefresh(true));
    if (E.workflowResourceFilter) E.workflowResourceFilter.addEventListener('change', () => this.renderRules());
    if (E.workflowResource) E.workflowResource.addEventListener('change', () => this.populateRuleSelects());
    if (E.workflowMatrixResource) E.workflowMatrixResource.addEventListener('change', () => this.renderMatrix());
    [E.workflowAuditSearch, E.workflowAuditResourceFilter, E.workflowAuditAllowedFilter].forEach(el => {
      if (!el) return;
      el.addEventListener('input', () => this.renderAudit());
      el.addEventListener('change', () => this.renderAudit());
    });

    if (E.workflowRulesTbody) {
      E.workflowRulesTbody.addEventListener('click', async event => {
        const editId = event.target?.closest?.('[data-rule-edit]')?.getAttribute('data-rule-edit');
        const deleteId = event.target?.closest?.('[data-rule-delete]')?.getAttribute('data-rule-delete');
        if (editId) {
          const rule = this.state.rules.find(item => String(item.workflow_rule_id || '') === String(editId));
          if (rule) this.fillRuleForm(rule);
        }
        if (deleteId) {
          try {
            await this.deleteRule(deleteId);
          } catch (error) {
            UI.toast(error?.message || 'Unable to delete workflow rule.');
          }
        }
      });
    }
    if (E.workflowApprovalsTbody) {
      E.workflowApprovalsTbody.addEventListener('click', async event => {
        const button = event.target?.closest?.('[data-approval-action]');
        if (!button) return;
        try {
          await this.actOnApproval(button.getAttribute('data-approval-action'), button.getAttribute('data-approval-id'));
        } catch (error) {
          UI.toast(error?.message || 'Unable to process approval action.');
        }
      });
    }
    if (E.workflowMatrixContainer) {
      E.workflowMatrixContainer.addEventListener('click', event => {
        const button = event.target?.closest?.('[data-matrix-from]');
        if (!button) return;
        const from = button.getAttribute('data-matrix-from');
        const to = button.getAttribute('data-matrix-to');
        const resource = String(E.workflowMatrixResource?.value || '').trim();
        const rule = this.state.rules.find(item => String(item.resource || '').toLowerCase() === resource.toLowerCase() && String(item.current_status || '').toLowerCase() === String(from || '').toLowerCase() && String(item.next_status || '').toLowerCase() === String(to || '').toLowerCase());
        this.fillRuleForm(rule || { resource, current_status: from, next_status: to, is_active: true });
      });
    }
  }
};

window.WorkflowEngine = WorkflowEngine;
window.Workflow = Workflow;
