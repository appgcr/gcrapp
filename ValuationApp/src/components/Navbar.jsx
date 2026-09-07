import React from 'react';
import { ShieldCheck, UserCheck, Landmark, Moon, Sun, LogOut, Crown, Building2 } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, theme, toggleTheme, currentUser, onLogout, liveLocation }) {
  return (
    <nav className="navbar">
      <div className="nav-container">
        <div className="nav-header-row">
          <div className="nav-brand">
            <div className="brand-text">
              <h1>GCR Valuations</h1>
              <p className="desktop-only">Panel Valuer Technical Valuation & Auto-Extraction System</p>
            </div>
          </div>

          <div className="nav-actions">
            {currentUser ? (
              <div className="user-profile-box">
                <div className="valuer-badge sleek-pill">
                  <span className="user-role-icon">
                    {currentUser.role === 'SUPER_ADMIN' ? '👑' : '👷'}
                  </span>
                  <div className="user-names desktop-only">
                    <strong>{currentUser.name}</strong>
                    <small>{currentUser.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Panel Engineer'}</small>
                  </div>
                </div>

                <button className="logout-icon-btn" onClick={onLogout} title="Sign Out">
                  <LogOut size={18} />
                  <span className="desktop-only">Logout</span>
                </button>
              </div>
            ) : (
              <div className="valuer-badge sleek-pill">
                <UserCheck size={16} />
                <span className="desktop-only">Not Logged In</span>
              </div>
            )}

            <button className="theme-toggle-btn" onClick={toggleTheme} title="Toggle Dark/Light Mode">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>

        <div className="nav-tabs scrollable-tabs">
      </div>
    </nav>
  );
}
