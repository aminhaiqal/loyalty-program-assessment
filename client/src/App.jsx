import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Link,
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate
} from "react-router-dom";
import { api, downloadReceipt } from "./api.js";
import { useAuth } from "./AuthContext.jsx";

const appVersion = import.meta.env.VITE_APP_VERSION || "dev";
const appCommitSha = import.meta.env.VITE_APP_COMMIT_SHA || "local";

function BuildStamp() {
  const versionLabel = appVersion === "dev" ? "development" : `v${appVersion}`;
  const commitLabel = appCommitSha === "local" ? null : appCommitSha.slice(0, 7);
  return (
    <span className="build-stamp" title={`Build ${appVersion} · commit ${appCommitSha}`}>
      {versionLabel}{commitLabel ? ` · ${commitLabel}` : ""}
    </span>
  );
}

function Loading() {
  return <div className="center-message">Loading…</div>;
}

function Notice({ error, success }) {
  if (!error && !success) return null;
  return <div className={`notice ${error ? "notice-error" : "notice-success"}`}>{error || success}</div>;
}

function Protected({ role }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={user.role === "ADMIN" ? "/admin" : "/app"} replace />;
  return <Outlet />;
}

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "ADMIN" ? "/admin" : "/app"} replace />;
}

function AuthPage({ mode }) {
  const isRegister = mode === "register";
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={user.role === "ADMIN" ? "/admin" : "/app"} replace />;

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const values = isRegister
        ? {
            name: form.get("name"),
            email: form.get("email"),
            phone: form.get("phone"),
            password: form.get("password")
          }
        : { identifier: form.get("identifier"), password: form.get("password") };
      const nextUser = await (isRegister ? register(values) : login(values));
      navigate(nextUser.role === "ADMIN" ? "/admin" : "/app");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-layout">
      <section className="auth-intro">
        <div className="ticket-mark" aria-hidden="true">P&amp;P</div>
        <p className="eyebrow">Proof &amp; Perk loyalty</p>
        <h1>Turn a receipt into your next reward.</h1>
        <p>Keep purchase proof in one place and see exactly when it becomes a voucher.</p>
      </section>
      <section className="auth-panel" aria-labelledby="auth-title">
        <p className="step-label">{isRegister ? "New member" : "Member access"}</p>
        <h2 id="auth-title">{isRegister ? "Create your account" : "Welcome back"}</h2>
        <Notice error={error} />
        <form onSubmit={submit} className="form-stack">
          {isRegister ? (
            <>
              <label>Name <input name="name" autoComplete="name" maxLength="100" /></label>
              <label>Email <input name="email" type="email" autoComplete="email" /></label>
              <label>Phone <input name="phone" type="tel" autoComplete="tel" /></label>
              <p className="field-help">Enter at least an email or phone number.</p>
            </>
          ) : (
            <label>Email or phone <input name="identifier" autoComplete="username" required /></label>
          )}
          <label>Password <input name="password" type="password" autoComplete={isRegister ? "new-password" : "current-password"} minLength="8" required /></label>
          <button className="button button-primary" disabled={busy}>{busy ? "Working…" : isRegister ? "Create account" : "Log in"}</button>
        </form>
        <p className="auth-switch">
          {isRegister ? "Already have an account? " : "New here? "}
          <Link to={isRegister ? "/login" : "/register"}>{isRegister ? "Log in" : "Create an account"}</Link>
        </p>
        <BuildStamp />
      </section>
    </main>
  );
}

const userLinks = [
  ["/app", "Overview", true],
  ["/app/upload", "Upload receipt"],
  ["/app/receipts", "Receipt history"],
  ["/app/vouchers", "Vouchers"],
  ["/app/settings", "Settings"]
];
const adminLinks = [
  ["/admin", "Overview", true],
  ["/admin/receipts", "Validate receipts"]
];

function Shell({ admin = false }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const links = admin ? adminLinks : userLinks;
  async function signOut() {
    await logout();
    navigate("/login");
  }
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" to={admin ? "/admin" : "/app"}>
          <span className="mini-ticket">P&amp;P</span>
          <span>Proof &amp; Perk</span>
        </Link>
        <span className="role-tag">{admin ? "Admin desk" : "Member"}</span>
        <nav aria-label="Primary navigation">
          {links.map(([to, label, end]) => <NavLink key={to} to={to} end={end}>{label}</NavLink>)}
        </nav>
        <div className="account-block">
          <span>{user.name || user.email || user.phone}</span>
          <button className="button-link" onClick={signOut}>Log out</button>
        </div>
        <BuildStamp />
      </header>
      <main className="main-content"><Outlet /></main>
    </div>
  );
}

function PageHeader({ kicker, title, action }) {
  return (
    <header className="page-header">
      <div><p className="eyebrow">{kicker}</p><h1>{title}</h1></div>
      {action}
    </header>
  );
}

function Stats({ items }) {
  return <div className="stats-strip">{items.map(([label, value]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>;
}

function UserDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { api("/user/dashboard").then(setData).catch((e) => setError(e.message)); }, []);
  return (
    <>
      <PageHeader kicker="Your loyalty ledger" title={data ? `Hello, ${data.name}` : "Your overview"} action={<Link className="button button-primary" to="/app/upload">Upload a receipt</Link>} />
      <Notice error={error} />
      {data ? <Stats items={[["Pending receipts", data.pendingReceipts], ["Approved receipts", data.approvedReceipts], ["Available vouchers", data.availableVouchers]]} /> : !error && <Loading />}
      <section className="process-line">
        <h2>How rewards move</h2>
        <ol><li><span>1</span>Upload your purchase proof</li><li><span>2</span>An administrator reviews it</li><li><span>3</span>An approved receipt becomes one voucher</li></ol>
      </section>
    </>
  );
}

function UploadReceipt() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api("/receipts", { method: "POST", body: new FormData(event.currentTarget) });
      navigate("/app/receipts", { state: { success: "Receipt submitted for review." } });
    } catch (requestError) {
      setError(requestError.message);
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader kicker="Purchase proof" title="Upload a receipt" />
      <div className="narrow-panel">
        <Notice error={error} />
        <form onSubmit={submit} className="form-stack">
          <label>Order ID <input name="orderId" required maxLength="100" /></label>
          <div className="form-row">
            <label>Purchase date <input name="purchaseDate" type="date" max={localToday()} required /></label>
            <label>Amount <input name="amount" type="number" min="0.01" max="9999999999.99" step="0.01" inputMode="decimal" required /></label>
          </div>
          <label className="file-field">Receipt file <input name="receipt" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf" required /><span>JPG, PNG, WEBP or PDF · up to 5 MB</span></label>
          <button className="button button-primary" disabled={busy}>{busy ? "Uploading…" : "Submit for review"}</button>
        </form>
      </div>
    </>
  );
}

function Status({ value }) {
  return <span className={`status status-${value.toLowerCase()}`}>{value}</span>;
}

function Empty({ children }) {
  return <div className="empty-state">{children}</div>;
}

function ReceiptHistory() {
  const location = useLocation();
  const [receipts, setReceipts] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { api("/receipts").then((d) => setReceipts(d.receipts)).catch((e) => setError(e.message)); }, []);
  async function download(id) {
    setError("");
    try { await downloadReceipt(id); } catch (e) { setError(e.message); }
  }
  return (
    <>
      <PageHeader kicker="Purchase proof" title="Receipt history" action={<Link className="button button-secondary" to="/app/upload">Upload new</Link>} />
      <Notice error={error} success={location.state?.success} />
      {receipts?.length ? <div className="table-wrap"><table><thead><tr><th>Order</th><th>Purchase date</th><th>Amount</th><th>Status</th><th>Submitted</th><th></th></tr></thead><tbody>
        {receipts.map((receipt) => <tr key={receipt.id}><td data-label="Order">{receipt.orderId}</td><td data-label="Purchase date">{formatDate(receipt.purchaseDate)}</td><td data-label="Amount">{formatAmount(receipt.amount)}</td><td data-label="Status"><Status value={receipt.status} />{receipt.rejectionReason && <small className="reason">{receipt.rejectionReason}</small>}</td><td data-label="Submitted">{formatDate(receipt.submittedAt)}</td><td><button className="button-link" onClick={() => download(receipt.id)}>Get file</button></td></tr>)}
      </tbody></table></div> : receipts && <Empty>No receipts yet. Upload your first purchase proof to begin.</Empty>}
    </>
  );
}

function Vouchers() {
  const [vouchers, setVouchers] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { api("/user/vouchers").then((d) => setVouchers(d.vouchers)).catch((e) => setError(e.message)); }, []);
  return (
    <>
      <PageHeader kicker="Earned rewards" title="Your vouchers" />
      <Notice error={error} />
      {vouchers?.length ? <div className="voucher-list">{vouchers.map((voucher) => <article className="voucher" key={voucher.id}><div><p className="step-label">Voucher code</p><strong>{voucher.code}</strong></div><dl><div><dt>Source order</dt><dd>{voucher.orderId}</dd></div><div><dt>Issued</dt><dd>{formatDate(voucher.issuedAt)}</dd></div></dl></article>)}</div> : vouchers && <Empty>Approved receipts will appear here as vouchers.</Empty>}
    </>
  );
}

function Settings() {
  const { user, updateUser } = useAuth();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setError(""); setSuccess(""); setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const data = await api("/user/profile", { method: "PUT", body: JSON.stringify({ name: form.get("name"), email: form.get("email"), phone: form.get("phone") }) });
      updateUser(data.user); setSuccess("Profile changes saved.");
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return (
    <>
      <PageHeader kicker="Account details" title="Settings" />
      <div className="narrow-panel"><Notice error={error} success={success} /><form className="form-stack" onSubmit={submit}>
        <label>Name <input name="name" defaultValue={user.name || ""} maxLength="100" /></label>
        <label>Email <input name="email" type="email" defaultValue={user.email || ""} /></label>
        <label>Phone <input name="phone" type="tel" defaultValue={user.phone || ""} /></label>
        <p className="field-help">Keep at least one email or phone number.</p>
        <button className="button button-primary" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
      </form></div>
    </>
  );
}

function AdminDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { api("/admin/dashboard").then(setData).catch((e) => setError(e.message)); }, []);
  return (
    <>
      <PageHeader kicker="Validation desk" title="Program overview" action={<Link className="button button-primary" to="/admin/receipts">Review receipts</Link>} />
      <Notice error={error} />
      {data ? <Stats items={[["Pending", data.pendingReceipts], ["Approved", data.approvedReceipts], ["Rejected", data.rejectedReceipts], ["Vouchers issued", data.vouchersIssued]]} /> : !error && <Loading />}
    </>
  );
}

function AdminReceipts() {
  const [status, setStatus] = useState("PENDING");
  const [receipts, setReceipts] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busyId, setBusyId] = useState(null);

  function load(nextStatus = status) {
    setReceipts(null); setError("");
    api(`/admin/receipts${nextStatus ? `?status=${nextStatus}` : ""}`).then((d) => setReceipts(d.receipts)).catch((e) => setError(e.message));
  }
  useEffect(() => { load(status); }, [status]);

  async function decide(receipt, decision) {
    const rejectionReason = decision === "REJECT" ? window.prompt("Optional rejection reason:") : null;
    if (decision === "REJECT" && rejectionReason === null) return;
    if (!window.confirm(`${decision === "APPROVE" ? "Approve" : "Reject"} order ${receipt.orderId}?`)) return;
    setBusyId(receipt.id); setError(""); setSuccess("");
    try {
      await api(`/admin/receipts/${receipt.id}/decision`, { method: "PATCH", body: JSON.stringify({ decision, rejectionReason }) });
      setSuccess(decision === "APPROVE" ? "Receipt approved and one voucher issued." : "Receipt rejected. No voucher was issued.");
      load();
    } catch (e) { setError(e.message); } finally { setBusyId(null); }
  }
  async function download(receipt) {
    try { await downloadReceipt(receipt.id, receipt.fileName); } catch (e) { setError(e.message); }
  }
  return (
    <>
      <PageHeader kicker="Validation desk" title="Receipt queue" action={<label className="filter">Show <select value={status} onChange={(e) => setStatus(e.target.value)}><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option><option value="">All</option></select></label>} />
      <Notice error={error} success={success} />
      {receipts?.length ? <div className="review-list">{receipts.map((receipt) => <article className="review-row" key={receipt.id}>
        <div className="review-main"><div><p className="step-label">Order {receipt.orderId}</p><h2>{formatAmount(receipt.amount)}</h2></div><Status value={receipt.status} /></div>
        <dl className="receipt-details"><div><dt>Member</dt><dd>{receipt.userName || receipt.userEmail || receipt.userPhone}</dd></div><div><dt>Purchased</dt><dd>{formatDate(receipt.purchaseDate)}</dd></div><div><dt>Submitted</dt><dd>{formatDate(receipt.submittedAt)}</dd></div><div><dt>File</dt><dd><button className="button-link" onClick={() => download(receipt)}>{receipt.fileName}</button></dd></div></dl>
        {receipt.rejectionReason && <p className="reason-block"><strong>Reason:</strong> {receipt.rejectionReason}</p>}
        {receipt.status === "PENDING" && <div className="decision-actions"><button className="button button-secondary" disabled={busyId === receipt.id} onClick={() => decide(receipt, "REJECT")}>Reject</button><button className="button button-primary" disabled={busyId === receipt.id} onClick={() => decide(receipt, "APPROVE")}>Approve &amp; issue voucher</button></div>}
      </article>)}</div> : receipts && <Empty>No receipts match this status.</Empty>}
    </>
  );
}

function formatDate(value) {
  if (!value) return "—";
  const dateOnly = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = dateOnly
    ? new Date(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10)))
    : new Date(value);
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function localToday() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
}

function formatAmount(value) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value));
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route element={<Protected role="USER" />}>
          <Route path="/app" element={<Shell />}>
            <Route index element={<UserDashboard />} />
            <Route path="upload" element={<UploadReceipt />} />
            <Route path="receipts" element={<ReceiptHistory />} />
            <Route path="vouchers" element={<Vouchers />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Route>
        <Route element={<Protected role="ADMIN" />}>
          <Route path="/admin" element={<Shell admin />}>
            <Route index element={<AdminDashboard />} />
            <Route path="receipts" element={<AdminReceipts />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
