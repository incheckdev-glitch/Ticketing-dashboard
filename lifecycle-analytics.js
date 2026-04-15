const LifecycleAnalytics = {
  state: {
    initialized: false,
    query: '',
    dateFrom: '',
    dateTo: '',
    stage: 'All',
    owner: 'All',
    loading: false,
    error: '',
    hasSearched: false,
    result: null
  },
  debugEnabled: /localhost|127\.0\.0\.1|\.vercel\.app$/i.test(window.location.hostname),
  log(...args) {
    if (!this.debugEnabled) return;
    console.debug('[LifecycleAnalytics]', ...args);
  },
  text(value) {
    return String(value ?? '').trim();
  },
  norm(value) {
    return this.text(value).toLowerCase();
  },
  num(value) {
    if (value === null || value === undefined || value === '') return 0;
    const parsed = Number(String(value).replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : 0;
  },
  toDate(value) {
    const raw = this.text(value);
    if (!raw) return null;
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  },
  fmtDate(value) {
    if (!value) return '—';
    const date = this.toDate(value);
    if (!date) return '—';
    try {
      return date.toLocaleString();
    } catch {
      return String(value);
    }
  },
  daysBetween(a, b) {
    const da = this.toDate(a);
    const db = this.toDate(b);
    if (!da || !db) return null;
    return Math.max(0, Math.round((db.getTime() - da.getTime()) / 86400000));
  },
  escape(value) {
    return U.escapeHtml(String(value ?? ''));
  },
  matchesSearch(record, normalizedQuery) {
    if (!record || !normalizedQuery) return false;
    const fields = [
      record.lead_id,
      record.deal_id,
      record.proposal_id,
      record.agreement_id,
      record.invoice_id,
      record.receipt_id,
      record.customer_name,
      record.customer_legal_name,
      record.company_name,
      record.full_name,
      record.customer_contact_name,
      record.customer_contact_email,
      record.email,
      record.phone,
      record.mobile,
      record.status,
      record.owner,
      record.assigned_to
    ]
      .map(v => this.norm(v))
      .filter(Boolean);
    return fields.some(value => value.includes(normalizedQuery));
  },
  extractRows(response) {
    const candidates = [
      response,
      response?.items,
      response?.rows,
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
  normalizeLead(raw = {}) {
    return {
      lead_id: this.text(raw.lead_id || raw.leadId || raw.id),
      created_at: this.text(raw.created_at || raw.createdAt),
      full_name: this.text(raw.full_name || raw.fullName || raw.customer_name),
      company_name: this.text(raw.company_name || raw.companyName),
      email: this.text(raw.email || raw.customer_contact_email),
      phone: this.text(raw.phone || raw.mobile || raw.customer_contact_mobile),
      status: this.text(raw.status || 'New'),
      owner: this.text(raw.assigned_to || raw.owner),
      estimated_value: this.num(raw.estimated_value || raw.expected_value || raw.deal_value),
      source: raw
    };
  },
  normalizeDeal(raw = {}) {
    return {
      deal_id: this.text(raw.deal_id || raw.dealId || raw.id),
      lead_id: this.text(raw.lead_id || raw.leadId),
      created_at: this.text(raw.created_at || raw.createdAt || raw.converted_at),
      company_name: this.text(raw.company_name || raw.companyName),
      full_name: this.text(raw.full_name || raw.fullName || raw.customer_name),
      email: this.text(raw.email || raw.customer_contact_email),
      phone: this.text(raw.phone || raw.mobile || raw.customer_contact_mobile),
      status: this.text(raw.status || ''),
      owner: this.text(raw.assigned_to || raw.owner),
      stage: this.text(raw.stage || raw.pipeline_stage),
      estimated_value: this.num(raw.value || raw.expected_value || raw.grand_total),
      source: raw
    };
  },
  normalizeProposal(raw = {}) {
    return {
      proposal_id: this.text(raw.proposal_id || raw.proposalId || raw.id),
      deal_id: this.text(raw.deal_id || raw.dealId),
      lead_id: this.text(raw.lead_id || raw.leadId),
      created_at: this.text(raw.created_at || raw.createdAt || raw.proposal_date),
      sent_at: this.text(raw.sent_at || raw.sentAt),
      customer_name: this.text(raw.customer_name || raw.company_name),
      customer_contact_email: this.text(raw.customer_contact_email || raw.email),
      customer_contact_mobile: this.text(raw.customer_contact_mobile || raw.phone),
      status: this.text(raw.status || ''),
      owner: this.text(raw.generated_by || raw.owner),
      grand_total: this.num(raw.grand_total),
      discount_percent: this.num(raw.discount_percent),
      source: raw
    };
  },
  normalizeAgreement(raw = {}) {
    return {
      agreement_id: this.text(raw.agreement_id || raw.agreementId || raw.id),
      proposal_id: this.text(raw.proposal_id || raw.proposalId),
      deal_id: this.text(raw.deal_id || raw.dealId),
      created_at: this.text(raw.created_at || raw.createdAt || raw.agreement_date),
      signed_at: this.text(raw.customer_sign_date || raw.signed_at || raw.signedAt),
      customer_name: this.text(raw.customer_name || raw.company_name),
      customer_contact_email: this.text(raw.customer_contact_email || raw.email),
      customer_contact_mobile: this.text(raw.customer_contact_mobile || raw.phone),
      status: this.text(raw.status || ''),
      owner: this.text(raw.assigned_to || raw.owner),
      grand_total: this.num(raw.grand_total),
      source: raw
    };
  },
  normalizeInvoice(raw = {}) {
    return {
      invoice_id: this.text(raw.invoice_id || raw.invoiceId || raw.id),
      agreement_id: this.text(raw.agreement_id || raw.agreementId),
      created_at: this.text(raw.created_at || raw.createdAt || raw.issued_date),
      customer_name: this.text(raw.customer_name || raw.company_name),
      customer_contact_email: this.text(raw.customer_contact_email || raw.email),
      customer_contact_mobile: this.text(raw.customer_contact_mobile || raw.phone),
      status: this.text(raw.status || raw.payment_state),
      owner: this.text(raw.generated_by || raw.owner),
      grand_total: this.num(raw.grand_total),
      amount_paid: this.num(raw.amount_paid),
      discount_percent: this.num(raw.discount_percent),
      source: raw
    };
  },
  normalizeReceipt(raw = {}) {
    return {
      receipt_id: this.text(raw.receipt_id || raw.receiptId || raw.id),
      invoice_id: this.text(raw.invoice_id || raw.invoiceId),
      created_at: this.text(raw.created_at || raw.createdAt || raw.receipt_date),
      customer_name: this.text(raw.customer_name || raw.company_name),
      customer_contact_email: this.text(raw.customer_contact_email || raw.email),
      customer_contact_mobile: this.text(raw.customer_contact_mobile || raw.phone),
      status: this.text(raw.status || raw.payment_state),
      owner: this.text(raw.generated_by || raw.owner),
      received_amount: this.num(raw.received_amount || raw.amount_paid),
      source: raw
    };
  },
  async listLeads(forceRefresh = false) {
    if (typeof window.Leads?.listLeads === 'function') {
      const response = await window.Leads.listLeads({ forceRefresh, limit: 200, offset: 0 });
      return this.extractRows(response).map(item => this.normalizeLead(item));
    }
    const response = await Api.postAuthenticatedCached('leads', 'list', { limit: 200, offset: 0 }, { forceRefresh });
    return this.extractRows(response).map(item => this.normalizeLead(item));
  },
  async listDeals(forceRefresh = false) {
    if (typeof window.Deals?.listDeals === 'function') {
      const response = await window.Deals.listDeals({ forceRefresh, limit: 200, offset: 0 });
      return this.extractRows(response).map(item => this.normalizeDeal(item));
    }
    const response = await Api.postAuthenticatedCached('deals', 'list', { limit: 200, offset: 0 }, { forceRefresh });
    return this.extractRows(response).map(item => this.normalizeDeal(item));
  },
  async listProposals(forceRefresh = false) {
    if (typeof window.Proposals?.listProposals === 'function') {
      const response = await window.Proposals.listProposals({ forceRefresh, limit: 200, offset: 0 });
      return this.extractRows(response).map(item => this.normalizeProposal(item));
    }
    const response = await Api.postAuthenticatedCached('proposals', 'list', { limit: 200, offset: 0 }, { forceRefresh });
    return this.extractRows(response).map(item => this.normalizeProposal(item));
  },
  async listAgreements(forceRefresh = false) {
    const response = await Api.listAgreements({ forceRefresh });
    return this.extractRows(response).map(item => this.normalizeAgreement(item));
  },
  async listInvoices(forceRefresh = false) {
    const response = await Api.listInvoices({});
    return this.extractRows(response).map(item => this.normalizeInvoice(item));
  },
  async listReceipts(forceRefresh = false) {
    const response = await Api.listReceipts({});
    return this.extractRows(response).map(item => this.normalizeReceipt(item));
  },
  findBestMatch(query, collections) {
    const normalized = this.norm(query);
    if (!normalized) return null;

    const idRegex = /^(lead|deal|prop|proposal|agr|agreement|inv|invoice|rec|receipt)[-_\s]?[a-z0-9-]+$/i;
    const allExact = [];
    const allLoose = [];

    collections.forEach(({ stage, rows, idKey }) => {
      rows.forEach(row => {
        const idValue = this.norm(row[idKey]);
        if (idValue && idValue === normalized) {
          allExact.push({ stage, row, idKey });
        } else if (this.matchesSearch(row, normalized)) {
          allLoose.push({ stage, row, idKey });
        }
      });
    });

    if (idRegex.test(query) && allExact.length) return allExact[0];
    if (allExact.length) return allExact[0];
    return allLoose[0] || null;
  },
  buildLifecycleGraph(seed, data) {
    const byNorm = value => this.norm(value);
    const links = {
      lead: null,
      deal: null,
      proposals: [],
      agreements: [],
      invoices: [],
      receipts: []
    };

    const seedRecord = seed?.row || {};
    const seedStage = seed?.stage || '';
    const seedIdKey = seed?.idKey || '';
    const seedId = this.text(seedRecord[seedIdKey]);

    if (seedStage === 'lead') links.lead = seedRecord;
    if (seedStage === 'deal') links.deal = seedRecord;
    if (seedStage === 'proposal') links.proposals.push(seedRecord);
    if (seedStage === 'agreement') links.agreements.push(seedRecord);
    if (seedStage === 'invoice') links.invoices.push(seedRecord);
    if (seedStage === 'receipt') links.receipts.push(seedRecord);

    if (!links.lead) {
      links.lead = data.leads.find(item => byNorm(item.lead_id) === byNorm(seedRecord.lead_id || seedId)) || null;
    }

    if (!links.deal) {
      const dealIdFromSeed = seedRecord.deal_id || (seedStage === 'deal' ? seedId : '');
      links.deal =
        data.deals.find(item => byNorm(item.deal_id) === byNorm(dealIdFromSeed)) ||
        data.deals.find(item => links.lead && byNorm(item.lead_id) === byNorm(links.lead.lead_id)) ||
        null;
    }

    if (!links.proposals.length) {
      links.proposals = data.proposals.filter(item => {
        if (links.deal && byNorm(item.deal_id) === byNorm(links.deal.deal_id)) return true;
        if (links.lead && byNorm(item.lead_id) === byNorm(links.lead.lead_id)) return true;
        return this.matchesSearch(item, byNorm(seedId));
      });
    }

    const proposalIdSet = new Set(links.proposals.map(item => byNorm(item.proposal_id)).filter(Boolean));

    if (!links.agreements.length) {
      links.agreements = data.agreements.filter(item => {
        if (proposalIdSet.size && proposalIdSet.has(byNorm(item.proposal_id))) return true;
        if (links.deal && byNorm(item.deal_id) === byNorm(links.deal.deal_id)) return true;
        return false;
      });
    }

    const agreementIdSet = new Set(links.agreements.map(item => byNorm(item.agreement_id)).filter(Boolean));

    if (!links.invoices.length) {
      links.invoices = data.invoices.filter(item => agreementIdSet.has(byNorm(item.agreement_id)));
    }

    const invoiceIdSet = new Set(links.invoices.map(item => byNorm(item.invoice_id)).filter(Boolean));

    if (!links.receipts.length) {
      links.receipts = data.receipts.filter(item => invoiceIdSet.has(byNorm(item.invoice_id)));
    }

    const fallbackIdentity = [
      links.lead?.email,
      links.deal?.email,
      links.proposals[0]?.customer_contact_email,
      links.agreements[0]?.customer_contact_email,
      links.invoices[0]?.customer_contact_email,
      links.lead?.company_name,
      links.deal?.company_name,
      links.proposals[0]?.customer_name,
      links.agreements[0]?.customer_name,
      links.invoices[0]?.customer_name,
      links.lead?.phone,
      links.deal?.phone
    ]
      .map(v => this.norm(v))
      .filter(Boolean);

    const weakMatch = row => fallbackIdentity.some(value => this.matchesSearch(row, value));

    if (!links.proposals.length) links.proposals = data.proposals.filter(weakMatch);
    if (!links.agreements.length) links.agreements = data.agreements.filter(weakMatch);
    if (!links.invoices.length) links.invoices = data.invoices.filter(weakMatch);
    if (!links.receipts.length) links.receipts = data.receipts.filter(weakMatch);

    return links;
  },
  buildTimeline(graph) {
    const events = [];
    const pushEvent = (stage, kind, date, title, recordId, status, user, note) => {
      if (!date) return;
      events.push({ stage, kind, date, title, recordId, status, user, note });
    };

    if (graph.lead) {
      pushEvent('Lead', 'created', graph.lead.created_at, 'Lead created', graph.lead.lead_id, graph.lead.status, graph.lead.owner, 'Lead entered pipeline');
    }
    if (graph.deal) {
      pushEvent('Deal', 'created', graph.deal.created_at, 'Deal created', graph.deal.deal_id, graph.deal.status || graph.deal.stage, graph.deal.owner, 'Deal linked to lead');
    }
    graph.proposals.forEach(item => {
      pushEvent('Proposal', 'created', item.created_at, 'Proposal created', item.proposal_id, item.status, item.owner, 'Proposal draft initialized');
      if (item.sent_at) {
        pushEvent('Proposal', 'sent', item.sent_at, 'Proposal sent', item.proposal_id, item.status, item.owner, 'Proposal sent to customer');
      }
    });
    graph.agreements.forEach(item => {
      pushEvent('Agreement', 'created', item.created_at, 'Agreement created', item.agreement_id, item.status, item.owner, 'Agreement generated');
      if (item.signed_at) {
        pushEvent('Agreement', 'signed', item.signed_at, 'Agreement signed', item.agreement_id, item.status, item.owner, 'Customer signed agreement');
      }
    });
    graph.invoices.forEach(item => {
      pushEvent('Invoice', 'created', item.created_at, 'Invoice created', item.invoice_id, item.status, item.owner, 'Invoice issued');
    });
    graph.receipts.forEach(item => {
      pushEvent('Receipt', 'created', item.created_at, 'Receipt created', item.receipt_id, item.status, item.owner, 'Receipt posted');
    });

    return events.sort((a, b) => this.toDate(a.date)?.getTime() - this.toDate(b.date)?.getTime());
  },
  buildMetrics(graph, timeline) {
    const stageDates = {
      lead: graph.lead?.created_at || '',
      deal: graph.deal?.created_at || '',
      proposal: graph.proposals[0]?.created_at || '',
      agreement: graph.agreements[0]?.created_at || '',
      invoice: graph.invoices[0]?.created_at || '',
      receipt: graph.receipts[0]?.created_at || ''
    };
    const stageSequence = ['lead', 'deal', 'proposal', 'agreement', 'invoice', 'receipt'];
    const stageDurations = {};
    for (let i = 0; i < stageSequence.length - 1; i += 1) {
      const current = stageSequence[i];
      const next = stageSequence[i + 1];
      const days = this.daysBetween(stageDates[current], stageDates[next]);
      if (days !== null) stageDurations[current] = days;
    }

    const firstDate = timeline[0]?.date || '';
    const lastDate = timeline[timeline.length - 1]?.date || '';
    const totalCycleDuration = this.daysBetween(firstDate, lastDate);
    const stageChanges = timeline.filter(item => item.kind === 'created' || item.kind === 'signed' || item.kind === 'sent').length;

    const approvalDelay = this.daysBetween(graph.proposals[0]?.sent_at || graph.proposals[0]?.created_at, graph.agreements[0]?.signed_at || graph.agreements[0]?.created_at);
    const latestActivityDate = lastDate || '';
    const lastActivityAge = latestActivityDate ? this.daysBetween(latestActivityDate, new Date().toISOString()) : null;

    const discountValues = [
      ...graph.proposals.map(item => this.num(item.discount_percent)),
      ...graph.invoices.map(item => this.num(item.discount_percent))
    ].filter(value => value > 0);
    const avgDiscount = discountValues.length
      ? discountValues.reduce((sum, value) => sum + value, 0) / discountValues.length
      : 0;

    let stuckStage = 'None';
    const maxStage = Object.entries(stageDurations).sort((a, b) => (b[1] || 0) - (a[1] || 0))[0];
    if (maxStage && maxStage[1] >= 10) stuckStage = maxStage[0];

    const bottleneckWarning = maxStage && maxStage[1] >= 14 ? `${maxStage[0]} stage has a ${maxStage[1]} day delay` : '';

    return {
      stage_durations_days: stageDurations,
      total_cycle_duration_days: totalCycleDuration,
      stage_changes: stageChanges,
      approval_delay_days: approvalDelay,
      last_activity_age_days: lastActivityAge,
      average_discount_percent: Number(avgDiscount.toFixed(2)),
      stuck_stage: stuckStage,
      bottleneck_warning: bottleneckWarning
    };
  },
  buildSummary(graph, timeline, metrics) {
    const latest = timeline[timeline.length - 1] || null;
    const currentStage = graph.receipts.length
      ? 'Receipt'
      : graph.invoices.length
      ? 'Invoice'
      : graph.agreements.length
      ? 'Agreement'
      : graph.proposals.length
      ? 'Proposal'
      : graph.deal
      ? 'Deal'
      : graph.lead
      ? 'Lead'
      : 'Unknown';

    const estimated =
      graph.invoices[0]?.grand_total ||
      graph.agreements[0]?.grand_total ||
      graph.proposals[0]?.grand_total ||
      graph.deal?.estimated_value ||
      graph.lead?.estimated_value ||
      0;

    return {
      current_stage: currentStage,
      customer_company:
        graph.lead?.company_name ||
        graph.deal?.company_name ||
        graph.proposals[0]?.customer_name ||
        graph.agreements[0]?.customer_name ||
        graph.invoices[0]?.customer_name ||
        '—',
      owner:
        graph.deal?.owner ||
        graph.lead?.owner ||
        graph.proposals[0]?.owner ||
        graph.agreements[0]?.owner ||
        graph.invoices[0]?.owner ||
        '—',
      status: latest?.status || graph.invoices[0]?.status || graph.agreements[0]?.status || graph.proposals[0]?.status || graph.deal?.status || graph.lead?.status || '—',
      estimated_value: estimated,
      lifecycle_duration: metrics.total_cycle_duration_days,
      last_activity: latest?.date || '',
      next_action: graph.invoices.length && !graph.receipts.length ? 'Follow up for payment receipt' : graph.agreements.length && !graph.invoices.length ? 'Generate invoice from agreement' : graph.proposals.length && !graph.agreements.length ? 'Move proposal to agreement' : 'Monitor status updates'
    };
  },
  buildInsights(graph, metrics) {
    const insights = [];
    if (metrics.stuck_stage && metrics.stuck_stage !== 'None') {
      insights.push(`This lifecycle is delayed at ${metrics.stuck_stage} stage.`);
    }
    if ((metrics.approval_delay_days || 0) <= 2 && graph.agreements.some(item => this.norm(item.status).includes('signed'))) {
      insights.push('Agreement was signed quickly.');
    }
    if (graph.invoices.length && !graph.receipts.length) {
      insights.push('Invoice exists but no receipt is linked.');
    }
    if ((metrics.last_activity_age_days || 0) >= 10) {
      insights.push(`No activity in the last ${metrics.last_activity_age_days} days.`);
    }
    if (metrics.bottleneck_warning) {
      insights.push(`Bottleneck warning: ${metrics.bottleneck_warning}.`);
    }
    if (!insights.length) {
      insights.push('Lifecycle is progressing without major bottlenecks.');
    }
    return insights;
  },
  applyViewFilters(timeline, graph) {
    const from = this.toDate(this.state.dateFrom);
    const to = this.toDate(this.state.dateTo);
    const stage = this.norm(this.state.stage);
    const owner = this.norm(this.state.owner);

    const inDateRange = item => {
      const d = this.toDate(item.date);
      if (!d) return false;
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    };

    const timelineFiltered = timeline.filter(item => {
      if ((from || to) && !inDateRange(item)) return false;
      if (stage && stage !== 'all' && this.norm(item.stage) !== stage) return false;
      if (owner && owner !== 'all' && this.norm(item.user) !== owner) return false;
      return true;
    });

    const filterRecordSet = list =>
      list.filter(item => {
        if (stage && stage !== 'all') {
          const mapStage = item.lead_id ? 'lead' : item.deal_id ? 'deal' : item.proposal_id ? 'proposal' : item.agreement_id ? 'agreement' : item.invoice_id ? 'invoice' : item.receipt_id ? 'receipt' : '';
          if (mapStage && mapStage !== stage) return false;
        }
        if (owner && owner !== 'all' && this.norm(item.owner) !== owner) return false;
        if (from || to) {
          const date = item.created_at || item.sent_at || item.signed_at;
          if (!date) return false;
          const d = this.toDate(date);
          if (!d) return false;
          if (from && d < from) return false;
          if (to && d > to) return false;
        }
        return true;
      });

    return {
      timeline: timelineFiltered,
      graph: {
        ...graph,
        proposals: filterRecordSet(graph.proposals),
        agreements: filterRecordSet(graph.agreements),
        invoices: filterRecordSet(graph.invoices),
        receipts: filterRecordSet(graph.receipts)
      }
    };
  },
  renderSummaryCards(summary) {
    const cards = [
      ['Current Stage', summary.current_stage || '—'],
      ['Customer / Company', summary.customer_company || '—'],
      ['Owner', summary.owner || '—'],
      ['Status', summary.status || '—'],
      ['Estimated Value', U.fmtNumber(summary.estimated_value || 0)],
      ['Lifecycle Duration', summary.lifecycle_duration == null ? '—' : `${summary.lifecycle_duration} days`],
      ['Last Activity', this.fmtDate(summary.last_activity)],
      ['Next Action', summary.next_action || '—']
    ];
    const root = document.getElementById('lifecycleSummaryCards');
    if (!root) return;
    root.innerHTML = cards
      .map(([label, value]) => `<div class="card kpi"><div class="label">${this.escape(label)}</div><div class="value">${this.escape(String(value))}</div></div>`)
      .join('');
  },
  renderTimeline(timeline) {
    const root = document.getElementById('lifecycleTimeline');
    if (!root) return;
    if (!timeline.length) {
      root.innerHTML = '<div class="muted">No lifecycle events match the selected filters.</div>';
      return;
    }
    root.innerHTML = timeline
      .map(item => `<article class="lifecycle-timeline-item">
        <div class="lifecycle-timeline-dot" aria-hidden="true"></div>
        <div class="lifecycle-timeline-content">
          <div class="lifecycle-timeline-title-row">
            <strong>${this.escape(item.title)}</strong>
            <span class="muted">${this.escape(this.fmtDate(item.date))}</span>
          </div>
          <div class="muted">ID: ${this.escape(item.recordId || '—')} · Status: ${this.escape(item.status || '—')}</div>
          <div class="muted">User: ${this.escape(item.user || '—')} · Note: ${this.escape(item.note || '—')}</div>
        </div>
      </article>`)
      .join('');
  },
  recordCard(title, id, status, createdAt, value, view) {
    return `<div class="card lifecycle-record-card">
      <strong>${this.escape(title)}</strong>
      <div class="muted">ID: ${this.escape(id || '—')}</div>
      <div class="muted">Status: ${this.escape(status || '—')}</div>
      <div class="muted">Created: ${this.escape(this.fmtDate(createdAt))}</div>
      <div class="muted">Value: ${this.escape(value != null ? U.fmtNumber(value) : '—')}</div>
      <button class="btn ghost sm" type="button" data-lifecycle-open-view="${this.escape(view)}">Quick Open</button>
    </div>`;
  },
  renderRecords(graph) {
    const root = document.getElementById('lifecycleRecordsGrid');
    if (!root) return;
    const cards = [];
    if (graph.lead) cards.push(this.recordCard('Lead', graph.lead.lead_id, graph.lead.status, graph.lead.created_at, graph.lead.estimated_value, 'leads'));
    if (graph.deal) cards.push(this.recordCard('Deal', graph.deal.deal_id, graph.deal.status || graph.deal.stage, graph.deal.created_at, graph.deal.estimated_value, 'deals'));
    graph.proposals.forEach(item => cards.push(this.recordCard('Proposal', item.proposal_id, item.status, item.created_at, item.grand_total, 'proposals')));
    graph.agreements.forEach(item => cards.push(this.recordCard('Agreement', item.agreement_id, item.status, item.created_at, item.grand_total, 'agreements')));
    graph.invoices.forEach(item => cards.push(this.recordCard('Invoice', item.invoice_id, item.status, item.created_at, item.grand_total, 'invoices')));
    graph.receipts.forEach(item => cards.push(this.recordCard('Receipt', item.receipt_id, item.status, item.created_at, item.received_amount, 'receipts')));
    root.innerHTML = cards.length ? cards.join('') : '<div class="muted">No related records found.</div>';
  },
  renderMetrics(metrics) {
    const root = document.getElementById('lifecycleMetricsGrid');
    if (!root) return;
    const entries = [
      ['Days in Lead', metrics.stage_durations_days?.lead ?? '—'],
      ['Days in Deal', metrics.stage_durations_days?.deal ?? '—'],
      ['Days in Proposal', metrics.stage_durations_days?.proposal ?? '—'],
      ['Days in Agreement', metrics.stage_durations_days?.agreement ?? '—'],
      ['Days in Invoice', metrics.stage_durations_days?.invoice ?? '—'],
      ['Total Cycle Duration', metrics.total_cycle_duration_days == null ? '—' : `${metrics.total_cycle_duration_days} days`],
      ['Number of Stage Changes', metrics.stage_changes ?? '—'],
      ['Approval Delay', metrics.approval_delay_days == null ? '—' : `${metrics.approval_delay_days} days`],
      ['Last Activity Age', metrics.last_activity_age_days == null ? '—' : `${metrics.last_activity_age_days} days`],
      ['Average Discount', `${metrics.average_discount_percent || 0}%`],
      ['Stuck Stage', metrics.stuck_stage || 'None'],
      ['Bottleneck Warning', metrics.bottleneck_warning || 'None']
    ];
    root.innerHTML = entries.map(([label, value]) => `<div class="card"><div class="label">${this.escape(label)}</div><div class="value">${this.escape(String(value))}</div></div>`).join('');
  },
  renderInsights(insights) {
    const root = document.getElementById('lifecycleInsights');
    if (!root) return;
    root.innerHTML = insights.map(item => `<li>${this.escape(item)}</li>`).join('');
  },
  renderLoading() {
    const body = document.getElementById('lifecycleResultBody');
    const state = document.getElementById('lifecycleState');
    if (state) state.textContent = 'Searching lifecycle analytics…';
    if (!body) return;
    body.innerHTML = `
      <div class="grid cols-4 lifecycle-skeleton-grid">
        <div class="card skeleton-block"></div>
        <div class="card skeleton-block"></div>
        <div class="card skeleton-block"></div>
        <div class="card skeleton-block"></div>
      </div>
      <div class="card skeleton-block" style="height:220px;margin-top:10px;"></div>
      <div class="card skeleton-block" style="height:220px;margin-top:10px;"></div>
    `;
  },
  renderError(message) {
    const body = document.getElementById('lifecycleResultBody');
    const state = document.getElementById('lifecycleState');
    if (state) state.textContent = message;
    if (!body) return;
    body.innerHTML = `<div class="card"><div class="muted" style="color:#ffb4b4;">${this.escape(message)}</div></div>`;
  },
  renderEmpty() {
    const body = document.getElementById('lifecycleResultBody');
    const state = document.getElementById('lifecycleState');
    if (state) state.textContent = 'No lifecycle records found.';
    if (!body) return;
    body.innerHTML = '<div class="card"><div class="muted">No matching lead/deal/proposal/agreement/invoice/receipt chain was found. Try searching by exact ID first, then email, phone, or company name.</div></div>';
  },
  renderResults() {
    const body = document.getElementById('lifecycleResultBody');
    const state = document.getElementById('lifecycleState');
    if (!body) return;
    body.innerHTML = `
      <section class="grid cols-4" id="lifecycleSummaryCards"></section>
      <section class="card" style="margin-top:10px;"><strong>Lifecycle Timeline</strong><div id="lifecycleTimeline" class="lifecycle-timeline"></div></section>
      <section class="card" style="margin-top:10px;"><strong>Related Records</strong><div id="lifecycleRecordsGrid" class="grid cols-3 lifecycle-records-grid"></div></section>
      <section class="card" style="margin-top:10px;"><strong>Advanced Analytics</strong><div id="lifecycleMetricsGrid" class="grid cols-4"></div></section>
      <section class="card" style="margin-top:10px;"><strong>Insight Panel</strong><ul id="lifecycleInsights" class="muted" style="padding-left:18px;"></ul></section>
    `;

    const result = this.state.result;
    this.renderSummaryCards(result.summary);
    this.renderTimeline(result.filtered.timeline);
    this.renderRecords(result.filtered.graph);
    this.renderMetrics(result.metrics);
    this.renderInsights(result.insights);
    if (state) state.textContent = 'Lifecycle analytics loaded.';
  },
  updateOwnerFilterOptions(ownerCandidates = []) {
    const select = document.getElementById('lifecycleOwnerFilter');
    if (!select) return;
    const unique = [...new Set(ownerCandidates.map(v => this.text(v)).filter(Boolean))];
    const current = this.state.owner || 'All';
    select.innerHTML = ['All', ...unique].map(v => `<option>${this.escape(v)}</option>`).join('');
    select.value = unique.includes(current) ? current : 'All';
  },
  async resolveFromBackend(query, filters = {}) {
    const search = await Api.analyticsSearchEntity(query, filters);
    if (!search) return null;
    const lifecycle = await Api.analyticsGetLifecycle(search.entity_id || search.id || query, filters);
    const timeline = await Api.analyticsGetTimeline(search.entity_id || search.id || query, filters);
    const metrics = await Api.analyticsGetMetrics(search.entity_id || search.id || query, filters);
    return {
      summary: lifecycle?.summary || lifecycle?.entity_summary || {},
      graph: lifecycle?.linked_records || lifecycle?.records || {},
      timeline: Array.isArray(timeline?.events) ? timeline.events : this.extractRows(timeline),
      metrics: metrics?.metrics || metrics || {},
      insights: Array.isArray(metrics?.insights) ? metrics.insights : lifecycle?.insights || []
    };
  },
  async resolveLocal(query) {
    const [leads, deals, proposals, agreements, invoices, receipts] = await Promise.all([
      this.listLeads(false),
      this.listDeals(false),
      this.listProposals(false),
      this.listAgreements(false),
      this.listInvoices(false),
      this.listReceipts(false)
    ]);

    const seed = this.findBestMatch(query, [
      { stage: 'lead', rows: leads, idKey: 'lead_id' },
      { stage: 'deal', rows: deals, idKey: 'deal_id' },
      { stage: 'proposal', rows: proposals, idKey: 'proposal_id' },
      { stage: 'agreement', rows: agreements, idKey: 'agreement_id' },
      { stage: 'invoice', rows: invoices, idKey: 'invoice_id' },
      { stage: 'receipt', rows: receipts, idKey: 'receipt_id' }
    ]);
    if (!seed) return null;

    const graph = this.buildLifecycleGraph(seed, { leads, deals, proposals, agreements, invoices, receipts });
    const timeline = this.buildTimeline(graph);
    const metrics = this.buildMetrics(graph, timeline);
    const summary = this.buildSummary(graph, timeline, metrics);
    const insights = this.buildInsights(graph, metrics);

    return { summary, graph, timeline, metrics, insights };
  },
  async search() {
    const queryInput = document.getElementById('lifecycleSearchInput');
    const query = this.text(queryInput?.value || this.state.query);
    this.state.query = query;
    this.state.hasSearched = true;

    if (!query) {
      this.renderError('Please enter a search query.');
      return;
    }

    this.state.loading = true;
    this.state.error = '';
    this.renderLoading();

    const filters = {
      date_from: this.state.dateFrom,
      date_to: this.state.dateTo,
      stage: this.state.stage,
      owner: this.state.owner
    };

    try {
      let resolved = null;
      try {
        resolved = await this.resolveFromBackend(query, filters);
      } catch (backendError) {
        this.log('analytics backend endpoint unavailable, falling back to local aggregation', backendError);
      }

      if (!resolved) {
        resolved = await this.resolveLocal(query);
      }

      if (!resolved || !resolved.timeline || !resolved.timeline.length) {
        this.state.result = null;
        this.renderEmpty();
        return;
      }

      const normalizedTimeline = (resolved.timeline || []).map(item => ({
        title: this.text(item.title || item.event_title || item.label || item.event || 'Lifecycle event'),
        date: this.text(item.date || item.timestamp || item.created_at || item.updated_at),
        recordId: this.text(item.record_id || item.related_record_id || item.id),
        status: this.text(item.status || item.state),
        user: this.text(item.user || item.actor || item.owner),
        note: this.text(item.note || item.description),
        stage: this.text(item.stage || item.resource || item.type || 'General'),
        kind: this.text(item.kind || item.event_type || 'updated')
      }))
      .filter(item => item.date)
      .sort((a, b) => this.toDate(a.date)?.getTime() - this.toDate(b.date)?.getTime());

      const normalizedGraph = {
        lead: resolved.graph?.lead || null,
        deal: resolved.graph?.deal || null,
        proposals: Array.isArray(resolved.graph?.proposals) ? resolved.graph.proposals : [],
        agreements: Array.isArray(resolved.graph?.agreements) ? resolved.graph.agreements : [],
        invoices: Array.isArray(resolved.graph?.invoices) ? resolved.graph.invoices : [],
        receipts: Array.isArray(resolved.graph?.receipts) ? resolved.graph.receipts : []
      };

      const owners = [
        normalizedGraph.lead?.owner,
        normalizedGraph.deal?.owner,
        ...normalizedGraph.proposals.map(item => item.owner),
        ...normalizedGraph.agreements.map(item => item.owner),
        ...normalizedGraph.invoices.map(item => item.owner),
        ...normalizedGraph.receipts.map(item => item.owner),
        ...normalizedTimeline.map(item => item.user)
      ];
      this.updateOwnerFilterOptions(owners);

      const computedMetrics = resolved.metrics && Object.keys(resolved.metrics).length
        ? resolved.metrics
        : this.buildMetrics(normalizedGraph, normalizedTimeline);

      const computedSummary = resolved.summary && Object.keys(resolved.summary).length
        ? {
            current_stage: resolved.summary.current_stage || resolved.summary.currentStage,
            customer_company: resolved.summary.customer_company || resolved.summary.customerCompany,
            owner: resolved.summary.owner,
            status: resolved.summary.status,
            estimated_value: this.num(resolved.summary.estimated_value || resolved.summary.estimatedValue),
            lifecycle_duration: resolved.summary.lifecycle_duration || resolved.summary.lifecycleDuration,
            last_activity: resolved.summary.last_activity || resolved.summary.lastActivity,
            next_action: resolved.summary.next_action || resolved.summary.nextAction
          }
        : this.buildSummary(normalizedGraph, normalizedTimeline, computedMetrics);

      const computedInsights = Array.isArray(resolved.insights) && resolved.insights.length
        ? resolved.insights
        : this.buildInsights(normalizedGraph, computedMetrics);

      const filtered = this.applyViewFilters(normalizedTimeline, normalizedGraph);
      this.state.result = {
        summary: computedSummary,
        graph: normalizedGraph,
        timeline: normalizedTimeline,
        metrics: computedMetrics,
        insights: computedInsights,
        filtered
      };
      this.renderResults();
    } catch (error) {
      this.state.error = String(error?.message || 'Unable to load lifecycle analytics.');
      this.renderError(this.state.error);
    } finally {
      this.state.loading = false;
    }
  },
  reapplyFilters() {
    if (!this.state.result) return;
    this.state.result.filtered = this.applyViewFilters(this.state.result.timeline, this.state.result.graph);
    this.renderResults();
  },
  wire() {
    const searchBtn = document.getElementById('lifecycleSearchBtn');
    const searchInput = document.getElementById('lifecycleSearchInput');
    const dateFrom = document.getElementById('lifecycleDateFrom');
    const dateTo = document.getElementById('lifecycleDateTo');
    const stage = document.getElementById('lifecycleStageFilter');
    const owner = document.getElementById('lifecycleOwnerFilter');
    const exportBtn = document.getElementById('lifecycleExportBtn');
    const resultBody = document.getElementById('lifecycleResultBody');

    if (searchBtn) searchBtn.addEventListener('click', () => this.search());
    if (searchInput) {
      searchInput.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
          event.preventDefault();
          this.search();
        }
      });
    }

    const bindFilter = (element, key) => {
      if (!element) return;
      element.addEventListener('change', () => {
        this.state[key] = this.text(element.value || (key === 'stage' || key === 'owner' ? 'All' : ''));
        if (this.state.hasSearched) this.reapplyFilters();
      });
    };

    bindFilter(dateFrom, 'dateFrom');
    bindFilter(dateTo, 'dateTo');
    bindFilter(stage, 'stage');
    bindFilter(owner, 'owner');

    if (exportBtn) exportBtn.addEventListener('click', () => UI.toast('Export placeholder: PDF/print export will be added in a future release.'));

    if (resultBody) {
      resultBody.addEventListener('click', event => {
        const openBtn = event.target.closest('[data-lifecycle-open-view]');
        if (!openBtn) return;
        const view = this.text(openBtn.getAttribute('data-lifecycle-open-view'));
        if (view && typeof setActiveView === 'function') setActiveView(view);
      });
    }
  },
  init() {
    if (this.state.initialized) return;
    this.state.initialized = true;
    this.wire();
  }
};

window.LifecycleAnalytics = LifecycleAnalytics;
