// site/src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import {
  BrowserRouter,
  Routes,
  Route,
  useParams,
} from 'react-router-dom';
import Page from './Page';
import './styles.css';

function RoutedPage() {
  const params = useParams();
  // "/" → no slug → home
  // "/about" → slug="about"
  return <Page slug={params.slug || 'home'} />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RoutedPage />} />
        <Route path="/:slug" element={<RoutedPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
