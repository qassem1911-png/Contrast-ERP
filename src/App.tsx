import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "./components/ui/sonner";
import { Toaster } from "./components/ui/toaster";
import { TooltipProvider } from "./components/ui/tooltip";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Index from "./pages/Index.tsx";
import Login from "./pages/Login.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import { Analytics } from "./pages/Analytics";
import Users from "./pages/Users.tsx";
import Inventory from "./pages/Inventory.tsx";
import Brands from "./pages/Brands.tsx";
import Customers from "./pages/Customers.tsx";
import MyCustody from "./pages/MyCustody.tsx";
import Invoices from "./pages/Invoices.tsx";
import NewInvoice from "./pages/NewInvoice.tsx";
import InvoiceDetails from "./pages/InvoiceDetails.tsx";
import Suppliers from "./pages/Suppliers.tsx";
import { Expenses } from "./pages/Expenses.tsx";
import { FinancialHub } from "./pages/FinancialHub.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();


const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/analytics" element={<ProtectedRoute requirePermission="analytics"><Analytics /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute requirePermission="inventory"><Inventory /></ProtectedRoute>} />
            <Route path="/brands" element={<ProtectedRoute requirePermission="inventory"><Brands /></ProtectedRoute>} />
            <Route path="/customers" element={<ProtectedRoute requirePermission="customers"><Customers /></ProtectedRoute>} />
            <Route path="/suppliers" element={<ProtectedRoute requirePermission="suppliers"><Suppliers /></ProtectedRoute>} />
            <Route path="/custody" element={<ProtectedRoute requireRoles={["super_admin","technician"]}><MyCustody /></ProtectedRoute>} />
            <Route path="/invoices" element={<ProtectedRoute requirePermission="invoices"><Invoices /></ProtectedRoute>} />
            <Route path="/invoices/new" element={<ProtectedRoute requirePermission="invoices"><NewInvoice /></ProtectedRoute>} />
            <Route path="/invoices/:id" element={<ProtectedRoute requirePermission="invoices"><InvoiceDetails /></ProtectedRoute>} />
            <Route path="/expenses" element={<ProtectedRoute requirePermission="expenses"><Expenses /></ProtectedRoute>} />
            <Route path="/financial-hub" element={<ProtectedRoute requirePermission="analytics"><FinancialHub /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute requirePermission="system"><Users /></ProtectedRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
