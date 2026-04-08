const UserAdmin = {
  state: {
    rows: [],
    loading: false,
    error: ''
  },
  wire() {
    if (E.usersRefreshBtn) {
      E.usersRefreshBtn.addEventListener('click', () => this.refresh(true));
    }
    if (E.userCreateForm) {
      E.userCreateForm.addEventListener('submit', async e => {
        e.preventDefault();
        if (!Permissions.canManageUsers()) {
          UI.toast('Only admin can manage users.');
          return;
        }
        const payload = {
          name: String(E.userCreateName?.value || '').trim(),
          username: String(E.userCreateUsername?.value || '').trim(),
          email: String(E.userCreateEmail?.value || '').trim(),
          role: String(E.userCreateRole?.value || ROLES.VIEWER).trim().toLowerCase(),
          password: String(E.userCreatePassword?.value || '')
        };
        if (!payload.name || !payload.username || !payload.email || !payload.password) {
          UI.toast('Name, username, email, and password are required.');
          return;
        }
        try {
          await Api.postAuthenticated('users', 'create', {
            user: payload,
            ...payload
          });
          if (E.userCreateForm) E.userCreateForm.reset();
          if (E.userCreateRole) E.userCreateRole.value = ROLES.VIEWER;
          UI.toast('User created successfully.');
          await this.refresh();
        } catch (error) {
          this.handleError(error, 'Unable to create user.');
        }
      });
    }
  },
  async refresh(force = false) {
    if (!Permissions.canManageUsers()) return;
    if (this.state.loading && !force) return;
    this.state.loading = true;
    this.state.error = '';
    this.render();
    try {
      const response = await Api.postAuthenticated('users', 'list', {});
      this.state.rows = this.extractRows(response);
      this.state.error = '';
      this.render();
    } catch (error) {
      this.state.rows = [];
      this.state.error = String(error?.message || '').trim() || 'Unable to load users right now.';
      this.render(error);
      this.handleError(error, 'Unable to load users.');
    } finally {
      this.state.loading = false;
      this.render();
    }
  },
  extractRows(response) {
    const candidates = [
      response,
      response?.users,
      response?.items,
      response?.rows,
      response?.data,
      response?.result,
      response?.payload,
      response?.users?.items,
      response?.users?.rows,
      response?.data?.users,
      response?.data?.items,
      response?.data?.rows,
      response?.result?.users,
      response?.payload?.users
    ];

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return candidate;
    }

    const objectCandidates = [
      response?.users,
      response?.data?.users,
      response?.result?.users,
      response?.payload?.users
    ];
    for (const candidate of objectCandidates) {
      if (candidate && typeof candidate === 'object') return Object.values(candidate);
    }

    return [];
  },
  formatDate(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString();
  },
  normalizeActive(user = {}) {
    if (typeof user.active === 'boolean') return user.active;
    if (typeof user.is_active === 'boolean') return user.is_active;
    const status = String(user.status || '').toLowerCase();
    if (status === 'inactive' || status === 'disabled' || status === 'deactivated') return false;
    return true;
  },
  getUserId(user = {}) {
    return String(user.id || user.user_id || user.userId || '').trim();
  },
  getCreatedAt(user = {}) {
    return user.created_at || user.createdAt || user.created || '';
  },
  getUpdatedAt(user = {}) {
    return user.updated_at || user.updatedAt || user.updated || '';
  },
  getLastLoginAt(user = {}) {
    return user.last_login_at || user.lastLoginAt || user.last_login || '';
  },
  render(error = null) {
    if (!E.usersTbody || !E.usersState) return;
    if (this.state.loading) {
      E.usersState.textContent = 'Loading users…';
      E.usersTbody.innerHTML = '';
      return;
    }
    if (error) {
      E.usersState.textContent = this.state.error || 'Unable to load users right now.';
      E.usersTbody.innerHTML = '';
      return;
    }
    if (!this.state.rows.length) {
      E.usersState.textContent = 'No users found.';
      E.usersTbody.innerHTML = '';
      return;
    }

    E.usersState.textContent = `${this.state.rows.length} user(s)`;
    E.usersTbody.innerHTML = this.state.rows
      .map(user => {
        const userId = this.getUserId(user);
        const currentUserId = Session.user().user_id;
        const isSelf = !!userId && userId === currentUserId;
        const active = this.normalizeActive(user);
        const role = String(user.role || '').toLowerCase() === ROLES.ADMIN ? ROLES.ADMIN : ROLES.VIEWER;
        const created = this.formatDate(this.getCreatedAt(user));
        const updated = this.formatDate(this.getUpdatedAt(user));
        const lastLogin = this.formatDate(this.getLastLoginAt(user));
        return `<tr data-user-id="${U.escapeHtml(userId)}">
          <td>${U.escapeHtml(user.name || '—')}</td>
          <td>${U.escapeHtml(user.email || '—')}</td>
          <td>${U.escapeHtml(user.username || '—')}</td>
          <td>${U.escapeHtml(role)}</td>
          <td>${active ? 'true' : 'false'}</td>
          <td>${U.escapeHtml(created)}</td>
          <td>${U.escapeHtml(updated)}</td>
          <td>${U.escapeHtml(lastLogin)}</td>
          <td>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <button class="chip-btn" data-user-action="edit">Edit</button>
              <button class="chip-btn" data-user-action="reset">Reset pwd</button>
              <button class="chip-btn" data-user-action="toggle">${active ? 'Deactivate' : 'Activate'}</button>
              ${isSelf ? '<span class="muted" style="font-size:11px;">(You)</span>' : ''}
            </div>
          </td>
        </tr>`;
      })
      .join('');

    E.usersTbody.querySelectorAll('[data-user-action]').forEach(btn => {
      btn.addEventListener('click', async event => {
        const action = event.currentTarget.getAttribute('data-user-action');
        const rowEl = event.currentTarget.closest('tr');
        const userId = String(rowEl?.getAttribute('data-user-id') || '').trim();
        const user = this.state.rows.find(r => this.getUserId(r) === userId);
        if (!user || !userId) return;
        if (action === 'edit') await this.editUser(user);
        if (action === 'reset') await this.resetPassword(user);
        if (action === 'toggle') await this.toggleUserStatus(user);
      });
    });
  },
  async editUser(user) {
    const currentUserId = Session.user().user_id;
    const userId = this.getUserId(user);
    const isSelf = userId === String(currentUserId || '');
    const name = window.prompt('Name', String(user.name || ''));
    if (name == null) return;
    const email = window.prompt('Email', String(user.email || ''));
    if (email == null) return;
    const username = window.prompt('Username', String(user.username || ''));
    if (username == null) return;
    const role = window.prompt('Role (admin/viewer)', String(user.role || ROLES.VIEWER));
    if (role == null) return;
    const normalizedRole = String(role).trim().toLowerCase() === ROLES.ADMIN ? ROLES.ADMIN : ROLES.VIEWER;
    if (isSelf && normalizedRole !== ROLES.ADMIN) {
      const allow = window.confirm('You are editing your own account. Changing your role may end admin access. Continue?');
      if (!allow) return;
    }
    try {
      await Api.postAuthenticated('users', 'update', {
        user_id: userId,
        id: userId,
        updates: {
          name: String(name).trim(),
          email: String(email).trim(),
          username: String(username).trim(),
          role: normalizedRole
        },
        user: {
          id: userId,
          user_id: userId,
          name: String(name).trim(),
          email: String(email).trim(),
          username: String(username).trim(),
          role: normalizedRole
        }
      });
      UI.toast('User updated.');
      await this.refresh();
    } catch (error) {
      this.handleError(error, 'Unable to update user.');
    }
  },
  async toggleUserStatus(user) {
    const currentUserId = Session.user().user_id;
    const userId = this.getUserId(user);
    const isSelf = userId === String(currentUserId || '');
    const active = this.normalizeActive(user);
    if (isSelf && active) {
      UI.toast('You cannot deactivate your own active session from this screen.');
      return;
    }
    const confirmed = window.confirm(`${active ? 'Deactivate' : 'Activate'} user ${user.username || user.email || userId}?`);
    if (!confirmed) return;
    try {
      await Api.postAuthenticated('users', active ? 'deactivate' : 'activate', {
        user_id: userId,
        id: userId
      });
      UI.toast(`User ${active ? 'deactivated' : 'activated'}.`);
      await this.refresh();
    } catch (error) {
      this.handleError(error, 'Unable to update user status.');
    }
  },
  async resetPassword(user) {
    const newPassword = window.prompt(`Enter a new password for ${user.username || user.email}`);
    if (!newPassword) return;
    if (String(newPassword).length < 8) {
      UI.toast('Password should be at least 8 characters.');
      return;
    }
    const confirmed = window.confirm('Reset password now?');
    if (!confirmed) return;
    try {
      await Api.postAuthenticated('users', 'reset_password', {
        user_id: this.getUserId(user),
        id: this.getUserId(user),
        newPassword,
        password: newPassword,
        passcode: newPassword
      });
      UI.toast('Password reset successfully.');
    } catch (error) {
      this.handleError(error, 'Unable to reset password.');
    }
  },
  handleError(error, fallbackMessage) {
    if (isAuthError(error)) {
      handleExpiredSession('Session expired. Please log in again.');
      return;
    }
    const message = String(error?.message || '').trim();
    if (/forbidden|permission|admin/i.test(message)) {
      UI.toast('Forbidden: admin access is required.');
      return;
    }
    UI.toast(message || fallbackMessage);
  }
};

window.UserAdmin = UserAdmin;
