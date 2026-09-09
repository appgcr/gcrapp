import { API_BASE_URL } from '../../config/api';
import React, { useState, useEffect } from 'react';
import { X, MapPin } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix leaflet marker icon issue in React
const customMarker = L.divIcon({
  html: `<div style="background-color: #ef4444; width: 24px; height: 24px; border-radius: 12px; border: 3px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.3); display: flex; justify-content: center; align-items: center;"><div style="background-color: white; width: 8px; height: 8px; border-radius: 4px;"></div></div>`,
  className: '',
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

export default function LiveTrackingMap({ caseId, onClose }) {
  const [location, setLocation] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    const fetchLocation = async () => {
      try {
        const res = await fetch(`https://gcr-9ys1.onrender.com/api/cases/${caseId}`);
        const data = await res.json();
        if (data.currentLocation && data.currentLocation.lat && data.currentLocation.lng) {
          setLocation({ lat: data.currentLocation.lat, lng: data.currentLocation.lng });
          setLastUpdated(data.currentLocation.lastUpdated);
        }
      } catch (err) {
        console.error("Failed to fetch location", err);
      }
    };

    fetchLocation();
    const interval = setInterval(fetchLocation, 3000);
    return () => clearInterval(interval);
  }, [caseId]);

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 9999
    }}>
      <div style={{
        background: 'white',
        width: '90%',
        maxWidth: '800px',
        height: '80vh',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#f8fafc'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>Live Engineer Tracking</h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
              Case #{caseId} • {lastUpdated ? `Last updated: ${new Date(lastUpdated).toLocaleTimeString()}` : 'Connecting to GPS...'}
            </p>
          </div>
          <button 
            onClick={onClose}
            style={{
              background: '#e2e8f0',
              border: 'none',
              width: '32px',
              height: '32px',
              borderRadius: '16px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              cursor: 'pointer',
              color: '#475569'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Map */}
        <div style={{ flex: 1, position: 'relative' }}>
          {location ? (
            <MapContainer 
              center={[location.lat, location.lng]} 
              zoom={16} 
              style={{ width: '100%', height: '100%' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap contributors'
              />
              <Marker position={[location.lat, location.lng]} icon={customMarker}>
                <Popup>Engineer is here.</Popup>
              </Marker>
            </MapContainer>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center', alignItems: 'center', color: '#94a3b8' }}>
              <MapPin size={48} style={{ opacity: 0.5, marginBottom: '16px' }} />
              <p>Waiting for GPS signal...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
