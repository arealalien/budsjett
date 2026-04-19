import React from 'react';
import ReactDOM from 'react-dom/client';
import {
    createBrowserRouter,
    RouterProvider,
} from 'react-router-dom';
import reportWebVitals from './reportWebVitals';
import { AuthProvider } from './components/AuthContext';
import { ToastProvider } from './components/utils/ToastContext';
import { AnimationProvider } from "./components/sidebar/AnimationMode";

import App from './App';
import Home from './pages/Home';
import Register from './pages/Register';
import SignIn from './pages/SignIn';
import Addpurchase from "./pages/Addpurchase";
import Analytics from "./pages/Analytics";
import Statistics from "./pages/Statistics";
import Purchases from "./pages/Purchases";
import Reports from "./pages/Reports";
import VerifyEmailPage from './pages/VerifyEmailPage';
import RequireOnboarding, { RequireApp } from './components/RequireOnboarding';
import OnboardingPage from './pages/OnboardingPage';
import BudgetsIndex from './pages/BudgetsIndex';
import BudgetLayout from './pages/BudgetLayout';
import BudgetHome from './pages/BudgetHome';
import BudgetEdit from './pages/BudgetEdit';
import BudgetMembers from './pages/BudgetMembers';
import BudgetSettings from "./pages/BudgetSettings";
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import PurchaseDetails from './pages/PurchaseDetails';
import AccountSettings from './pages/AccountSettings';

const router = createBrowserRouter([
    {
        element: <App />,
        children: [
            { path: '/', element: <Home /> },
            { path: '/register', element: <Register /> },
            { path: '/signin', element: <SignIn /> },
            { path: '/forgot-password', element: <ForgotPasswordPage /> },
            { path: '/reset', element: <ResetPasswordPage /> },
            { path: '/verify', element: <VerifyEmailPage /> },

            { path: '/onboarding', element: <RequireOnboarding><OnboardingPage/></RequireOnboarding> },

            { path: '/budgets', element: <RequireApp><BudgetsIndex /></RequireApp> },

            {
                path: '/:slug',
                handle: { isBudgetRoute: true },
                element: <RequireApp><BudgetLayout /></RequireApp>,
                children: [
                    { index: true, element: <BudgetHome /> },
                    { path: 'new', element: <Addpurchase /> },
                    { path: 'analytics', element: <Analytics /> },
                    { path: 'statistics', element: <Statistics /> },
                    { path: 'purchases', element: <Purchases /> },
                    { path: 'purchases/:purchaseId', element: <PurchaseDetails /> },
                    { path: 'reports', element: <Reports /> },
                    { path: 'members', element: <BudgetMembers /> },
                    { path: 'edit', element: <BudgetEdit /> },
                    { path: 'settings', element: <BudgetSettings /> },
                    { path: 'account/settings', element: <AccountSettings /> },
                ],
            },
        ],
    },
]);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
      <AuthProvider>
          <AnimationProvider animated="static"> {/* Supports: Static | Fluid | System */}
              <ToastProvider>
                  <RouterProvider router={router}/>
              </ToastProvider>
          </AnimationProvider>
      </AuthProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
