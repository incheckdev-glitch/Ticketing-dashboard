/* ---------- Elements cache ---------- */
const E = {};
function cacheEls() {
  [
    'issuesTable',
    'issuesTbody',
    'tbodySkeleton',
    'columnToggleBtn',
    'bulkEditBtn',
    'bulkEditModal',
    'bulkEditForm',
    'bulkEditClose',
    'bulkEditCancel',
    'bulkIssueIds',
    'bulkPriority',
    'bulkStatus',
    'bulkDevTeamStatus',
    'bulkNotes',
    'columnPanel',
    'columnList',
    'rowCount',
    'moduleFilter',
    'categoryFilter',
    'priorityFilter',
    'statusFilter',
    'devTeamStatusFilter',
    'devTeamStatusFilterRow',
    'issueRelatedFilter',
    'issueRelatedFilterRow',
    'resetBtn',
    'refreshNow',
    'exportCsv',
    'kpis',
    'issueModal',
    'modalBody',
    'modalTitle',
    'replyRecipientLabel',
    'replyEmailBtn',
    'exportIssuePdf',
    'exportIssueExcel',
    'copyLink',
    'editIssueBtn',
    'modalClose',
    'editIssueModal',
    'editIssueForm',
    'editIssueClose',
    'editIssueCancel',
    'editIssueTitleInput',
    'editIssueDesc',
    'editIssueModule',
    'editIssuePriority',
    'editIssueStatus',
    'editIssueType',
    'editIssueDepartment',
    'editIssueName',
    'editIssueEmail',
    'editIssueYoutrackReference',
    'editIssueDevTeamStatus',
    'editIssueRelated',
    'editIssueFile',
    'editIssueDate',
    'drawerBtn',
    'drawerBtn',
    'sidebar',
    'mainFiltersPanel',
    'leadsFiltersPanel',
    'dealsFiltersPanel',
     'app',
    'spinner',
    'toast',
    'searchInput',
    'loginForm',
    'loginIdentifier',
    'loginPasscode',
    'loginBtn',
    'loginHint',
    'logoutBtn',
     'savedViews',
    'saveViewBtn',
    'deleteViewBtn',
    'themeSelect',
    'firstPage',
    'prevPage',
    'nextPage',
    'lastPage',
    'pageInfo',
    'pageSize',
    'createTicketBtn',
    'startDateFilter',
    'endDateFilter',
    'issuesTab',
    'calendarTab',
    'insightsTab',
    'csmTab',
    'leadsTab',
    'dealsTab',
    'proposalsTab',
    'agreementsTab',
    'clientsTab',
    'proposalCatalogTab',
    'issuesView',
    'calendarView',
    'insightsView',
    'csmView',
    'leadsView',
    'dealsView',
    'proposalsView',
    'agreementsView',
    'clientsView',
    'proposalCatalogView',
    'addEventBtn',
    'eventModal',
    'eventModalTitle',
    'eventModalClose',
    'eventForm',
    'eventTitle',
    'eventType',
    'eventIssueId',
    'eventStart',
    'eventEnd',
    'eventDescription',
    'eventSave',
    'eventCancel',
    'eventDelete',
    'eventIssueLinkedInfo',
    'eventChecklistStatus',
    'aiPatternsList',
    'aiLabelsList',
    'aiRisksList',
   'aiClustersList',
    'aiClustersDetail',
    'aiScopeText',
    'aiSignalsText',
    'aiTrendsList',
    'aiModulesTableBody',
    'aiTriageList',
    'aiEventsList',
    'aiQueryInput',
    'aiQueryRun',
    'aiQueryResults',
    'aiQueryApplyFilters',
    'aiIncidentsList',
    'aiEmergingStable',
    'aiOpsCockpit',
    'syncIssuesText',
    'syncIssuesDot',
    'syncEventsText',
    'syncEventsDot',
    'aiAnalyzing',
    'eventFilterDeployment',
    'eventFilterMaintenance',
    'eventFilterRelease',
    'eventFilterOther',
    'loadingStatus',
    'issuesSummaryText',
    'issuesLastUpdated',
    'activeFiltersChips',
    'calendarTz',
    'onlineStatusChip',
    'currentUserChip',
    'currentRoleChip',
    'usersTab',
    'rolesTab',
    'rolePermissionsTab',
    'usersView',
    'rolesView',
    'rolePermissionsView',
    'csmSearchInput',
    'csmNameFilter',
    'csmClientFilter',
    'csmSupportTypeFilter',
    'csmEffortFilter',
    'csmChannelFilter',
    'csmMinMinutesFilter',
    'csmMaxMinutesFilter',
    'csmStartDateFilter',
    'csmEndDateFilter',
    'csmKpiActivities',
    'csmKpiActivitiesSub',
    'csmKpiMinutes',
    'csmKpiMinutesSub',
    'csmKpiAvg',
    'csmKpiAvgSub',
    'csmKpiActiveClients',
    'csmKpiActiveClientsSub',
    'csmKpiWeightedLoad',
    'csmKpiWeightedLoadSub',
    'csmKpiHighEffortShare',
    'csmKpiHighEffortShareSub',
    'csmWeekdayWorkloadChart',
    'csmWeeklyTrendChart',
    'csmEffortMixByCsmChart',
    'csmClientConcentrationChart',
    'csmWorkloadBalanceChart',
    'csmMinutesByClientChart',
    'csmTypeOfSupportChart',
    'csmEffortRequirementChart',
    'csmSupportChannelsChart',
    'csmInsightList',
    'csmTopSnapshotBody',
    'csmRowCount',
    'csmTableBody',
    'csmFormModal',
    'csmForm',
    'csmFormTitle',
    'csmFormCloseBtn',
    'csmFormCancelBtn',
    'csmFormSaveBtn',
    'csmFormDeleteBtn',
    'csmFormTimestamp',
    'csmFormCsmName',
    'csmFormClient',
    'csmFormMinutes',
    'csmFormSupportType',
    'csmFormEffort',
    'csmFormChannel',
    'csmFormNotes',
    'usersRefreshBtn',
    'usersState',
    'usersTbody',
    'leadsRefreshBtn',
    'leadsCreateBtn',
    'leadsSearchInput',
    'leadsStatusFilter',
    'leadsServiceInterestFilter',
    'leadsAssignedToFilter',
    'leadsProposalNeededFilter',
    'leadsAgreementNeededFilter',
    'leadsStartDateFilter',
    'leadsEndDateFilter',
    'leadsResetBtn',
    'leadsState',
    'leadsKpiTotal',
    'leadsKpiNew',
    'leadsKpiQualified',
    'leadsKpiProposalSent',
    'leadsKpiWon',
    'leadsKpiLost',
    'leadsKpiHighPriority',
    'leadsKpiPipelineValue',
    'leadsKpiPipelineSub',
    'leadsKpiProposalNeeded',
    'leadsKpiAgreementNeeded',
    'leadsKpiConversionRate',
    'leadsStatusDistribution',
    'leadsTable',
    'leadsTbody',
    'dealsSearchInput',
    'dealsSidebarSearchInput',
    'dealsStageFilter',
    'dealsStatusFilter',
    'dealsPriorityFilter',
    'dealsServiceInterestFilter',
    'dealsLeadSourceFilter',
    'dealsAssignedToFilter',
    'dealsProposalNeededFilter',
    'dealsAgreementNeededFilter',
    'dealsStartDateFilter',
    'dealsEndDateFilter',
    'dealsResetBtn',
    'dealsCreateBtn',
    'dealsRefreshBtn',
    'clientsRefreshBtn',
    'clientsState',
    'clientsTbody',
    'dealsAnalytics',
    'dealsAnalyticsGrid',
    'dealsKpiTotal',
    'dealsKpiOpen',
    'dealsKpiWon',
    'dealsKpiLost',
    'dealsKpiProposalNeeded',
    'dealsKpiAgreementNeeded',
    'dealsKpiHighPriority',
    'dealsKpiPipelineValue',
    'dealsKpiPipelineSub',
    'dealsKpiWeightedPipelineValue',
    'dealsKpiWeightedPipelineSub',
    'dealsKpiWinRate',
    'dealsKpiAverageDealSize',
    'dealsKpiAverageWonDealSize',
    'dealsKpiConvertedFromLeads',
    'dealsKpiUniqueCompanies',
    'dealsKpiUniqueAssignees',
    'dealsStageDistribution',
    'dealsStatusDistribution',
    'dealsAssigneeBreakdown',
    'dealsServiceBreakdown',
    'dealsSourceBreakdown',
    'dealsState',
    'dealsTable',
    'dealsTbody',
    'dealFormModal',
    'dealForm',
    'dealFormTitle',
    'dealFormCloseBtn',
    'dealFormCancelBtn',
    'dealFormSaveBtn',
    'dealFormDeleteBtn',
    'dealFormDealId',
    'dealFormLeadId',
    'dealFormFullName',
    'dealFormCompanyName',
    'dealFormPhone',
    'dealFormEmail',
    'dealFormCountry',
    'dealFormLeadSource',
    'dealFormServiceInterest',
    'dealFormStage',
    'dealFormStatus',
    'dealFormPriority',
    'dealFormEstimatedValue',
    'dealFormCurrency',
    'dealFormAssignedTo',
    'dealFormProposalNeeded',
    'dealFormAgreementNeeded',
    'dealFormConvertedBy',
    'dealFormConvertedAt',
    'dealFormNotes',
    'proposalsSearchInput',
    'proposalsStatusFilter',
    'proposalsCustomerFilter',
    'proposalsRefreshBtn',
    'proposalsCreateBtn',
    'proposalCatalogSearchInput',
    'proposalCatalogSectionFilter',
    'proposalCatalogActiveFilter',
    'proposalCatalogSortFilter',
    'proposalCatalogRefreshBtn',
    'proposalCatalogCreateBtn',
    'proposalCatalogState',
    'proposalCatalogSummary',
    'proposalCatalogTable',
    'proposalCatalogTbody',
    'proposalCatalogFormModal',
    'proposalCatalogForm',
    'proposalCatalogFormTitle',
    'proposalCatalogFormCloseBtn',
    'proposalCatalogFormCancelBtn',
    'proposalCatalogFormSaveBtn',
    'proposalCatalogFormDeleteBtn',
    'proposalCatalogFormItemId',
    'proposalCatalogFormIsActive',
    'proposalCatalogFormSection',
    'proposalCatalogFormCategory',
    'proposalCatalogFormItemName',
    'proposalCatalogFormLocation',
    'proposalCatalogFormUnitPrice',
    'proposalCatalogFormDiscountPercent',
    'proposalCatalogFormQuantity',
    'proposalCatalogFormCapabilityName',
    'proposalCatalogFormCapabilityValue',
    'proposalCatalogFormSortOrder',
    'proposalCatalogFormNotes',
    'proposalsState',
    'proposalsTable',
    'proposalsTbody',
    'proposalFormModal',
    'proposalForm',
    'proposalFormTitle',
    'proposalFormCloseBtn',
    'proposalFormCancelBtn',
    'proposalFormSaveBtn',
    'proposalFormDeleteBtn',
    'proposalFormPreviewBtn',
    'proposalFormProposalId',
    'proposalFormTitleField',
    'proposalFormDealId',
    'proposalFormProposalDate',
    'proposalFormValidUntil',
    'proposalFormStatus',
    'proposalFormCurrency',
    'proposalFormCustomerName',
    'proposalFormCustomerAddress',
    'proposalFormCustomerContactName',
    'proposalFormCustomerContactMobile',
    'proposalFormCustomerContactEmail',
    'proposalFormProviderContactName',
    'proposalFormProviderContactMobile',
    'proposalFormProviderContactEmail',
    'proposalFormServiceStartDate',
    'proposalFormContractTerm',
    'proposalFormAccountNumber',
    'proposalFormBillingFrequency',
    'proposalFormPaymentTerm',
    'proposalFormPoNumber',
    'proposalFormCustomerSignatoryName',
    'proposalFormCustomerSignatoryTitle',
    'proposalFormProviderSignatoryName',
    'proposalFormProviderSignatoryTitle',
    'proposalFormProviderSignDate',
    'proposalFormTerms',
    'proposalAnnualItemsTbody',
    'proposalOneTimeItemsTbody',
    'proposalCapabilityItemsTbody',
    'proposalAddAnnualRowBtn',
    'proposalAddOneTimeRowBtn',
    'proposalAddCapabilityRowBtn',
    'proposalSaasTotal',
    'proposalOneTimeTotal',
    'proposalGrandTotal',
    'proposalPreviewModal',
    'proposalPreviewTitle',
    'proposalPreviewCloseBtn',
    'proposalPreviewFrame',
    'agreementsSummary',
    'agreementsSearchInput',
    'agreementsStatusFilter',
    'agreementsProposalDealFilter',
    'agreementsCreateFromProposalInput',
    'agreementsCreateFromProposalBtn',
    'agreementsRefreshBtn',
    'agreementsCreateBtn',
    'agreementsState',
    'agreementsTable',
    'agreementsTbody',
    'agreementFormModal',
    'agreementForm',
    'agreementFormTitle',
    'agreementFormCloseBtn',
    'agreementFormCancelBtn',
    'agreementFormSaveBtn',
    'agreementFormDeleteBtn',
    'agreementFormPreviewBtn',
    'agreementFormAgreementId',
    'agreementFormAgreementNumber',
    'agreementFormProposalId',
    'agreementFormDealId',
    'agreementFormLeadId',
    'agreementFormAgreementTitle',
    'agreementFormAgreementDate',
    'agreementFormEffectiveDate',
    'agreementFormServiceStartDate',
    'agreementFormAgreementLength',
    'agreementFormAccountNumber',
    'agreementFormBillingFrequency',
    'agreementFormPaymentTerm',
    'agreementFormPoNumber',
    'agreementFormCurrency',
    'agreementFormCustomerName',
    'agreementFormCustomerLegalName',
    'agreementFormCustomerAddress',
    'agreementFormCustomerContactName',
    'agreementFormCustomerContactMobile',
    'agreementFormCustomerContactEmail',
    'agreementFormProviderName',
    'agreementFormProviderLegalName',
    'agreementFormProviderAddress',
    'agreementFormProviderContactName',
    'agreementFormProviderContactMobile',
    'agreementFormProviderContactEmail',
    'agreementFormStatus',
    'agreementFormTermsConditions',
    'agreementFormCustomerSignatoryName',
    'agreementFormCustomerSignatoryTitle',
    'agreementFormProviderSignatoryNamePrimary',
    'agreementFormProviderSignatoryTitlePrimary',
    'agreementFormProviderSignatoryNameSecondary',
    'agreementFormProviderSignatoryTitleSecondary',
    'agreementFormProviderSignDate',
    'agreementFormCustomerSignDate',
    'agreementFormGeneratedBy',
    'agreementFormNotes',
    'agreementAnnualItemsTbody',
    'agreementOneTimeItemsTbody',
    'agreementCapabilityItemsTbody',
    'agreementAddAnnualRowBtn',
    'agreementAddOneTimeRowBtn',
    'agreementAddCapabilityRowBtn',
    'agreementSaasTotal',
    'agreementOneTimeTotal',
    'agreementGrandTotal',
    'agreementPreviewModal',
    'agreementPreviewTitle',
    'agreementPreviewCloseBtn',
    'agreementPreviewFrame',
    'leadFormModal',
    'leadForm',
    'leadFormTitle',
    'leadFormCloseBtn',
    'leadFormCancelBtn',
    'leadFormSaveBtn',
    'leadFormDeleteBtn',
    'leadFormLeadId',
    'leadFormCreatedAt',
    'leadFormFullName',
    'leadFormCompanyName',
    'leadFormPhone',
    'leadFormEmail',
    'leadFormCountry',
    'leadFormLeadSource',
    'leadFormServiceInterest',
    'leadFormStatus',
    'leadFormPriority',
    'leadFormEstimatedValue',
    'leadFormCurrency',
    'leadFormAssignedTo',
    'leadFormNextFollowupDate',
    'leadFormLastContactDate',
    'leadFormProposalNeeded',
    'leadFormAgreementNeeded',
    'leadFormNotes',
    'leadFormUpdatedAt',
    'userCreateForm',
    'userCreateName',
    'userCreateUsername',
    'userCreateEmail',
    'userCreateRole',
    'userCreatePassword',
    'userCreateSubmit',
    'userEditModal',
    'userEditForm',
    'userEditClose',
    'userEditCancel',
    'userEditName',
    'userEditUsername',
    'userEditEmail',
    'userEditRole',
    'userEditSubmit',
    'rolesRefreshBtn',
    'rolesState',
    'rolesTbody',
    'rolesTotalCount',
    'rolesActiveCount',
    'rolesInactiveCount',
    'roleCreateForm',
    'roleCreateKey',
    'roleCreateDisplayName',
    'roleCreateDescription',
    'roleCreateIsActive',
    'rolePermissionsRefreshBtn',
    'rolePermissionsFiltersForm',
    'rolePermissionsSearchResource',
    'rolePermissionsSearchAction',
    'rolePermissionsSearchAllowedRoles',
    'rolePermissionsResourceFilter',
    'rolePermissionsState',
    'rolePermissionsTbody',
    'rolePermissionCreateForm',
    'rolePermissionCreateResource',
    'rolePermissionCreateAction',
    'rolePermissionCreateAllowedRoles',
    'rolePermissionCreateDescription',
    'tabPermissionBulkForm',
    'tabPermissionRole',
    'tabPermissionTarget',
    'tabPermissionActionView',
    'tabPermissionActionCreate',
    'tabPermissionActionEdit',
    'tabPermissionActionDelete',
    'accentColor',
    'heroTriagePct',
    'heroHighImpactCount',
    'heroChangeReadiness',
    'shortcutsHelp',
    'aiQueryExport',
    'eventAllDay',
    'eventEnv',
    'eventOwner',
    'eventStatus',
    'eventModules',
    'eventImpactType',
    // Release Planner IDs
    'plannerRegion',
    'plannerEnv',
    'plannerModules',
    'plannerHorizon',
    'plannerReleaseType',
    'plannerRun',
    'plannerResults',
    'plannerDescription',
    'plannerSlotsPerDay',
    'plannerReleasePlan',
    'plannerTickets',
    'plannerAssignBtn',
    'plannerAddEvent',
    'plannerExportScorecard',
    'releasePlannerCard',
    'freezeWindowsCard',
    'freezeManageBtn',
    'freezeManageBtnSecondary',
    'freezeWindowsList',
    'freezeModal',
    'freezeModalClose',
    'freezeModalList',
    'freezeForm',
    'freezeStart',
    'freezeEnd',
    'freezeReset'
    ,
  ].forEach(id => (E[id] = document.getElementById(id)));
}

/** UI helpers */
const UI = {
  toast(msg, ms = 3500) {
    if (!E.toast) return;
    const normalizedMsg = String(msg ?? '')
      .replace(/\\n/g, ' ')
      .replace(/\s*\n\s*/g, ' ')
      .trim();
    E.toast.textContent = normalizedMsg;
    E.toast.style.display = 'block';
    setTimeout(() => {
      if (E.toast) E.toast.style.display = 'none';
    }, ms);
  },
  spinner(v = true) {
    if (E.spinner) E.spinner.style.display = v ? 'flex' : 'none';
    if (E.loadingStatus) E.loadingStatus.textContent = v ? 'Loading…' : '';
  },
  setSync(which, ok, when) {
    const txt = which === 'issues' ? E.syncIssuesText : E.syncEventsText;
    const dot = which === 'issues' ? E.syncIssuesDot : E.syncEventsDot;
    if (!txt || !dot) return;
    const rawTimestamp = when == null ? '' : String(when).replace(/\s*\n\s*/g, ' ').trim();
    const formattedTimestamp = rawTimestamp ? U.fmtTS(rawTimestamp) : '';
    const syncTimestamp = formattedTimestamp && formattedTimestamp !== '—' ? formattedTimestamp : 'never';
    txt.textContent = `${which === 'issues' ? 'Issues' : 'Events'}: ${syncTimestamp}`;
    dot.className = 'dot ' + (ok ? 'ok' : 'err');
  },
  setAnalyzing(v) {
    if (E.aiAnalyzing) E.aiAnalyzing.style.display = v ? 'block' : 'none';
  },
  applyRolePermissions() {
    const role = Session.role() || 'guest';
    const displayName = Session.displayName() || Session.username() || 'guest';
    const canUseInternalIssueFilters = Permissions.canUseInternalIssueFilters();
    const canManageFreezeWindows = Permissions.canManageFreezeWindows();
    const canChangePlanner = Permissions.canChangePlanner();

    if (!canUseInternalIssueFilters) {
      Filters.state.devTeamStatus = 'All';
      Filters.state.issueRelated = 'All';
      Filters.save();
      setIfOptionExists(E.devTeamStatusFilter, 'All');
      setIfOptionExists(E.issueRelatedFilter, 'All');
    }

    if (E.currentUserChip) E.currentUserChip.textContent = `User: ${displayName}`;
    if (E.currentRoleChip) E.currentRoleChip.textContent = `Role: ${role}`;
    const tabAccessRules = [
      { key: 'csm', tabEl: E.csmTab, viewEl: E.csmView },
      { key: 'leads', tabEl: E.leadsTab, viewEl: E.leadsView },
      { key: 'deals', tabEl: E.dealsTab, viewEl: E.dealsView },
      { key: 'proposals', tabEl: E.proposalsTab, viewEl: E.proposalsView },
      { key: 'agreements', tabEl: E.agreementsTab, viewEl: E.agreementsView },
      { key: 'clients', tabEl: E.clientsTab, viewEl: E.clientsView },
      { key: 'proposalCatalog', tabEl: E.proposalCatalogTab, viewEl: E.proposalCatalogView },
      { key: 'users', tabEl: E.usersTab, viewEl: E.usersView, forceAllowed: Permissions.canManageUsers() },
      { key: 'roles', tabEl: E.rolesTab, viewEl: E.rolesView, forceAllowed: Permissions.canManageRolesPermissions() },
      { key: 'rolePermissions', tabEl: E.rolePermissionsTab, viewEl: E.rolePermissionsView, forceAllowed: Permissions.canManageRolesPermissions() },
      {
        key: 'calendar',
        tabEl: E.calendarTab,
        viewEl: E.calendarView
      },
      {
        key: 'insights',
        tabEl: E.insightsTab,
        viewEl: E.insightsView
      }
    ];
    tabAccessRules.forEach(rule => {
      const allowed = typeof rule.forceAllowed === 'boolean' ? rule.forceAllowed : Permissions.canAccessTab(rule.key);
      if (rule.tabEl) rule.tabEl.style.display = allowed ? '' : 'none';
      if (!allowed && rule.viewEl?.classList.contains('active')) {
        setActiveView('issues');
      }
    });
    if (E.addEventBtn) E.addEventBtn.style.display = Permissions.canManageEvents() ? '' : 'none';
    if (E.freezeManageBtn) E.freezeManageBtn.style.display = canManageFreezeWindows ? '' : 'none';
    if (E.freezeManageBtnSecondary) E.freezeManageBtnSecondary.style.display = canManageFreezeWindows ? '' : 'none';
    if (E.freezeWindowsCard) E.freezeWindowsCard.style.display = canManageFreezeWindows ? '' : 'none';
    if (E.plannerAddEvent) E.plannerAddEvent.style.display = canChangePlanner ? '' : 'none';
    if (E.plannerAssignBtn) E.plannerAssignBtn.style.display = canChangePlanner ? '' : 'none';
    if (E.releasePlannerCard) E.releasePlannerCard.style.display = canChangePlanner ? '' : 'none';
    if (E.editIssueBtn) E.editIssueBtn.style.display = Permissions.canEditTicket() ? '' : 'none';
    if (E.bulkEditBtn) E.bulkEditBtn.style.display = Permissions.canEditTicket() ? '' : 'none';
    if (E.devTeamStatusFilterRow)
      E.devTeamStatusFilterRow.style.display = canUseInternalIssueFilters ? '' : 'none';
    if (E.issueRelatedFilterRow)
      E.issueRelatedFilterRow.style.display = canUseInternalIssueFilters ? '' : 'none';
    // Re-apply role-scoped column visibility immediately after login/logout
    // so viewer-restricted columns are hidden without requiring refresh.
    ColumnManager.renderPanel();
    ColumnManager.apply();
  },
  updateHeroMetrics(rows) {
    if (!E.heroTriagePct && !E.heroHighImpactCount && !E.heroChangeReadiness) return;
    const safeRows = Array.isArray(rows) ? rows : [];
    const parseDate = value => {
      if (!value) return null;
      const d = new Date(value);
      return isNaN(d) ? null : d;
    };

    const triageDurations = safeRows
      .map(r => {
        const created = parseDate(r.date);
        const triaged = parseDate(r.notificationSent || r.notificationUnderReview);
        if (!created || !triaged) return null;
        return (triaged - created) / 3600000;
      })
      .filter(v => v != null && v >= 0);

    const triageUnderTwo = triageDurations.filter(v => v <= 2).length;
    const triagePct = triageDurations.length
      ? Math.round((triageUnderTwo / triageDurations.length) * 100)
      : 0;
    if (E.heroTriagePct) E.heroTriagePct.textContent = `${triagePct}%`;

    const dailyHighImpact = safeRows.filter(r => {
      const created = parseDate(r.date);
      if (!created) return false;
      if (!U.isBetween(created, U.daysAgo(1), null)) return false;
      const meta = DataStore.computed.get(r.id);
      const impactScore = meta?.risk?.impact ?? 0;
      return impactScore >= 4 || r.priority === 'High';
    }).length;
    if (E.heroHighImpactCount) E.heroHighImpactCount.textContent = String(dailyHighImpact);

    const reviewDurations = safeRows
      .map(r => {
        const created = parseDate(r.date);
        const reviewed = parseDate(r.notificationUnderReview);
        if (!created || !reviewed) return null;
        return (reviewed - created) / 3600000;
      })
      .filter(v => v != null && v >= 0);
    const avgReviewHours = reviewDurations.length
      ? reviewDurations.reduce((a, b) => a + b, 0) / reviewDurations.length
      : 0;
    const baselineHours = 24;
    const speed = avgReviewHours ? baselineHours / avgReviewHours : 0;
    if (E.heroChangeReadiness) {
      E.heroChangeReadiness.textContent = `${speed ? speed.toFixed(1) : '0'}x`;
    }
  },
  skeleton(show) {
    if (!E.issuesTbody || !E.tbodySkeleton) return;
    E.tbodySkeleton.style.display = show ? '' : 'none';
    E.issuesTbody.style.display = show ? 'none' : '';
  }
};

const GridState = {
  sortKey: 'date',
  sortAsc: false,
  page: 1,
  pageSize: +(localStorage.getItem(LS_KEYS.pageSize) || 20)
};

function buildIssueCategoryOptions(extra = []) {
  const allowedCategories = ['Bug', 'Enhancement', 'New Features'];
  const selectedExtras = extra
    .filter(Boolean)
    .map(v => String(v).trim().toLowerCase())
    .filter(v => allowedCategories.includes(v));
  return [...new Set([...allowedCategories, ...selectedExtras])];
}
