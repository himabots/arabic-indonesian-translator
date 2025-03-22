import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Global unhandled promise rejection handler
window.addEventListener('unhandledrejection', function(event) {
  console.error('UNHANDLED PROMISE REJECTION:', event.reason);
  // Prevent default browser behavior (which is showing an alert)
  event.preventDefault();
});

// Global error handler
window.addEventListener('error', function(event) {
  console.error('GLOBAL ERROR:', event.error);
  // Prevent default browser behavior
  event.preventDefault();
  return true; // Prevents the firing of the default event handler
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
