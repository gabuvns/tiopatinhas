import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import './dark.css';
import './controls.css';
import './history.css';
import './ux.css';
import './currency-portfolio.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
