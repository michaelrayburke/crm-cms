import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
// Import your Supabase client
import { supabase } from '../lib/supabaseClient';

/**
 * JWT-based login for the admin UI.
 * Calls POST /api/auth/login with { email, password }.
 * Stores token + user in localStorage and then signs into Supabase Auth.
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/api/auth/login', { email, password });
      if (!res || !res.token) {
        throw new Error('Invalid response from server');
      }
      // Store JWT and user as before
      localStorage.setItem('serviceup.jwt', res.token);
      if (res.user) {
        localStorage.setItem('serviceup.user', JSON.stringify(res.user));
      }
      // NEW: sign into Supabase Auth so file/image uploads work
      try {
        const { error: sbErr } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (sbErr) {
          console.warn('[Login] Supabase sign-in failed', sbErr.message);
        }
      } catch (sbErr) {
        console.warn('[Login] Supabase sign-in exception', sbErr);
      }
      // Redirect to admin dashboard
      navigate('/admin', { replace: true });
    } catch (err) {
      console.error('Login failed', err);
      setError('Invalid email or password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--su-bg, #0f172a)',
      }}
    >
      <div
        className="su-card"
        style={{
          width: '100%',
          maxWidth: 420,
          boxShadow: '0 18px 45px rgba(15,23,42,0.45)',
        }}
      >
        <h1 style={{ marginTop: 0, marginBottom: 8 }}>ServiceUp Login</h1>
        <p style={{ marginTop: 0, opacity: 0.8, fontSize: 14 }}>
          Sign in to manage your content, widgets, headers, and more.
        </p>

        {error && (
          <div className="su-alert su-error" style={{ marginBottom: 12, fontSize: 14 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', marginBottom: 10 }}>
            <span style={{ display: 'block', marginBottom: 4 }}>Email</span>
            <input
              type="email"
              className="su-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>

          <label style={{ display: 'block', marginBottom: 12 }}>
            <span style={{ display: 'block', marginBottom: 4 }}>Password</span>
            <input
              type="password"
              className="su-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>

          <button
            className="su-btn primary"
            type="submit"
            disabled={loading}
            style={{ width: '100%', marginTop: 4 }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
