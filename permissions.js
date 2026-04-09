const Permissions = {
  isAdmin() {
    return Session.role() === ROLES.ADMIN;
  },
  isDev() {
    return Session.role() === ROLES.DEV;
  },
  isHoo() {
    return Session.role() === ROLES.HOO;
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
    return Session.isAuthenticated() && !this.isDev();
  },
  canManageCsmActivity() {
    return this.isAdmin() || this.isHoo();
  },
  canEditTicket() {
    return this.isAdminLike();
  },
  canEditDeleteLead() {
    return this.isAdminLike();
  },
  canManageEvents() {
    return this.isAdminLike();
  },
  canManageUsers() {
    return this.isAdmin();
  },
  canChangePlanner() {
    return this.isAdminLike();
  },
  canManageFreezeWindows() {
    return this.isAdminLike();
  },
  canUseInternalIssueFilters() {
    return this.isAdminLike();
  }
};

function requirePermission(check, message) {
  if (check()) return true;
  UI.toast(message || 'You do not have permission for this action.');
  return false;
}

async function handleExpiredSession(message = 'Session expired. Please log in again.') {
  Session.clearClientSession();
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
