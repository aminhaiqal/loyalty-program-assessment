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
import {
  ArrowRight,
  CircleAlert,
  CircleCheck,
  ClipboardCheck,
  Clock3,
  Download,
  FileCheck2,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  ReceiptText,
  Settings,
  ShieldCheck,
  TicketCheck,
  Upload,
  UserRound,
  XCircle
} from "lucide-react";
import { api, downloadReceipt } from "./api.js";
import { useAuth } from "./AuthContext.jsx";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const appVersion = import.meta.env.VITE_APP_VERSION || "dev";
const appCommitSha = import.meta.env.VITE_APP_COMMIT_SHA || "local";

const memberLinks = [
  { to: "/app", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/app/receipts", label: "Receipt history", icon: ReceiptText },
  { to: "/app/vouchers", label: "Vouchers", icon: TicketCheck },
  { to: "/app/settings", label: "Settings", icon: Settings }
];

const adminLinks = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/receipts", label: "Receipt queue", icon: ClipboardCheck }
];

function AppLogo({ compact = false }) {
  return (
    <span className="flex items-center gap-3">
      <span className="grid size-8 place-items-center rounded-sm bg-blue-600 font-mono text-[10px] font-medium tracking-tight text-white">
        P/P
      </span>
      {!compact && (
        <span className="text-sm font-semibold tracking-[-0.02em] text-white">
          Proof <span className="text-blue-400">/</span> Perk
        </span>
      )}
    </span>
  );
}

function BuildStamp({ inverse = false }) {
  const versionLabel = appVersion === "dev" ? "development" : `v${appVersion}`;
  const commitLabel = appCommitSha === "local" ? null : appCommitSha.slice(0, 7);
  return (
    <span
      className={cn(
        "font-mono text-[10px] tracking-[0.08em]",
        inverse ? "text-slate-500" : "text-muted-foreground"
      )}
      title={`Build ${appVersion} · commit ${appCommitSha}`}
    >
      {versionLabel}{commitLabel ? ` / ${commitLabel}` : ""}
    </span>
  );
}

function Loading() {
  return (
    <div className="space-y-4 py-8" aria-label="Loading">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

function Notice({ error, success }) {
  if (!error && !success) return null;
  const isError = Boolean(error);
  const Icon = isError ? CircleAlert : CircleCheck;
  return (
    <Alert
      variant={isError ? "destructive" : "default"}
      className={cn("mb-6 rounded-sm", !isError && "border-emerald-200 bg-emerald-50 text-emerald-950")}
    >
      <Icon />
      <AlertTitle>{isError ? "Action required" : "Updated"}</AlertTitle>
      <AlertDescription className={cn(!isError && "text-emerald-800")}>{error || success}</AlertDescription>
    </Alert>
  );
}

function Protected({ role }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="mx-auto min-h-svh max-w-5xl px-6 py-20"><Loading /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={user.role === "ADMIN" ? "/admin" : "/app"} replace />;
  return <Outlet />;
}

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div className="mx-auto min-h-svh max-w-5xl px-6 py-20"><Loading /></div>;
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
    <main className="grid min-h-svh bg-[#f6f7f9] lg:grid-cols-[minmax(340px,0.72fr)_minmax(560px,1.28fr)]">
      <section className="relative flex min-h-[420px] flex-col overflow-hidden bg-[#0b1020] px-7 py-7 text-white sm:px-10 sm:py-9 lg:min-h-svh lg:px-12 lg:py-10">
        <div className="absolute inset-y-0 left-0 w-1 bg-blue-600" aria-hidden="true" />
        <Link to="/" className="relative z-10 w-fit" aria-label="Proof and Perk home"><AppLogo /></Link>

        <div className="relative z-10 my-auto max-w-md py-14 lg:py-10">
          <p className="mb-4 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-blue-400">
            Receipt loyalty operations
          </p>
          <h1 className="max-w-sm text-4xl font-semibold leading-[1.08] tracking-[-0.045em] text-white sm:text-5xl">
            Every reward starts with verified proof.
          </h1>
          <p className="mt-5 max-w-sm text-sm leading-6 text-slate-400">
            Submit purchase records, follow review status, and keep issued vouchers tied to their source.
          </p>

          <ol className="mt-10 hidden border-y border-white/10 sm:block">
            {[
              ["01", "Receipt submitted", "Purchase record enters the review queue."],
              ["02", "Decision recorded", "An administrator approves or rejects the proof."],
              ["03", "Voucher issued", "Approval creates one traceable voucher."]
            ].map(([number, title, description]) => (
              <li key={number} className="grid grid-cols-[36px_1fr] gap-3 border-b border-white/10 py-4 last:border-b-0">
                <span className="pt-0.5 font-mono text-[10px] text-blue-400">{number}</span>
                <span>
                  <strong className="block text-sm font-medium text-slate-100">{title}</strong>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-5">
          <span className="flex items-center gap-2 text-xs text-slate-400">
            <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.1)]" />
            System operational
          </span>
          <BuildStamp inverse />
        </div>
      </section>

      <section className="flex items-center px-5 py-12 sm:px-12 lg:px-[clamp(4rem,9vw,9rem)]" aria-labelledby="auth-title">
        <div className="workspace-enter w-full max-w-md">
          <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-primary">
            {isRegister ? "Member registration" : "Secure access"}
          </p>
          <h2 id="auth-title" className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
            {isRegister ? "Create your account" : "Sign in to continue"}
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {isRegister ? "Use an email address, phone number, or both." : "Enter the credentials linked to your loyalty account."}
          </p>

          <Separator className="my-8" />
          <Notice error={error} />
          <form onSubmit={submit} className="space-y-5">
            {isRegister ? (
              <>
                <Field label="Name" htmlFor="name" optional>
                  <Input id="name" name="name" autoComplete="name" maxLength="100" />
                </Field>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Email" htmlFor="email" optional>
                    <Input id="email" name="email" type="email" autoComplete="email" />
                  </Field>
                  <Field label="Phone" htmlFor="phone" optional>
                    <Input id="phone" name="phone" type="tel" autoComplete="tel" />
                  </Field>
                </div>
                <p className="-mt-2 text-xs text-muted-foreground">At least one contact method is required.</p>
              </>
            ) : (
              <Field label="Email or phone" htmlFor="identifier">
                <Input id="identifier" name="identifier" autoComplete="username" required />
              </Field>
            )}
            <Field label="Password" htmlFor="password">
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete={isRegister ? "new-password" : "current-password"}
                minLength="8"
                required
              />
            </Field>
            <Button className="mt-2 w-full" size="lg" disabled={busy}>
              {busy && <LoaderCircle className="animate-spin" />}
              {busy ? "Working" : isRegister ? "Create account" : "Sign in"}
              {!busy && <ArrowRight />}
            </Button>
          </form>
          <p className="mt-7 text-sm text-muted-foreground">
            {isRegister ? "Already registered? " : "Need an account? "}
            <Link className="font-medium text-foreground underline underline-offset-4" to={isRegister ? "/login" : "/register"}>
              {isRegister ? "Sign in" : "Create one"}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

function Field({ label, htmlFor, optional = false, children }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={htmlFor}>{label}</Label>
        {optional && <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Optional</span>}
      </div>
      {children}
    </div>
  );
}

function Navigation({ links, mobile = false }) {
  return (
    <nav className={cn(mobile ? "flex min-w-max gap-1" : "space-y-1")} aria-label="Primary navigation">
      {links.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => cn(
            "group relative flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-medium transition-colors",
            mobile && "py-2",
            isActive
              ? mobile
                ? "bg-slate-800 text-white"
                : "bg-white/[0.07] text-white before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:bg-blue-500"
              : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
          )}
        >
          <Icon className="size-4" strokeWidth="1.8" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function Shell({ admin = false }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const links = admin ? adminLinks : memberLinks;

  async function signOut() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="min-h-svh bg-background lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="hidden min-h-svh flex-col bg-[#0b1020] px-4 py-5 lg:flex">
        <Link to={admin ? "/admin" : "/app"} className="px-2 py-2" aria-label="Proof and Perk home"><AppLogo /></Link>
        <div className="mb-7 mt-5 px-3">
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-600">Workspace</span>
          <p className="mt-1 text-xs font-medium text-slate-300">{admin ? "Validation desk" : "Member account"}</p>
        </div>
        <Navigation links={links} />

        <div className="mt-auto border-t border-white/10 pt-4">
          <div className="flex items-center gap-3 px-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-sm bg-slate-800 text-slate-300">
              <UserRound className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium text-slate-200">{user.name || user.email || user.phone}</span>
              <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-wider text-slate-600">{admin ? "Administrator" : "Member"}</span>
            </span>
            <Button variant="ghost" size="icon-sm" onClick={signOut} className="text-slate-500 hover:bg-white/5 hover:text-white" aria-label="Log out">
              <LogOut />
            </Button>
          </div>
          <div className="mt-4 px-2"><BuildStamp inverse /></div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-slate-800 bg-[#0b1020] px-4 py-3 lg:hidden">
          <div className="flex items-center justify-between">
            <Link to={admin ? "/admin" : "/app"} aria-label="Proof and Perk home"><AppLogo /></Link>
            <Button variant="ghost" size="icon-sm" onClick={signOut} className="text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Log out"><LogOut /></Button>
          </div>
          <div className="mt-3 overflow-x-auto pb-0.5"><Navigation links={links} mobile /></div>
        </header>
        <main className="workspace-enter mx-auto w-full max-w-[1480px] px-4 py-8 sm:px-7 lg:px-10 lg:py-11 xl:px-14">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function PageHeader({ kicker, title, description, action }) {
  return (
    <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="mb-2 font-mono text-[10px] font-medium uppercase tracking-[0.15em] text-primary">{kicker}</p>
        <h1 className="text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-[2.15rem]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

function Stats({ items }) {
  return (
    <section
      className={cn(
        "grid border-y bg-white/35 divide-y lg:divide-x lg:divide-y-0",
        items.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"
      )}
      aria-label="Summary statistics"
    >
      {items.map(([label, value]) => (
        <div key={label} className="px-1 py-5 lg:px-7 lg:py-6 lg:first:pl-1">
          <strong className="block font-mono text-3xl font-medium tracking-[-0.05em] text-foreground sm:text-4xl">{value}</strong>
          <span className="mt-2 block text-xs font-medium text-muted-foreground">{label}</span>
        </div>
      ))}
    </section>
  );
}

function WorkflowBrief() {
  const stages = [
    ["01", "Submit", "Upload a purchase receipt and order details."],
    ["02", "Review", "An administrator records one final decision."],
    ["03", "Issue", "An approved receipt creates one voucher."]
  ];
  return (
    <section className="mt-12 grid gap-9 border-t pt-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div>
        <div className="mb-5 flex items-center gap-2">
          <FileCheck2 className="size-4 text-primary" />
          <h2 className="text-base font-semibold tracking-[-0.015em]">Receipt workflow</h2>
        </div>
        <ol className="divide-y border-y">
          {stages.map(([number, title, description]) => (
            <li key={number} className="grid grid-cols-[40px_110px_1fr] items-baseline gap-3 py-4 max-sm:grid-cols-[40px_1fr]">
              <span className="font-mono text-[10px] text-primary">{number}</span>
              <strong className="text-sm font-medium">{title}</strong>
              <span className="text-sm text-muted-foreground max-sm:col-start-2">{description}</span>
            </li>
          ))}
        </ol>
      </div>
      <aside className="border-l-2 border-blue-600 pl-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Control rule</p>
        <p className="mt-3 text-xl font-semibold leading-7 tracking-[-0.025em]">One receipt. One decision. One voucher.</p>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Every reward remains linked to the approved receipt that created it.</p>
      </aside>
    </section>
  );
}

function UserDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { api("/user/dashboard").then(setData).catch((e) => setError(e.message)); }, []);
  return (
    <>
      <PageHeader
        kicker="Member workspace"
        title={data ? `Welcome, ${data.name}` : "Account overview"}
        description="Track submitted receipts and the rewards created from approved purchases."
        action={<Link className={buttonVariants()} to="/app/upload"><Upload />Upload receipt</Link>}
      />
      <Notice error={error} />
      {data ? (
        <Stats items={[
          ["Pending receipts", data.pendingReceipts],
          ["Approved receipts", data.approvedReceipts],
          ["Available vouchers", data.availableVouchers]
        ]} />
      ) : !error && <Loading />}
      <WorkflowBrief />
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
      <PageHeader kicker="Purchase records" title="Upload receipt" description="Add the order details exactly as they appear on the purchase record." />
      <Notice error={error} />
      <section className="max-w-3xl">
        <form onSubmit={submit} className="space-y-6 border-t pt-7">
          <Field label="Order ID" htmlFor="orderId">
            <Input id="orderId" name="orderId" required maxLength="100" placeholder="e.g. ORDER-10482" />
          </Field>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Purchase date" htmlFor="purchaseDate">
              <Input id="purchaseDate" name="purchaseDate" type="date" max={localToday()} required />
            </Field>
            <Field label="Amount" htmlFor="amount">
              <Input id="amount" name="amount" type="number" min="0.01" max="9999999999.99" step="0.01" inputMode="decimal" placeholder="0.00" required />
            </Field>
          </div>
          <div className="space-y-2">
            <Label htmlFor="receipt">Receipt file</Label>
            <div className="border border-dashed bg-white px-4 py-5">
              <Input
                id="receipt"
                name="receipt"
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                className="h-auto border-0 bg-transparent p-0 shadow-none file:mr-4 file:rounded-sm file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-medium hover:file:bg-slate-200"
                required
              />
              <p className="mt-3 text-xs text-muted-foreground">JPG, PNG, WEBP, or PDF. Maximum file size: 5 MB.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 border-t pt-6">
            <Button size="lg" disabled={busy}>
              {busy ? <LoaderCircle className="animate-spin" /> : <Upload />}
              {busy ? "Uploading" : "Submit for review"}
            </Button>
            <span className="text-xs text-muted-foreground">New submissions start as pending.</span>
          </div>
        </form>
      </section>
    </>
  );
}

const statusStyles = {
  PENDING: "border-amber-300 bg-amber-50 text-amber-800",
  APPROVED: "border-emerald-300 bg-emerald-50 text-emerald-800",
  REJECTED: "border-red-300 bg-red-50 text-red-800"
};

const statusIcons = {
  PENDING: Clock3,
  APPROVED: CircleCheck,
  REJECTED: XCircle
};

const receiptFilters = [
  { value: "ALL", label: "All", marker: "bg-slate-400", count: "border-slate-200 bg-slate-50 text-slate-700" },
  { value: "PENDING", label: "Pending", marker: "bg-amber-500", count: "border-amber-200 bg-amber-50 text-amber-800" },
  { value: "APPROVED", label: "Approved", marker: "bg-emerald-500", count: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  { value: "REJECTED", label: "Rejected", marker: "bg-red-500", count: "border-red-200 bg-red-50 text-red-800" }
];

function Status({ value }) {
  const Icon = statusIcons[value] || CircleAlert;
  return (
    <Badge variant="outline" className={cn("rounded-sm font-mono text-[9px] tracking-[0.08em]", statusStyles[value])}>
      <Icon />{value}
    </Badge>
  );
}

function Empty({ icon: Icon = ReceiptText, children }) {
  return (
    <div className="grid place-items-center border-y border-dashed py-16 text-center">
      <Icon className="mb-4 size-6 text-slate-400" strokeWidth="1.5" />
      <p className="max-w-sm text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

function ReceiptFilters({ active, counts, onChange }) {
  return (
    <section className="mb-4" aria-label="Receipt status summary">
      <div className="grid grid-cols-2 gap-px border bg-border sm:grid-cols-4" role="group" aria-label="Filter receipts by status">
        {receiptFilters.map((filter) => {
          const selected = active === filter.value;
          return (
            <button
              key={filter.value}
              type="button"
              aria-pressed={selected}
              aria-controls="receipt-history-results"
              onClick={() => onChange(filter.value)}
              className={cn(
                "relative flex min-h-14 items-center justify-between gap-4 bg-white px-4 py-3 text-left text-sm font-medium transition-colors focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px]",
                selected ? "text-foreground" : "text-muted-foreground hover:bg-slate-50 hover:text-foreground",
                selected && "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-blue-600"
              )}
            >
              <span className="flex items-center gap-2.5">
                <span className={cn("size-1.5 rounded-full", filter.marker)} aria-hidden="true" />
                {filter.label}
              </span>
              <span className={cn("min-w-7 rounded-sm border px-1.5 py-0.5 text-center font-mono text-[10px] tabular-nums", filter.count)}>
                {counts[filter.value]}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ReceiptHistory() {
  const location = useLocation();
  const [receipts, setReceipts] = useState(null);
  const [filter, setFilter] = useState("ALL");
  const [error, setError] = useState("");
  useEffect(() => { api("/receipts").then((d) => setReceipts(d.receipts)).catch((e) => setError(e.message)); }, []);

  const counts = {
    ALL: receipts?.length ?? 0,
    PENDING: receipts?.filter((receipt) => receipt.status === "PENDING").length ?? 0,
    APPROVED: receipts?.filter((receipt) => receipt.status === "APPROVED").length ?? 0,
    REJECTED: receipts?.filter((receipt) => receipt.status === "REJECTED").length ?? 0
  };
  const visibleReceipts = receipts?.filter((receipt) => filter === "ALL" || receipt.status === filter) ?? [];

  async function download(id) {
    setError("");
    try { await downloadReceipt(id); } catch (downloadError) { setError(downloadError.message); }
  }

  return (
    <>
      <PageHeader
        kicker="Purchase records"
        title="Receipt history"
        description="Review submission status and retrieve the original purchase files."
        action={<Link className={buttonVariants({ variant: "outline" })} to="/app/upload"><Upload />New receipt</Link>}
      />
      <Notice error={error} success={location.state?.success} />
      {receipts ? (
        <>
          <ReceiptFilters active={filter} counts={counts} onChange={setFilter} />
          <p className="sr-only" aria-live="polite">
            {visibleReceipts.length} {filter === "ALL" ? "total" : filter.toLowerCase()} {visibleReceipts.length === 1 ? "receipt" : "receipts"}.
          </p>
          <div id="receipt-history-results">
            {visibleReceipts.length ? (
              <div className="border bg-white">
                <Table>
                  <TableHeader className="bg-slate-50/80">
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>Purchase date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead className="w-16"><span className="sr-only">File</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleReceipts.map((receipt) => (
                      <TableRow key={receipt.id}>
                        <TableCell className="font-mono text-xs font-medium">{receipt.orderId}</TableCell>
                        <TableCell>{formatDate(receipt.purchaseDate)}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums">{formatAmount(receipt.amount)}</TableCell>
                        <TableCell>
                          <Status value={receipt.status} />
                          {receipt.rejectionReason && <span className="mt-2 block max-w-52 text-xs leading-5 text-red-700">{receipt.rejectionReason}</span>}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(receipt.submittedAt)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon-sm" onClick={() => download(receipt.id)} aria-label={`Download receipt for ${receipt.orderId}`}><Download /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <Empty>
                {filter === "ALL"
                  ? "No receipts yet. Add a purchase record to start the review process."
                  : `No ${filter.toLowerCase()} receipts.`}
              </Empty>
            )}
          </div>
        </>
      ) : !error && <Loading />}
    </>
  );
}

function Vouchers() {
  const [vouchers, setVouchers] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { api("/user/vouchers").then((d) => setVouchers(d.vouchers)).catch((e) => setError(e.message)); }, []);
  return (
    <>
      <PageHeader kicker="Issued rewards" title="Vouchers" description="Each voucher traces back to one approved receipt." />
      <Notice error={error} />
      {vouchers?.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {vouchers.map((voucher) => (
            <article className="relative overflow-hidden rounded-sm border bg-white p-6 before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-blue-600" key={voucher.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground">Voucher code</p>
                  <strong className="mt-2 block font-mono text-lg font-medium tracking-[-0.02em] text-foreground">{voucher.code}</strong>
                </div>
                <TicketCheck className="size-5 text-primary" strokeWidth="1.7" />
              </div>
              <dl className="mt-8 grid grid-cols-2 gap-5 border-t pt-4">
                <div><dt className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Source order</dt><dd className="mt-1 text-sm font-medium">{voucher.orderId}</dd></div>
                <div><dt className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Issued</dt><dd className="mt-1 text-sm font-medium">{formatDate(voucher.issuedAt)}</dd></div>
              </dl>
            </article>
          ))}
        </div>
      ) : vouchers ? <Empty icon={TicketCheck}>Approved receipts will appear here as issued vouchers.</Empty> : !error && <Loading />}
    </>
  );
}

function SettingsPage() {
  const { user, updateUser } = useAuth();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const data = await api("/user/profile", {
        method: "PUT",
        body: JSON.stringify({ name: form.get("name"), email: form.get("email"), phone: form.get("phone") })
      });
      updateUser(data.user);
      setSuccess("Profile changes saved.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader kicker="Account" title="Profile settings" description="Keep at least one contact method available for account access." />
      <Notice error={error} success={success} />
      <section className="max-w-2xl">
        <form className="space-y-6 border-t pt-7" onSubmit={submit}>
          <Field label="Name" htmlFor="profile-name" optional><Input id="profile-name" name="name" defaultValue={user.name || ""} maxLength="100" /></Field>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Email" htmlFor="profile-email" optional><Input id="profile-email" name="email" type="email" defaultValue={user.email || ""} /></Field>
            <Field label="Phone" htmlFor="profile-phone" optional><Input id="profile-phone" name="phone" type="tel" defaultValue={user.phone || ""} /></Field>
          </div>
          <div className="border-t pt-6">
            <Button disabled={busy}>{busy && <LoaderCircle className="animate-spin" />}{busy ? "Saving" : "Save changes"}</Button>
          </div>
        </form>
      </section>
    </>
  );
}

function AdminDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { api("/admin/dashboard").then(setData).catch((e) => setError(e.message)); }, []);
  return (
    <>
      <PageHeader
        kicker="Validation desk"
        title="Program overview"
        description="Monitor the review queue and the outcomes recorded across the loyalty program."
        action={<Link className={buttonVariants()} to="/admin/receipts"><ClipboardCheck />Open receipt queue</Link>}
      />
      <Notice error={error} />
      {data ? (
        <Stats items={[
          ["Pending", data.pendingReceipts],
          ["Approved", data.approvedReceipts],
          ["Rejected", data.rejectedReceipts],
          ["Vouchers issued", data.vouchersIssued]
        ]} />
      ) : !error && <Loading />}
      <section className="mt-12 grid gap-8 border-t pt-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <div className="flex items-center gap-2"><ShieldCheck className="size-4 text-primary" /><h2 className="text-base font-semibold">Decision controls</h2></div>
          <dl className="mt-5 divide-y border-y">
            <div className="grid gap-2 py-4 sm:grid-cols-[180px_1fr]"><dt className="text-sm font-medium">Pending only</dt><dd className="text-sm text-muted-foreground">Only pending receipts can receive a decision.</dd></div>
            <div className="grid gap-2 py-4 sm:grid-cols-[180px_1fr]"><dt className="text-sm font-medium">Single transition</dt><dd className="text-sm text-muted-foreground">A recorded decision cannot be processed a second time.</dd></div>
            <div className="grid gap-2 py-4 sm:grid-cols-[180px_1fr]"><dt className="text-sm font-medium">Voucher integrity</dt><dd className="text-sm text-muted-foreground">Approval and voucher creation complete in one transaction.</dd></div>
          </dl>
        </div>
        <aside className="border-l-2 border-blue-600 pl-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Operator focus</p>
          <p className="mt-3 text-lg font-semibold leading-7">Clear the pending queue before reviewing historical decisions.</p>
        </aside>
      </section>
    </>
  );
}

function AdminReceipts() {
  const [status, setStatus] = useState("PENDING");
  const [receipts, setReceipts] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [decisionRequest, setDecisionRequest] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");

  function load(nextStatus = status) {
    setReceipts(null);
    setError("");
    api(`/admin/receipts${nextStatus ? `?status=${nextStatus}` : ""}`).then((data) => setReceipts(data.receipts)).catch((requestError) => setError(requestError.message));
  }

  useEffect(() => { load(status); }, [status]);

  function requestDecision(receipt, decision) {
    setDecisionRequest({ receipt, decision });
    setRejectionReason("");
    setError("");
    setSuccess("");
  }

  async function confirmDecision() {
    if (!decisionRequest) return;
    const { receipt, decision } = decisionRequest;
    setBusyId(receipt.id);
    try {
      await api(`/admin/receipts/${receipt.id}/decision`, {
        method: "PATCH",
        body: JSON.stringify({ decision, rejectionReason: decision === "REJECT" ? rejectionReason : null })
      });
      setSuccess(decision === "APPROVE" ? "Receipt approved and one voucher issued." : "Receipt rejected. No voucher was issued.");
      setDecisionRequest(null);
      load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId(null);
    }
  }

  async function download(receipt) {
    setError("");
    try { await downloadReceipt(receipt.id, receipt.fileName); } catch (downloadError) { setError(downloadError.message); }
  }

  const decisionIsReject = decisionRequest?.decision === "REJECT";

  return (
    <>
      <PageHeader
        kicker="Validation desk"
        title="Receipt queue"
        description="Inspect purchase evidence and record one final decision for each pending receipt."
        action={(
          <div className="flex items-center gap-3">
            <Label htmlFor="status-filter" className="text-xs text-muted-foreground">Show</Label>
            <NativeSelect id="status-filter" value={status} onChange={(event) => setStatus(event.target.value)} className="min-w-36 bg-white">
              <NativeSelectOption value="PENDING">Pending</NativeSelectOption>
              <NativeSelectOption value="APPROVED">Approved</NativeSelectOption>
              <NativeSelectOption value="REJECTED">Rejected</NativeSelectOption>
              <NativeSelectOption value="">All receipts</NativeSelectOption>
            </NativeSelect>
          </div>
        )}
      />
      <Notice error={error} success={success} />
      {receipts?.length ? (
        <div className="divide-y border-y">
          {receipts.map((receipt) => (
            <article className="py-6" key={receipt.id}>
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-mono text-xs font-medium text-foreground">{receipt.orderId}</span>
                    <Status value={receipt.status} />
                  </div>
                  <p className="mt-3 font-mono text-3xl font-medium tracking-[-0.05em] tabular-nums">{formatAmount(receipt.amount)}</p>
                  <dl className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
                    <Detail label="Member" value={receipt.userName || receipt.userEmail || receipt.userPhone} />
                    <Detail label="Purchased" value={formatDate(receipt.purchaseDate)} />
                    <Detail label="Submitted" value={formatDate(receipt.submittedAt)} />
                    <div>
                      <dt className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Evidence</dt>
                      <dd className="mt-1"><Button variant="link" className="h-auto max-w-full justify-start overflow-hidden p-0 text-xs" onClick={() => download(receipt)}><Download />{receipt.fileName}</Button></dd>
                    </div>
                  </dl>
                  {receipt.rejectionReason && <p className="mt-5 border-l-2 border-red-500 pl-4 text-sm text-red-800"><strong className="font-medium">Rejection reason:</strong> {receipt.rejectionReason}</p>}
                </div>
                {receipt.status === "PENDING" && (
                  <div className="flex shrink-0 gap-2 xl:pt-1">
                    <Button variant="outline" disabled={busyId === receipt.id} onClick={() => requestDecision(receipt, "REJECT")}>Reject</Button>
                    <Button disabled={busyId === receipt.id} onClick={() => requestDecision(receipt, "APPROVE")}><CircleCheck />Approve</Button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : receipts ? <Empty icon={ClipboardCheck}>No receipts match the selected status.</Empty> : !error && <Loading />}

      <Dialog
        open={Boolean(decisionRequest)}
        onOpenChange={(open) => {
          if (!open && !busyId) setDecisionRequest(null);
        }}
      >
        <DialogContent className="rounded-sm sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{decisionIsReject ? "Reject receipt" : "Approve receipt"}</DialogTitle>
            <DialogDescription>
              {decisionIsReject
                ? `Reject order ${decisionRequest?.receipt.orderId}. This decision will not create a voucher.`
                : `Approve order ${decisionRequest?.receipt.orderId} and issue exactly one voucher.`}
            </DialogDescription>
          </DialogHeader>
          {decisionIsReject && (
            <div className="space-y-2 py-2">
              <Label htmlFor="rejection-reason">Reason <span className="text-muted-foreground">(optional)</span></Label>
              <Textarea
                id="rejection-reason"
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                placeholder="Record a concise reason for the member."
                maxLength="500"
              />
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" disabled={Boolean(busyId)}>Cancel</Button></DialogClose>
            <Button variant={decisionIsReject ? "destructive" : "default"} onClick={confirmDecision} disabled={Boolean(busyId)}>
              {busyId ? <LoaderCircle className="animate-spin" /> : decisionIsReject ? <XCircle /> : <CircleCheck />}
              {busyId ? "Recording" : decisionIsReject ? "Reject receipt" : "Approve and issue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Detail({ label, value }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate text-sm font-medium" title={value}>{value}</dd>
    </div>
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
            <Route path="settings" element={<SettingsPage />} />
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
