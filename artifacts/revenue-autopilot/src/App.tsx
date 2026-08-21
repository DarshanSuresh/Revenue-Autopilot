import { type ReactNode, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Activity, ArrowDownRight, ArrowUpRight, BarChart3, Bell, BookOpen,
  BrainCircuit, Check, ChevronRight, CircleAlert, CircleCheck, Command,
  Database, FlaskConical, Gauge, LayoutDashboard, Menu, Play, RefreshCw,
  Search, ShieldCheck, SlidersHorizontal, Sparkles, Target, UsersRound,
  WalletCards, X,
} from 'lucide-react';
import {
  useGetAuditTrail, useGetCustomerRecoveryProfile, useGetLeakageCategories,
  useGetRecoveryQueue, useGetRevenueSummary, useHealthCheck,
  useRunJudgeDemo, useRunRecoverySimulation, useTriggerChaosDemo,
  getGetCustomerRecoveryProfileQueryKey,
} from '@workspace/api-client-react';
import type {
  AuditEvent, ChaosResult, CustomerProfile, DemoResult, LeakageCategory,
  RecoveryOpportunity, RevenueSummary, SimulationResult,
} from '@workspace/api-client-react';
import { Link, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import NotFound from '@/pages/not-found';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

const queryClient = new QueryClient();

const fallbackSummary: RevenueSummary = { processed: 284690, atRisk: 18420, recoverable: 12680, recovered: 8740, recoveryRate: 47.5, incremental: 7210, interventionCost: 612, netRecovered: 6598, transactions: 12842, customers: 5910 };
const fallbackLeakage: LeakageCategory[] = [
  { id: 'soft-decline', label: 'Soft declines', lost: 6820, recoverable: 5115, probability: 75, share: 37, color: '#ef9c4f' },
  { id: 'expired-card', label: 'Expired card', lost: 4840, recoverable: 3270, probability: 68, share: 26, color: '#3f9b79' },
  { id: 'insufficient', label: 'Insufficient funds', lost: 3920, recoverable: 2140, probability: 54, share: 17, color: '#6579a5' },
  { id: 'network', label: 'Network timeout', lost: 2840, recoverable: 1560, probability: 55, share: 12, color: '#bd725b' },
  { id: 'other', label: 'Other', lost: 0, recoverable: 595, probability: 33, share: 8, color: '#98a69c' },
];
const fallbackQueue: RecoveryOpportunity[] = [
  { id: 'opp_1', customerId: 'cus_2048', customer: 'Northstar Studio', amount: 1280, failureReason: 'Soft decline · do not honor', probability: 0.82, expectedRecovery: 1049, expectedNet: 1008, action: 'Retry with network token', priority: 'critical', confidence: 0.94, status: 'queued', retryCount: 0, paymentMethod: 'Visa ···· 4821' },
  { id: 'opp_2', customerId: 'cus_7710', customer: 'Morrow & Finch', amount: 680, failureReason: 'Card expired', probability: 0.71, expectedRecovery: 483, expectedNet: 463, action: 'Send update payment link', priority: 'high', confidence: 0.89, status: 'queued', retryCount: 1, paymentMethod: 'Amex ···· 0918' },
  { id: 'opp_3', customerId: 'cus_3902', customer: 'Lantern Works', amount: 445, failureReason: 'Insufficient funds', probability: 0.64, expectedRecovery: 285, expectedNet: 270, action: 'Retry in 48 hours', priority: 'high', confidence: 0.84, status: 'review', retryCount: 0, paymentMethod: 'Mastercard ···· 7022' },
  { id: 'opp_4', customerId: 'cus_1129', customer: 'August Field', amount: 310, failureReason: 'Network timeout', probability: 0.58, expectedRecovery: 180, expectedNet: 168, action: 'Retry once now', priority: 'medium', confidence: 0.78, status: 'queued', retryCount: 1, paymentMethod: 'Visa ···· 3340' },
  { id: 'opp_5', customerId: 'cus_8911', customer: 'Kite Assembly', amount: 218, failureReason: 'Soft decline · offline', probability: 0.53, expectedRecovery: 116, expectedNet: 108, action: 'Retry with alternate route', priority: 'medium', confidence: 0.76, status: 'held', retryCount: 2, paymentMethod: 'Visa ···· 5104' },
];
const fallbackProfile: CustomerProfile = { id: 'cus_2048', name: 'Northstar Studio', outstanding: 1280, probability: .82, value: 'Strategic', behavior: 'Reliable monthly buyer · usually pays within 2 hours', recentFailures: 1, successfulRecoveries: 4, recommendedAction: 'Retry with network token', expectedRecovery: 1049, confidence: .94, why: 'The last three successful payments used the same tokenized route. This decline is isolated, and the account has no recent retry fatigue.', factors: ['3 successful tokenized payments', 'No retry in the last 30 days', 'Monthly invoice pattern', 'High account value'] };

const money = (value = 0) => `$${Math.round(value).toLocaleString('en-US')}`;
const pct = (value = 0) => `${(value > 1 ? value : value * 100).toFixed(value > 1 ? 1 : 0)}%`;
const initials = (name: string) => name.split(' ').map((part) => part[0]).slice(0, 2).join('');

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} data-testid="loading-skeleton" />;
}
function LoadingBlock() {
  return <div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div>;
}
function StateMessage({ kind, onRetry }: { kind: 'empty' | 'error'; onRetry?: () => void }) {
  const error = kind === 'error';
  return <div className="surface flex min-h-44 flex-col items-center justify-center p-8 text-center" data-testid={`${kind}-state`}>
    {error ? <CircleAlert className="mb-3 text-[#bd725b]" size={24} /> : <Database className="mb-3 text-[#7e9c8c]" size={24} />}
    <p className="font-semibold">{error ? 'The signal is unavailable' : 'Nothing in this view yet'}</p>
    <p className="mt-1 max-w-sm text-sm text-muted-foreground">{error ? 'Revenue Autopilot is showing safe test data where possible. Try the connection again.' : 'As events arrive, this workspace will become your operating surface.'}</p>
    {error && onRetry && <button onClick={onRetry} data-testid="button-retry" className="btn-quiet mt-4 rounded-md px-3 py-2 text-xs font-semibold">Retry connection</button>}
  </div>;
}

const navItems = [
  { href: '/', label: 'Command center', icon: LayoutDashboard },
  { href: '/queue', label: 'Recovery queue', icon: Target },
  { href: '/simulator', label: 'Simulator', icon: FlaskConical },
  { href: '/business-impact', label: 'Business impact', icon: BarChart3 },
  { href: '/audit', label: 'Audit trail', icon: ShieldCheck },
];

function Shell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const health = useHealthCheck();
  const healthy = health.data?.status === 'ok' || health.data?.status === 'healthy';
  return <div className="cockpit flex">
    <aside className="sidebar fixed inset-y-0 left-0 z-30 hidden w-[238px] flex-col px-4 py-5 lg:flex">
      <Link href="/" className="mb-9 flex items-center gap-3 px-2" data-testid="link-brand">
        <span className="brand-mark flex h-9 w-9 items-center justify-center rounded-lg"><Command size={19} strokeWidth={2.5} /></span>
        <span><span className="display block text-[17px] font-bold tracking-tight">Revenue</span><span className="mono block text-[9px] uppercase tracking-[.2em] text-[#89a89b]">Autopilot</span></span>
      </Link>
      <div className="mb-3 px-2 text-[9px] font-bold uppercase tracking-[.2em] text-[#6e8e84]">Operate</div>
      <nav className="space-y-1">
        {navItems.slice(0, 3).map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setOpen(false)} className={`nav-link flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-semibold ${location === href ? 'active' : ''}`} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`}><Icon size={16} /><span>{label}</span>{href === '/queue' && <span className="mono ml-auto rounded-full bg-[#ef9c4f] px-1.5 py-0.5 text-[9px] font-medium text-[#193333]">24</span>}</Link>)}
      </nav>
      <div className="mb-3 mt-8 px-2 text-[9px] font-bold uppercase tracking-[.2em] text-[#6e8e84]">Measure</div>
      <nav className="space-y-1">
        {navItems.slice(3).map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setOpen(false)} className={`nav-link flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-semibold ${location === href ? 'active' : ''}`} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`}><Icon size={16} /><span>{label}</span></Link>)}
      </nav>
      <div className="mt-auto rounded-xl border border-[#315352] bg-[#1b3b3b] p-3">
        <div className="flex items-center gap-2 text-[11px] font-semibold"><span className="status-dot" /> {health.isLoading ? 'Checking systems' : healthy ? 'Systems nominal' : 'Safe test mode'}</div>
        <div className="mono mt-2 text-[10px] text-[#84a59a]">Last sync · 14 sec ago</div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-[#315352]"><div className="h-full w-[84%] rounded-full bg-[#63c499]" /></div>
      </div>
      <div className="mt-4 flex items-center gap-2 border-t border-[#315352] px-2 pt-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#d9e6d9] text-[10px] font-bold text-[#25473e]">MC</div>
        <div><div className="text-[11px] font-semibold">Maya Chen</div><div className="text-[10px] text-[#82a097]">Revenue operator</div></div>
      </div>
    </aside>
    {open && <div className="fixed inset-0 z-20 bg-[#152d2e]/40 lg:hidden" onClick={() => setOpen(false)} />}
    <aside className={`sidebar fixed inset-y-0 left-0 z-30 flex w-[238px] flex-col px-4 py-5 transition-transform lg:hidden ${open ? 'translate-x-0' : '-translate-x-full'}`}>
      <button onClick={() => setOpen(false)} data-testid="button-close-menu" className="absolute right-3 top-4 text-[#91aaa3]"><X size={18} /></button>
      <Link href="/" onClick={() => setOpen(false)} className="mb-9 flex items-center gap-3 px-2"><span className="brand-mark flex h-9 w-9 items-center justify-center rounded-lg"><Command size={19} /></span><span className="display text-[17px] font-bold">Revenue <span className="mono text-[9px] text-[#89a89b]">AUTOPILOT</span></span></Link>
      {navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setOpen(false)} className={`nav-link mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-semibold ${location === href ? 'active' : ''}`}><Icon size={16} />{label}</Link>)}
    </aside>
    <div className="min-w-0 flex-1 lg:ml-[238px]">
      <header className="flex h-[67px] items-center justify-between border-b border-border bg-[#f7f4e9]/85 px-5 backdrop-blur-md dark:bg-background/85 md:px-8">
        <div className="mobile-menu items-center gap-3"><button onClick={() => setOpen(true)} data-testid="button-open-menu" className="rounded-md p-2 hover:bg-muted"><Menu size={19} /></button><span className="display font-bold">Revenue Autopilot</span></div>
        <div className="hidden items-center gap-2 text-[11px] text-muted-foreground md:flex"><span className={`status-dot ${healthy ? '' : 'opacity-50'}`} /><span className="mono">{health.isLoading ? 'CHECKING SYSTEMS' : healthy ? 'LIVE MONITORING' : 'SAFE TEST MODE'}</span><span className="mx-2 text-border">/</span><span>Today, 24 Jun 2024</span></div>
        <div className="relative ml-auto flex items-center gap-2"><button onClick={() => setNotificationsOpen((value) => !value)} data-testid="button-notifications" className="rounded-md p-2 text-muted-foreground hover:bg-muted"><Bell size={17} /></button>{notificationsOpen && <div className="surface absolute right-0 top-10 z-20 w-64 p-3 text-xs" data-testid="panel-notifications"><div className="font-bold">Operator notices</div><div className="mt-2 flex gap-2 rounded-md bg-muted p-2 text-muted-foreground"><CircleCheck size={14} className="shrink-0 text-primary" /> All policy checks are passing.</div><button onClick={() => setNotificationsOpen(false)} className="mt-2 text-[10px] font-bold text-primary" data-testid="button-dismiss-notifications">Dismiss</button></div>}<div className="hidden h-7 w-px bg-border sm:block" /><div className="mono hidden text-[10px] text-muted-foreground sm:block">MERCHANT · NSTR-042</div></div>
      </header>
      <main className="page-main mx-auto max-w-[1420px] px-5 py-7 md:px-8">{children}</main>
    </div>
  </div>;
}

function PageHeading({ kicker, title, detail, action }: { kicker: string; title: string; detail?: string; action?: ReactNode }) {
  return <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><div className="eyebrow mb-2">{kicker}</div><h1 className="display mobile-title text-[38px] font-bold leading-[.98]">{title}</h1>{detail && <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{detail}</p>}</div>{action}</div>;
}
function Metric({ label, value, note, accent = false, trend }: { label: string; value: string; note: string; accent?: boolean; trend?: 'up' | 'down' }) {
  return <div className={`metric p-4 ${accent ? 'metric-accent' : ''}`} data-testid={`metric-${label.toLowerCase().replaceAll(' ', '-')}`}><div className="eyebrow">{label}</div><div className="display mt-2 text-[27px] font-bold tracking-tight">{value}</div><div className="mt-2 flex items-center gap-1 text-[11px] opacity-75">{trend === 'up' ? <ArrowUpRight size={13} /> : trend === 'down' ? <ArrowDownRight size={13} /> : null}{note}</div></div>;
}

function Overview() {
  const summaryQuery = useGetRevenueSummary();
  const leakageQuery = useGetLeakageCategories();
  const queueQuery = useGetRecoveryQueue();
  const demo = useRunJudgeDemo();
  const summary = summaryQuery.data || fallbackSummary;
  const leakage = leakageQuery.data || fallbackLeakage;
  const queue = queueQuery.data || fallbackQueue;
  const [demoResult, setDemoResult] = useState<DemoResult | null>(null);
  const runDemo = () => demo.mutate(undefined, { onSuccess: setDemoResult, onError: () => setDemoResult({ recovered: 8740, incremental: 7210, decisions: 184, recoveryRate: 47.5, events: ['Safe test-mode result · API unavailable'] }) });
  return <div className="fade-in">
    <PageHeading kicker="Command center / Revenue operations" title="Find the money before it goes." detail="A bounded recovery system for the revenue you already earned. Every decision is explainable. Every action has a ceiling." action={<div className="flex gap-2"><Link href="/simulator" className="btn-quiet flex items-center gap-2 rounded-md px-3 py-2 text-xs font-bold" data-testid="link-open-simulator"><FlaskConical size={14} /> Simulate</Link><button onClick={runDemo} disabled={demo.isPending} className="btn-primary flex items-center gap-2 rounded-md px-3 py-2 text-xs font-bold" data-testid="button-run-demo"><Play size={13} /> {demo.isPending ? 'Running…' : 'Run judge demo'}</button></div>} />
    {demoResult && <div className="mb-5 flex flex-wrap items-center gap-4 rounded-lg border border-[#9acfb3] bg-[#eaf6ed] px-4 py-3 text-sm text-[#285c48]" data-testid="status-demo-result"><CircleCheck size={17} /><b>Demo complete</b><span>{money(demoResult.incremental)} incremental revenue</span><span className="mono text-xs">{demoResult.decisions} bounded decisions</span><button className="ml-auto" onClick={() => setDemoResult(null)} data-testid="button-dismiss-demo"><X size={15} /></button></div>}
    <div className="metric-grid mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Metric label="Processed" value={money(summary.processed)} note={`${summary.transactions.toLocaleString()} transactions`} />
      <Metric label="At risk" value={money(summary.atRisk)} note={`${(summary.atRisk / summary.processed * 100).toFixed(1)}% of processed`} trend="down" />
      <Metric label="Recoverable" value={money(summary.recoverable)} note="Bounded opportunity" accent />
      <Metric label="Recovered" value={money(summary.recovered)} note={`${pct(summary.recoveryRate)} recovery rate`} trend="up" />
      <Metric label="Incremental" value={money(summary.incremental)} note="vs. no intervention" trend="up" />
      <Metric label="Net recovered" value={money(summary.netRecovered)} note={`${money(summary.interventionCost)} intervention cost`} accent />
    </div>
    <div className="hero-grid grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
      <section className="surface grid-paper p-5 md:p-6" data-testid="section-leakage-analysis">
        <div className="mb-6 flex items-start justify-between"><div><div className="eyebrow">Leakage analysis</div><h2 className="display mt-1 text-xl font-bold">Where revenue slips</h2></div><span className="pill border border-border px-2.5 py-1 text-[10px] font-bold text-muted-foreground">LAST 30 DAYS</span></div>
        <div className="space-y-5">{leakage.map((item, index) => <div key={item.id} data-testid={`row-leakage-${item.id}`}><div className="mb-1.5 flex items-center justify-between text-xs"><span className="font-semibold">{item.label}</span><span className="mono text-[11px] text-muted-foreground">{money(item.lost)} lost <span className="mx-1 text-border">·</span> {money(item.recoverable)} recoverable</span></div><div className="progress-track"><div className="progress-fill" style={{ width: `${Math.max(item.share * 1.7, 5)}%`, background: item.color, animationDelay: `${index * 80}ms` }} /></div><div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground"><span>{item.share}% of leakage</span><span className="mono">P(recovery) {pct(item.probability)}</span></div></div>)}</div>
        <div className="mt-7 flex items-center gap-3 border-t border-border pt-4 text-xs text-muted-foreground"><BrainCircuit size={16} className="text-primary" /><span>Model focus: retry timing and payment route selection account for 61% of modeled recovery.</span></div>
      </section>
      <section className="surface overflow-hidden p-5 md:p-6" data-testid="section-recovery-forecast">
        <div className="eyebrow">Recovery forecast</div><h2 className="display mt-1 text-xl font-bold">Money in motion</h2>
        <div className="relative mt-8 h-[184px] border-b border-l border-border"><div className="absolute inset-x-0 top-0 border-t border-dashed border-border" /><div className="absolute inset-x-0 top-1/2 border-t border-dashed border-border" /><div className="absolute -left-1 bottom-2 flex h-[132px] w-[88%] items-end gap-1"><div className="h-[20%] flex-1 rounded-t-sm bg-[#d5dfd7]" /><div className="h-[32%] flex-1 rounded-t-sm bg-[#d5dfd7]" /><div className="h-[28%] flex-1 rounded-t-sm bg-[#d5dfd7]" /><div className="h-[45%] flex-1 rounded-t-sm bg-[#c2d9c9]" /><div className="h-[53%] flex-1 rounded-t-sm bg-[#a9cfbb]" /><div className="h-[66%] flex-1 rounded-t-sm bg-[#83c19f]" /><div className="h-[79%] flex-1 rounded-t-sm bg-[#57ae83]" /><div className="h-[100%] flex-1 rounded-t-sm bg-[#236b5a]" /></div><div className="absolute bottom-[125px] left-[76%] rounded-md bg-[#173e39] px-2 py-1 text-[10px] font-bold text-white">+{money(summary.incremental)}</div></div>
        <div className="mt-4 flex justify-between text-[10px] text-muted-foreground"><span>01 Jun</span><span>08 Jun</span><span>15 Jun</span><span>24 Jun</span></div>
        <div className="mt-6 grid grid-cols-2 gap-3"><div className="rounded-lg bg-muted p-3"><div className="eyebrow">Expected this week</div><div className="display mt-1 text-lg font-bold">{money(3210)}</div></div><div className="rounded-lg bg-[#fff1dd] p-3 text-[#754a25]"><div className="eyebrow text-[#a36c37]">Cost guardrail</div><div className="display mt-1 text-lg font-bold">7.1%</div></div></div>
      </section>
    </div>
    <section className="surface mt-5 overflow-hidden" data-testid="section-priority-queue">
      <div className="flex items-center justify-between border-b border-border px-5 py-4"><div><div className="eyebrow">Priority queue</div><h2 className="display mt-1 text-xl font-bold">Fastest path to recovered revenue</h2></div><Link href="/queue" className="flex items-center gap-1 text-xs font-bold text-primary hover:gap-2" data-testid="link-view-queue">View all <ChevronRight size={14} /></Link></div>
      <div className="table-scroll"><div className="table-min">{queue.slice(0, 4).map((item) => <OpportunityRow key={item.id} item={item} />)}</div></div>
    </section>
  </div>;
}

function OpportunityRow({ item }: { item: RecoveryOpportunity }) {
  return <Link href={`/customers/${item.customerId}`} className="data-row grid grid-cols-[1.5fr_1fr_.8fr_.8fr_auto] items-center gap-4 px-5 py-4" data-testid={`row-opportunity-${item.id}`}>
    <div className="flex items-center gap-3"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#dbe8dc] text-[10px] font-bold text-[#2b6250]">{initials(item.customer)}</div><div><div className="text-xs font-bold">{item.customer}</div><div className="mt-0.5 text-[10px] text-muted-foreground">{item.failureReason}</div></div></div>
    <div><div className="eyebrow">Outstanding</div><div className="mono mt-1 text-xs font-medium">{money(item.amount)}</div></div>
    <div><div className="eyebrow">Expected net</div><div className="mono mt-1 text-xs font-medium text-primary">{money(item.expectedNet)}</div></div>
    <div><div className="eyebrow">Action</div><div className="mt-1 truncate text-[11px] font-semibold">{item.action}</div></div>
    <div className="flex items-center gap-2"><span className={`pill px-2 py-1 text-[10px] font-bold ${item.priority === 'critical' ? 'bg-[#f9dfd4] text-[#974b39]' : 'bg-[#fff0d9] text-[#93602a]'}`}>{item.priority}</span><ChevronRight size={15} className="text-muted-foreground" /></div>
  </Link>;
}

function Queue() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const query = useGetRecoveryQueue({ search: search || undefined, status: status || undefined });
  const rows = query.data || fallbackQueue;
  const filtered = useMemo(() => rows.filter((x) => !search || `${x.customer} ${x.failureReason}`.toLowerCase().includes(search.toLowerCase())), [rows, search]);
  return <div className="fade-in">
    <PageHeading kicker="Operate / Recovery queue" title="Decisions, ranked." detail="The queue is ordered by expected net recovery — not by account size. Each row is a bounded intervention, ready for review." action={<div className="pill flex items-center gap-2 bg-[#e5f1e8] px-3 py-2 text-[11px] font-bold text-[#27614e]"><Activity size={14} /> 24 opportunities live</div>} />
    <div className="surface mb-4 flex flex-col gap-3 p-3 md:flex-row md:items-center"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customers or failure reasons" className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary" data-testid="input-queue-search" /></div><div className="flex items-center gap-2"><SlidersHorizontal size={15} className="text-muted-foreground" /><select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-md border border-border bg-background px-3 text-xs font-semibold outline-none" data-testid="select-queue-status"><option value="">All statuses</option><option value="queued">Queued</option><option value="review">Needs review</option><option value="held">Held</option></select><button onClick={() => { setSearch(''); setStatus(''); }} className="btn-quiet h-10 rounded-md px-3 text-xs font-bold" data-testid="button-clear-filters">Clear</button></div></div>
    <div className="mb-4 flex items-center justify-between text-xs text-muted-foreground"><span>{filtered.length} opportunities · ranked by expected net</span><span className="mono">MODEL v2.4 · BOUNDED</span></div>
    {query.isError && !query.data ? <StateMessage kind="error" onRetry={() => query.refetch()} /> : filtered.length === 0 ? <StateMessage kind="empty" /> : <section className="surface overflow-hidden"><div className="hidden grid-cols-[1.5fr_1fr_.8fr_.8fr_auto] gap-4 bg-muted px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground md:grid"><span>Customer / signal</span><span>Outstanding</span><span>Expected net</span><span>Recommended action</span><span>Priority</span></div><div className="table-scroll"><div className="table-min">{filtered.map((item) => <OpportunityRow key={item.id} item={item} />)}</div></div></section>}
  </div>;
}

function Customer() {
  const { customerId } = useParams<{ customerId: string }>();
  const query = useGetCustomerRecoveryProfile(customerId || 'cus_2048', { query: { enabled: Boolean(customerId), queryKey: getGetCustomerRecoveryProfileQueryKey(customerId || 'cus_2048') } });
  const profile = query.data || { ...fallbackProfile, id: customerId || fallbackProfile.id };
  const [held, setHeld] = useState(false);
  return <div className="fade-in">
    <Link href="/queue" className="mb-5 inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-primary" data-testid="link-back-queue">← Back to queue</Link>
    <PageHeading kicker={`Customer profile / ${profile.id}`} title={profile.name} detail="A compact view of payment behavior, modeled value, and the reasoning behind the next safe action." action={<span className="pill flex items-center gap-2 border border-[#9acfb3] bg-[#eaf6ed] px-3 py-2 text-[11px] font-bold text-[#27614e]"><span className="status-dot" /> Decision ready</span>} />
    {query.isError && <div className="mb-4 rounded-md bg-[#fff1dd] px-3 py-2 text-xs text-[#754a25]" data-testid="status-test-mode">Test mode · customer data is illustrative while the profile service reconnects.</div>}
    <div className="metric-grid mb-5 grid grid-cols-2 gap-3 md:grid-cols-4"><Metric label="Outstanding" value={money(profile.outstanding)} note="Current failed payment" accent /><Metric label="P(recovery)" value={pct(profile.probability)} note={`${pct(profile.confidence)} model confidence`} trend="up" /><Metric label="Account value" value={profile.value} note="Based on 12 month behavior" /><Metric label="Past recoveries" value={String(profile.successfulRecoveries)} note={`${profile.recentFailures} recent failure`} /></div>
    <div className="two-col grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
      <section className="surface p-5 md:p-6" data-testid="section-ai-decision"><div className="mb-5 flex items-start justify-between"><div><div className="eyebrow">Explainable decision</div><h2 className="display mt-1 text-2xl font-bold">Recommended intervention</h2></div><div className="rounded-lg bg-[#e4f1e8] p-2 text-primary"><BrainCircuit size={20} /></div></div><div className="rounded-xl border border-[#9acfb3] bg-[#edf7ef] p-4"><div className="eyebrow text-[#3b755c]">Bounded action</div><div className="mt-1 text-lg font-bold text-[#214d3d]">{profile.recommendedAction}</div><p className="mt-2 text-sm leading-relaxed text-[#456c5d]">{profile.why}</p><div className="mt-4 flex flex-wrap gap-2"><span className="pill bg-[#d3eade] px-2.5 py-1 text-[10px] font-bold text-[#2e6953]">Max 1 retry</span><span className="pill bg-[#d3eade] px-2.5 py-1 text-[10px] font-bold text-[#2e6953]">No discount</span><span className="pill bg-[#d3eade] px-2.5 py-1 text-[10px] font-bold text-[#2e6953]">Stop after success</span></div></div><div className="mt-6"><div className="eyebrow mb-3">Decision factors</div><div className="grid gap-2 sm:grid-cols-2">{profile.factors.map((factor, i) => <div key={factor} className="flex items-center gap-2 rounded-md bg-muted px-3 py-2.5 text-xs font-semibold"><Check size={14} className={i === 0 ? 'text-primary' : 'text-muted-foreground'} />{factor}</div>)}</div></div><div className="mt-6 flex gap-2"><Link href="/simulator" className="btn-primary flex items-center gap-2 rounded-md px-4 py-2.5 text-xs font-bold" data-testid="link-simulate-customer"><FlaskConical size={14} /> Test this action</Link><button onClick={() => setHeld((value) => !value)} className={`btn-quiet rounded-md px-4 py-2.5 text-xs font-bold ${held ? 'bg-[#fff0d9] text-[#93602a]' : ''}`} data-testid="button-hold-customer">{held ? 'Decision held' : 'Hold decision'}</button></div></section>
      <section className="surface p-5 md:p-6" data-testid="section-customer-history"><div className="eyebrow">Payment history</div><h2 className="display mt-1 text-xl font-bold">Signal, not noise</h2><div className="mt-6 space-y-5"><HistoryItem icon={<CircleAlert size={14} />} title="Payment declined" detail="Soft decline · do not honor" time="Today, 09:42" tone="warn" /><HistoryItem icon={<RefreshCw size={14} />} title="Recovery held" detail="Waiting for safe retry window" time="Today, 09:43" tone="neutral" /><HistoryItem icon={<CircleCheck size={14} />} title="Payment recovered" detail="Network token · $1,180" time="28 May, 14:06" tone="good" /><HistoryItem icon={<CircleCheck size={14} />} title="Payment recovered" detail="Network token · $1,180" time="28 Apr, 11:21" tone="good" /></div><div className="mt-8 border-t border-border pt-5"><div className="flex items-center justify-between"><span className="text-xs font-semibold">Expected recovery</span><span className="mono text-lg font-bold text-primary">{money(profile.expectedRecovery)}</span></div><div className="progress-track mt-3"><div className="progress-fill w-[82%] bg-primary" /></div><div className="mt-2 flex justify-between text-[10px] text-muted-foreground"><span>0</span><span>Outstanding {money(profile.outstanding)}</span></div></div></section>
    </div>
  </div>;
}
function HistoryItem({ icon, title, detail, time, tone }: { icon: ReactNode; title: string; detail: string; time: string; tone: string }) {
  return <div className="flex gap-3"><div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${tone === 'good' ? 'bg-[#d9eee0] text-primary' : tone === 'warn' ? 'bg-[#f8e3d7] text-[#b9654c]' : 'bg-muted text-muted-foreground'}`}>{icon}</div><div className="min-w-0 flex-1"><div className="flex justify-between gap-2 text-xs font-bold"><span>{title}</span><span className="mono whitespace-nowrap text-[10px] font-normal text-muted-foreground">{time}</span></div><div className="mt-1 text-[11px] text-muted-foreground">{detail}</div></div></div>;
}

const localSimulation = (transactions: number): SimulationResult => ({ transactions, atRisk: Math.round(transactions * .064), incremental: Math.round(transactions * .064 * 29.7), heldOut: .2, baselines: [{ name: 'No intervention', recovered: 0, rate: 0, cost: 0, contacts: 0, falseInterventions: 0, net: 0 }, { name: 'Rules only', recovered: Math.round(transactions * .008), rate: 0.125, cost: 410, contacts: 142, falseInterventions: 32, net: Math.round(transactions * .008) - 410 }], model: { name: 'Autopilot model', recovered: Math.round(transactions * .0297), rate: .463, cost: 612, contacts: 184, falseInterventions: 11, net: Math.round(transactions * .0297) - 612 } });
function Simulator() {
  const run = useRunRecoverySimulation();
  const [transactions, setTransactions] = useState(10000);
  const [seed, setSeed] = useState(240624);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const execute = () => run.mutate({ data: { transactions, seed } }, { onSuccess: setResult, onError: () => setResult(localSimulation(transactions)) });
  const shown = result || localSimulation(transactions);
  return <div className="fade-in"><PageHeading kicker="Test / Recovery simulator" title="Prove the lift safely." detail="Reproduce a baseline-versus-model evaluation on held-out transactions. Change the seed to inspect a different cohort; no live payments are touched." action={<span className="pill border border-border bg-card px-3 py-2 text-[10px] font-bold text-muted-foreground"><ShieldCheck size={13} className="mr-1 inline text-primary" /> NO LIVE ACTIONS</span>} />
    <div className="two-col grid gap-5 lg:grid-cols-[.7fr_1.3fr]"><section className="surface p-5 md:p-6" data-testid="section-simulation-controls"><div className="eyebrow">Experiment controls</div><h2 className="display mt-1 text-xl font-bold">Reproducible inputs</h2><label className="mt-7 block text-xs font-bold">Transactions <span className="float-right mono text-muted-foreground">{transactions.toLocaleString()}</span></label><input type="range" min="1000" max="100000" step="1000" value={transactions} onChange={(e) => setTransactions(Number(e.target.value))} className="mt-3 w-full accent-[#236b5a]" data-testid="input-transactions" /><div className="mt-1 flex justify-between text-[10px] text-muted-foreground"><span>1,000</span><span>100,000</span></div><label className="mt-7 block text-xs font-bold">Random seed</label><div className="relative mt-2"><Command className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} /><input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 font-mono text-sm outline-none focus:border-primary" data-testid="input-seed" /></div><div className="mt-6 rounded-lg bg-muted p-3 text-xs leading-relaxed text-muted-foreground"><div className="mb-1 flex items-center gap-2 font-bold text-foreground"><BookOpen size={14} className="text-primary" /> Evaluation protocol</div>80% train · 20% held-out. The model cannot see the evaluation cohort while choosing interventions.</div><button onClick={execute} disabled={run.isPending} className="btn-primary mt-6 flex w-full items-center justify-center gap-2 rounded-md py-3 text-xs font-bold" data-testid="button-run-simulation"><Play size={14} /> {run.isPending ? 'Evaluating cohort…' : 'Run simulation'}</button></section>
      <section className="surface overflow-hidden" data-testid="section-simulation-results"><div className="border-b border-border bg-[#173e39] px-5 py-5 text-[#eaf6ef] md:px-6"><div className="eyebrow text-[#8ecdb1]">Held-out evaluation · seed {seed}</div><div className="mt-2 flex flex-wrap items-end justify-between gap-3"><div><div className="display text-4xl font-bold">+{money(shown.incremental)}</div><div className="mt-1 text-xs text-[#9fc4b3]">incremental recovery vs. no intervention</div></div><div className="rounded-md bg-[#2e6858] px-3 py-2 text-xs font-bold">Evaluation share · {pct(shown.heldOut)}</div></div></div><div className="table-scroll"><div className="table-min"><div className="grid grid-cols-[1.3fr_repeat(4,.8fr)] gap-3 bg-muted px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"><span>Strategy</span><span>Recovered</span><span>Rate</span><span>Cost</span><span>Net</span></div>{shown.baselines.map((strategy) => <StrategyRow key={strategy.name} strategy={strategy} />)}<StrategyRow strategy={shown.model} featured /></div></div><div className="grid grid-cols-3 gap-px border-t border-border bg-border"><div className="bg-card p-4"><div className="eyebrow">At-risk volume</div><div className="mono mt-1 text-sm font-bold">{money(shown.atRisk)}</div></div><div className="bg-card p-4"><div className="eyebrow">Model contacts</div><div className="mono mt-1 text-sm font-bold">{shown.model.contacts}</div></div><div className="bg-card p-4"><div className="eyebrow">False actions</div><div className="mono mt-1 text-sm font-bold text-primary">{shown.model.falseInterventions}</div></div></div></section></div>
  </div>;
}
function StrategyRow({ strategy, featured = false }: { strategy: SimulationResult['model']; featured?: boolean }) {
  return <div className={`data-row grid grid-cols-[1.3fr_repeat(4,.8fr)] items-center gap-3 px-5 py-4 text-xs ${featured ? 'bg-[#edf7ef]' : ''}`}><span className="font-bold">{featured && <Sparkles size={13} className="mr-1 inline text-primary" />}{strategy.name}</span><span className="mono">{money(strategy.recovered)}</span><span className="mono">{pct(strategy.rate)}</span><span className="mono">{money(strategy.cost)}</span><span className={`mono font-bold ${featured ? 'text-primary' : ''}`}>{money(strategy.net)}</span></div>;
}

function BusinessImpact() {
  const query = useGetRevenueSummary();
  const s = query.data || fallbackSummary;
  return <div className="fade-in"><PageHeading kicker="Measure / Business impact" title="Revenue you can defend." detail="The clean readout: what was recovered, what was truly incremental, and what it cost to make that happen." action={<Link href="/audit" className="btn-quiet flex items-center gap-2 rounded-md px-3 py-2 text-xs font-bold" data-testid="link-impact-audit"><ShieldCheck size={14} /> Inspect audit trail</Link>} />
    <section className="surface overflow-hidden bg-[#173e39] text-[#eaf6ef]" data-testid="section-net-recovery"><div className="grid gap-8 p-6 md:grid-cols-[1fr_1fr] md:p-10"><div><div className="eyebrow text-[#8ecdb1]">Net recovered revenue</div><div className="display mt-4 text-6xl font-bold tracking-[-.07em]">{money(s.netRecovered)}</div><p className="mt-4 max-w-md text-sm leading-relaxed text-[#a9c8ba]">Revenue preserved after intervention cost. This is the number your finance team can take to the forecast.</p></div><div className="grid grid-cols-2 gap-3 self-end"><div className="rounded-lg bg-[#245146] p-4"><div className="eyebrow text-[#8ecdb1]">Gross recovered</div><div className="display mt-2 text-2xl font-bold">{money(s.recovered)}</div></div><div className="rounded-lg bg-[#245146] p-4"><div className="eyebrow text-[#8ecdb1]">Incremental lift</div><div className="display mt-2 text-2xl font-bold">+{money(s.incremental)}</div></div><div className="rounded-lg bg-[#245146] p-4"><div className="eyebrow text-[#8ecdb1]">Intervention cost</div><div className="display mt-2 text-2xl font-bold">−{money(s.interventionCost)}</div></div><div className="rounded-lg bg-[#ef9c4f] p-4 text-[#243b36]"><div className="eyebrow text-[#72502f]">ROI on action</div><div className="display mt-2 text-2xl font-bold">{(s.incremental / Math.max(s.interventionCost, 1)).toFixed(1)}×</div></div></div></div></section>
    <div className="mt-5 grid gap-5 lg:grid-cols-[.9fr_1.1fr]"><section className="surface p-6"><div className="eyebrow">Why this matters</div><h2 className="display mt-1 text-2xl font-bold">The quiet compounding effect.</h2><div className="mt-6 space-y-5"><ImpactLine icon={<WalletCards size={17} />} title="Protects existing demand" detail="Recovery starts with payment context, not a blanket discount." /><ImpactLine icon={<Gauge size={17} />} title="Keeps the cost bounded" detail="Every action is capped, logged, and stopped when the expected net turns negative." /><ImpactLine icon={<UsersRound size={17} />} title="Respects the customer" detail="The model chooses the lightest useful touch and avoids retry fatigue." /></div></section><section className="surface p-6"><div className="flex items-center justify-between"><div><div className="eyebrow">Operating efficiency</div><h2 className="display mt-1 text-2xl font-bold">From leak to ledger</h2></div><span className="mono text-xs text-primary">{pct(s.recoveryRate)} recovered</span></div><div className="mt-8 space-y-6"><ImpactBar label="At-risk revenue identified" value={s.atRisk} max={s.processed} color="#bd725b" /><ImpactBar label="Modeled as recoverable" value={s.recoverable} max={s.atRisk} color="#ef9c4f" /><ImpactBar label="Actually recovered" value={s.recovered} max={s.recoverable} color="#236b5a" /><ImpactBar label="Incremental contribution" value={s.incremental} max={s.recovered} color="#63b98e" /></div></section></div>
  </div>;
}
function ImpactLine({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) { return <div className="flex gap-3"><div className="rounded-md bg-[#e3f0e7] p-2 text-primary">{icon}</div><div><div className="text-sm font-bold">{title}</div><div className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</div></div></div>; }
function ImpactBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) { return <div><div className="mb-2 flex justify-between text-xs"><span className="font-semibold">{label}</span><span className="mono text-muted-foreground">{money(value)}</span></div><div className="progress-track h-3"><div className="progress-fill" style={{ width: `${Math.min(value / Math.max(max, 1) * 100, 100)}%`, background: color }} /></div></div>; }

function Audit() {
  const query = useGetAuditTrail();
  const chaos = useTriggerChaosDemo();
  const [scenario, setScenario] = useState('provider_timeout');
  const [chaosResult, setChaosResult] = useState<ChaosResult | null>(null);
  const events: AuditEvent[] = query.data || [
    { id: 'evt_901', time: '24 Jun · 09:43:12', type: 'POLICY_GUARD', detail: 'Held retry: customer exceeded contact frequency ceiling', amount: 0, status: 'blocked' },
    { id: 'evt_900', time: '24 Jun · 09:42:51', type: 'RECOVERY_ATTEMPT', detail: 'Network token retry approved for Northstar Studio', amount: 1049, status: 'success' },
    { id: 'evt_899', time: '24 Jun · 09:41:08', type: 'DECISION', detail: 'Ranked cus_2048 as critical opportunity', amount: 1280, status: 'recorded' },
    { id: 'evt_898', time: '24 Jun · 09:38:44', type: 'MODEL_REFRESH', detail: 'Recovery model v2.4 evaluated 12,842 transactions', amount: 0, status: 'complete' },
    { id: 'evt_897', time: '24 Jun · 09:32:02', type: 'RECOVERY_ATTEMPT', detail: 'Payment link sent to Morrow & Finch', amount: 483, status: 'pending' },
  ];
  const runChaos = () => chaos.mutate({ data: { scenario } }, { onSuccess: setChaosResult, onError: () => setChaosResult({ scenario, title: 'Provider timeout contained', action: 'No payment action was sent', status: 'contained', reason: 'The provider did not respond within the policy window.', nextAction: 'Retry only after health returns to nominal.' }) });
  return <div className="fade-in"><PageHeading kicker="Govern / Audit trail" title="Nothing happens off the record." detail="An immutable-style activity trail for decisions, policy checks, interventions, and safe failure behavior." action={<div className="pill flex items-center gap-2 border border-[#9acfb3] bg-[#eaf6ed] px-3 py-2 text-[11px] font-bold text-[#27614e]"><ShieldCheck size={14} /> Append-only log</div>} />
    <div className="two-col grid gap-5 lg:grid-cols-[1.25fr_.75fr]"><section className="surface overflow-hidden" data-testid="section-audit-events"><div className="flex items-center justify-between border-b border-border px-5 py-4"><div><div className="eyebrow">Activity trail</div><h2 className="display mt-1 text-xl font-bold">Recent events</h2></div><span className="mono text-[10px] text-muted-foreground">{events.length} EVENTS</span></div>{query.isError && <div className="bg-[#fff1dd] px-5 py-2 text-xs text-[#754a25]" data-testid="status-audit-test-mode">Showing signed test events · audit service unavailable.</div>}<div>{events.map((event) => <div key={event.id} className="data-row flex gap-3 px-5 py-4" data-testid={`row-audit-${event.id}`}><div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${event.status === 'success' || event.status === 'complete' ? 'bg-primary' : event.status === 'blocked' ? 'bg-[#bd725b]' : 'bg-[#ef9c4f]'}`} /><div className="min-w-0 flex-1"><div className="flex flex-wrap justify-between gap-2"><span className="mono text-[10px] font-bold tracking-wider text-primary">{event.type}</span><span className="mono text-[10px] text-muted-foreground">{event.time}</span></div><div className="mt-1 text-xs font-semibold">{event.detail}</div></div><div className="hidden text-right sm:block">{event.amount > 0 ? <div className="mono text-xs font-bold">{money(event.amount)}</div> : <span className="mono text-[10px] text-muted-foreground">—</span>}<div className={`mt-1 text-[9px] font-bold uppercase ${event.status === 'blocked' ? 'text-[#bd725b]' : 'text-muted-foreground'}`}>{event.status}</div></div></div>)}</div></section>
      <section className="surface p-5 md:p-6" data-testid="section-chaos-demo"><div className="eyebrow">Safety harness</div><h2 className="display mt-1 text-xl font-bold">Chaos demo</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Introduce a known failure and watch the system choose containment over a risky action.</p><label className="mt-6 block text-xs font-bold">Failure scenario</label><select value={scenario} onChange={(e) => setScenario(e.target.value)} className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 text-xs font-semibold outline-none focus:border-primary" data-testid="select-chaos-scenario"><option value="provider_timeout">Payment provider timeout</option><option value="stale_model">Stale model signal</option><option value="retry_spike">Unexpected retry spike</option></select><button onClick={runChaos} disabled={chaos.isPending} className="btn-amber mt-4 flex w-full items-center justify-center gap-2 rounded-md py-3 text-xs font-bold" data-testid="button-run-chaos"><Play size={13} /> {chaos.isPending ? 'Injecting failure…' : 'Trigger safe failure'}</button>{chaosResult && <div className="mt-5 rounded-lg border border-[#9acfb3] bg-[#edf7ef] p-4" data-testid="status-chaos-result"><div className="flex items-center gap-2 text-sm font-bold text-[#285c48]"><CircleCheck size={16} /> {chaosResult.title}</div><div className="mt-3 space-y-2 text-xs text-[#456c5d]"><div><b>Action:</b> {chaosResult.action}</div><div><b>Reason:</b> {chaosResult.reason}</div><div><b>Next:</b> {chaosResult.nextAction}</div></div></div>}<div className="mt-6 border-t border-border pt-5"><div className="flex items-center gap-2 text-xs font-bold"><ShieldCheck size={15} className="text-primary" /> Policy guarantees</div><ul className="mt-3 space-y-2 text-[11px] text-muted-foreground"><li className="flex gap-2"><Check size={13} className="shrink-0 text-primary" /> No action without a fresh health signal</li><li className="flex gap-2"><Check size={13} className="shrink-0 text-primary" /> Every contact has a customer-level ceiling</li><li className="flex gap-2"><Check size={13} className="shrink-0 text-primary" /> Failed dependencies fail closed</li></ul></div></section></div>
  </div>;
}

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Shell><Switch><Route path="/" component={Overview} /><Route path="/queue" component={Queue} /><Route path="/customers/:customerId" component={Customer} /><Route path="/simulator" component={Simulator} /><Route path="/business-impact" component={BusinessImpact} /><Route path="/audit" component={Audit} /><Route component={NotFound} /></Switch></Shell></ErrorBoundary>;
}
function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}
export default App;