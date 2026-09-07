import React, { useState, useEffect } from 'react';
import { Map, Users, MapPin, Clock, Plus, Car, Loader2, X, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix leaflet default icon issue in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Helper to create custom div icon with initials
const createInitialsIcon = (initials, color) => {
  return L.divIcon({
    className: 'custom-leaflet-icon',
    html: `<div style="width: 32px; height: 32px; border-radius: 50%; background: ${color}; color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2); font-size: 12px;">${initials}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

function MapUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && center.length === 2) {
      map.setView(center, 15, { animate: true });
    }
  }, [center, map]);
  return null;
}

export default function AdminStaff() {
  const [engineers, setEngineers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mapCenter, setMapCenter] = useState([14.4673, 78.8242]); // Kadapa Default

  // Add Staff Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newStaff, setNewStaff] = useState({ name: '', username: '', password: '', phone: '' });
  const [showPassword, setShowPassword] = useState(false);
  
  // Profile Details Modal State
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [showProfilePassword, setShowProfilePassword] = useState(false);

  const fetchStaffData = async () => {
      try {
        const [usersRes, attRes] = await Promise.all([
          fetch('https://gcr-9ys1.onrender.com/api/users'),
          fetch('https://gcr-9ys1.onrender.com/api/attendance')
        ]);
        const users = await usersRes.json();
        const attendances = await attRes.json();

        // Filter only engineers
        const staff = users.filter(u => u.role === 'ENGINEER');

        // Get today's start
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const enrichedStaff = staff.map(user => {
          // Get today's logs for this user, sorted newest first
          const userLogs = attendances
            .filter(a => a.userId === user.id && new Date(a.timestamp) >= today)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

          let status = 'Off Duty';
          let statusColor = '#94a3b8';
          let lastLog = null;

          if (userLogs.length > 0) {
            lastLog = userLogs[0];
            if (lastLog.attendanceType === 'Clock-In') {
              status = 'On Site';
              statusColor = '#16a34a'; // Green
            } else {
              status = 'Off Duty';
            }
          }

          // Generate initials
          const names = (user.name || user.username).split(' ');
          let initials = names[0].charAt(0).toUpperCase();
          if (names.length > 1) {
            initials += names[1].charAt(0).toUpperCase();
          }

          return {
            ...user,
            displayName: user.name || user.username,
            initials,
            status,
            statusColor,
            lastLog
          };
        });

        setEngineers(enrichedStaff);

        // Calculate map center based on first "On Site" engineer
        const activeEng = enrichedStaff.find(e => e.status === 'On Site' && e.lastLog && e.lastLog.lat && e.lastLog.lng);
        if (activeEng) {
          setMapCenter([parseFloat(activeEng.lastLog.lat), parseFloat(activeEng.lastLog.lng)]);
        }

        setLoading(false);
      } catch (err) {
        console.error("Staff fetch error", err);
        setLoading(false);
      }
    };

  useEffect(() => {
    fetchStaffData();
    const intervalId = setInterval(() => {
      fetchStaffData();
    }, 10000);
    return () => clearInterval(intervalId);
  }, []);

  const handleAddStaff = async (e) => {
    e.preventDefault();
    if (!newStaff.name || !newStaff.username || !newStaff.password) {
      toast.error("Please fill all fields");
      return;
    }
    
    setIsSubmitting(true);
    try {
      const res = await fetch('https://gcr-9ys1.onrender.com/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newStaff.name,
          username: newStaff.username,
          password: newStaff.password,
          phone: newStaff.phone || undefined, // Allow backend to handle empty
          role: 'ENGINEER'
        })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create user');
      }
      
      toast.success("Staff member added successfully!");
      setIsModalOpen(false);
      setNewStaff({ name: '', username: '', password: '', phone: '' });
      
      // Refresh list
      fetchStaffData();
      
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-fade-in" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div className="skeleton skeleton-text" style={{ width: '120px', height: '24px' }}></div>
          <div className="skeleton" style={{ width: '100px', height: '36px', borderRadius: '8px' }}></div>
        </div>
        
        <div className="skeleton-card" style={{ height: '300px', padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
            <div className="skeleton skeleton-text" style={{ width: '100px', height: '20px', margin: 0 }}></div>
            <div className="skeleton skeleton-text" style={{ width: '60px', height: '20px', margin: 0 }}></div>
          </div>
          <div className="skeleton" style={{ flex: 1, borderRadius: 0 }}></div>
        </div>
        
        <div className="skeleton-card" style={{ padding: 0 }}>
          <div style={{ padding: '16px', borderBottom: '1px solid #f1f5f9' }}>
            <div className="skeleton skeleton-text" style={{ width: '120px', height: '20px', margin: 0 }}></div>
          </div>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ padding: '16px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '16px' }}>
              <div className="skeleton skeleton-avatar"></div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div className="skeleton skeleton-text" style={{ width: '40%' }}></div>
                  <div className="skeleton skeleton-text" style={{ width: '20%' }}></div>
                </div>
                <div className="skeleton skeleton-text" style={{ width: '60%' }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const activeStaffCount = engineers.filter(e => e.status === 'On Site').length;

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '700', margin: '0 0 4px' }}>Staff Tracking</h2>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>Real-time field personnel locator.</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#0346c8', color: 'white', padding: '10px 16px', borderRadius: '6px', border: 'none', fontWeight: '600', fontSize: '12px', cursor: 'pointer' }}>
          <Plus size={16} /> ADD NEW STAFF
        </button>
      </div>

      <div className="admin-card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', fontSize: '14px' }}>
            <Map size={18} color="#0346c8" /> Live Field Map
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b' }}>
              {activeStaffCount} active in field
            </span>
          </div>
        </div>
        
        <div className="staff-map-container" style={{ margin: 0, height: '250px', borderRadius: 0, backgroundImage: 'none' }}>
          <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {engineers.filter(e => e.lastLog && e.lastLog.lat && e.lastLog.lng).map((eng, idx) => (
              <Marker 
                key={idx} 
                position={[parseFloat(eng.lastLog.lat), parseFloat(eng.lastLog.lng)]}
                icon={createInitialsIcon(eng.initials, eng.statusColor)}
              >
                <Popup>
                  <strong>{eng.displayName}</strong><br/>
                  {eng.status === 'On Site' ? 'On Site since' : 'Last seen at'} {new Date(eng.lastLog.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </Popup>
              </Marker>
            ))}
            <MapUpdater center={mapCenter} />
          </MapContainer>
        </div>
      </div>

      <div className="admin-card" style={{ padding: '0' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700' }}>
          <Users size={18} color="#475569" /> Active Roster
        </div>
        
        {engineers.map((eng, idx) => (
          <div key={idx} onClick={() => { 
            setSelectedStaff(eng); 
            setShowProfilePassword(false); 
            if (eng.lastLog && eng.lastLog.lat && eng.lastLog.lng) {
              setMapCenter([parseFloat(eng.lastLog.lat), parseFloat(eng.lastLog.lng)]);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }} style={{ padding: '16px', borderBottom: '1px solid #f1f5f9', borderLeft: `3px solid ${eng.statusColor}`, display: 'flex', gap: '16px', background: eng.status === 'On Site' ? '#f8fafc' : '#fff', cursor: 'pointer', transition: 'background 0.2s' }} className="roster-row">
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#e2e8f0', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', flexShrink: 0 }}>{eng.initials}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div style={{ fontWeight: '700', fontSize: '15px' }}>{eng.displayName}</div>
                <div style={{ fontSize: '11px', color: eng.statusColor, fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: eng.statusColor }}></div> {eng.status}
                </div>
              </div>
              <div style={{ fontSize: '12px', color: '#475569', marginBottom: '8px' }}>{eng.id} • @{eng.username}</div>
              {eng.status === 'On Site' && eng.lastLog ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: '#0f172a', fontWeight: '500' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={14} /> Lat: {parseFloat(eng.lastLog.lat).toFixed(4)}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#64748b' }}>Arr: {new Date(eng.lastLog.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                </div>
              ) : (
                <div style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <MapPin size={12} /> Location tracking paused (Staff is Off Duty)
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Staff Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(2px)' }}>
          <div className="animate-fade-in" style={{ background: 'white', borderRadius: '12px', width: '100%', maxWidth: '400px', overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>Add New Staff</h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleAddStaff} style={{ padding: '20px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Full Name</label>
                <input 
                  type="text" 
                  value={newStaff.name}
                  onChange={(e) => setNewStaff({...newStaff, name: e.target.value})}
                  placeholder="e.g. John Doe"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                />
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Username / Login ID</label>
                <input 
                  type="text" 
                  value={newStaff.username}
                  onChange={(e) => setNewStaff({...newStaff, username: e.target.value})}
                  placeholder="e.g. john.doe"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Mobile Number</label>
                <input 
                  type="tel" 
                  maxLength="10"
                  pattern="[0-9]{10}"
                  title="Please enter exactly 10 digits"
                  value={newStaff.phone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, ''); // strip non-digits
                    setNewStaff({...newStaff, phone: val});
                  }}
                  placeholder="e.g. 9876543210"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Initial Password</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    value={newStaff.password}
                    onChange={(e) => setNewStaff({...newStaff, password: e.target.value})}
                    placeholder="Create a password"
                    style={{ width: '100%', padding: '10px 40px 10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ flex: 1, padding: '12px', background: 'transparent', border: '1px solid #cbd5e1', color: '#475569', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} style={{ flex: 1, padding: '12px', background: '#0346c8', border: 'none', color: 'white', borderRadius: '6px', fontWeight: '600', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  {isSubmitting ? <Loader2 size={18} className="spin" /> : 'Create Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Staff Profile Details Modal */}
      {selectedStaff && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(2px)' }}>
          <div className="animate-fade-in" style={{ background: 'white', borderRadius: '12px', width: '100%', maxWidth: '400px', overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#e2e8f0', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700' }}>
                  {selectedStaff.initials}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700' }}>{selectedStaff.displayName}</h3>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>{selectedStaff.id}</div>
                </div>
              </div>
              <button onClick={() => setSelectedStaff(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
            </div>
            
            <div style={{ padding: '20px' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Login Credentials</h4>
              
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>LOGIN ID (USERNAME)</div>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#0f172a' }}>{selectedStaff.username}</div>
                </div>
                
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>PASSWORD</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#0f172a', letterSpacing: showProfilePassword ? '0' : '2px' }}>
                      {showProfilePassword ? selectedStaff.password : '••••••••'}
                    </div>
                    <button 
                      onClick={() => setShowProfilePassword(!showProfilePassword)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0346c8', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: '600' }}
                    >
                      {showProfilePassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      {showProfilePassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
              </div>
              
              <button onClick={() => setSelectedStaff(null)} style={{ width: '100%', padding: '12px', background: '#f1f5f9', border: 'none', color: '#475569', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
