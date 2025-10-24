import React from 'react';
import ReactDOM from 'react-dom/client';
import {
    createBrowserRouter,
    RouterProvider,
} from 'react-router-dom';
import reportWebVitals from './reportWebVitals';
import { AuthProvider } from './components/AuthContext';
import { ToastProvider } from './components/utils/ToastContext';

import App from './App';
import Home from './pages/Home';
import Register from './pages/Register';
import SignIn from './pages/SignIn';
import Addpurchase from "./pages/Addpurchase";
import Purchases from "./pages/Purchases";
import VerifyEmailPage from './pages/VerifyEmailPage';
import RequireOnboarding, { RequireApp } from './components/RequireOnboarding';
import OnboardingPage from './pages/OnboardingPage';
import BudgetsIndex from './pages/BudgetsIndex';
import BudgetLayout from './pages/BudgetLayout';
import BudgetHome from './pages/BudgetHome';
import BudgetEdit from './pages/BudgetEdit';

const router = createBrowserRouter([
    {
        element: <App />,
        children: [
            { path: '/', element: <Home /> },
            { path: '/register', element: <Register /> },
            { path: '/signin', element: <SignIn /> },
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
                    { path: 'purchases', element: <Purchases /> },
                    { path: 'edit', element: <BudgetEdit /> },
                ],
            },
        ],
    },
]);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
      <AuthProvider>
          <ToastProvider>
              <RouterProvider router={router}/>
          </ToastProvider>
      </AuthProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
