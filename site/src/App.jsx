import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.jsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}


import React, { useEffect, useState } from 'react';
import Page from './Page';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';
const GADGET_SLUG = 'serviceup-site'; // whatever you used for your ServiceUp gadget

export default function App() {
  const [page, setPage] = useState(null);

  useEffect(() => {
    async function loadPage() {
      // This depends on your existing public page API.
      // Example: GET /api/public/pages/home
      const res = await fetch(`${API_BASE}/api/public/pages/home`);
      if (!res.ok) throw new Error('Failed to load page');
      const json = await res.json();
      setPage(json.page || json); // adjust to your shape
    }
    loadPage().catch((err) => console.error(err));
  }, []);

  if (!page) return <div>Loading…</div>;

  return <Page page={page} gadgetSlug={GADGET_SLUG} />;
}


export default App


