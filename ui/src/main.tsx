import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./index.css";
import { AuthProvider, useAuth } from "./auth";
import Layout from "./components/Layout";
import LoginView from "./views/LoginView";
import DashboardView from "./views/DashboardView";
import CallsView from "./views/CallsView";
import CallView from "./views/CallView";
import CustomersView from "./views/CustomersView";
import CustomerView from "./views/CustomerView";
import AgentsView from "./views/AgentsView";
import AgentView from "./views/AgentView";
import UploadView from "./views/UploadView";
import UsersView from "./views/UsersView";
import { Spinner } from "./components/ui";

function Guard({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { me, loading } = useAuth();
  if (loading) return <Spinner full />;
  if (!me) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(me.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginView />} />
      <Route path="/" element={<Guard><Layout /></Guard>}>
        <Route index element={<DashboardView />} />
        <Route path="calls" element={<CallsView />} />
        <Route path="calls/:sid" element={<CallView />} />
        <Route path="customers" element={<CustomersView />} />
        <Route path="customers/:id" element={<CustomerView />} />
        <Route path="agents" element={<AgentsView />} />
        <Route path="agents/:id" element={<AgentView />} />
        <Route path="upload" element={<Guard roles={["admin", "manager"]}><UploadView /></Guard>} />
        <Route path="users" element={<Guard roles={["admin"]}><UsersView /></Guard>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);