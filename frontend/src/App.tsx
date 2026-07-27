import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter, Redirect } from 'wouter';
import { AuthProvider } from '@/lib/mock-auth';
import { DepartmentProvider } from '@/lib/department-context';
import { NotificationProvider } from '@/lib/notification-context';
import { ThemeProvider } from '@/lib/theme-context';
import { useTheme } from '@/hooks/use-theme';
import { AppShell } from '@/components/layout/AppShell';

// Pages
import LoginPage from '@/pages/auth/LoginPage';
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage';
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage';
import DashboardPage from '@/pages/DashboardPage';
import DepartmentSelectPage from '@/pages/departments/DepartmentSelectPage';
import MachineRegisterPage from '@/pages/machines/MachineRegisterPage';
import MachineAddPage from '@/pages/machines/MachineAddPage';
import MachineEditPage from '@/pages/machines/MachineEditPage';
import MachineDetailPage from '@/pages/machines/MachineDetailPage';
import PartsPage from '@/pages/parts/PartsPage';
import PartAddPage from '@/pages/parts/PartAddPage';
import PartEditPage from '@/pages/parts/PartEditPage';
import PartDetailPage from '@/pages/parts/PartDetailPage';
import MaintenancePage from '@/pages/maintenance/MaintenancePage';
import MaintenanceAddPage from '@/pages/maintenance/MaintenanceAddPage';
import MaintenanceEditPage from '@/pages/maintenance/MaintenanceEditPage';
import MaintenanceDetailPage from '@/pages/maintenance/MaintenanceDetailPage';
import MaintenancePlanAddPage from '@/pages/maintenance/MaintenancePlanAddPage';
import MaintenancePlanEditPage from '@/pages/maintenance/MaintenancePlanEditPage';
import RepairsPage from '@/pages/repairs/RepairsPage';
import RepairAddPage from '@/pages/repairs/RepairAddPage';
import RepairEditPage from '@/pages/repairs/RepairEditPage';
import RepairDetailPage from '@/pages/repairs/RepairDetailPage';
import ReportsPage from '@/pages/reports/ReportsPage';
import NotificationsPage from '@/pages/NotificationsPage';
import ProfilePage from '@/pages/ProfilePage';
import NotFoundPage from '@/pages/NotFoundPage';
import UnauthorizedPage from '@/pages/UnauthorizedPage';
import { registeredRoutes } from '@/lib/routes';

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path={registeredRoutes.login} component={LoginPage} />
      <Route path={registeredRoutes.forgotPassword} component={ForgotPasswordPage} />
      <Route path={registeredRoutes.resetPassword} component={ResetPasswordPage} />
      <Route path={registeredRoutes.root}>{() => <Redirect to="/dashboard" />}</Route>
      <Route path={registeredRoutes.departments} component={DepartmentSelectPage} />
      <Route path={registeredRoutes.dashboard} component={DashboardPage} />
      <Route path={registeredRoutes.machines} component={MachineRegisterPage} />
      {/* Static machine routes must precede `/machines/:id` so `add` is not read as an ID. */}
      <Route path={registeredRoutes.machineAdd} component={MachineAddPage} />
      <Route path={registeredRoutes.machineEdit} component={MachineEditPage} />
      <Route path={registeredRoutes.machineDetail} component={MachineDetailPage} />
      <Route path={registeredRoutes.parts} component={PartsPage} />
      {/* Static part routes must precede `/parts/:id` for the same reason as machines. */}
      <Route path={registeredRoutes.partAdd} component={PartAddPage} />
      <Route path={registeredRoutes.partEdit} component={PartEditPage} />
      <Route path={registeredRoutes.partDetail} component={PartDetailPage} />
      <Route path={registeredRoutes.maintenance} component={MaintenancePage} />
      {/* Plan routes and static maintenance routes must precede `/maintenance/:id`. */}
      <Route path={registeredRoutes.maintenancePlanAdd} component={MaintenancePlanAddPage} />
      <Route path={registeredRoutes.maintenancePlanEdit} component={MaintenancePlanEditPage} />
      <Route path={registeredRoutes.maintenanceAdd} component={MaintenanceAddPage} />
      <Route path={registeredRoutes.maintenanceEdit} component={MaintenanceEditPage} />
      <Route path={registeredRoutes.maintenanceDetail} component={MaintenanceDetailPage} />
      {/* Static repair routes must precede `/repairs/:id`. */}
      <Route path={registeredRoutes.repairs} component={RepairsPage} />
      <Route path={registeredRoutes.repairAdd} component={RepairAddPage} />
      <Route path={registeredRoutes.repairEdit} component={RepairEditPage} />
      <Route path={registeredRoutes.repairDetail} component={RepairDetailPage} />
      <Route path={registeredRoutes.reports} component={ReportsPage} />
      <Route path={registeredRoutes.notifications} component={NotificationsPage} />
      <Route path={registeredRoutes.profile} component={ProfilePage} />
      <Route path={registeredRoutes.unauthorized} component={UnauthorizedPage} />
      <Route component={NotFoundPage} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
              <DepartmentProvider>
                <NotificationProvider>
                  <AppShell>
                    <Router />
                  </AppShell>
                </NotificationProvider>
              </DepartmentProvider>
            </WouterRouter>
            <AppToaster />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

/**
 * Sonner needs the theme passed explicitly — it renders in a portal and picks its own
 * palette rather than inheriting the `.dark` class from `<html>`.
 */
function AppToaster() {
  const { resolved } = useTheme();
  return <Toaster position="top-right" richColors closeButton theme={resolved} />;
}

export default App;
