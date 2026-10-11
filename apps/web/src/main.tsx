import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router';
import { AppErrorBoundary } from './app/AppErrorBoundary';
import { FormationApp } from './app/FormationApp';
import { DesignBoard } from './app/DesignBoard';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary onReset={() => window.location.assign('/')}>
      <BrowserRouter useTransitions={false}>
        <Routes>
          {import.meta.env.DEV && <Route path="/board" element={<DesignBoard />} />}
          <Route path="*" element={<FormationApp />} />
        </Routes>
      </BrowserRouter>
    </AppErrorBoundary>
  </StrictMode>,
);
