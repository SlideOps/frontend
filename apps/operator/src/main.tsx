import { ThemeProvider } from '@slideops/design-system';
import '@slideops/design-system/styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { guidance } from './guidance';
import { GuidanceProvider } from '@slideops/tooltips';
import { NotificationsProvider } from './notifications/NotificationsProvider';
import './index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('The operator root element is missing.');
}

createRoot(container).render(
  <StrictMode>
    <ThemeProvider>
      <GuidanceProvider registry={guidance}>
        <BrowserRouter>
          <NotificationsProvider>
            <App />
          </NotificationsProvider>
        </BrowserRouter>
      </GuidanceProvider>
    </ThemeProvider>
  </StrictMode>,
);
