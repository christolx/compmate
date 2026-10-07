import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router';
import { AppShell } from './app/AppShell';
import { Board } from './board/Board';
import { StoreContext, createPersistentStore } from './store/store';
import './index.css';

const store = createPersistentStore();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreContext.Provider value={store}>
      {/* Navigations must commit in the same render as sign-in changes, or a
          gated page sees the new auth state at the old URL and redirects. */}
      <BrowserRouter useTransitions={false}>
        <Routes>
          <Route path="/board" element={<Board />} />
          <Route path="*" element={<AppShell />} />
        </Routes>
      </BrowserRouter>
    </StoreContext.Provider>
  </StrictMode>,
);
