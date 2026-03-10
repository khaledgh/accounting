import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from '@/store/auth'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute } from '@/components/shared/ProtectedRoute'
import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { AccountingDashboard } from '@/pages/accounting/AccountingDashboard'
import { EcommerceDashboard } from '@/pages/ecommerce/EcommerceDashboard'

import { UsersPage } from '@/pages/settings/UsersPage'
import { ChartOfAccountsPage } from '@/pages/accounting/ChartOfAccountsPage'
import { FinancialYearsPage } from '@/pages/accounting/FinancialYearsPage'
import { JournalEntriesPage } from '@/pages/accounting/JournalEntriesPage'
import { TrialBalancePage } from '@/pages/accounting/reports/TrialBalancePage'
import { BalanceSheetPage } from '@/pages/accounting/reports/BalanceSheetPage'
import { ProfitLossPage } from '@/pages/accounting/reports/ProfitLossPage'
import { ProductsPage } from '@/pages/ecommerce/ProductsPage'
import { ProductFormPage } from '@/pages/ecommerce/ProductFormPage'
import { CustomersPage } from '@/pages/ecommerce/CustomersPage'
import { OrdersPage } from '@/pages/ecommerce/OrdersPage'
import { IntegrationPage } from '@/pages/integration/IntegrationPage'
import { SuppliersPage } from '@/pages/ecommerce/SuppliersPage'
import { CategoriesPage } from '@/pages/ecommerce/CategoriesPage'
import { InventoryPage } from '@/pages/ecommerce/InventoryPage'
import { InvoicesPage } from '@/pages/ecommerce/InvoicesPage'
import { PaymentsPage } from '@/pages/ecommerce/PaymentsPage'
import { SettingsPage } from '@/pages/settings/SettingsPage'
import { CompaniesPage } from '@/pages/settings/CompaniesPage'
import { CurrenciesPage } from '@/pages/accounting/CurrenciesPage'
import { GeneralLedgerPage } from '@/pages/accounting/reports/GeneralLedgerPage'
import { CashFlowPage } from '@/pages/accounting/reports/CashFlowPage'
import { ExpensesPage } from '@/pages/accounting/ExpensesPage'
import { ReceivablesPage } from '@/pages/accounting/ReceivablesPage'
import { PayablesPage } from '@/pages/accounting/PayablesPage'
import { PurchaseInvoicesPage } from '@/pages/accounting/PurchaseInvoicesPage'
import { PurchaseInvoiceFormPage } from '@/pages/accounting/PurchaseInvoiceFormPage'
import { BankAccountsPage } from '@/pages/accounting/BankAccountsPage'
import { AccountingPaymentsPage } from '@/pages/accounting/AccountingPaymentsPage'
import { InvoiceTemplatesPage } from '@/pages/settings/InvoiceTemplatesPage'
import { MediaCenterPage } from '@/pages/settings/MediaCenterPage'

function App() {
  const { isAuthenticated, fetchProfile } = useAuthStore()

  useEffect(() => {
    if (isAuthenticated) {
      fetchProfile()
    }
  }, [isAuthenticated, fetchProfile])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <LoginPage />} />
        <Route path="/register" element={isAuthenticated ? <Navigate to="/" /> : <RegisterPage />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/accounting" replace />} />

          {/* Accounting Routes */}
          <Route path="accounting" element={<AccountingDashboard />} />
          <Route path="accounting/accounts" element={<ChartOfAccountsPage />} />
          <Route path="accounting/journals" element={<JournalEntriesPage />} />
          <Route path="accounting/financial-years" element={<FinancialYearsPage />} />
          <Route path="accounting/currencies" element={<CurrenciesPage />} />
          <Route path="accounting/reports/general-ledger" element={<GeneralLedgerPage />} />
          <Route path="accounting/reports/trial-balance" element={<TrialBalancePage />} />
          <Route path="accounting/reports/balance-sheet" element={<BalanceSheetPage />} />
          <Route path="accounting/reports/profit-loss" element={<ProfitLossPage />} />
          <Route path="accounting/reports/cash-flow" element={<CashFlowPage />} />
          <Route path="accounting/expenses" element={<ExpensesPage />} />
          <Route path="accounting/receivables" element={<ReceivablesPage />} />
          <Route path="accounting/payables" element={<PayablesPage />} />
          <Route path="accounting/purchase-invoices" element={<PurchaseInvoicesPage />} />
          <Route path="accounting/purchase-invoices/new" element={<PurchaseInvoiceFormPage />} />
          <Route path="accounting/bank-accounts" element={<BankAccountsPage />} />
          <Route path="accounting/payments" element={<AccountingPaymentsPage />} />

          {/* eCommerce Routes */}
          <Route path="ecommerce" element={<EcommerceDashboard />} />
          <Route path="ecommerce/products" element={<ProductsPage />} />
          <Route path="ecommerce/products/new" element={<ProductFormPage />} />
          <Route path="ecommerce/products/:id/edit" element={<ProductFormPage />} />
          <Route path="ecommerce/categories" element={<CategoriesPage />} />
          <Route path="ecommerce/orders" element={<OrdersPage />} />
          <Route path="ecommerce/customers" element={<CustomersPage />} />
          <Route path="ecommerce/suppliers" element={<SuppliersPage />} />
          <Route path="ecommerce/inventory" element={<InventoryPage />} />
          <Route path="ecommerce/invoices" element={<InvoicesPage />} />
          <Route path="ecommerce/payments" element={<PaymentsPage />} />

          {/* System Routes */}
          <Route path="integration" element={<IntegrationPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="settings/companies" element={<CompaniesPage />} />
          <Route path="settings/users" element={<UsersPage />} />
          <Route path="settings/invoice-templates" element={<InvoiceTemplatesPage />} />
          <Route path="settings/media" element={<MediaCenterPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
