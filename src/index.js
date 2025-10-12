import React from 'react';
import ReactDOM from 'react-dom/client';
import {
    createBrowserRouter,
    RouterProvider,
} from 'react-router-dom';
import reportWebVitals from './reportWebVitals';
import { AuthProvider } from './components/AuthContext';
import { ToastProvider } from './components/ToastContext';

import App from './App';
import Home from './Home';
import Register from './Register';
import SignIn from './SignIn';
import Addpurchase from "./Addpurchase";
import Purchases from "./Purchases";
import Budget from "./Budget";
import VerifyEmailPage from './VerifyEmailPage';

const router = createBrowserRouter([
    {
        element: <App />,
        children: [
            { path: '/', element: <Home /> },
            { path: '/register', element: <Register /> },
            { path: '/signin', element: <SignIn /> },
            { path: '/new', element: <Addpurchase /> },
            { path: '/purchases', element: <Purchases /> },
            { path: '/budget', element: <Budget /> },
            { path: '/verify', element: <VerifyEmailPage /> },
        ]
    }
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
