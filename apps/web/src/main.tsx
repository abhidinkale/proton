import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MedplumProvider } from '@medplum/react';
import { medplum } from './lib/medplum';
import './index.css';
import App from './App';
import { bootPalette } from './design-system/theme/palettes';

// Before the first paint: the palette is a preference, not a loading state.
bootPalette();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <MedplumProvider medplum={medplum}>
        <App />
      </MedplumProvider>
    </BrowserRouter>
  </StrictMode>
);
