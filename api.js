const Api = {
  ensureBaseUrl() {
    const resolved = resolveApiEndpoint(API_BASE_URL);
    if (!resolved) {
      throw new Error('API_BASE_URL is not configured.');
    }
    return resolved;
  },
  buildUrl(resource = '', params = {}) {
    const endpoint = this.ensureBaseUrl();
    const url = new URL(endpoint);
    if (resource) url.searchParams.set('resource', String(resource));
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      url.searchParams.set(key, String(value));
    });
    return url.toString();
  },
  unwrapApiPayload(response) {
    let payload = response;
    const seen = new Set();
    while (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      if (seen.has(payload)) break;
      seen.add(payload);
      if ('data' in payload && payload.data !== undefined) {
        payload = payload.data;
        continue;
      }
      if ('result' in payload && payload.result !== undefined) {
        payload = payload.result;
        continue;
      }
      if ('payload' in payload && payload.payload !== undefined) {
        payload = payload.payload;
        continue;
      }
      if ('item' in payload && payload.item !== undefined) {
        payload = payload.item;
        continue;
      }
      break;
    }
    return payload;
  },
  async get(resource, params = {}) {
    const endpoint = this.buildUrl(resource, params);
    let response;
    try {
      response = await fetch(endpoint, {
        method: 'GET',
        cache: 'no-store'
      });
    } catch (error) {
      throw buildNetworkRequestError(endpoint, error);
    }
    const rawText = await response.text();
    const data = parseApiJson(rawText, `Backend ${resource || 'api'}`);
    if (!response.ok) {
      throw buildHttpResponseError(response, data, endpoint);
    }
    if (data && typeof data === 'object' && hasExplicitBackendFailure(data)) {
      throw new Error(data.error || data.message || 'Backend rejected request.');
    }
    return this.unwrapApiPayload(data);
  },
  async post(resource, action, payload = {}) {
    const safePayload = payload && typeof payload === 'object' ? payload : {};
    return apiPost({
      ...safePayload,
      resource,
      action
    });
  },
  async postAuthenticated(resource, action, payload = {}, options = {}) {
    const requireAuth = options?.requireAuth !== false;
    const authToken =
      typeof Session?.getAuthToken === 'function'
        ? Session.getAuthToken()
        : String(Session?.authContext?.().authToken || '');
    if (requireAuth && !authToken) {
      throw new Error('Missing authentication token.');
    }
    return this.post(resource, action, {
      ...payload,
      authToken: authToken || ''
    });
  },

  getCacheConfig() {
    return {
      prefix: 'ticketing_dashboard_cache_v1',
      ttlMs: 2 * 60 * 1000
    };
  },
  buildCacheKey(resource, action, payload = {}) {
    const config = this.getCacheConfig();
    const cleanPayload = { ...(payload || {}) };
    delete cleanPayload.authToken;
    const serialized = JSON.stringify(cleanPayload, Object.keys(cleanPayload).sort());
    return `${config.prefix}:${resource}:${action}:${serialized}`;
  },
  readCachedValue(cacheKey) {
    if (!cacheKey) return null;
    try {
      const raw = localStorage.getItem(cacheKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      const age = Date.now() - Number(parsed.savedAt || 0);
      const { ttlMs } = this.getCacheConfig();
      if (age > ttlMs) return null;
      return parsed;
    } catch {
      return null;
    }
  },
  writeCachedValue(cacheKey, value, syncedAt = new Date().toISOString()) {
    if (!cacheKey) return;
    try {
      localStorage.setItem(
        cacheKey,
        JSON.stringify({
          savedAt: Date.now(),
          syncedAt,
          value
        })
      );
    } catch {
      // Ignore storage quota/sandbox failures.
    }
  },
  clearCachedValue(cacheKey) {
    if (!cacheKey) return;
    try {
      localStorage.removeItem(cacheKey);
    } catch {
      // Ignore storage quota/sandbox failures.
    }
  },
  invalidateResourceCache(resource, action = null) {
    const config = this.getCacheConfig();
    const segments = [config.prefix, resource];
    if (action) segments.push(action);
    const prefix = `${segments.join(':')}:`;
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(prefix)) localStorage.removeItem(key);
      });
    } catch {
      // Ignore storage access failures.
    }
  },
  buildPagedListPayload(filters = {}, options = {}) {
    const page = Math.max(1, Number.parseInt(options.page, 10) || 1);
    const pageSize = Math.max(1, Number.parseInt(options.page_size ?? options.pageSize, 10) || 25);
    return {
      filters: filters && typeof filters === 'object' ? filters : {},
      paged: options.paged !== false,
      summary_only: options.summary_only !== false,
      page,
      page_size: pageSize
    };
  },
  normalizePagedResponse(response, fallback = {}) {
    const container = response && typeof response === 'object' ? response : {};
    const rows = Array.isArray(container.data)
      ? container.data
      : Array.isArray(response)
      ? response
      : [];
    const page = Math.max(1, Number(container.page) || Number(fallback.page) || 1);
    const pageSize = Math.max(
      1,
      Number(container.page_size) || Number(container.pageSize) || Number(fallback.page_size) || 25
    );
    const count = Math.max(
      0,
      Number(container.count) ||
        Number(container.total_count) ||
        Number(fallback.count) ||
        rows.length
    );
    const totalPages = Math.max(
      1,
      Number(container.total_pages) ||
        Number(fallback.total_pages) ||
        Math.ceil((count || rows.length) / pageSize) ||
        1
    );
    return {
      data: rows,
      page,
      page_size: pageSize,
      total_pages: totalPages,
      count
    };
  },
  async listPagedResource(resource, filters = {}, options = {}) {
    const payload = this.buildPagedListPayload(filters, options);
    const response = await this.postAuthenticatedCached(resource, 'list', payload, {
      forceRefresh: options.forceRefresh === true
    });
    return this.normalizePagedResponse(response, payload);
  },
  mergeIncrementalRows(cachedRows = [], freshRows = []) {
    if (!Array.isArray(cachedRows)) return Array.isArray(freshRows) ? freshRows : [];
    if (!Array.isArray(freshRows) || !freshRows.length) return cachedRows;

    const idKeys = ['id', 'uuid', 'ticket_id', 'deal_id', 'client_id', 'agreement_id', 'invoice_id', 'proposal_id', 'user_id', 'role_id', 'key'];
    const getRowId = row => {
      if (!row || typeof row !== 'object') return '';
      const match = idKeys.find(key => row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '');
      return match ? `${match}:${String(row[match])}` : '';
    };

    const map = new Map();
    cachedRows.forEach(row => {
      const id = getRowId(row);
      if (id) map.set(id, row);
    });

    const appended = [];
    freshRows.forEach(row => {
      const id = getRowId(row);
      if (id) {
        const previous = map.get(id) || {};
        map.set(id, { ...previous, ...row });
      } else {
        appended.push(row);
      }
    });

    const merged = cachedRows.map(row => {
      const id = getRowId(row);
      return id && map.has(id) ? map.get(id) : row;
    });

    map.forEach((row, id) => {
      if (!cachedRows.some(existing => getRowId(existing) === id)) {
        merged.push(row);
      }
    });

    if (appended.length) merged.push(...appended);
    return merged;
  },
  async postAuthenticatedCached(resource, action, payload = {}, options = {}) {
    const cacheKey = options?.cacheKey || this.buildCacheKey(resource, action, payload);
    const forceRefresh = options?.forceRefresh === true;
    const cached = this.readCachedValue(cacheKey);

    if (!forceRefresh && cached?.value !== undefined) {
      const ageMs = Date.now() - Number(cached.savedAt || 0);
      if (ageMs <= 15000) return cached.value;
    }

    const incrementalPayload = {
      ...payload
    };
    if (cached?.syncedAt) {
      incrementalPayload.updated_after = cached.syncedAt;
      incrementalPayload.if_modified_since = cached.syncedAt;
    }

    try {
      const fresh = await this.postAuthenticated(resource, action, incrementalPayload, options);
      const shouldMerge = Array.isArray(cached?.value) && Array.isArray(fresh);
      const merged = shouldMerge ? this.mergeIncrementalRows(cached.value, fresh) : fresh;
      this.writeCachedValue(cacheKey, merged);
      return merged;
    } catch (error) {
      if (cached?.value !== undefined) {
        return cached.value;
      }
      throw error;
    }
  },
  async listProposalCatalogItems() {
    return this.postAuthenticatedCached('proposal_catalog', 'list', {
      sheetName: CONFIG.PROPOSAL_CATALOG_SHEET_NAME
    });
  },
  async getProposalCatalogItem(catalogItemId) {
    return this.postAuthenticated('proposal_catalog', 'get', {
      catalog_item_id: catalogItemId,
      sheetName: CONFIG.PROPOSAL_CATALOG_SHEET_NAME
    });
  },
  async createProposalCatalogItem(item) {
    return this.postAuthenticated('proposal_catalog', 'create', {
      item,
      sheetName: CONFIG.PROPOSAL_CATALOG_SHEET_NAME
    });
  },
  async updateProposalCatalogItem(catalogItemId, updates) {
    return this.postAuthenticated('proposal_catalog', 'update', {
      catalog_item_id: catalogItemId,
      updates,
      sheetName: CONFIG.PROPOSAL_CATALOG_SHEET_NAME
    });
  },
  async deleteProposalCatalogItem(catalogItemId) {
    return this.postAuthenticated('proposal_catalog', 'delete', {
      catalog_item_id: catalogItemId,
      sheetName: CONFIG.PROPOSAL_CATALOG_SHEET_NAME
    });
  },
  async listTickets(filters = {}, options = {}) {
    return this.listPagedResource('tickets', filters, options);
  },
  async listCsmActivities(filters = {}, options = {}) {
    return this.listPagedResource('csm', filters, options);
  },
  async listLeads(filters = {}, options = {}) {
    return this.listPagedResource('leads', filters, options);
  },
  async listDeals(filters = {}, options = {}) {
    return this.listPagedResource('deals', filters, options);
  },
  async listProposals(filters = {}, options = {}) {
    return this.listPagedResource('proposals', filters, options);
  },
  async listAgreements(filters = {}, options = {}) {
    return this.listPagedResource('agreements', filters, options);
  },
  async getAgreement(agreementId) {
    return this.postAuthenticated('agreements', 'get', { agreement_id: agreementId });
  },
  async createAgreement(agreement, items = []) {
    this.invalidateResourceCache('agreements', 'list');
    return this.postAuthenticated('agreements', 'create', { agreement, items });
  },
  async updateAgreement(agreementId, updates, items = []) {
    this.invalidateResourceCache('agreements', 'list');
    return this.postAuthenticated('agreements', 'update', {
      agreement_id: agreementId,
      updates,
      items
    });
  },
  async deleteAgreement(agreementId) {
    this.invalidateResourceCache('agreements', 'list');
    return this.postAuthenticated('agreements', 'delete', { agreement_id: agreementId });
  },
  async createAgreementFromProposal(proposalId) {
    return this.postAuthenticated('agreements', 'create_from_proposal', { proposal_id: proposalId });
  },
  async generateAgreementHtml(agreementId) {
    return this.postAuthenticated('agreements', 'generate_agreement_html', {
      agreement_id: agreementId
    });
  },

  async listInvoices(filters = {}) {
    return this.postAuthenticatedCached('invoices', 'list', { filters });
  },
  async getInvoice(invoiceId) {
    return this.postAuthenticated('invoices', 'get', { invoice_id: invoiceId });
  },
  async createInvoice(invoice, items = []) {
    return this.postAuthenticated('invoices', 'create', { invoice, items });
  },
  async updateInvoice(invoiceId, updates = {}, items) {
    const payload = {
      invoice_id: invoiceId,
      updates
    };
    if (items !== undefined) payload.items = items;
    return this.postAuthenticated('invoices', 'update', payload);
  },
  async deleteInvoice(invoiceId) {
    return this.postAuthenticated('invoices', 'delete', { invoice_id: invoiceId });
  },
  async createInvoiceFromAgreement(agreementId) {
    return this.postAuthenticated('invoices', 'create_from_agreement', { agreement_id: agreementId });
  },
  async generateInvoiceHtml(invoiceId) {
    return this.postAuthenticated('invoices', 'generate_invoice_html', { invoice_id: invoiceId });
  },
  async listReceipts(filters = {}) {
    return this.postAuthenticatedCached('receipts', 'list', { filters });
  },
  async getReceipt(receiptId) {
    return this.postAuthenticated('receipts', 'get', { receipt_id: receiptId });
  },
  async createReceipt(receipt, items = []) {
    return this.postAuthenticated('receipts', 'create', { receipt, items });
  },
  async updateReceipt(receiptId, updates = {}, items) {
    const payload = {
      receipt_id: receiptId,
      updates
    };
    if (items !== undefined) payload.items = items;
    return this.postAuthenticated('receipts', 'update', payload);
  },
  async deleteReceipt(receiptId) {
    return this.postAuthenticated('receipts', 'delete', { receipt_id: receiptId });
  },
  async createReceiptFromInvoice(invoiceId) {
    return this.postAuthenticated('receipts', 'create_from_invoice', { invoice_id: invoiceId });
  },
  async previewReceipt(receiptId) {
    return this.postAuthenticated('receipts', 'generate_receipt_html', { receipt_id: receiptId });
  },
  async listClients() {
    return this.postAuthenticatedCached('clients', 'list', {});
  },
  async getClient(clientId) {
    return this.postAuthenticated('clients', 'get', { client_id: clientId });
  },
  async createClient(client) {
    return this.postAuthenticated('clients', 'create', { client });
  },
  async createClientFromPayload(client) {
    return this.postAuthenticated('clients', 'create', { client });
  },
  async updateClient(clientId, updates) {
    return this.postAuthenticated('clients', 'update', {
      client_id: clientId,
      updates
    });
  },
  async deleteClient(clientId) {
    return this.postAuthenticated('clients', 'delete', { client_id: clientId });
  },
  async getClientAnalytics(clientId) {
    return this.postAuthenticated('clients', 'get_analytics', { client_id: clientId });
  },
  async getClientTimeline(clientId) {
    return this.postAuthenticated('clients', 'get_timeline', { client_id: clientId });
  },
  async createProposalFromClient(clientId, payload = {}) {
    return this.postAuthenticated('clients', 'create_proposal', {
      client_id: clientId,
      ...payload
    });
  },
  async createAgreementFromClient(clientId, payload = {}) {
    return this.postAuthenticated('clients', 'create_agreement', {
      client_id: clientId,
      ...payload
    });
  },
  async createInvoiceFromClient(clientId, payload = {}) {
    return this.postAuthenticated('clients', 'create_invoice', {
      client_id: clientId,
      ...payload
    });
  },
  async createFromPreviousAgreement(clientId, agreementId, flow = 'agreement') {
    return this.postAuthenticated('clients', 'create_from_previous_agreement', {
      client_id: clientId,
      agreement_id: agreementId,
      flow
    });
  },
  async listRoles() {
    return this.postAuthenticatedCached('roles', 'list', {
      sheetName: CONFIG.ROLES_SHEET_NAME
    });
  },
  async getRole(roleIdOrKey) {
    return this.postAuthenticated('roles', 'get', {
      role_id: roleIdOrKey,
      role_key: roleIdOrKey,
      sheetName: CONFIG.ROLES_SHEET_NAME
    });
  },
  async createRole(payload = {}) {
    return this.postAuthenticated('roles', 'create', {
      role: payload,
      ...payload,
      sheetName: CONFIG.ROLES_SHEET_NAME
    });
  },
  async updateRole(roleIdOrKey, updates = {}) {
    return this.postAuthenticated('roles', 'update', {
      role_id: roleIdOrKey,
      role_key: roleIdOrKey,
      updates,
      role: { role_key: roleIdOrKey, ...updates },
      sheetName: CONFIG.ROLES_SHEET_NAME
    });
  },
  async deleteRole(roleIdOrKey) {
    return this.postAuthenticated('roles', 'delete', {
      role_id: roleIdOrKey,
      role_key: roleIdOrKey,
      sheetName: CONFIG.ROLES_SHEET_NAME
    });
  },
  async listRolePermissions() {
    return this.postAuthenticatedCached('role_permissions', 'list', {
      sheetName: CONFIG.ROLE_PERMISSIONS_SHEET_NAME
    });
  },
  async getRolePermission(permissionId) {
    return this.postAuthenticated('role_permissions', 'get', {
      permission_id: permissionId,
      sheetName: CONFIG.ROLE_PERMISSIONS_SHEET_NAME
    });
  },
  async createRolePermission(payload = {}) {
    return this.postAuthenticated('role_permissions', 'create', {
      permission: payload,
      ...payload,
      sheetName: CONFIG.ROLE_PERMISSIONS_SHEET_NAME
    });
  },
  async updateRolePermission(permissionId, updates = {}) {
    return this.postAuthenticated('role_permissions', 'update', {
      permission_id: permissionId,
      updates,
      permission: { permission_id: permissionId, ...updates },
      sheetName: CONFIG.ROLE_PERMISSIONS_SHEET_NAME
    });
  },
  async saveRolePermission(payload = {}) {
    return this.postAuthenticated('role_permissions', 'save', {
      permission: payload,
      ...payload,
      sheetName: CONFIG.ROLE_PERMISSIONS_SHEET_NAME
    });
  },
  async deleteRolePermission(permissionId) {
    return this.postAuthenticated('role_permissions', 'delete', {
      permission_id: permissionId,
      sheetName: CONFIG.ROLE_PERMISSIONS_SHEET_NAME
    });
  },

  async listWorkflowRules(filters = {}) {
    return this.postAuthenticatedCached('workflow', 'list', {
      filters,
      sheetName: CONFIG.WORKFLOW_RULES_SHEET_NAME
    });
  },
  async getWorkflowRule(workflowRuleId) {
    return this.postAuthenticated('workflow', 'get', {
      workflow_rule_id: workflowRuleId,
      sheetName: CONFIG.WORKFLOW_RULES_SHEET_NAME
    });
  },
  async saveWorkflowRule(rule = {}) {
    const body = {
      rule,
      ...rule,
      sheetName: CONFIG.WORKFLOW_RULES_SHEET_NAME
    };
    try {
      return await this.postAuthenticated('workflow', 'save_rule', body);
    } catch (error) {
      const message = String(error?.message || '').toLowerCase();
      if (!message || !/proposal/.test(message) || !/required/.test(message)) throw error;
      return this.postAuthenticated('workflow', 'save', body);
    }
  },
  async deleteWorkflowRule(workflowRuleId) {
    const body = {
      workflow_rule_id: workflowRuleId,
      sheetName: CONFIG.WORKFLOW_RULES_SHEET_NAME
    };
    try {
      return await this.postAuthenticated('workflow', 'delete_rule', body);
    } catch (error) {
      const message = String(error?.message || '').toLowerCase();
      if (!message || !/proposal/.test(message) || !/required/.test(message)) throw error;
      return this.postAuthenticated('workflow', 'delete', body);
    }
  },
  async validateWorkflowTransition(payload = {}) {
    const targetResource =
      payload?.target_resource ??
      payload?.targetResource ??
      payload?.workflow_target_resource ??
      payload?.resource_target ??
      payload?.validated_resource ??
      payload?.validatedResource ??
      payload?.resource_name ??
      payload?.resource ??
      '';
    return this.postAuthenticated('workflow', 'validate_transition', {
      ...payload,
      target_resource: targetResource,
      sheetName: CONFIG.WORKFLOW_RULES_SHEET_NAME
    });
  },
  async requestWorkflowApproval(payload = {}) {
    return this.postAuthenticated('workflow', 'request_approval', {
      ...payload,
      sheetName: CONFIG.WORKFLOW_APPROVALS_SHEET_NAME
    });
  },
  async approveWorkflowRequest(payload = {}) {
    return this.postAuthenticated('workflow', 'approve', {
      ...payload,
      sheetName: CONFIG.WORKFLOW_APPROVALS_SHEET_NAME
    });
  },
  async rejectWorkflowRequest(payload = {}) {
    return this.postAuthenticated('workflow', 'reject', {
      ...payload,
      sheetName: CONFIG.WORKFLOW_APPROVALS_SHEET_NAME
    });
  },
  async listPendingWorkflowApprovals(filters = {}) {
    return this.postAuthenticated('workflow', 'list_pending_approvals', {
      filters,
      sheetName: CONFIG.WORKFLOW_APPROVALS_SHEET_NAME
    });
  },
  async listWorkflowAudit(filters = {}) {
    return this.postAuthenticated('workflow', 'list_audit', {
      filters,
      sheetName: CONFIG.WORKFLOW_AUDIT_LOG_SHEET_NAME
    });
  },
};

async function apiPost(payload = {}) {
  const endpoint = Api.ensureBaseUrl();
  const requestBody = payload && typeof payload === 'object' ? payload : {};
  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
  } catch (error) {
    throw buildNetworkRequestError(endpoint, error);
  }

  const rawText = await response.text();
  const data = parseApiJson(rawText, `Backend ${requestBody.resource || 'api'}`);
  if (!response.ok) {
    throw buildHttpResponseError(response, data, endpoint);
  }
  if (data && typeof data === 'object' && hasExplicitBackendFailure(data)) {
    throw new Error(data.error || data.message || 'Backend rejected request.');
  }
  if (shouldUnwrapDataEnvelope(data)) {
    return data.data;
  }
  return data;
}

function shouldUnwrapDataEnvelope(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  if (!Object.prototype.hasOwnProperty.call(data, 'data') || data.data === undefined) return false;

  // Keep paginated envelopes intact so callers can read `count`, `page_size`,
  // and `total_pages`. Some backends cap page size (e.g., 50 rows), so dropping
  // pagination metadata would prevent the frontend from fetching remaining pages.
  const paginationKeys = ['count', 'total_count', 'page', 'page_size', 'pageSize', 'total_pages'];
  if (paginationKeys.some(key => Object.prototype.hasOwnProperty.call(data, key))) return false;

  return true;
}

function buildNetworkRequestError(url, originalError) {
  const rawMessage = String(originalError?.message || '').trim();
  const looksLikeCorsFailure =
    /failed to fetch|networkerror|load failed|err_failed/i.test(rawMessage);
  if (looksLikeCorsFailure) {
    return new Error(
        `Request to ${url} failed before a response was received. ` +
        'This is commonly caused by CORS (missing Access-Control-Allow-Origin) ' +
        'or an unreachable backend/proxy endpoint.'
    );
  }
  return new Error(rawMessage || `Network error while contacting ${url}.`);
}

function hasExplicitBackendFailure(data) {
  const normalizeBool = value => {
    if (typeof value === 'boolean') return value;
    const normalized = String(value || '')
      .trim()
      .toLowerCase();
    if (['false', '0', 'no', 'n'].includes(normalized)) return false;
    if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
    return null;
  };
  const ok = normalizeBool(data?.ok);
  const success = normalizeBool(data?.success);
  return ok === false || success === false;
}

function buildHttpResponseError(response, data, endpoint) {
  const backendMessage = String(data?.error || data?.message || '').trim();
  if (backendMessage) return new Error(backendMessage);

  const status = Number(response?.status || 0);
  const statusText = String(response?.statusText || '').trim();
  const endpointLabel = String(endpoint || API_BASE_URL || 'backend endpoint');

  if (status === 404) {
    return new Error(
      `HTTP 404 from ${endpointLabel}. Login/auth routes were not found on the configured backend. ` +
      'Verify API_BASE_URL points to a backend/proxy that implements auth.'
    );
  }

  return new Error(
    `HTTP ${status || 'error'}${statusText ? ` ${statusText}` : ''} from ${endpointLabel}.`
  );
}
