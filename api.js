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
    if (data && typeof data === 'object' && 'data' in data && data.data !== undefined) {
      return data.data;
    }
    return data;
  },
  async post(resource, action, payload = {}) {
    return apiPost({
      resource,
      action,
      ...payload
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
  async listProposalCatalogItems() {
    return this.postAuthenticated('proposal_catalog', 'list', {
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
  async listAgreements() {
    return this.postAuthenticated('agreements', 'list', {});
  },
  async getAgreement(agreementId) {
    return this.postAuthenticated('agreements', 'get', { agreement_id: agreementId });
  },
  async createAgreement(agreement, items = []) {
    return this.postAuthenticated('agreements', 'create', { agreement, items });
  },
  async updateAgreement(agreementId, updates, items = []) {
    return this.postAuthenticated('agreements', 'update', {
      agreement_id: agreementId,
      updates,
      items
    });
  },
  async deleteAgreement(agreementId) {
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
  async listClients() {
    return this.postAuthenticated('clients', 'list', {});
  },
  async getClient(clientId) {
    return this.postAuthenticated('clients', 'get', { client_id: clientId });
  },
  async createClient(client) {
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
  async listRoles() {
    return this.postAuthenticated('roles', 'list', {});
  },
  async getRole(roleIdOrKey) {
    return this.postAuthenticated('roles', 'get', {
      role_id: roleIdOrKey,
      role_key: roleIdOrKey
    });
  },
  async createRole(payload = {}) {
    return this.postAuthenticated('roles', 'create', {
      role: payload,
      ...payload
    });
  },
  async updateRole(roleIdOrKey, updates = {}) {
    return this.postAuthenticated('roles', 'update', {
      role_id: roleIdOrKey,
      role_key: roleIdOrKey,
      updates,
      role: { role_key: roleIdOrKey, ...updates }
    });
  },
  async deleteRole(roleIdOrKey) {
    return this.postAuthenticated('roles', 'delete', {
      role_id: roleIdOrKey,
      role_key: roleIdOrKey
    });
  },
  async listRolePermissions() {
    return this.postAuthenticated('role_permissions', 'list', {});
  },
  async getRolePermission(permissionId) {
    return this.postAuthenticated('role_permissions', 'get', { permission_id: permissionId });
  },
  async createRolePermission(payload = {}) {
    return this.postAuthenticated('role_permissions', 'create', {
      permission: payload,
      ...payload
    });
  },
  async updateRolePermission(permissionId, updates = {}) {
    return this.postAuthenticated('role_permissions', 'update', {
      permission_id: permissionId,
      updates,
      permission: { permission_id: permissionId, ...updates }
    });
  },
  async saveRolePermission(payload = {}) {
    return this.postAuthenticated('role_permissions', 'save', {
      permission: payload,
      ...payload
    });
  },
  async deleteRolePermission(permissionId) {
    return this.postAuthenticated('role_permissions', 'delete', { permission_id: permissionId });
  }
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
  if (data && typeof data === 'object' && 'data' in data && data.data !== undefined) {
    return data.data;
  }
  return data;
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
