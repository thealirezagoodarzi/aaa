import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
// AUDIT FIX (#98): import style unified — App.tsx exports BOTH a named
// `App` and an explicit `export default App`; main.tsx now uses the default
// import consistently (no aliasing, no reliance on which form exists).
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
