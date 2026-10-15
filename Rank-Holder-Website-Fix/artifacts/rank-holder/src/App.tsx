import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, ArrowUpRight, BriefcaseBusiness, Check, CircleHelp, Compass, FileText, Lightbulb, LoaderCircle, LockKeyhole, LogIn, LogOut, Mail, Target, UserRound, WalletCards } from 'lucide-react';
import { Link, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import {
  getGetBillingPlansQueryKey,
  getGetBillingSubscriptionQueryKey,
  useCreateBillingCheckout,
  useCreateBillingPortal,
  useGetBillingPlans,
  useGetBillingSubscription,
} from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { AuthFeedback, RankHolderUser } from '@/lib/auth-types';
import NotFound from '@/pages/not-found';
import './index.css';

const queryClient = new QueryClient();

function useRankHolderUser() {
  const [user, setUser] = useState<RankHolderUser | null>(() => window.rankHolderUser ?? null);
  useEffect(() => {
    const syncUser = (event: Event) => {
      const detail = (event as CustomEvent<RankHolderUser | null>).detail;
      window.rankHolderUser = detail ?? null;
      setUser(detail ?? null);
    };
    window.addEventListener('rank-holder:auth-state', syncUser);
    return () => window.removeEventListener('rank-holder:auth-state', syncUser);
  }, []);
  return user;
}

function Logo() {
  return <span className="brand"><span className="brand-mark">R</span><span>rank holder</span></span>;
}

function Header({ user }: { user: RankHolderUser | null }) {
  const [location] = useLocation();
  function signOut() {
    window.dispatchEvent(new CustomEvent('rank-holder:sign-out'));
  }
  return (
    <header className="shell topbar">
      <Link href="/" aria-label="Rank Holder home" data-testid="link-home"><Logo /></Link>
      <nav className="nav-links" aria-label="Main navigation">
        {user && <Link href="/dashboard" data-testid="link-dashboard" style={{ color: location === '/dashboard' ? '#eff1f4' : undefined }}>Toolkit</Link>}
        <Link href="/billing" data-testid="link-billing" style={{ color: location.startsWith('/billing') ? '#eff1f4' : undefined }}>Plans</Link>
        {user
          ? <><Link href="/dashboard" className="button button-primary" data-testid="link-account"><UserRound size={15} /> Account</Link><button type="button" className="sign-out-button" onClick={signOut} aria-label="Sign out" title="Sign out" data-testid="button-sign-out"><LogOut size={15} /></button></>
          : <Link href="/login" className="button button-primary" data-testid="link-sign-in"><LogIn size={15} /> Sign in</Link>}
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="shell footer">
      <span>© Rank Holder · Make your next move count.</span>
      <div className="footer-links"><Link href="/billing">Plans</Link><Link href="/login">Sign in</Link></div>
    </footer>
  );
}

function Home() {
  return (
    <>
      <main className="shell">
        <section className="hero">
          <div className="hero-copy reveal">
            <div className="eyebrow">A sharper way forward</div>
            <h1 className="display">Your next move<br />starts <em>right here.</em></h1>
            <p>Make progress on the career you want. Rank Holder brings practical AI career support into one focused space — built for job seekers, students, and people growing in tech.</p>
            <div className="hero-ctas">
              <Link href="/login" className="button button-primary" data-testid="link-start-progress">Start making progress <ArrowRight size={16} /></Link>
              <Link href="/billing" className="button button-quiet" data-testid="link-explore-plans">Explore membership <ArrowUpRight size={15} /></Link>
            </div>
            <div className="hero-note"><div className="faces"><span>JS</span><span>AP</span><span>TK</span></div><span>Useful support for the next step in your career.</span></div>
          </div>
          <div className="hero-art reveal delay-1" aria-label="Rank Holder career coach portrait">
            <div className="orbit orbit-one" /><div className="orbit orbit-two" />
            <div className="portrait-wrap"><img className="portrait" src="/brand/Rank.png" alt="Rank Holder career coach" /></div>
            <div className="art-label label-top"><strong><i className="label-dot" />Built around your goals</strong><span>Turn intention into action</span></div>
            <div className="art-label label-bottom"><strong>Less second-guessing.</strong><span>More forward motion.</span></div>
          </div>
        </section>

        <section className="section" id="toolkit">
          <div className="section-head">
            <div><div className="eyebrow">The toolkit</div><h2>Practical help for<br />real career moments.</h2></div>
            <p>Not another dashboard to manage. Just thoughtful AI support for the work that moves your career forward.</p>
          </div>
          <div className="tool-grid">
            <article className="tool-card featured">
              <div className="tool-index"><span>01 / MAKE YOURSELF CLEAR</span><FileText size={15} /></div>
              <div className="tool-symbol"><FileText size={19} /></div>
              <h3>Present your best work</h3>
              <p>Shape the story of your experience and communicate your strengths with more clarity.</p>
              <span className="card-link">Career materials</span>
            </article>
            <article className="tool-card">
              <div className="tool-index"><span>02 / PREPARE WITH PURPOSE</span><Target size={15} /></div>
              <div className="tool-symbol"><Target size={19} /></div>
              <h3>Show up ready</h3>
              <p>Build confidence for important career conversations and the opportunities ahead.</p>
              <span className="card-link">Interview readiness</span>
            </article>
            <article className="tool-card">
              <div className="tool-index"><span>03 / FIND YOUR DIRECTION</span><Compass size={15} /></div>
              <div className="tool-symbol"><Compass size={19} /></div>
              <h3>Find the next step</h3>
              <p>Get unstuck, explore your options, and choose a practical next move.</p>
              <span className="card-link">Career direction</span>
            </article>
          </div>
        </section>

        <section className="section">
          <div className="method">
            <div><div className="eyebrow">A useful kind of AI</div><h2 className="display" style={{ fontSize: 'clamp(36px,4vw,48px)', lineHeight: 1.04, margin: '15px 0' }}>Guidance that<br />gets to the point.</h2><p style={{ color: '#99a1b3', lineHeight: 1.8, fontSize: 13, maxWidth: 380 }}>Your career is personal. The tools should meet you where you are and help you take a meaningful next step.</p></div>
            <div className="method-list">
              <article className="method-item"><span className="method-num">01</span><div><h3>Start with what matters to you</h3><p>Bring your goals, your questions, or the part that feels difficult. No perfect prompt required.</p></div></article>
              <article className="method-item"><span className="method-num">02</span><div><h3>Get practical, considered help</h3><p>Use AI support designed around real career tasks — clear enough to act on, personal enough to be useful.</p></div></article>
              <article className="method-item"><span className="method-num">03</span><div><h3>Keep your momentum</h3><p>Turn advice into action, one focused move at a time. Your progress stays yours.</p></div></article>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="quote-panel"><p>“A little more clarity can change what you do next.”</p><span>Rank Holder · Career progress, made practical</span></div>
        </section>
      </main>
    </>
  );
}

function Login() {
  const user = useRankHolderUser();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'sign-in' | 'register'>('sign-in');
  const [feedback, setFeedback] = useState<AuthFeedback | null>(null);
  useEffect(() => {
    const handleFeedback = (event: Event) => {
      setFeedback((event as CustomEvent<AuthFeedback>).detail);
    };
    window.addEventListener('rank-holder:auth-feedback', handleFeedback);
    return () => window.removeEventListener('rank-holder:auth-feedback', handleFeedback);
  }, []);
  function submitEmailAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    window.dispatchEvent(new CustomEvent('rank-holder:sign-in-email', {
      detail: { email: email.trim(), password, displayName: name.trim(), mode },
    }));
  }
  function googleSignIn() {
    setFeedback(null);
    window.dispatchEvent(new CustomEvent('rank-holder:sign-in-google'));
  }
  return (
    <main className="auth-main">
      <section className="auth-card">
        <img className="avatar" src="/brand/career-avatar.jpg" alt="" />
        <h1>{mode === 'register' ? 'Create your account' : 'Sign in to Rank Holder'}</h1>
        <p>Use your email and password to access your account.</p>



        <form onSubmit={submitEmailAuth}>
          {mode === 'register' && <div className="auth-field"><label htmlFor="full-name">Full name</label><input id="full-name" data-testid="input-name" required autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="How should we address you?" /></div>}
          <div className="auth-field"><label htmlFor="email-address">Email address</label><input id="email-address" data-testid="input-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></div>
          <div className="auth-field"><label htmlFor="auth-password">Password</label><input id="auth-password" data-testid="input-password" type="password" required minLength={mode === 'register' ? 6 : undefined} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === 'register' ? 'At least 6 characters' : 'Your password'} /></div>
          <button className="button button-primary" type="submit" data-testid="button-email-auth"><Mail size={15} /> {mode === 'register' ? 'Create account' : 'Sign in with email'} <ArrowRight size={15} /></button>
        </form>
        <button className="auth-mode-switch" type="button" onClick={() => { setMode(mode === 'sign-in' ? 'register' : 'sign-in'); setFeedback(null); }} data-testid="button-toggle-auth-mode">
          {mode === 'register' ? 'Already have an account? Sign in' : 'New to Rank Holder? Create an account'}
        </button>
        {feedback && feedback.kind === 'error' && <div className="auth-message is-error" role="alert" data-testid="status-auth-feedback">{feedback.message}</div>}

        <p className="auth-foot"><LockKeyhole size={11} style={{ verticalAlign: 'middle', marginRight: 5 }} />Secure sign-in with email credentials.</p>
      </section>
    </main>
  );
}

function ErrorState({ retry, message = 'Something did not load as expected.' }: { retry: () => void; message?: string }) {
  return <div className="error-state" role="alert" data-testid="status-load-error"><span>{message}</span><button type="button" onClick={retry} data-testid="button-retry">Try again</button></div>;
}

function SkeletonList({ count = 2 }: { count?: number }) {
  return <div aria-label="Loading" aria-busy="true">{Array.from({ length: count }, (_, index) => <div className="skeleton skeleton-card" key={index} />)}</div>;
}

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency.toUpperCase(), maximumFractionDigits: 2 }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function cadence(interval: string, count = 1) {
  if (count === 1) return `per ${interval}`;
  const unit = interval.endsWith('s') ? interval : `${interval}s`;
  return `every ${count} ${unit}`;
}

function Dashboard({ user }: { user: RankHolderUser | null }) {
  const [, setLocation] = useLocation();
  const signedIn = Boolean(user);
  const subscription = useGetBillingSubscription({
    query: { enabled: signedIn, queryKey: getGetBillingSubscriptionQueryKey(), retry: false },
  });
  const isSubscribed = Boolean(subscription.data?.hasActiveSubscription);
  return (
    <main className="shell page-main">
      <div className="dash-top">
        <div className="page-heading" style={{ margin: 0 }}>
          <div className="eyebrow">Your workspace</div>
          <h1>Make room for<br />your next move.</h1>
          <p>{signedIn ? `Good to have you here${user?.displayName ? `, ${user.displayName}` : ''}.` : 'A focused place to make progress on your career.'}</p>
        </div>
        <span className="status-chip" data-testid="status-account"><i className={`status-dot ${signedIn ? 'active' : ''}`} />{signedIn ? 'SIGNED IN' : 'SIGN IN REQUIRED'}</span>
      </div>
      <div className="dash-layout">
        <section className="panel">
          <div className="panel-title"><h2>Your career toolkit</h2><span className="mono" style={{ fontSize: 10, color: '#8f98a8' }}>RANK HOLDER</span></div>
          <div className="tool-list">
            <article className="tool-row"><span className="tool-row-icon"><FileText size={18} /></span><div className="tool-row-copy"><h3>Career materials</h3><p>Get support clarifying your experience and how you present it.</p></div></article>
            <article className="tool-row"><span className="tool-row-icon"><BriefcaseBusiness size={18} /></span><div className="tool-row-copy"><h3>Interview readiness</h3><p>Prepare for the conversations that can move you forward.</p></div></article>
            <article className="tool-row"><span className="tool-row-icon"><Lightbulb size={18} /></span><div className="tool-row-copy"><h3>Career direction</h3><p>Explore options and identify a useful next step.</p></div></article>
          </div>
          <p style={{ color: '#737d8e', fontSize: 10, lineHeight: 1.7, margin: '18px 4px 0' }}>Sign in and choose a plan to access your Rank Holder tools.</p>
        </section>
        <aside className="panel status-panel">
          <div className="eyebrow">Account status</div>
          {!signedIn ? <>
            <h3>Start with your account.</h3>
            <p>Sign in to view your membership and continue with Rank Holder.</p>
            <button className="button button-primary full" type="button" onClick={() => setLocation('/login')} data-testid="button-dashboard-sign-in">Sign in <ArrowRight size={15} /></button>
          </> : subscription.isLoading ? <>
            <h3>Checking your membership…</h3><div className="skeleton" style={{ width: '80%', margin: '15px 0' }} />
          </> : subscription.isError ? <>
            <h3>Membership status unavailable.</h3><p>We could not retrieve your current account status.</p><button className="button button-quiet full" onClick={() => subscription.refetch()} type="button" data-testid="button-retry-subscription">Retry status</button>
          </> : isSubscribed ? <>
            <h3>{subscription.data?.cancelAtPeriodEnd ? 'Your plan is ending.' : 'Your membership is active.'}</h3>
            <p>{subscription.data?.cancelAtPeriodEnd ? 'Your access continues through the current billing period.' : 'You are all set to continue your career progress.'}</p>
            <div className="subscription-summary">
              <div className="summary-line"><span>Status</span><strong data-testid="text-subscription-status">{subscription.data?.status ?? 'Active'}</strong></div>
              {subscription.data?.currentPeriodEnd && <div className="summary-line"><span>{subscription.data.cancelAtPeriodEnd ? 'Access through' : 'Renews / ends'}</span><strong data-testid="text-period-end">{new Date(subscription.data.currentPeriodEnd).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</strong></div>}
            </div>
            <button className="button button-quiet full" onClick={() => setLocation('/billing')} type="button" data-testid="button-manage-membership">Manage membership <ArrowRight size={15} /></button>
          </> : <>
            <h3>Your next step is open.</h3>
            <p>No active membership is linked to this account. View current plans to get started.</p>
            <button className="button button-primary full" onClick={() => setLocation('/billing')} type="button" data-testid="button-view-plans">View plans <ArrowRight size={15} /></button>
          </>}
        </aside>
      </div>
    </main>
  );
}

function Billing({ user }: { user: RankHolderUser | null }) {
  const plans = useGetBillingPlans({
    query: { queryKey: getGetBillingPlansQueryKey(), retry: 1 },
  });
  const signedIn = Boolean(user);
  const subscription = useGetBillingSubscription({
    query: { enabled: signedIn, queryKey: getGetBillingSubscriptionQueryKey(), retry: false },
  });
  const checkout = useCreateBillingCheckout();
  const portal = useCreateBillingPortal();
  const active = Boolean(subscription.data?.hasActiveSubscription);
  const pending = checkout.isPending || portal.isPending;
  const [actionError, setActionError] = useState('');

  function startCheckout(priceId: string) {
    setActionError('');
    checkout.mutate({ data: { priceId } }, {
      onSuccess: (redirect) => { window.location.assign(redirect.url); },
      onError: () => setActionError('Checkout could not be started. Please try again.'),
    });
  }
  function openPortal() {
    setActionError('');
    portal.mutate(undefined, {
      onSuccess: (redirect) => { window.location.assign(redirect.url); },
      onError: () => setActionError('The billing portal could not be opened. Please try again.'),
    });
  }

  return (
    <main className="shell page-main">
      <div className="page-heading">
        <div className="eyebrow">Membership</div>
        <h1>Make your next move count.</h1>
        <p>One practical toolkit for the moments that move a career forward.</p>
      </div>
      {!signedIn && <div className="notice" style={{ marginBottom: 20 }} data-testid="status-billing-logged-out">You are viewing plans while signed out. Sign in before starting a membership.</div>}
      <div className="billing-layout">
        <section className="panel">
          <div className="panel-title"><h2>Available plans</h2><WalletCards size={17} color="#c9ed61" /></div>
          {plans.isLoading ? <SkeletonList /> : plans.isError ? <ErrorState retry={() => plans.refetch()} message="Plans could not be loaded." /> : plans.data?.length ? (
            <div className="plan-list">
              {plans.data.map((plan) => (
                <article className={`plan-card ${active ? 'selected' : ''}`} key={plan.priceId} data-testid={`card-plan-${plan.priceId}`}>
                  <div><h3>{plan.name}</h3><p>{plan.description || 'Practical AI career support to help you make meaningful progress.'}</p></div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="plan-price" data-testid={`text-price-${plan.priceId}`}>{money(plan.unitAmount, plan.currency)}<small> / {cadence(plan.interval, plan.intervalCount)}</small></div>
                    <button className="button button-primary" style={{ marginTop: 12 }} type="button" disabled={!signedIn || active || pending} onClick={() => startCheckout(plan.priceId)} data-testid={`button-subscribe-${plan.priceId}`}>
                      {pending ? <><LoaderCircle size={15} className="spin" /> Opening checkout</> : active ? 'Membership active' : signedIn ? 'Continue to checkout' : 'Sign in to continue'} {!pending && !active && <ArrowRight size={15} />}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : <div className="empty-state" data-testid="empty-plans"><CircleHelp size={20} style={{ marginBottom: 10 }} /><br />There are no plans available right now. Please check back later.</div>}
          {actionError && <div className="auth-message" role="alert" data-testid="status-billing-action-error">{actionError}</div>}
        </section>
        <aside className="panel manage-box">
          <div className="eyebrow">Your account</div>
          {signedIn ? subscription.isLoading ? <><h2 style={{ marginTop: 18 }}>Checking membership</h2><div className="skeleton" /></> : subscription.isError ? <>
            <h2 style={{ marginTop: 18 }}>Status unavailable</h2><p>We could not verify your current subscription. You can retry before taking action.</p><button type="button" className="button button-quiet full" onClick={() => subscription.refetch()} data-testid="button-billing-retry">Retry status</button>
          </> : active ? <>
            <h2 style={{ marginTop: 18 }}>{subscription.data?.cancelAtPeriodEnd ? 'Membership ending' : 'Membership active'}</h2>
            <p>{subscription.data?.cancelAtPeriodEnd ? 'Your current access remains available until the end of the billing period.' : 'Manage your payment details or subscription securely through Stripe.'}</p>
            {subscription.data?.currentPeriodEnd && <div className="summary-line" style={{ margin: '18px 0' }}><span>Period ends</span><strong>{new Date(subscription.data.currentPeriodEnd).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</strong></div>}
            <button className="button button-primary full" type="button" disabled={pending} onClick={openPortal} data-testid="button-open-portal">{portal.isPending ? 'Opening Stripe…' : 'Manage billing'} <ArrowUpRight size={15} /></button>
          </> : <>
            <h2 style={{ marginTop: 18 }}>No active membership</h2><p>Your subscription status is clear. Browse available plans when you are ready to get started.</p>
            {!plans.isLoading && plans.data?.length === 0 && <div className="notice">No plans are available at this time.</div>}
          </> : <>
            <h2 style={{ marginTop: 18 }}>Sign in first</h2><p>Your membership is connected to your account. Sign in to see its status or manage billing.</p>
            <Link href="/login" className="button button-primary full" data-testid="link-billing-sign-in">Sign in <ArrowRight size={15} /></Link>
          </>}
          <div style={{ height: 20 }} />
          <div className="notice"><LockKeyhole size={13} style={{ verticalAlign: 'middle', marginRight: 6 }} />Payments and subscription changes are handled securely by Stripe.</div>
        </aside>
      </div>
    </main>
  );
}

function BillingSuccess() {
  return (
    <main className="shell page-main">
      <div className="success-wrap reveal">
        <div className="success-mark"><Check size={25} /></div>
        <div className="eyebrow">Checkout complete</div>
        <h1>Good things start<br />with a next step.</h1>
        <p>Stripe has returned you to Rank Holder. Your subscription status will update as soon as the payment confirmation reaches your account.</p>
        <div className="notice" style={{ maxWidth: 540, marginBottom: 24 }}>If your membership does not appear immediately, give it a moment and check your account again.</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}><Link href="/dashboard" className="button button-primary" data-testid="link-success-dashboard">Go to your account <ArrowRight size={15} /></Link><Link href="/billing" className="button button-quiet" data-testid="link-success-billing"><ArrowLeft size={15} /> Billing details</Link></div>
      </div>
    </main>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function Router() {
  const user = useRankHolderUser();
  return (
    <div className="app-frame">
      <Header user={user} />
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/login" component={Login} />
          <Route path="/dashboard"><Dashboard user={user} /></Route>
          <Route path="/billing"><Billing user={user} /></Route>
          <Route path="/billing/success" component={BillingSuccess} />
          <Route><NotFound /></Route>
        </Switch>
      </RoutedErrorBoundary>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
