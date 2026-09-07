import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X } from 'lucide-react';
import ChatSystem from './ChatSystem';

export default function GlobalChatWidget({ setActiveTab, currentUser }) {
  const [position, setPosition] = useState({ x: window.innerWidth - 80, y: window.innerHeight - 180 });
  const [isDragging, setIsDragging] = useState(false);
  const [showMini, setShowMini] = useState(false);
  const widgetRef = useRef(null);
  
  // Interaction states
  const dragStartPos = useRef({ x: 0, y: 0 });
  const startMousePos = useRef({ x: 0, y: 0 });
  const holdTimer = useRef(null);
  const isHeld = useRef(false);
  
  // Handle window resize to keep widget in bounds
  useEffect(() => {
    const handleResize = () => {
      setPosition(prev => ({
        x: Math.min(prev.x, window.innerWidth - 60),
        y: Math.min(prev.y, window.innerHeight - 60)
      }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePointerDown = (e) => {
    // Only handle left click / single touch
    if (e.button && e.button !== 0) return;
    
    e.target.setPointerCapture(e.pointerId);
    
    dragStartPos.current = { ...position };
    startMousePos.current = { x: e.clientX, y: e.clientY };
    isHeld.current = false;
    setIsDragging(false);

    // Start hold timer
    holdTimer.current = setTimeout(() => {
      if (!isDragging) {
        isHeld.current = true;
        // Trigger haptic feedback if available (using vibrate API on web/android)
        if (navigator.vibrate) navigator.vibrate(50);
        setShowMini(true);
      }
    }, 500); // 500ms for long press
  };

  const handlePointerMove = (e) => {
    // Calculate distance moved
    const dx = e.clientX - startMousePos.current.x;
    const dy = e.clientY - startMousePos.current.y;
    
    // If moved more than 5px, it's a drag
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      if (holdTimer.current) {
        clearTimeout(holdTimer.current);
        holdTimer.current = null;
      }
      setIsDragging(true);
      
      let newX = dragStartPos.current.x + dx;
      let newY = dragStartPos.current.y + dy;
      
      // Clamp to screen edges
      newX = Math.max(10, Math.min(newX, window.innerWidth - 70));
      newY = Math.max(10, Math.min(newY, window.innerHeight - 70));
      
      setPosition({ x: newX, y: newY });
    }
  };

  const handlePointerUp = (e) => {
    e.target.releasePointerCapture(e.pointerId);
    
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }

    if (!isDragging && !isHeld.current && !showMini) {
      // It was a short click
      setActiveTab('chat');
    }
    
    // Reset dragging state after a tiny delay to prevent click firing if we were dragging
    setTimeout(() => setIsDragging(false), 50);
  };

  return (
    <>
      {/* Mini Chat Popover overlay */}
      {showMini && (
        <div style={{
          position: 'fixed',
          bottom: '90px',
          right: '20px',
          width: 'calc(100% - 40px)',
          maxWidth: '380px',
          height: '60vh',
          maxHeight: '600px',
          backgroundColor: '#fff',
          borderRadius: '16px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          {/* Header */}
          <div style={{ padding: '12px 16px', backgroundColor: '#075E54', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: '600', fontSize: '16px' }}>Messages</span>
            <button onClick={() => setShowMini(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>
          
          {/* Chat List using ChatSystem component in mini mode */}
          <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
            <ChatSystem currentUser={currentUser} isMini={true} onBack={() => setShowMini(false)} />
          </div>
        </div>
      )}

      {/* Floating Dragable Button */}
      <div 
        ref={widgetRef}
        onPointerDown={handlePointerDown}
        onPointerMove={isDragging || startMousePos.current.x ? handlePointerMove : undefined}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          position: 'fixed',
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: '60px',
          height: '60px',
          backgroundColor: '#25D366',
          borderRadius: '30px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
          cursor: isDragging ? 'grabbing' : 'pointer',
          zIndex: 10000,
          touchAction: 'none', // Prevent scrolling while dragging
          transition: isDragging ? 'none' : 'transform 0.1s ease',
          transform: isHeld.current ? 'scale(0.9)' : 'scale(1)',
        }}
      >
        <MessageCircle size={28} color="white" fill="white" />
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  );
}
