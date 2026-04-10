const RolesAdmin = {
  state: {
    roles: [],
    permissions: [],
    filteredPermissions: [],
    filters: { resource: '', action: '', allowedRoles: '', resourceExact: '' },
    loadingRoles: false,
    loadingPermissions: false
  },
  wire() {
    if (E.rolesRefreshBtn) E.rolesRefreshBtn.addEventListener('click', () => this.refreshRoles(true));
    if (E.rolePermissionsRefreshBtn) {
      E.rolePermissionsRefreshBtn.addEventListener('click', () => this.refreshPermissions(true));
    }
    if (E.rolePermissionsFiltersForm) {
      E.rolePermissionsFiltersForm.addEventListener('input', () => {
        this.state.filters.resource = String(E.rolePermissionsSearchResource?.value || '').trim().toLowerCase();
        this.state.filters.action = String(E.rolePermissionsSearchAction?.value || '').trim().toLowerCase();
        this.state.filters.allowedRoles = String(E.rolePermissionsSearchAllowedRoles?.value || '').trim().toLowerCase();
        this.state.filters.resourceExact = String(E.rolePermissionsResourceFilter?.value || '').trim().toLowerCase();
        this.renderPermissionsTable();
      });
    }
    if (E.roleCreateForm) {
      E.roleCreateForm.addEventListener('submit', async e => {
        e.preventDefault();
        if (!Permissions.canManageRolesPermissions()) return UI.toast('Forbidden.');
        const roleKey = this.normalizeRoleKey(E.roleCreateKey?.value);
        const payload = {
          role_key: roleKey,
          display_name: String(E.roleCreateDisplayName?.value || '').trim(),
          description: String(E.roleCreateDescription?.value || '').trim(),
          is_active: String(E.roleCreateIsActive?.value || 'true') !== 'false'
        };
        if (!payload.role_key) return UI.toast('role_key is required.');
        try {
          await Api.createRole(payload);
          UI.toast('Role created.');
          E.roleCreateForm.reset();
          await this.refreshRoles(true);
          await this.refreshPermissions(true);
          await Permissions.loadMatrix(true);
        } catch (error) {
          UI.toast(String(error?.message || 'Unable to create role.'));
        }
      });
    }
    if (E.rolePermissionCreateForm) {
      E.rolePermissionCreateForm.addEventListener('submit', async e => {
        e.preventDefault();
        if (!Permissions.canManageRolesPermissions()) return UI.toast('Forbidden.');
        const payload = {
          resource: String(E.rolePermissionCreateResource?.value || '').trim().toLowerCase(),
          action: String(E.rolePermissionCreateAction?.value || '').trim().toLowerCase(),
          allowed_roles: this.normalizeAllowedRoles(E.rolePermissionCreateAllowedRoles?.value),
          description: String(E.rolePermissionCreateDescription?.value || '').trim()
        };
        if (!payload.resource || !payload.action || !payload.allowed_roles.length) {
          return UI.toast('resource, action, and allowed roles are required.');
        }
        try {
          await Api.createRolePermission({
            ...payload,
            allowed_roles_csv: this.stringifyAllowedRoles(payload.allowed_roles)
          });
          UI.toast('Permission rule created.');
          E.rolePermissionCreateForm.reset();
          await this.refreshPermissions(true);
          await Permissions.loadMatrix(true);
          UI.applyRolePermissions();
        } catch (error) {
          UI.toast(String(error?.message || 'Unable to create permission rule.'));
        }
      });
    }
  },
  normalizeRoleKey(value) {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_\-\s]/g, '').replace(/\s+/g, '_');
  },
  normalizeAllowedRoles(value) {
    const source = Array.isArray(value)
      ? value
      : String(value || '')
          .split(',')
          .map(v => String(v || '').trim());
    return [...new Set(source.map(v => this.normalizeRoleKey(v)).filter(Boolean))];
  },
  stringifyAllowedRoles(value) {
    return this.normalizeAllowedRoles(value).join(',');
  },
  extractRows(response) {
    const parseJsonIfNeeded = value => {
      if (typeof value !== 'string') return value;
      const trimmed = value.trim();
      if (!trimmed || !(trimmed.startsWith('[') || trimmed.startsWith('{'))) return value;
      try {
        return JSON.parse(trimmed);
      } catch (_error) {
        return value;
      }
    };
    const coerceRows = value => {
      const parsed = parseJsonIfNeeded(value);
      if (Array.isArray(parsed)) return parsed;
      if (!parsed || typeof parsed !== 'object') return [];
      const objectValues = Object.values(parsed).filter(Boolean);
      if (objectValues.length && objectValues.every(item => item && typeof item === 'object')) return objectValues;
      return [];
    };
    const payload = parseJsonIfNeeded(response);
    const candidates = [payload, payload?.items, payload?.rows, payload?.permissions, payload?.roles, payload?.values, payload?.data, payload?.result, payload?.payload, payload?.data?.items, payload?.data?.rows, payload?.data?.permissions, payload?.data?.roles];
    for (const candidate of candidates) {
      const rows = coerceRows(candidate);
      if (rows.length) return rows;
    }
    return [];
  },
  async ensureRolesLoaded(force = false) {
    if (!Session.isAuthenticated()) {
      this.state.roles = [];
      this.renderRoleSelects();
      return [];
    }
    if (this.state.roles.length && !force) return this.state.roles;
    await this.refreshRoles(force);
    return this.state.roles;
  },
  async loadAll(force = false) {
    if (!Permissions.canManageRolesPermissions()) return;
    await Promise.all([this.refreshRoles(force), this.refreshPermissions(force)]);
  },
  async refreshRoles(force = false) {
    if (this.state.loadingRoles && !force) return;
    this.state.loadingRoles = true;
    if (E.rolesState) E.rolesState.textContent = 'Loading roles…';
    try {
      const response = await Api.listRoles();
      this.state.roles = this.extractRows(response);
      this.renderRolesTable();
      this.renderRoleSelects();
      this.renderRolesWidgets();
    } catch (error) {
      this.state.roles = [];
      this.renderRolesTable(String(error?.message || 'Unable to load roles.'));
      this.renderRoleSelects();
      this.renderRolesWidgets();
    } finally {
      this.state.loadingRoles = false;
    }
  },
  async refreshPermissions(force = false) {
    if (this.state.loadingPermissions && !force) return;
    this.state.loadingPermissions = true;
    if (E.rolePermissionsState) E.rolePermissionsState.textContent = 'Loading permission matrix…';
    try {
      const response = await Api.listRolePermissions();
      this.state.permissions = this.extractRows(response);
      this.renderPermissionsTable();
    } catch (error) {
      this.state.permissions = [];
      this.renderPermissionsTable(String(error?.message || 'Unable to load permission matrix.'));
    } finally {
      this.state.loadingPermissions = false;
    }
  },
  formatDate(value) {
    const d = new Date(value || '');
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
  },
  roleId(role = {}) {
    return String(role.role_id || role.id || '').trim();
  },
  roleKey(role = {}) {
    return this.normalizeRoleKey(role.role_key || role.key || role.role);
  },
  displayName(role = {}) {
    return String(role.display_name || role.name || this.roleKey(role) || '').trim();
  },
  roleRef(role = {}) {
    return this.roleId(role) || this.roleKey(role);
  },
  renderRoleSelects() {
    if (window.UserAdmin?.applyRoleOptions) {
      window.UserAdmin.applyRoleOptions(this.state.roles);
    }
  },
  renderRolesWidgets() {
    const total = this.state.roles.length;
    const active = this.state.roles.filter(role => role?.is_active !== false).length;
    const inactive = Math.max(0, total - active);
    if (E.rolesTotalCount) E.rolesTotalCount.textContent = String(total);
    if (E.rolesActiveCount) E.rolesActiveCount.textContent = String(active);
    if (E.rolesInactiveCount) E.rolesInactiveCount.textContent = String(inactive);
  },
  renderRolesTable(error = '') {
    if (!E.rolesTbody || !E.rolesState) return;
    if (error) {
      E.rolesState.textContent = error;
      E.rolesTbody.innerHTML = '';
      return;
    }
    if (!this.state.roles.length) {
      E.rolesState.textContent = 'No roles found.';
      E.rolesTbody.innerHTML = '';
      return;
    }
    E.rolesState.textContent = `${this.state.roles.length} role(s)`;
    E.rolesTbody.innerHTML = this.state.roles
      .map(role => {
        const key = this.roleKey(role);
        const roleId = this.roleId(role);
        const isActive = role.is_active !== false;
        return `<tr data-role-ref="${U.escapeAttr(this.roleRef(role))}">
          <td>${U.escapeHtml(roleId || '—')}</td>
          <td>${U.escapeHtml(key || '—')}</td>
          <td>${U.escapeHtml(this.displayName(role) || '—')}</td>
          <td>${U.escapeHtml(role.description || '—')}</td>
          <td>${isActive ? 'true' : 'false'}</td>
          <td>${U.escapeHtml(this.formatDate(role.updated_at))}</td>
          <td>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <button class="chip-btn" data-role-action="edit">Edit</button>
              <button class="chip-btn" data-role-action="delete">Delete</button>
            </div>
          </td>
        </tr>`;
      })
      .join('');
    E.rolesTbody.querySelectorAll('[data-role-action]').forEach(btn => {
      btn.addEventListener('click', async event => {
        const action = String(event.currentTarget.getAttribute('data-role-action') || '');
        const rowEl = event.currentTarget.closest('tr');
        const roleRef = String(rowEl?.getAttribute('data-role-ref') || '');
        const role = this.state.roles.find(r => this.roleRef(r) === roleRef);
        if (!role || !roleRef) return;
        if (action === 'edit') await this.editRole(role);
        if (action === 'delete') await this.deleteRole(role);
      });
    });
  },
  async editRole(role) {
    const roleRef = this.roleRef(role);
    const displayName = window.prompt('Display name', this.displayName(role));
    if (displayName == null) return;
    const description = window.prompt('Description', String(role.description || ''));
    if (description == null) return;
    const isActive = window.confirm('Mark role as active? Click Cancel for inactive.');
    try {
      await Api.updateRole(roleRef, {
        display_name: String(displayName).trim(),
        description: String(description).trim(),
        is_active: isActive
      });
      UI.toast('Role updated.');
      await this.refreshRoles(true);
    } catch (error) {
      UI.toast(String(error?.message || 'Unable to update role.'));
    }
  },
  async deleteRole(role) {
    const roleRef = this.roleRef(role);
    const roleLabel = this.roleKey(role) || roleRef;
    if (!window.confirm(`Delete role "${roleLabel}"?`)) return;
    try {
      await Api.deleteRole(roleRef);
      UI.toast('Role deleted.');
      await this.refreshRoles(true);
      await this.refreshPermissions(true);
      await Permissions.loadMatrix(true);
      UI.applyRolePermissions();
    } catch (error) {
      UI.toast(String(error?.message || 'Unable to delete role.'));
    }
  },
  permissionId(permission = {}) {
    return String(permission.permission_id || permission.id || '').trim();
  },
  permissionAllowedRoles(permission = {}) {
    return this.normalizeAllowedRoles(permission.allowed_roles || permission.allowed_roles_csv || permission.allowedRoles);
  },
  filteredPermissionRows() {
    const filters = this.state.filters;
    return this.state.permissions.filter(permission => {
      const resource = String(permission.resource || '').trim().toLowerCase();
      const action = String(permission.action || '').trim().toLowerCase();
      const allowedRoles = this.stringifyAllowedRoles(this.permissionAllowedRoles(permission));
      if (filters.resource && !resource.includes(filters.resource)) return false;
      if (filters.action && !action.includes(filters.action)) return false;
      if (filters.allowedRoles && !allowedRoles.includes(filters.allowedRoles)) return false;
      if (filters.resourceExact && resource !== filters.resourceExact) return false;
      return true;
    });
  },
  renderPermissionsTable(error = '') {
    if (!E.rolePermissionsTbody || !E.rolePermissionsState) return;
    if (error) {
      E.rolePermissionsState.textContent = error;
      E.rolePermissionsTbody.innerHTML = '';
      return;
    }
    const rows = this.filteredPermissionRows();
    this.state.filteredPermissions = rows;
    if (!rows.length) {
      E.rolePermissionsState.textContent = this.state.permissions.length ? 'No permission rows match current filters.' : 'No permission rules found.';
      E.rolePermissionsTbody.innerHTML = '';
      return;
    }
    E.rolePermissionsState.textContent = `${rows.length} permission rule(s)`;
    E.rolePermissionsTbody.innerHTML = rows
      .map(permission => {
        const permissionId = this.permissionId(permission);
        return `<tr data-permission-id="${U.escapeAttr(permissionId)}">
          <td>${U.escapeHtml(permissionId || '—')}</td>
          <td>${U.escapeHtml(permission.resource || '—')}</td>
          <td>${U.escapeHtml(permission.action || '—')}</td>
          <td>
            <input class="input sm" data-permission-field="roles" type="text" value="${U.escapeAttr(this.stringifyAllowedRoles(this.permissionAllowedRoles(permission)))}" />
          </td>
          <td><input class="input sm" data-permission-field="description" type="text" value="${U.escapeAttr(permission.description || '')}" /></td>
          <td>${U.escapeHtml(this.formatDate(permission.updated_at))}</td>
          <td>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <button class="chip-btn" data-permission-action="save">Save</button>
              <button class="chip-btn" data-permission-action="delete">Delete</button>
            </div>
          </td>
        </tr>`;
      })
      .join('');
    E.rolePermissionsTbody.querySelectorAll('[data-permission-action]').forEach(btn => {
      btn.addEventListener('click', async event => {
        const action = String(event.currentTarget.getAttribute('data-permission-action') || '');
        const rowEl = event.currentTarget.closest('tr');
        const permissionId = String(rowEl?.getAttribute('data-permission-id') || '');
        const permission = this.state.permissions.find(r => this.permissionId(r) === permissionId);
        if (!permission) return;
        if (action === 'save') await this.savePermissionRow(permission, rowEl);
        if (action === 'delete') await this.deletePermissionRow(permission);
      });
    });
  },
  async savePermissionRow(permission, rowEl) {
    const allowedRoles = this.normalizeAllowedRoles(
      rowEl?.querySelector('[data-permission-field="roles"]')?.value || this.permissionAllowedRoles(permission)
    );
    const description = String(rowEl?.querySelector('[data-permission-field="description"]')?.value || permission.description || '').trim();
    if (!allowedRoles.length) return UI.toast('allowed roles cannot be empty.');
    const permissionId = this.permissionId(permission);
    const updates = { allowed_roles: allowedRoles, allowed_roles_csv: this.stringifyAllowedRoles(allowedRoles), description };
    try {
      if (permissionId) await Api.updateRolePermission(permissionId, updates);
      else await Api.saveRolePermission({ ...permission, ...updates });
      UI.toast('Permission row saved.');
      await this.refreshPermissions(true);
      await Permissions.loadMatrix(true);
      UI.applyRolePermissions();
    } catch (error) {
      UI.toast(String(error?.message || 'Unable to save permission row.'));
    }
  },
  async deletePermissionRow(permission) {
    const permissionId = this.permissionId(permission);
    if (!window.confirm(`Delete permission rule ${permission.resource}:${permission.action}?`)) return;
    try {
      await Api.deleteRolePermission(permissionId);
      UI.toast('Permission rule deleted.');
      await this.refreshPermissions(true);
      await Permissions.loadMatrix(true);
      UI.applyRolePermissions();
    } catch (error) {
      UI.toast(String(error?.message || 'Unable to delete permission rule.'));
    }
  }
};

window.RolesAdmin = RolesAdmin;
