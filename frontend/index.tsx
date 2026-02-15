
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './src/App';
import { BrowserRouter as Router } from 'react-router-dom';
import { Toaster } from 'sonner';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <Toaster richColors position="top-center" />
    <Router>
      <App />
    </Router>
  </React.StrictMode>
);
