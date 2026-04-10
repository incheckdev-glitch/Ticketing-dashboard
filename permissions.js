const Permissions = {
  tabResourceMap: {
    issues: null,
    calendar: 'events',
    insights: 'insights',
    csm: 'csm',
    leads: 'leads',
    deals: 'deals',
    proposals: 'proposals',
    agreements: 'agreements',
    proposalCatalog: 'proposal_catalog',
    users: 'users',
    rolesPermissions: 'roles'
  },
  state: {
    loaded: false,
    loading: false,
    rows: [],
    matrix: new Map()
  },
  normalizeRole(value) {
    return String(value || '')
      .trim()
      .toLowerCase();
  },
  extractRows(response) {
    const candidates = [
      response,
      response?.items,
      response?.rows,
      response?.permissions,
      response?.data,
      response?.result,
      response?.payload,
      response?.data?.items,
      response?.data?.rows
    ];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return candidate;
    }
    return [];
  },
  normalizeAllowedRoles(row = {}) {
    if (Array.isArray(row.allowed_roles)) {
      return row.allowed_roles.map(v => this.normalizeRole(v)).filter(Boolean);
    }
    return String(row.allowed_roles_csv || '')
      .split(',')
      .map(v => this.normalizeRole(v))
      .filter(Boolean);
  },
  async loadMatrix(force = false) {
    if (!Session.isAuthenticated()) {
      this.reset();
      return [];
    }
    if (this.state.loading && !force) return this.state.rows;
    this.state.loading = true;
    try {
      const response = await Api.listRolePermissions();
      const rows = this.extractRows(response);
      const matrix = new Map();
      rows.forEach(row => {
        const resource = String(row.resource || '').trim().toLowerCase();
        const action = String(row.action || '').trim().toLowerCase();
        if (!resource || !action) return;
        matrix.set(`${resource}:${action}`, this.normalizeAllowedRoles(row));
      });
      this.state.rows = rows;
      this.state.matrix = matrix;
      this.state.loaded = true;
      return rows;
    } catch (error) {
      this.state.rows = [];
      this.state.matrix = new Map();
      this.state.loaded = false;
      return [];
    } finally {
      this.state.loading = false;
    }
  },
  reset() {
    this.state.loaded = false;
    this.state.loading = false;
    this.state.rows = [];
    this.state.matrix = new Map();
  },
  can(resource, action, options = {}) {
    const role = this.normalizeRole(Session.role());
    if (!Session.isAuthenticated() || !role) return false;
    const normalizedResource = String(resource || '').trim().toLowerCase();
    const normalizedAction = String(action || '').trim().toLowerCase();
    if (!normalizedResource || !normalizedAction) return false;

    if (role === ROLES.ADMIN && !this.state.loaded) return true;
    const allowed = this.state.matrix.get(`${normalizedResource}:${normalizedAction}`);
    if (Array.isArray(allowed)) return allowed.includes(role);
    if (role === ROLES.ADMIN) return true;
    if (typeof options.fallback === 'boolean') return options.fallback;
    return false;
  },
  isAdmin() {
    return this.normalizeRole(Session.role()) === ROLES.ADMIN;
  },
  isDev() {
    return this.normalizeRole(Session.role()) === ROLES.DEV;
  },
  isHoo() {
    return this.normalizeRole(Session.role()) === ROLES.HOO;
  },
  isAdminLike() {
    return this.isAdmin() || this.isDev();
  },
  canCreateTicket() {
    return Session.isAuthenticated();
  },
  canCreateLead() {
    return Session.isAuthenticated();
  },
  canViewCsmActivity() {
    return this.can('csm', 'view', { fallback: Session.isAuthenticated() && !this.isDev() });
  },
  canManageCsmActivity() {
    return this.can('csm', 'manage', { fallback: this.isAdmin() || this.isHoo() });
  },
  canEditTicket() {
    return this.can('tickets', 'edit', { fallback: this.isAdminLike() });
  },
  canEditDeleteLead() {
    return this.can('leads', 'edit_delete', { fallback: this.isAdminLike() });
  },
  canManageEvents() {
    return this.can('events', 'manage', { fallback: this.isAdminLike() });
  },
  canManageUsers() {
    return this.can('users', 'manage', { fallback: this.isAdmin() });
  },
  canManageRolesPermissions() {
    return (
      this.can('roles', 'manage', { fallback: this.isAdmin() }) ||
      this.can('role_permissions', 'manage', { fallback: this.isAdmin() })
    );
  },
  canChangePlanner() {
    return this.can('planner', 'manage', { fallback: this.isAdminLike() });
  },
  canManageFreezeWindows() {
    return this.can('freeze_windows', 'manage', { fallback: this.isAdminLike() });
  },
  canUseInternalIssueFilters() {
    return this.can('tickets', 'internal_filters', { fallback: this.isAdminLike() });
  },
  canAccessTab(viewKey) {
    const key = String(viewKey || '').trim();
    if (!key) return false;
    if (key === 'issues') return Session.isAuthenticated();
    const resource = this.tabResourceMap[key];
    if (!resource) return Session.isAuthenticated();
    return this.can(resource, 'view', { fallback: Session.isAuthenticated() });
  }
};

function requirePermission(check, message) {
  if (check()) return true;
  UI.toast(message || 'You do not have permission for this action.');
  return false;
}

async function handleExpiredSession(message = 'Session expired. Please log in again.') {
  Session.clearClientSession();
  Permissions.reset();
  UI.applyRolePermissions();
  try {
    const loginIdentifierEl = document.getElementById('loginIdentifier');
    const loginPasscodeEl = document.getElementById('loginPasscode');
    if (loginIdentifierEl) loginIdentifierEl.value = '';
    if (loginPasscodeEl) loginPasscodeEl.value = '';
    const loginSection = document.getElementById('loginSection');
    if (loginSection) window.location.hash = '#loginSection';
    document.body.classList.add('auth-locked');
    const appEl = document.getElementById('app');
    if (appEl) {
      appEl.classList.add('is-locked');
      appEl.setAttribute('aria-hidden', 'true');
    }
  } catch {}
  UI.toast(message);
}
