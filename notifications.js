const Notifications = {
  POLL_INTERVAL_MS: 90000,
  state: {
    items: [],
    previewItems: [],
    unreadCount: 0,
    loading: false,
    previewLoading: false,
    filters: {
      mode: 'all',
      search: ''
    },
    lastFetchedAt: '',
    pollTimer: null,
    panelOpen: false
  },
  normalize(item = {}) {
    const source = item && typeof item === 'object' ? item : {};
    const parseMeta = value => {
      if (!value) return {};
      if (typeof value === 'object') return value;
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return {};
        }
      }
      return {};
    };
    const isRead = source.is_read === true || source.is_read === 'true' || source.status === 'read';
    return {
      notification_id: String(source.notification_id || source.id || '').trim(),
      created_at: String(source.created_at || source.createdAt || '').trim(),
      type: String(source.type || '').trim().toLowerCase(),
      title: String(source.title || 'Untitled notification').trim(),
      message: String(source.message || '').trim(),
      resource: String(source.resource || '').trim().toLowerCase(),
      resource_id: String(source.resource_id || '').trim(),
      action_required: !!source.action_required,
      action_label: String(source.action_label || '').trim(),
      priority: String(source.priority || '').trim().toLowerCase(),
      status: String(source.status || '').trim(),
      is_read: isRead,
      read_at: String(source.read_at || '').trim(),
      link_target: String(source.link_target || '').trim(),
      meta: parseMeta(source.meta || source.meta_json)
    };
  },
  extractRows(payload) {
    const candidates = [
      payload,
      payload?.rows,
      payload?.items,
      payload?.notifications,
      payload?.data,
      payload?.result,
      payload?.payload,
      payload?.data?.rows,
      payload?.data?.items,
      payload?.data?.notifications
    ];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return candidate;
    }
    return [];
  },
  formatDate(value) {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '—';
    return U.fmtDisplayDate(value);
  },
  iconForType(type = '') {
    const value = String(type || '').toLowerCase();
    if (value.includes('approval')) return '✅';
    if (value.includes('operation')) return '🧭';
    if (value.includes('ticket')) return '🎫';
    if (value.includes('assign')) return '👤';
    if (value.includes('onboarding')) return '🚀';
    return '🔔';
  },
  isHighPriority(item = {}) {
    return String(item.priority || '').toLowerCase() === 'high';
  },
  isApproval(item = {}) {
    return String(item.type || '').includes('approval');
  },
  isOperations(item = {}) {
    const t = String(item.type || '');
    const r = String(item.resource || '');
    return t.includes('operation') || r.includes('operations_onboarding');
  },
  isTicket(item = {}) {
    const t = String(item.type || '');
    const r = String(item.resource || '');
    return t.includes('ticket') || r.includes('ticket') || r.includes('issues');
  },
  isAssignment(item = {}) {
    const t = String(item.type || '');
    return t.includes('assignment') || t.includes('assigned');
  },
  getFilteredItems() {
    const mode = this.state.filters.mode || 'all';
    const search = String(this.state.filters.search || '').trim().toLowerCase();
    let list = Array.isArray(this.state.items) ? this.state.items.slice() : [];
    if (mode === 'unread') list = list.filter(item => !item.is_read);
    if (mode === 'approvals') list = list.filter(item => this.isApproval(item));
    if (mode === 'operations') list = list.filter(item => this.isOperations(item));
    if (mode === 'tickets') list = list.filter(item => this.isTicket(item));
    if (mode === 'assignments') list = list.filter(item => this.isAssignment(item));
    if (mode === 'high') list = list.filter(item => this.isHighPriority(item));

    if (search) {
      const terms = search.split(/\s+/).filter(Boolean);
      list = list.filter(item => {
        const hay = [
          item.title,
          item.message,
          item.type,
          item.priority,
          item.resource,
          item.resource_id,
          item.action_label
        ]
          .join(' ')
          .toLowerCase();
        return terms.every(term => hay.includes(term));
      });
    }
    return list;
  },
  async refreshUnreadCount() {
    if (!Session.isAuthenticated()) {
      this.state.unreadCount = 0;
      this.renderBell();
      return 0;
    }
    try {
      const count = await Api.getNotificationUnreadCount();
      this.state.unreadCount = Number(count) || 0;
      this.renderBell();
      return this.state.unreadCount;
    } catch (error) {
      console.warn('Unable to refresh notification unread count', error);
      return this.state.unreadCount;
    }
  },
  async fetchPreview(force = false) {
    if (!Session.isAuthenticated()) {
      this.state.previewItems = [];
      this.renderPreview();
      return;
    }
    this.state.previewLoading = true;
    this.renderPreview();
    try {
      const response = await Api.listNotifications({
        limit: 10,
        forceRefresh: force
      });
      const rows = this.extractRows(response).map(item => this.normalize(item));
      this.state.previewItems = rows.slice(0, 10);
    } catch (error) {
      console.warn('Unable to load notification preview', error);
      this.state.previewItems = [];
    } finally {
      this.state.previewLoading = false;
      this.renderPreview();
    }
  },
  async loadHub(force = false) {
    if (!E.notificationsView?.classList.contains('active') && !force) return;
    if (!Session.isAuthenticated()) {
      this.state.items = [];
      this.renderHub();
      return;
    }
    this.state.loading = true;
    this.renderHub();
    try {
      const mode = this.state.filters.mode || 'all';
      const payload = {
        limit: 200,
        unread_only: mode === 'unread',
        search: this.state.filters.search || ''
      };
      if (mode === 'approvals') payload.type = 'approval';
      if (mode === 'operations') payload.type = 'operations';
      if (mode === 'tickets') payload.type = 'ticket';
      if (mode === 'assignments') payload.type = 'assignment';
      if (mode === 'high') payload.priority = 'high';

      const response = await Api.listNotifications(payload);
      this.state.items = this.extractRows(response).map(item => this.normalize(item));
      this.state.lastFetchedAt = new Date().toISOString();
    } catch (error) {
      console.warn('Unable to load notifications hub', error);
      this.state.items = [];
      UI.toast('Unable to load notifications right now.');
    } finally {
      this.state.loading = false;
      this.renderHub();
    }
  },
  async refreshAll(force = false) {
    await this.refreshUnreadCount();
    await this.fetchPreview(force);
    await this.loadHub(force);
  },
  updateLocalRead(notificationId) {
    if (!notificationId) return;
    const update = list => list.map(item => {
      if (item.notification_id !== notificationId) return item;
      return {
        ...item,
        is_read: true,
        status: item.status || 'read',
        read_at: new Date().toISOString()
      };
    });
    this.state.items = update(this.state.items);
    this.state.previewItems = update(this.state.previewItems);
  },
  async markRead(notificationId) {
    if (!notificationId || !Session.isAuthenticated()) return;
    this.updateLocalRead(notificationId);
    this.renderHub();
    this.renderPreview();
    try {
      await Api.markNotificationRead(notificationId);
    } catch (error) {
      console.warn('Unable to mark notification as read', error);
    }
    await this.refreshUnreadCount();
  },
  async markAllRead() {
    if (!Session.isAuthenticated()) return;
    try {
      await Api.markAllNotificationsRead();
      this.state.items = this.state.items.map(item => ({ ...item, is_read: true, status: item.status || 'read' }));
      this.state.previewItems = this.state.previewItems.map(item => ({ ...item, is_read: true, status: item.status || 'read' }));
      this.state.unreadCount = 0;
      this.renderBell();
      this.renderPreview();
      this.renderHub();
      UI.toast('All notifications marked as read.');
    } catch (error) {
      console.warn('Unable to mark all notifications as read', error);
      UI.toast('Unable to mark all notifications as read.');
    }
  },
  async handleNotificationClick(item) {
    if (!item) return;
    if (!item.is_read) await this.markRead(item.notification_id);
    this.navigateFromNotification(item);
  },
  resolveTicketId(item = {}) {
    return String(item.resource_id || item.meta?.ticket_id || item.meta?.id || '').trim();
  },
  resolveAgreementId(item = {}) {
    return String(item.resource_id || item.meta?.agreement_id || item.meta?.id || '').trim();
  },
  resolveOperationsAgreementId(item = {}) {
    return String(item.meta?.agreement_id || item.resource_id || '').trim();
  },
  navigateFromNotification(item = {}) {
    try {
      const linkTarget = String(item.link_target || '').trim();
      if (linkTarget) {
        if (linkTarget.startsWith('http://') || linkTarget.startsWith('https://')) {
          window.open(linkTarget, '_blank', 'noopener,noreferrer');
          return;
        }
        if (linkTarget.startsWith('#')) {
          window.location.hash = linkTarget;
          return;
        }
      }

      const resource = String(item.resource || '').toLowerCase();
      if (resource.includes('ticket') || resource.includes('issues')) {
        setActiveView('issues');
        const ticketId = this.resolveTicketId(item);
        if (ticketId && window.UI?.Modals?.openIssue) {
          UI.Modals.openIssue(ticketId);
        }
        return;
      }
      if (resource.includes('agreement')) {
        setActiveView('agreements');
        const agreementId = this.resolveAgreementId(item);
        if (agreementId && window.Agreements?.openAgreementFormById) {
          Agreements.openAgreementFormById(agreementId, { readOnly: true });
        }
        return;
      }
      if (resource.includes('operations_onboarding')) {
        setActiveView('operationsOnboarding');
        const agreementId = this.resolveOperationsAgreementId(item);
        if (agreementId && window.OperationsOnboarding?.state) {
          OperationsOnboarding.state.search = agreementId;
          if (E.operationsOnboardingSearchInput) E.operationsOnboardingSearchInput.value = agreementId;
        }
        if (window.OperationsOnboarding?.loadAndRefresh) {
          OperationsOnboarding.loadAndRefresh({ force: true });
        }
        return;
      }
      if (resource.includes('workflow') || resource.includes('approval')) {
        if (Permissions.canAccessTab('workflow')) {
          setActiveView('workflow');
        } else {
          setActiveView('notifications');
        }
        return;
      }
      if (resource.includes('proposal')) {
        setActiveView('proposals');
        return;
      }
      if (resource.includes('deal')) {
        setActiveView('deals');
        return;
      }
      if (resource.includes('lead')) {
        setActiveView('leads');
        return;
      }
      if (resource.includes('invoice')) {
        setActiveView('invoices');
        return;
      }
      if (resource.includes('receipt')) {
        setActiveView('receipts');
        return;
      }
      setActiveView('notifications');
      UI.toast('Notification opened, but no direct route was available.');
    } catch (error) {
      console.warn('Notification navigation failed', error);
      UI.toast('Notification opened, but route was unavailable.');
    }
  },
  openPanel() {
    this.state.panelOpen = true;
    if (E.notificationPreviewPanel) E.notificationPreviewPanel.classList.add('open');
    this.fetchPreview();
  },
  closePanel() {
    this.state.panelOpen = false;
    if (E.notificationPreviewPanel) E.notificationPreviewPanel.classList.remove('open');
  },
  renderBell() {
    if (!E.notificationUnreadBadge) return;
    const count = Number(this.state.unreadCount) || 0;
    E.notificationUnreadBadge.textContent = count > 99 ? '99+' : String(count);
    E.notificationUnreadBadge.style.display = count > 0 ? 'inline-flex' : 'none';
    if (E.notificationBellBtn) E.notificationBellBtn.setAttribute('aria-label', `Notifications (${count} unread)`);
  },
  renderPreview() {
    if (!E.notificationPreviewList || !E.notificationPreviewState) return;
    if (this.state.previewLoading) {
      E.notificationPreviewState.textContent = 'Loading notifications…';
      E.notificationPreviewList.innerHTML = '';
      return;
    }
    const list = this.state.previewItems || [];
    if (!list.length) {
      E.notificationPreviewState.textContent = 'No new notifications.';
      E.notificationPreviewList.innerHTML = '';
      return;
    }
    E.notificationPreviewState.textContent = '';
    E.notificationPreviewList.innerHTML = list
      .map(item => {
        const cls = item.is_read ? 'notification-item' : 'notification-item unread';
        return `<button type="button" class="${cls}" data-notification-id="${U.escapeAttr(item.notification_id)}">
          <div class="notification-item-head">
            <span>${this.iconForType(item.type)} ${U.escapeHtml(item.title)}</span>
            <span class="muted">${U.escapeHtml(this.formatDate(item.created_at))}</span>
          </div>
          <div class="notification-item-body">${U.escapeHtml(item.message || '—')}</div>
        </button>`;
      })
      .join('');
    E.notificationPreviewList.querySelectorAll('[data-notification-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-notification-id');
        const item = this.state.previewItems.find(row => row.notification_id === id);
        this.closePanel();
        this.handleNotificationClick(item);
      });
    });
  },
  renderHub() {
    if (!E.notificationsState || !E.notificationsTbody) return;
    if (this.state.loading) {
      E.notificationsState.textContent = 'Loading notifications…';
      E.notificationsTbody.innerHTML = '';
      return;
    }
    const list = this.getFilteredItems();
    const unread = this.state.items.filter(item => !item.is_read);
    const highUnread = unread.filter(item => this.isHighPriority(item)).length;
    const approvalsUnread = unread.filter(item => this.isApproval(item)).length;
    const operationsUnread = unread.filter(item => this.isOperations(item)).length;

    if (E.notificationsSummaryTotalUnread) E.notificationsSummaryTotalUnread.textContent = String(unread.length);
    if (E.notificationsSummaryHighUnread) E.notificationsSummaryHighUnread.textContent = String(highUnread);
    if (E.notificationsSummaryApprovalsUnread) E.notificationsSummaryApprovalsUnread.textContent = String(approvalsUnread);
    if (E.notificationsSummaryOperationsUnread) E.notificationsSummaryOperationsUnread.textContent = String(operationsUnread);

    const lastFetched = this.state.lastFetchedAt ? this.formatDate(this.state.lastFetchedAt) : '—';
    E.notificationsState.textContent = `${list.length} item(s) • Last refreshed: ${lastFetched}`;

    if (!list.length) {
      E.notificationsTbody.innerHTML = '<tr><td colspan="8" class="muted">No notifications found for current filters.</td></tr>';
      return;
    }

    E.notificationsTbody.innerHTML = list
      .map(item => {
        const readLabel = item.is_read ? 'Read' : 'Unread';
        const rowClass = item.is_read ? '' : ' class="notification-row-unread"';
        const priorityClass = this.isHighPriority(item) ? 'chip high-priority' : 'chip';
        return `<tr${rowClass}>
          <td>${this.iconForType(item.type)} ${U.escapeHtml(item.title)}</td>
          <td>${U.escapeHtml(item.message || '—')}</td>
          <td>${U.escapeHtml(item.type || '—')}</td>
          <td><span class="${priorityClass}">${U.escapeHtml(item.priority || 'normal')}</span></td>
          <td>${U.escapeHtml(this.formatDate(item.created_at))}</td>
          <td>${U.escapeHtml(readLabel)}</td>
          <td>${U.escapeHtml(item.action_label || '—')}</td>
          <td>
            <div class="notification-actions">
              ${item.is_read ? '' : `<button type="button" class="btn ghost sm" data-mark-read="${U.escapeAttr(item.notification_id)}">Mark read</button>`}
              <button type="button" class="btn sm" data-open-notification="${U.escapeAttr(item.notification_id)}">Open</button>
            </div>
          </td>
        </tr>`;
      })
      .join('');

    E.notificationsTbody.querySelectorAll('[data-mark-read]').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        const id = btn.getAttribute('data-mark-read');
        await this.markRead(id);
      });
    });
    E.notificationsTbody.querySelectorAll('[data-open-notification]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-open-notification');
        const item = this.state.items.find(row => row.notification_id === id);
        this.handleNotificationClick(item);
      });
    });
  },
  handleFilterChange(mode) {
    this.state.filters.mode = mode;
    if (E.notificationsFilterButtons) {
      E.notificationsFilterButtons.querySelectorAll('[data-filter]').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-filter') === mode);
      });
    }
    this.loadHub(true);
  },
  startPolling() {
    this.stopPolling();
    this.state.pollTimer = window.setInterval(() => {
      if (!Session.isAuthenticated()) return;
      this.refreshUnreadCount();
      if (this.state.panelOpen) this.fetchPreview();
    }, this.POLL_INTERVAL_MS);
  },
  stopPolling() {
    if (this.state.pollTimer) {
      clearInterval(this.state.pollTimer);
      this.state.pollTimer = null;
    }
  },
  reset() {
    this.stopPolling();
    this.state.items = [];
    this.state.previewItems = [];
    this.state.unreadCount = 0;
    this.state.loading = false;
    this.state.previewLoading = false;
    this.state.lastFetchedAt = '';
    this.closePanel();
    this.renderBell();
    this.renderPreview();
    this.renderHub();
  },
  onAuthStateChanged() {
    if (!Session.isAuthenticated()) {
      this.reset();
      return;
    }
    this.startPolling();
    this.refreshAll(true);
  },
  wire() {
    if (E.notificationBellBtn) {
      E.notificationBellBtn.addEventListener('click', e => {
        e.stopPropagation();
        if (this.state.panelOpen) this.closePanel();
        else this.openPanel();
      });
    }
    document.addEventListener('click', e => {
      if (!this.state.panelOpen) return;
      if (E.notificationPreviewPanel?.contains(e.target) || E.notificationBellBtn?.contains(e.target)) return;
      this.closePanel();
    });
    if (E.notificationOpenHubBtn) {
      E.notificationOpenHubBtn.addEventListener('click', () => {
        this.closePanel();
        setActiveView('notifications');
      });
    }
    if (E.notificationsMarkAllBtn) {
      E.notificationsMarkAllBtn.addEventListener('click', () => this.markAllRead());
    }
    if (E.notificationsRefreshBtn) {
      E.notificationsRefreshBtn.addEventListener('click', () => this.refreshAll(true));
    }
    if (E.notificationsSearchInput) {
      E.notificationsSearchInput.addEventListener('input', debounce(() => {
        this.state.filters.search = String(E.notificationsSearchInput.value || '').trim();
        this.loadHub(true);
      }, 250));
    }
    if (E.notificationsFilterButtons) {
      E.notificationsFilterButtons.querySelectorAll('[data-filter]').forEach(btn => {
        btn.addEventListener('click', () => this.handleFilterChange(btn.getAttribute('data-filter') || 'all'));
      });
    }
    this.renderBell();
    this.renderPreview();
    this.renderHub();
  }
};

window.Notifications = Notifications;
