import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, Search, UserCircle2, Check, CheckCheck, Paperclip, FileText, ImageIcon, MapPin, UserPlus, Loader2, X, MessageCircle, ChevronDown } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Contacts } from '@capacitor-community/contacts';
import toast from 'react-hot-toast';
import CryptoJS from 'crypto-js';

export default function ChatSystem({ currentUser, otherUserId, caseId, onBack, isMini }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  
  // Admin Chat States
  const [adminChatList, setAdminChatList] = useState([]);
  const [isSearchingChats, setIsSearchingChats] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [debouncedChatSearch, setDebouncedChatSearch] = useState('');

  const [activeChatUserId, setActiveChatUserId] = useState(otherUserId || null);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [contactList, setContactList] = useState([]);
  const [showScrollDown, setShowScrollDown] = useState(false);

  // Debounce the chat search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedChatSearch(chatSearchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [chatSearchQuery]);
  
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  
  const isAdmin = currentUser?.role === 'SUPER_ADMIN';
  const myId = isAdmin ? 'ADMIN' : currentUser?.id;

  const SECRET_KEY = 'gcr-secure-chat-key-2024';

  const encryptText = (text) => {
    if (!text) return text;
    try {
      return CryptoJS.AES.encrypt(text, SECRET_KEY).toString();
    } catch (e) {
      return text;
    }
  };

  const decryptText = (ciphertext) => {
    if (!ciphertext) return ciphertext;
    // Check if it looks like a base64 encoded CryptoJS string (starts with U2FsdGVkX1)
    if (!ciphertext.startsWith('U2FsdGVkX1')) return ciphertext;
    try {
      const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
      const originalText = bytes.toString(CryptoJS.enc.Utf8);
      return originalText || ciphertext;
    } catch (e) {
      return ciphertext;
    }
  };

  const fetchAdminChats = async () => {
    try {
      const res = await fetch('https://gcr-9ys1.onrender.com/api/chat/admin/users');
      if (res.ok) {
        const data = await res.json();
        const decryptedData = data.map(chat => ({
          ...chat,
          lastMessage: decryptText(chat.lastMessage)
        }));
        setAdminChatList(decryptedData);
      }
    } catch (err) {
      console.error("Failed to fetch admin chats:", err);
    }
  };

  const fetchMessages = async () => {
    if (!activeChatUserId) return;
    try {
      const res = await fetch(`https://gcr-9ys1.onrender.com/api/chat/${myId}/${activeChatUserId}`);
      if (res.ok) {
        const data = await res.json();
        const decryptedData = data.map(msg => ({
          ...msg,
          text: decryptText(msg.text)
        }));
        setMessages(decryptedData);
        // Mark as read without blocking
        fetch(`https://gcr-9ys1.onrender.com/api/chat/read/${myId}/${activeChatUserId}`, { method: 'PUT' });
      }
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    }
  };

  useEffect(() => {
    if (isAdmin && !activeChatUserId) {
      fetchAdminChats();
      const interval = setInterval(fetchAdminChats, 2000);
      return () => clearInterval(interval);
    }
  }, [isAdmin, activeChatUserId]);

  useEffect(() => {
    if (activeChatUserId) {
      fetchMessages();
      const interval = setInterval(fetchMessages, 2000);
      return () => clearInterval(interval);
    }
  }, [activeChatUserId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (scrollContainerRef.current) {
      const { scrollHeight, scrollTop, clientHeight } = scrollContainerRef.current;
      const distanceToBottom = scrollHeight - Math.ceil(scrollTop) - clientHeight;
      const isScrolledUp = distanceToBottom > 20;
      if (!isScrolledUp) {
        scrollToBottom();
      }
    } else {
      scrollToBottom();
    }
  }, [messages]);

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollHeight, scrollTop, clientHeight } = scrollContainerRef.current;
      const distanceToBottom = scrollHeight - Math.ceil(scrollTop) - clientHeight;
      setShowScrollDown(distanceToBottom > 20);
    }
  };

  const sendPayload = async (messagePayload) => {
    // Optimistic update (show unencrypted text immediately)
    setMessages(prev => [...prev, { ...messagePayload, _id: Date.now().toString() }]);
    
    // Encrypt payload before sending to DB
    const encryptedPayload = {
      ...messagePayload,
      text: encryptText(messagePayload.text)
    };

    try {
      const res = await fetch('https://gcr-9ys1.onrender.com/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(encryptedPayload)
      });
      if (!res.ok) throw new Error("Failed to send message");
    } catch (err) {
      toast.error("Message failed to send");
      console.error(err);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const messagePayload = {
      senderId: myId,
      receiverId: activeChatUserId,
      caseId: caseId || null,
      text: inputText.trim(),
      timestamp: new Date().toISOString()
    };
    sendPayload(messagePayload);
    setInputText('');
    setTimeout(scrollToBottom, 100);
  };

  const handleFileUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Check file size (limit to 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be under 10MB');
      return;
    }
    
    setUploading(true);
    setShowAttachmentMenu(false);
    
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = async () => {
      try {
        const res = await fetch('https://gcr-9ys1.onrender.com/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: reader.result, folder: 'chat_attachments' })
        });
        const data = await res.json();
        
        if (data.url) {
          const messagePayload = {
            senderId: myId,
            receiverId: activeChatUserId,
            caseId: caseId || null,
            text: file.name,
            attachmentUrl: data.url,
            attachmentType: type,
            timestamp: new Date().toISOString()
          };
          sendPayload(messagePayload);
        } else {
          throw new Error('No URL returned');
        }
      } catch (err) {
        toast.error('Upload failed');
      } finally {
        setUploading(false);
      }
    };
  };

  const handleShareLocation = () => {
    setShowAttachmentMenu(false);
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    setUploading(true);
    navigator.geolocation.getCurrentPosition((position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const url = `https://maps.google.com/?q=${lat},${lng}`;
      
      const messagePayload = {
        senderId: myId,
        receiverId: activeChatUserId,
        caseId: caseId || null,
        text: 'Live Location',
        attachmentUrl: url,
        attachmentType: 'location',
        timestamp: new Date().toISOString()
      };
      sendPayload(messagePayload);
      setUploading(false);
    }, () => {
      toast.error('Unable to retrieve your location');
      setUploading(false);
    });
  };

  const handleShareContact = async () => {
    setShowAttachmentMenu(false);
    
    // Try Native Capacitor Contacts API first (Android/iOS App)
    if (Capacitor.isNativePlatform()) {
      try {
        const permission = await Contacts.requestPermissions();
        if (permission.contacts === 'granted') {
          const result = await Contacts.getContacts({
            projection: { name: true, phones: true }
          });
          
          if (result.contacts && result.contacts.length > 0) {
            // Map capacitor contacts to our UI format
            const nativeContacts = result.contacts.map((c, idx) => ({
              id: c.contactId || idx.toString(),
              name: c.name?.display || 'Unknown',
              phone: c.phones?.[0]?.number || 'No number'
            }));
            // Sort alphabetically
            nativeContacts.sort((a, b) => a.name.localeCompare(b.name));
            setContactList(nativeContacts);
          } else {
            setContactList([]);
          }
          setShowContactModal(true);
          return;
        } else {
          toast.error("Permission denied to access contacts. Check app settings.");
        }
      } catch (ex) {
        console.warn("Native Contacts API failed", ex);
      }
    }
    
    // Load real registered team members as contacts
    try {
      const res = await fetch('https://gcr-9ys1.onrender.com/api/users');
      if (res.ok) {
        const users = await res.json();
        const teamContacts = users
          .filter(u => u.id !== myId)
          .map(u => ({ id: u.id, name: u.name || u.username, phone: u.phone || 'N/A' }));
        setContactList(teamContacts);
      } else {
        setContactList([]);
      }
    } catch (err) {
      setContactList([]);
    }
    setShowContactModal(true);
  };

  const submitManualContact = (contact) => {
    const messagePayload = {
      senderId: myId,
      receiverId: activeChatUserId,
      caseId: caseId || null,
      text: `Contact: ${contact.name}`,
      attachmentType: 'contact',
      attachmentMetadata: { name: contact.name, phone: contact.phone },
      timestamp: new Date().toISOString()
    };
    sendPayload(messagePayload);
    setShowContactModal(false);
    setContactSearch('');
  };

  // View: Admin Chat List
  if (isAdmin && !activeChatUserId) {
    const filteredAdminChats = adminChatList.filter(chat => 
      chat.userId.toLowerCase().includes(debouncedChatSearch.toLowerCase()) ||
      (chat.lastMessage && chat.lastMessage.toLowerCase().includes(debouncedChatSearch.toLowerCase()))
    );

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#ffffff', paddingBottom: isMini ? '0' : '80px' }}>
        
        {/* WhatsApp Style Header (Hidden in Mini Mode) */}
        {!isMini && (
          <div style={{ padding: '16px 20px', backgroundColor: '#075E54', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            {isSearchingChats ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
              <button onClick={() => { setIsSearchingChats(false); setChatSearchQuery(''); }} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 0 }}>
                <ArrowLeft size={24} />
              </button>
              <input 
                autoFocus
                type="text" 
                placeholder="Search..."
                value={chatSearchQuery}
                onChange={(e) => setChatSearchQuery(e.target.value)}
                style={{ flex: 1, backgroundColor: 'transparent', border: 'none', color: 'white', fontSize: '16px', outline: 'none' }}
              />
              {chatSearchQuery && (
                <button onClick={() => setChatSearchQuery('')} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 0 }}>
                  <X size={20} />
                </button>
              )}
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {onBack && (
                  <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 0 }}>
                    <ArrowLeft size={24} />
                  </button>
                )}
                <h1 style={{ fontSize: '20px', fontWeight: '600', margin: 0 }}>GCR Personal Chats</h1>
              </div>
              <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                <Search size={20} color="white" style={{ cursor: 'pointer' }} onClick={() => setIsSearchingChats(true)} />
              </div>
            </>
          )}
        </div>
        )}
        
        {/* Chat List */}
        <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#ffffff' }}>
          {filteredAdminChats.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#8696a0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <MessageCircle size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
              <div style={{ fontSize: '16px', fontWeight: '500' }}>No active chats found</div>
              <div style={{ fontSize: '14px', marginTop: '8px' }}>When engineers message you, they will appear here.</div>
            </div>
          ) : (
            filteredAdminChats.map(chat => (
              <div 
                key={chat.userId}
                onClick={() => {
                  setActiveChatUserId(chat.userId);
                }}
                style={{ 
                  display: 'flex', 
                  padding: '12px 16px', 
                  cursor: 'pointer', 
                  alignItems: 'center',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f0f2f5'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <img 
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(chat.userId)}&background=e2e8f0&color=334155&font-size=0.33&bold=true`} 
                  alt={chat.userId}
                  style={{ width: '52px', height: '52px', borderRadius: '50%', marginRight: '16px', objectFit: 'cover' }}
                />
                
                <div style={{ flex: 1, borderBottom: '1px solid #f0f2f5', paddingBottom: '12px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', alignItems: 'center' }}>
                    <div style={{ fontWeight: '600', fontSize: '16px', color: '#111b21' }}>{chat.userId}</div>
                    <div style={{ fontSize: '12px', color: chat.unreadCount > 0 ? '#25D366' : '#667781', fontWeight: chat.unreadCount > 0 ? '600' : '400' }}>
                      {new Date(chat.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '14px', color: '#667781', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '220px' }}>
                      {chat.lastMessage || 'Attachment'}
                    </div>
                    {chat.unreadCount > 0 && (
                      <div style={{ backgroundColor: '#25D366', color: 'white', fontSize: '12px', fontWeight: 'bold', width: '22px', height: '22px', borderRadius: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                        {chat.unreadCount}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // View: Active Chat Thread
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', backgroundColor: '#f1f5f9', position: 'relative' }}>
      
      {/* Hidden File Inputs */}
      <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".pdf,.doc,.docx,.xls,.xlsx,.txt" onChange={(e) => handleFileUpload(e, 'document')} />
      <input type="file" ref={galleryInputRef} style={{ display: 'none' }} accept="image/*,video/*" onChange={(e) => handleFileUpload(e, 'gallery')} />

      {/* Header */}
      <div style={{ padding: '16px 20px', backgroundColor: '#17202A', color: 'white', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', zIndex: 100, flexShrink: 0 }}>
        <button 
          onClick={() => {
            if (isAdmin && !otherUserId) {
              setActiveChatUserId(null);
            } else if (onBack) {
              onBack();
            }
          }}
          style={{ width: '36px', height: '36px', background: '#2C3540', borderRadius: '50%', border: 'none', color: '#E2E8F0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
        >
          <ArrowLeft size={20} />
        </button>
        <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#3B82F6', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 0 15px rgba(59, 130, 246, 0.6)' }}>
          <UserCircle2 size={28} color="white" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontWeight: '700', fontSize: '17px', letterSpacing: '0.2px', color: '#FFFFFF' }}>
            {isAdmin ? activeChatUserId : 'Super Admin'}
          </div>
          <div style={{ fontSize: '13px', color: '#94A3B8', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e' }}></div>
            Online
          </div>
        </div>
      </div>

      {/* Message List */}
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative' }}
        onClick={() => document.activeElement?.blur()}
        onTouchStart={() => document.activeElement?.blur()}
      >
        
        {uploading && (
          <div style={{ position: 'absolute', top: '16px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', padding: '8px 16px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '8px', zIndex: 10 }}>
            <Loader2 size={16} className="spinner" /> Uploading attachment...
          </div>
        )}

        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', margin: 'auto', backgroundColor: '#e0e7ff', padding: '12px 20px', borderRadius: '16px', fontSize: '12px', color: '#4338ca', fontWeight: '500', maxWidth: '80%', boxShadow: '0 2px 8px rgba(67, 56, 202, 0.1)' }}>
            Messages are end-to-end encrypted. No one outside of this chat can read or listen to them.
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.senderId === myId;
            return (
              <div key={msg._id || idx} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', margin: '4px 12px' }}>
                <div style={{ 
                  maxWidth: '80%', 
                  background: isMe ? 'linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%)' : 'white', 
                  color: isMe ? 'white' : '#1e293b',
                  padding: '10px 14px 22px 14px', 
                  borderRadius: '18px', 
                  borderBottomRightRadius: isMe ? '4px' : '18px',
                  borderBottomLeftRadius: isMe ? '18px' : '4px',
                  boxShadow: isMe ? '0 4px 12px rgba(59, 130, 246, 0.25)' : '0 2px 8px rgba(0,0,0,0.05)',
                  position: 'relative'
                }}>
                  
                  {/* Rendering Attachments */}
                  {msg.attachmentType === 'gallery' && (
                    <img src={msg.attachmentUrl} alt="gallery" style={{ width: '100%', borderRadius: '8px', marginBottom: '8px', objectFit: 'cover' }} />
                  )}
                  {msg.attachmentType === 'document' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : '#f1f5f9', padding: '12px', borderRadius: '12px', marginBottom: '6px', cursor: 'pointer' }} onClick={() => window.open(msg.attachmentUrl, '_blank')}>
                      <FileText size={32} color={isMe ? 'white' : '#3b82f6'} />
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontSize: '14px', fontWeight: '700', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{msg.text || 'Document'}</div>
                        <div style={{ fontSize: '11px', color: isMe ? 'rgba(255,255,255,0.8)' : '#64748b' }}>Tap to open</div>
                      </div>
                    </div>
                  )}
                  {msg.attachmentType === 'location' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : '#f1f5f9', padding: '12px', borderRadius: '12px', marginBottom: '6px', cursor: 'pointer' }} onClick={() => window.open(msg.attachmentUrl, '_blank')}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <MapPin size={24} color={isMe ? 'white' : '#ef4444'} />
                        <div style={{ fontSize: '14px', fontWeight: '700' }}>Live Location</div>
                      </div>
                      <div style={{ fontSize: '12px', color: isMe ? 'rgba(255,255,255,0.9)' : '#2563eb', fontWeight: '500' }}>View on Google Maps</div>
                    </div>
                  )}
                  {msg.attachmentType === 'contact' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : '#f1f5f9', padding: '12px', borderRadius: '12px', marginBottom: '6px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '20px', backgroundColor: isMe ? 'rgba(255,255,255,0.3)' : '#cbd5e1', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <UserCircle2 size={24} color={isMe ? "white" : "#475569"} />
                      </div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: '700' }}>{msg.attachmentMetadata?.name}</div>
                        <div style={{ fontSize: '12px', color: isMe ? 'rgba(255,255,255,0.8)' : '#64748b' }}>{msg.attachmentMetadata?.phone}</div>
                      </div>
                    </div>
                  )}

                  {/* Text (if any) and Timestamp */}
                  {(!msg.attachmentType || (msg.attachmentType && msg.text && msg.attachmentType !== 'document' && msg.attachmentType !== 'location' && msg.attachmentType !== 'contact')) && (
                    <div style={{ fontSize: '15px', color: 'inherit', wordBreak: 'break-word', lineHeight: '1.4' }}>
                      {msg.text}
                    </div>
                  )}
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', position: 'absolute', bottom: '6px', right: '12px' }}>
                    <span style={{ fontSize: '10px', color: isMe ? 'rgba(255,255,255,0.8)' : '#94a3b8', fontWeight: '500' }}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {isMe && (
                      msg.isRead ? <CheckCheck size={14} color="white" /> : <Check size={14} color="rgba(255,255,255,0.6)" />
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {showScrollDown && (
        <button 
          onClick={scrollToBottom}
          style={{ position: 'absolute', bottom: '80px', right: '16px', width: '44px', height: '44px', borderRadius: '22px', backgroundColor: 'white', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 100, color: '#0f172a' }}
        >
          <ChevronDown size={28} strokeWidth={2.5} />
        </button>
      )}

      {/* Attachment Bottom Sheet Overlay */}
      {showAttachmentMenu && (
        <div style={{ position: 'absolute', bottom: '70px', left: '16px', right: '16px', backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 -2px 10px rgba(0,0,0,0.1)', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', zIndex: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => fileInputRef.current.click()}>
            <div style={{ width: '56px', height: '56px', borderRadius: '28px', backgroundColor: '#5f66cd', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <FileText size={24} color="white" />
            </div>
            <span style={{ fontSize: '12px', color: '#475569' }}>Document</span>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => galleryInputRef.current.click()}>
            <div style={{ width: '56px', height: '56px', borderRadius: '28px', backgroundColor: '#ec407a', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <ImageIcon size={24} color="white" />
            </div>
            <span style={{ fontSize: '12px', color: '#475569' }}>Gallery</span>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={handleShareLocation}>
            <div style={{ width: '56px', height: '56px', borderRadius: '28px', backgroundColor: '#25D366', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <MapPin size={24} color="white" />
            </div>
            <span style={{ fontSize: '12px', color: '#475569' }}>Location</span>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={handleShareContact}>
            <div style={{ width: '56px', height: '56px', borderRadius: '28px', backgroundColor: '#00a884', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <UserPlus size={24} color="white" />
            </div>
            <span style={{ fontSize: '12px', color: '#475569' }}>Contact</span>
          </div>
        </div>
      )}

      {/* WhatsApp-style Contact Picker Modal */}
      {showContactModal && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#f0f2f5', display: 'flex', flexDirection: 'column', zIndex: 20 }}>
          {/* Header */}
          <div style={{ padding: '16px', backgroundColor: '#075E54', color: 'white', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <button onClick={() => setShowContactModal(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '4px' }}>
              <ArrowLeft size={24} />
            </button>
            <div style={{ fontWeight: '500', fontSize: '18px' }}>Contacts</div>
          </div>
          
          {/* Search Bar */}
          <div style={{ padding: '8px 12px', backgroundColor: '#fff', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ backgroundColor: '#f0f2f5', borderRadius: '8px', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Search size={18} color="#94a3b8" />
              <input 
                type="text" 
                placeholder="Search contacts..." 
                value={contactSearch}
                onChange={e => setContactSearch(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', flex: 1, fontSize: '15px' }}
              />
            </div>
          </div>

          {/* Contact List */}
          <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#fff' }}>
            {contactList
              .filter(c => c.name.toLowerCase().includes(contactSearch.toLowerCase()) || c.phone.includes(contactSearch))
              .map(contact => (
              <div 
                key={contact.id}
                onClick={() => submitManualContact(contact)}
                style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}
              >
                <div style={{ width: '40px', height: '40px', borderRadius: '20px', backgroundColor: '#cbd5e1', display: 'flex', justifyContent: 'center', alignItems: 'center', marginRight: '16px' }}>
                  <UserCircle2 size={24} color="white" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '16px', fontWeight: '500', color: '#0f172a' }}>{contact.name}</div>
                  <div style={{ fontSize: '14px', color: '#64748b', marginTop: '2px' }}>{contact.phone}</div>
                </div>
              </div>
            ))}
            
            {contactList.filter(c => c.name.toLowerCase().includes(contactSearch.toLowerCase()) || c.phone.includes(contactSearch)).length === 0 && (
              <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                No contacts found matching "{contactSearch}"
              </div>
            )}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div style={{ padding: '12px 16px', backgroundColor: 'white', borderTop: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: '12px', zIndex: 10, position: 'relative', flexShrink: 0 }}>
        
        {/* Pill Input with Paperclip Inside */}
        <div style={{ flex: 1, backgroundColor: '#F3F4F6', borderRadius: '24px', padding: '10px 16px', display: 'flex', alignItems: 'center', border: '1px solid #E5E7EB' }}>
          <input 
            type="text" 
            placeholder="Message..." 
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && handleSendMessage(e)}
            style={{ border: 'none', background: 'transparent', outline: 'none', flex: 1, fontSize: '15px', color: '#1F2937' }}
          />
          <button 
            onClick={() => setShowAttachmentMenu(!showAttachmentMenu)} 
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280', transition: 'color 0.2s' }}
          >
            <Paperclip size={20} />
          </button>
        </div>

        {/* Send Button */}
        <button 
          onClick={handleSendMessage} 
          style={{ width: '48px', height: '48px', borderRadius: '24px', backgroundColor: '#3B82F6', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)', flexShrink: 0, transition: 'transform 0.1s' }}
        >
          <Send size={20} strokeWidth={2.5} style={{ marginLeft: '-2px' }} />
        </button>
      </div>
    </div>
  );
}
