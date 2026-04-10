const RolesAdmin = {
  tabPermissionResources: {
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
    roles: [],
    permissions: [],
    loadingRoles: false,
    loadingPermissions: false
  },
  wire() {
    if (E.rolesRefreshBtn) E.rolesRefreshBtn.addEventListener('click', () => this.refreshRoles(true));
    if (E.rolePermissionsRefreshBtn) {
      E.rolePermissionsRefreshBtn.addEventListener('click', () => this.refreshPermissions(true));
    }
    if (E.roleCreateForm) {
      E.roleCreateForm.addEventListener('submit', async e => {
        e.preventDefault();
        if (!Permissions.canManageRolesPermissions()) return UI.toast('Forbidden.');
        const payload = {
          role_key: String(E.roleCreateKey?.value || '').trim().toLowerCase(),
          display_name: String(E.roleCreateDisplayName?.value || '').trim(),
          description: String(E.roleCreateDescription?.value || '').trim(),
          is_active: String(E.roleCreateIsActive?.value || 'true') !== 'false'
        };
        if (!payload.role_key || !payload.display_name) return UI.toast('role_key and display name are required.');
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
          allowed_roles_csv: String(E.rolePermissionCreateAllowedRoles?.value || '').trim().toLowerCase(),
          description: String(E.rolePermissionCreateDescription?.value || '').trim()
        };
        if (!payload.resource || !payload.action || !payload.allowed_roles_csv) {
          return UI.toast('resource, action, and allowed roles are required.');
        }
        try {
          await Api.saveRolePermission(payload);
          UI.toast('Permission rule saved.');
          E.rolePermissionCreateForm.reset();
          await this.refreshPermissions(true);
          await Permissions.loadMatrix(true);
          UI.applyRolePermissions();
        } catch (error) {
          UI.toast(String(error?.message || 'Unable to create permission rule.'));
        }
      });
    }
    if (E.tabPermissionBulkForm) {
      E.tabPermissionBulkForm.addEventListener('submit', async e => {
        e.preventDefault();
        if (!Permissions.canManageRolesPermissions()) return UI.toast('Forbidden.');
        await this.applyBulkTabPermissions();
      });
    }
  },
  extractRows(response) {
    const parseJsonIfNeeded = value => {
      if (typeof value !== 'string') return value;
      const trimmed = value.trim();
      if (!trimmed) return value;
      if (!(trimmed.startsWith('[') || trimmed.startsWith('{'))) return value;
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
      if (objectValues.length && objectValues.every(item => item && typeof item === 'object')) {
        const hasRuleLikeShape = objectValues.some(
          item => 'resource' in item || 'action' in item || 'allowed_roles' in item || 'allowed_roles_csv' in item
        );
        if (hasRuleLikeShape) return objectValues;
      }
      return [];
    };
    const payload = parseJsonIfNeeded(response);
    const candidates = [
      payload,
      payload?.items,
      payload?.rows,
      payload?.permissions,
      payload?.values,
      payload?.data,
      payload?.result,
      payload?.payload,
      payload?.data?.items,
      payload?.data?.rows,
      payload?.data?.permissions,
      payload?.result?.items,
      payload?.result?.rows,
      payload?.result?.permissions
    ];
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
    } catch (error) {
      this.state.roles = [];
      this.renderRolesTable(String(error?.message || 'Unable to load roles.'));
      this.renderRoleSelects();
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
  roleKey(role = {}) {
    return String(role.role_key || role.key || role.role || '').trim().toLowerCase();
  },
  displayName(role = {}) {
    return String(role.display_name || role.name || this.roleKey(role) || '').trim();
  },
  renderRoleSelects() {
    if (window.UserAdmin?.applyRoleOptions) {
      window.UserAdmin.applyRoleOptions(this.state.roles);
    }
    if (E.tabPermissionRole) {
      const current = String(E.tabPermissionRole.value || '').trim().toLowerCase();
      E.tabPermissionRole.innerHTML = [
        '<option value="">Select role *</option>',
        ...this.state.roles.map(role => {
          const key = this.roleKey(role);
          const name = this.displayName(role);
          return `<option value="${U.escapeAttr(key)}">${U.escapeHtml(name || key || '—')}</option>`;
        })
      ].join('');
      if (current) E.tabPermissionRole.value = current;
    }
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
        const isSystem = role.is_system === true;
        const isActive = role.is_active !== false;
        return `<tr data-role-key="${U.escapeAttr(key)}">
          <td>${U.escapeHtml(key || '—')}</td>
          <td>${U.escapeHtml(this.displayName(role) || '—')}</td>
          <td>${U.escapeHtml(role.description || '—')}</td>
          <td>${isSystem ? 'true' : 'false'}</td>
          <td>${isActive ? 'true' : 'false'}</td>
          <td>${U.escapeHtml(this.formatDate(role.updated_at))}</td>
          <td>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <button class="chip-btn" data-role-action="edit">Edit</button>
              ${isSystem ? '' : '<button class="chip-btn" data-role-action="delete">Delete</button>'}
            </div>
          </td>
        </tr>`;
      })
      .join('');
    E.rolesTbody.querySelectorAll('[data-role-action]').forEach(btn => {
      btn.addEventListener('click', async event => {
        const action = String(event.currentTarget.getAttribute('data-role-action') || '');
        const rowEl = event.currentTarget.closest('tr');
        const roleKey = String(rowEl?.getAttribute('data-role-key') || '');
        const role = this.state.roles.find(r => this.roleKey(r) === roleKey);
        if (!role || !roleKey) return;
        if (action === 'edit') await this.editRole(role);
        if (action === 'delete') await this.deleteRole(role);
      });
    });
  },
  async editRole(role) {
    const roleKey = this.roleKey(role);
    const displayName = window.prompt('Display name', this.displayName(role));
    if (displayName == null) return;
    const description = window.prompt('Description', String(role.description || ''));
    if (description == null) return;
    const isActive = window.confirm('Mark role as active? Click Cancel for inactive.');
    try {
      await Api.updateRole(roleKey, {
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
    const roleKey = this.roleKey(role);
    if (!window.confirm(`Delete role "${roleKey}"?`)) return;
    try {
      await Api.deleteRole(roleKey);
      UI.toast('Role deleted.');
      await this.refreshRoles(true);
      await this.refreshPermissions(true);
      await Permissions.loadMatrix(true);
      UI.applyRolePermissions();
    } catch (error) {
      UI.toast(String(error?.message || 'Unable to delete role.'));
    }
  },
  normalizeAllowedRoles(permission = {}) {
    if (Array.isArray(permission.allowed_roles)) return permission.allowed_roles.join(',');
    return String(permission.allowed_roles_csv || '');
  },
  permissionId(permission = {}) {
    return String(permission.permission_id || permission.id || '').trim();
  },
  renderPermissionsTable(error = '') {
    if (!E.rolePermissionsTbody || !E.rolePermissionsState) return;
    if (error) {
      E.rolePermissionsState.textContent = error;
      E.rolePermissionsTbody.innerHTML = '';
      return;
    }
    if (!this.state.permissions.length) {
      E.rolePermissionsState.textContent = 'No permission rules found.';
      E.rolePermissionsTbody.innerHTML = '';
      return;
    }
    E.rolePermissionsState.textContent = `${this.state.permissions.length} permission rule(s)`;
    E.rolePermissionsTbody.innerHTML = this.state.permissions
      .map(permission => {
        const permissionId = this.permissionId(permission);
        return `<tr data-permission-id="${U.escapeAttr(permissionId)}">
          <td>${U.escapeHtml(permission.resource || '—')}</td>
          <td>${U.escapeHtml(permission.action || '—')}</td>
          <td><input class="input sm" data-permission-field="roles" type="text" value="${U.escapeAttr(this.normalizeAllowedRoles(permission))}" /></td>
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
    const rolesCsv = String(
      rowEl?.querySelector('[data-permission-field="roles"]')?.value || this.normalizeAllowedRoles(permission)
    )
      .trim()
      .toLowerCase();
    const description = String(
      rowEl?.querySelector('[data-permission-field="description"]')?.value || permission.description || ''
    ).trim();
    if (!rolesCsv) return UI.toast('allowed roles cannot be empty.');
    const payload = {
      permission_id: this.permissionId(permission),
      resource: String(permission.resource || '').trim().toLowerCase(),
      action: String(permission.action || '').trim().toLowerCase(),
      allowed_roles_csv: rolesCsv,
      description
    };
    try {
      await Api.saveRolePermission(payload);
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
  },
  selectedCrudActions() {
    const entries = [
      ['view', E.tabPermissionActionView],
      ['create', E.tabPermissionActionCreate],
      ['edit', E.tabPermissionActionEdit],
      ['delete', E.tabPermissionActionDelete]
    ];
    return entries.filter(([, input]) => Boolean(input?.checked)).map(([name]) => name);
  },
  resolveBulkTabKeys(target) {
    const normalized = String(target || '').trim();
    if (normalized === 'all_tabs') return Object.keys(this.tabPermissionResources);
    if (this.tabPermissionResources[normalized]) return [normalized];
    return [];
  },
  async applyBulkTabPermissions() {
    const roleKey = String(E.tabPermissionRole?.value || '')
      .trim()
      .toLowerCase();
    const target = String(E.tabPermissionTarget?.value || '').trim();
    const selectedActions = this.selectedCrudActions();
    const tabKeys = this.resolveBulkTabKeys(target);

    if (!roleKey) return UI.toast('Please choose a role.');
    if (!tabKeys.length) return UI.toast('Please choose a valid tab target.');
    if (!selectedActions.length) return UI.toast('Select at least one action.');

    const existingByRule = new Map();
    this.state.permissions.forEach(permission => {
      const resource = String(permission.resource || '').trim().toLowerCase();
      const action = String(permission.action || '').trim().toLowerCase();
      if (resource && action) existingByRule.set(`${resource}:${action}`, permission);
    });

    const requests = [];
    tabKeys.forEach(tabKey => {
      const resource = this.tabPermissionResources[tabKey];
      selectedActions.forEach(action => {
        const existing = existingByRule.get(`${resource}:${action}`);
        const roles = new Set(
          this.normalizeAllowedRoles(existing)
            .split(',')
            .map(v => String(v || '').trim().toLowerCase())
            .filter(Boolean)
        );
        roles.add(roleKey);
        requests.push(
          Api.saveRolePermission({
            permission_id: this.permissionId(existing),
            resource,
            action,
            allowed_roles_csv: [...roles].join(','),
            description: String(existing?.description || '').trim() || `${tabKey} ${action} access`
          })
        );
      });
    });

    try {
      await Promise.all(requests);
      UI.toast(`Applied ${selectedActions.join('/')} permissions to ${tabKeys.length} tab(s).`);
      await this.refreshPermissions(true);
      await Permissions.loadMatrix(true);
      UI.applyRolePermissions();
    } catch (error) {
      UI.toast(String(error?.message || 'Unable to apply tab permissions.'));
    }
  }
};

window.RolesAdmin = RolesAdmin;
