const Permissions = {
  isAdmin() {
    return Session.role() === ROLES.ADMIN;
  },
  isHoo() {
    return Session.role() === ROLES.HOO;
  },
  canCreateTicket() {
    return Session.isAuthenticated();
  },
  canManageCsmActivity() {
    return this.isAdmin() || this.isHoo();
  },
  canCreateCrm() {
    return Session.isAuthenticated();
  },
  canManageCrm() {
    return this.isAdmin() || this.isHoo();
  },
  canEditTicket() {
    return this.isAdmin();
  },
  canManageEvents() {
    return this.isAdmin();
  },
  canManageUsers() {
    return this.isAdmin();
  },
  canChangePlanner() {
    return this.isAdmin();
  },
  canManageFreezeWindows() {
    return this.isAdmin();
  },
  canUseInternalIssueFilters() {
    return this.isAdmin();
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
