import { Suspense, lazy, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { InvitationAccept } from './auth/InvitationAccept';
import { NodeTransferAccept } from './auth/NodeTransferAccept';
import { Login } from './auth/Login';
import { MfaVerify } from './auth/MfaVerify';
import { Register } from './auth/Register';
import { LogoLoader } from './components/LogoLoader';
import { RequireAdmin } from './components/RequireAdmin';
import { RequireAuth } from './components/RequireAuth';
import { MarketingLayout } from './marketing/MarketingLayout';
import {
  AudiencePage,
  CapabilitiesPage,
  DocsPage,
  MarketingHome,
  PricingPage,
  StoryPage,
} from './marketing/pages';
import { useAuthStore } from './store/auth';

/*
 * One application, three areas. The public marketing pages and the two auth
 * screens load eagerly so the first paint of the site stays immediate. The
 * operator area under /app and the admin control plane under /admin are split
 * per screen with React.lazy, so their code and the heavy libraries they pull in
 * (charts, the terminal) only arrive when a signed-in account opens them and
 * never weigh on the marketing first load.
 */

// Operator area.
const Workspace = lazy(() =>
  import('./app/screens/Workspace').then((m) => ({ default: m.Workspace })),
);
const WorkspaceHub = lazy(() =>
  import('./app/screens/WorkspaceHub').then((m) => ({ default: m.WorkspaceHub })),
);
const Nodes = lazy(() => import('./app/screens/Nodes').then((m) => ({ default: m.Nodes })));
const NodeRegister = lazy(() =>
  import('./app/screens/NodeRegister').then((m) => ({ default: m.NodeRegister })),
);
const NodeDetail = lazy(() =>
  import('./app/screens/NodeDetail').then((m) => ({ default: m.NodeDetail })),
);
const SSHKeys = lazy(() =>
  import('./app/screens/SSHKeys').then((m) => ({ default: m.SSHKeys })),
);
const Snippets = lazy(() =>
  import('./app/screens/Snippets').then((m) => ({ default: m.Snippets })),
);
const Projects = lazy(() =>
  import('./app/screens/Projects').then((m) => ({ default: m.Projects })),
);
const ProjectDetail = lazy(() =>
  import('./app/screens/ProjectDetail').then((m) => ({ default: m.ProjectDetail })),
);
const Services = lazy(() =>
  import('./app/screens/Services').then((m) => ({ default: m.Services })),
);
const Terminal = lazy(() =>
  import('./app/screens/Terminal').then((m) => ({ default: m.Terminal })),
);
const ServiceDeploy = lazy(() =>
  import('./app/screens/ServiceDeploy').then((m) => ({ default: m.ServiceDeploy })),
);
const ServiceDetail = lazy(() =>
  import('./app/screens/ServiceDetail').then((m) => ({ default: m.ServiceDetail })),
);
const ServiceImport = lazy(() =>
  import('./app/screens/ServiceImport').then((m) => ({ default: m.ServiceImport })),
);
const Capabilities = lazy(() =>
  import('./app/screens/Capabilities').then((m) => ({ default: m.Capabilities })),
);
const CapabilityMatrix = lazy(() =>
  import('./app/screens/CapabilityMatrix').then((m) => ({ default: m.CapabilityMatrix })),
);
const CapabilityDetail = lazy(() =>
  import('./app/screens/CapabilityDetail').then((m) => ({ default: m.CapabilityDetail })),
);
const Marketplace = lazy(() =>
  import('./app/screens/Marketplace').then((m) => ({ default: m.Marketplace })),
);
const PluginDetail = lazy(() =>
  import('./app/screens/PluginDetail').then((m) => ({ default: m.PluginDetail })),
);
const Automations = lazy(() =>
  import('./app/screens/Automations').then((m) => ({ default: m.Automations })),
);
const AutomationNew = lazy(() =>
  import('./app/screens/AutomationNew').then((m) => ({ default: m.AutomationNew })),
);
const AutomationDetail = lazy(() =>
  import('./app/screens/AutomationDetail').then((m) => ({ default: m.AutomationDetail })),
);
const Extensions = lazy(() =>
  import('./app/screens/Extensions').then((m) => ({ default: m.Extensions })),
);
const Credentials = lazy(() =>
  import('./app/screens/Credentials').then((m) => ({ default: m.Credentials })),
);
const History = lazy(() => import('./app/screens/History').then((m) => ({ default: m.History })));
const OperationDetail = lazy(() =>
  import('./app/screens/OperationDetail').then((m) => ({ default: m.OperationDetail })),
);
const Reports = lazy(() => import('./app/screens/Reports').then((m) => ({ default: m.Reports })));
const Security = lazy(() =>
  import('./app/screens/Security').then((m) => ({ default: m.Security })),
);
const Billing = lazy(() => import('./app/screens/Billing').then((m) => ({ default: m.Billing })));
const Transactions = lazy(() =>
  import('./app/screens/Transactions').then((m) => ({ default: m.Transactions })),
);
const TransactionDetail = lazy(() =>
  import('./app/screens/TransactionDetail').then((m) => ({ default: m.TransactionDetail })),
);
const Team = lazy(() => import('./app/screens/Team').then((m) => ({ default: m.Team })));

// Admin control plane.
const Overview = lazy(() =>
  import('./admin/screens/Overview').then((m) => ({ default: m.Overview })),
);
const Operators = lazy(() =>
  import('./admin/screens/Operators').then((m) => ({ default: m.Operators })),
);
const OperatorDetail = lazy(() =>
  import('./admin/screens/OperatorDetail').then((m) => ({ default: m.OperatorDetail })),
);
const Operations = lazy(() =>
  import('./admin/screens/Operations').then((m) => ({ default: m.Operations })),
);
const AdminOperationDetail = lazy(() =>
  import('./admin/screens/AdminOperationDetail').then((m) => ({ default: m.AdminOperationDetail })),
);
const Analytics = lazy(() =>
  import('./admin/screens/Analytics').then((m) => ({ default: m.Analytics })),
);
const Audit = lazy(() => import('./admin/screens/Audit').then((m) => ({ default: m.Audit })));
const PromoCodes = lazy(() =>
  import('./admin/screens/PromoCodes').then((m) => ({ default: m.PromoCodes })),
);
const Tiers = lazy(() => import('./admin/screens/Tiers').then((m) => ({ default: m.Tiers })));
// A shell on a page of its own, for working on a second screen.
const NodeShellPage = lazy(() =>
  import('./app/screens/ShellPage').then((m) => ({ default: m.NodeShellPage })),
);
const ServiceShellPage = lazy(() =>
  import('./app/screens/ShellPage').then((m) => ({ default: m.ServiceShellPage })),
);
const Subscribers = lazy(() =>
  import('./admin/screens/Subscribers').then((m) => ({ default: m.Subscribers })),
);
const SubscriberDetail = lazy(() =>
  import('./admin/screens/SubscriberDetail').then((m) => ({ default: m.SubscriberDetail })),
);
const Arrangements = lazy(() =>
  import('./admin/screens/Arrangements').then((m) => ({ default: m.Arrangements })),
);
const Emergency = lazy(() =>
  import('./admin/screens/Emergency').then((m) => ({ default: m.Emergency })),
);
const FeatureFlags = lazy(() =>
  import('./admin/screens/FeatureFlags').then((m) => ({ default: m.FeatureFlags })),
);
const WebhookDeliveries = lazy(() =>
  import('./admin/screens/WebhookDeliveries').then((m) => ({ default: m.WebhookDeliveries })),
);
const RateLimits = lazy(() =>
  import('./admin/screens/RateLimits').then((m) => ({ default: m.RateLimits })),
);
const EmailDeliveries = lazy(() =>
  import('./admin/screens/EmailDeliveries').then((m) => ({ default: m.EmailDeliveries })),
);

export function App() {
  const loadSession = useAuthStore((state) => state.loadSession);

  // Read the session once on boot so route protection knows where to send a
  // visitor. Until it resolves, protected routes show a minimal splash.
  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  return (
    <Suspense fallback={<LogoLoader fullScreen label="Loading" />}>
      <Routes>
        {/* Public marketing. */}
        <Route element={<MarketingLayout />}>
          <Route path="/" element={<MarketingHome />} />
          <Route path="/story" element={<StoryPage />} />
          <Route path="/capabilities" element={<CapabilitiesPage />} />
          <Route path="/audience" element={<AudiencePage />} />
          <Route path="/docs" element={<DocsPage />} />
          <Route path="/pricing" element={<PricingPage />} />
        </Route>

        {/* Unified sign in and sign up. */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/mfa" element={<MfaVerify />} />
        <Route path="/invitations/:token" element={<InvitationAccept />} />
        <Route path="/node-transfers/:token" element={<NodeTransferAccept />} />

        {/* Operator area: any signed-in account. */}
        <Route path="/app" element={<RequireAuth />}>
          <Route index element={<Workspace />} />
          <Route path="workspaces" element={<WorkspaceHub />} />
          <Route path="nodes" element={<Nodes />} />
          <Route path="nodes/new" element={<NodeRegister />} />
          <Route path="ssh-keys" element={<SSHKeys />} />
          <Route path="snippets" element={<Snippets />} />
          <Route path="nodes/:id" element={<NodeDetail />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="services" element={<Services />} />
          <Route path="services/new" element={<ServiceDeploy />} />
          <Route path="services/import" element={<ServiceImport />} />
          <Route path="services/:id" element={<ServiceDetail />} />
          <Route path="terminal" element={<Terminal />} />
          <Route path="capabilities" element={<Capabilities />} />
          <Route path="capabilities/matrix" element={<CapabilityMatrix />} />
          <Route path="capabilities/:key" element={<CapabilityDetail />} />
          <Route path="marketplace" element={<Marketplace />} />
          <Route path="marketplace/:id" element={<PluginDetail />} />
          <Route path="automations" element={<Automations />} />
          <Route path="automations/new" element={<AutomationNew />} />
          <Route path="automations/:id" element={<AutomationDetail />} />
          <Route path="extensions" element={<Extensions />} />
          <Route path="operations" element={<History />} />
          <Route path="operations/:id" element={<OperationDetail />} />
          <Route path="credentials" element={<Credentials />} />
          <Route path="reports" element={<Reports />} />
          <Route path="billing" element={<Billing />} />
          <Route path="billing/transactions" element={<Transactions />} />
          <Route path="billing/transactions/:reference" element={<TransactionDetail />} />
          <Route path="security" element={<Security />} />
          <Route path="team" element={<Team />} />
          {/* The standalone shells sit inside the authenticated area so they are
              guarded like everything else, but they render no application
              navigation: the page is one terminal and nothing more. */}
          <Route path="nodes/:id/shell" element={<NodeShellPage />} />
          <Route path="services/:id/shell" element={<ServiceShellPage />} />
        </Route>

        {/* Admin control plane: admin role only. */}
        <Route path="/admin" element={<RequireAdmin />}>
          <Route index element={<Overview />} />
          <Route path="operators" element={<Operators />} />
          <Route path="operators/:id" element={<OperatorDetail />} />
          <Route path="operations" element={<Operations />} />
          <Route path="operations/:id" element={<AdminOperationDetail />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="audit" element={<Audit />} />
          <Route path="promo-codes" element={<PromoCodes />} />
          <Route path="tiers" element={<Tiers />} />
          <Route path="subscribers" element={<Subscribers />} />
          <Route path="subscribers/:id" element={<SubscriberDetail />} />
          <Route path="arrangements" element={<Arrangements />} />
          <Route path="emergency" element={<Emergency />} />
          <Route path="feature-flags" element={<FeatureFlags />} />
          <Route path="webhooks" element={<WebhookDeliveries />} />
          <Route path="rate-limits" element={<RateLimits />} />
          <Route path="email-deliveries" element={<EmailDeliveries />} />
        </Route>

        {/* Anything else returns to the marketing home. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
