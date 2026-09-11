import { API_BASE_URL } from '../../config/api';
import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  ShieldCheck,
  LogIn,
  LogOut,
  X,
  Award,
  TrendingUp,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export default function AttendanceCalendarView({ currentUser }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [summaryData, setSummaryData] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedDayDetail, setSelectedDayDetail] = useState(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1; // 1-indexed

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const fetchCalendarSummary = async () => {
    setLoading(true);
    try {
      const userId = currentUser?.id || 'ENG-001';
      const res = await fetch(`${API_BASE_URL}/api/attendance/calendar-summary?userId=${userId}&year=${year}&month=${month}`);
      if (res.ok) {
        const data = await res.json();
        setSummaryData(data);
      }
    } catch (err) {
      console.error('Error fetching calendar summary:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendarSummary();
  }, [year, month, currentUser?.id]);

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 2, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Calendar Calculation
  const firstDayIndex = new Date(year, month - 1, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(year, month, 0).getDate();

  // Aggregate monthly statistics
  let totalPresentDays = 0;
  let totalHoursWorked = 0;
  let fullDaysCount = 0;
  let halfDaysCount = 0;

  Object.values(summaryData).forEach(day => {
    if (day.totalDurationHours > 0 || day.firstClockIn) {
      totalPresentDays++;
      totalHoursWorked += (day.totalDurationHours || 0);
      if (day.totalDurationHours >= 7) fullDaysCount++;
      else if (day.totalDurationHours >= 4) halfDaysCount++;
    }
  });

  const avgDailyHours = totalPresentDays > 0 ? (totalHoursWorked / totalPresentDays).toFixed(1) : 0;

  // Build calendar grid cells
  const calendarCells = [];
  // Empty padding for previous month days
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push({ type: 'empty', id: `empty-${i}` });
  }

  const todayStr = new Date().toISOString().split('T')[0];

  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayData = summaryData[dateKey];
    const cellDate = new Date(year, month - 1, d);
    const dayOfWeek = cellDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isPast = cellDate < new Date().setHours(0, 0, 0, 0);
    const isToday = dateKey === todayStr;

    let status = 'No Record';
    let color = '#94a3b8'; // Default grey
    let bgColor = '#f8fafc';
    let durationText = '';

    if (dayData && (dayData.totalDurationHours > 0 || dayData.firstClockIn)) {
      if (dayData.totalDurationHours >= 7) {
        status = 'Full Day';
        color = '#10b981';
        bgColor = '#ecfdf5';
      } else if (dayData.totalDurationHours >= 4) {
        status = 'Half Day';
        color = '#f59e0b';
        bgColor = '#fef3c7';
      } else if (dayData.firstClockIn && !dayData.lastClockOut) {
        status = 'In Progress';
        color = '#6366f1';
        bgColor = '#e0e7ff';
      } else {
        status = 'Short Shift';
        color = '#0284c7';
        bgColor = '#e0f2fe';
      }
      durationText = dayData.totalDurationHours > 0 ? `${dayData.totalDurationHours}h` : 'Active';
    } else if (isPast && !isWeekend) {
      status = 'Absent';
      color = '#ef4444';
      bgColor = '#fef2f2';
    } else if (isWeekend) {
      status = 'Weekend';
      color = '#94a3b8';
      bgColor = '#f1f5f9';
    }

    calendarCells.push({
      type: 'day',
      dayNumber: d,
      dateKey,
      isToday,
      isWeekend,
      dayData,
      status,
      color,
      bgColor,
      durationText
    });
  }

  return (
    <div className="attendance-calendar-view animate-fade-in" style={{ paddingBottom: '30px' }}>
      {/* Month Navigator Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#ffffff',
        padding: '16px 20px',
        borderRadius: '16px',
        border: '1px solid var(--border-color)',
        marginBottom: '16px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            backgroundColor: '#e0f2fe',
            color: '#0052cc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <CalendarIcon size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: '17px', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>
              {monthNames[month - 1]} {year}
            </h2>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>Attendance & Hours Tracker</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={goToToday}
            style={{
              padding: '6px 10px',
              fontSize: '12px',
              fontWeight: '600',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: '#ffffff',
              cursor: 'pointer',
              color: 'var(--primary)'
            }}
          >
            Today
          </button>
          <button
            onClick={prevMonth}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={nextMonth}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Monthly Statistics Overview Cards */}
      <div className="responsive-grid-4" style={{
        marginBottom: '16px'
      }}>
        <div style={{
          backgroundColor: '#ffffff',
          padding: '12px 10px',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          textAlign: 'center'
        }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', display: 'block' }}>PRESENT</span>
          <span style={{ fontSize: '18px', fontWeight: '800', color: '#10b981' }}>{totalPresentDays}</span>
          <span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>Days</span>
        </div>

        <div style={{
          backgroundColor: '#ffffff',
          padding: '12px 10px',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          textAlign: 'center'
        }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', display: 'block' }}>HOURS</span>
          <span style={{ fontSize: '18px', fontWeight: '800', color: '#0052cc' }}>{totalHoursWorked.toFixed(1)}</span>
          <span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>Hrs</span>
        </div>

        <div style={{
          backgroundColor: '#ffffff',
          padding: '12px 10px',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          textAlign: 'center'
        }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', display: 'block' }}>AVG / DAY</span>
          <span style={{ fontSize: '18px', fontWeight: '800', color: '#f59e0b' }}>{avgDailyHours}</span>
          <span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>Hrs</span>
        </div>

        <div style={{
          backgroundColor: '#ffffff',
          padding: '12px 10px',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          textAlign: 'center'
        }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', display: 'block' }}>FULL DAY</span>
          <span style={{ fontSize: '18px', fontWeight: '800', color: '#059669' }}>{fullDaysCount}</span>
          <span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>Days</span>
        </div>
      </div>

      {/* Calendar Grid */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        border: '1px solid var(--border-color)',
        padding: '14px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
      }}>
        {/* Day-of-week header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          textAlign: 'center',
          fontWeight: '700',
          fontSize: '11px',
          color: '#64748b',
          marginBottom: '10px'
        }}>
          <div>SUN</div>
          <div>MON</div>
          <div>TUE</div>
          <div>WED</div>
          <div>THU</div>
          <div>FRI</div>
          <div>SAT</div>
        </div>

        {/* Days grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '6px'
        }}>
          {calendarCells.map(cell => {
            if (cell.type === 'empty') {
              return <div key={cell.id} style={{ height: '54px' }} />;
            }

            return (
              <div
                key={cell.dateKey}
                onClick={() => cell.dayData && setSelectedDayDetail(cell.dayData)}
                style={{
                  height: '54px',
                  borderRadius: '10px',
                  backgroundColor: cell.bgColor,
                  border: cell.isToday ? '2px solid #0052cc' : '1px solid rgba(0,0,0,0.05)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 2px',
                  cursor: cell.dayData ? 'pointer' : 'default',
                  position: 'relative',
                  transition: 'transform 0.15s ease'
                }}
              >
                {/* Day number */}
                <span style={{
                  fontSize: '12px',
                  fontWeight: cell.isToday ? '800' : '600',
                  color: cell.isToday ? '#0052cc' : 'var(--text-primary)'
                }}>
                  {cell.dayNumber}
                </span>

                {/* Hours or Status indicator */}
                {cell.durationText ? (
                  <span style={{
                    fontSize: '10px',
                    fontWeight: '700',
                    color: cell.color,
                    backgroundColor: 'rgba(255,255,255,0.7)',
                    padding: '1px 4px',
                    borderRadius: '4px',
                    lineHeight: '1.2'
                  }}>
                    {cell.durationText}
                  </span>
                ) : (
                  <div style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: cell.color
                  }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          justifyContent: 'center',
          marginTop: '16px',
          paddingTop: '12px',
          borderTop: '1px solid var(--border-color)',
          fontSize: '11px',
          fontWeight: '600'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
            Full Day (≥7h)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#f59e0b' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
            Half Day (4-7h)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#6366f1' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#6366f1' }} />
            In Progress
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ef4444' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
            Absent
          </div>
        </div>
      </div>

      {/* Selected Day Details Drawer / Modal */}
      {selectedDayDetail && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(6px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '460px',
            maxHeight: '90vh',
            backgroundColor: '#ffffff',
            borderRadius: '20px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            {/* Header */}
            <div style={{
              padding: '16px 20px',
              backgroundColor: 'linear-gradient(135deg, #001233 0%, #002855 100%)',
              background: '#001233',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>
                  {new Date(selectedDayDetail.date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </h3>
                <span style={{
                  display: 'inline-block',
                  fontSize: '11px',
                  fontWeight: '700',
                  color: selectedDayDetail.status === 'Full Day' ? '#34d399' : '#f59e0b',
                  marginTop: '4px'
                }}>
                  ● {selectedDayDetail.status.toUpperCase()} — {selectedDayDetail.durationFormatted || `${selectedDayDetail.totalDurationHours} hrs`}
                </span>
              </div>
              <button
                onClick={() => setSelectedDayDetail(null)}
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  cursor: 'pointer'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Body */}
            <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Check-In and Check-Out Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {/* Clock-In Card */}
                <div style={{
                  padding: '12px',
                  backgroundColor: '#f0fdf4',
                  borderRadius: '12px',
                  border: '1px solid #bbf7d0'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#16a34a', fontWeight: '700', fontSize: '12px', marginBottom: '6px' }}>
                    <LogIn size={15} /> Check-In
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                    {selectedDayDetail.firstClockIn
                      ? (selectedDayDetail.firstClockIn.formattedTime || new Date(selectedDayDetail.firstClockIn.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }))
                      : 'N/A'}
                  </div>
                </div>

                {/* Clock-Out Card */}
                <div style={{
                  padding: '12px',
                  backgroundColor: '#fef2f2',
                  borderRadius: '12px',
                  border: '1px solid #fecaca'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#dc2626', fontWeight: '700', fontSize: '12px', marginBottom: '6px' }}>
                    <LogOut size={15} /> Check-Out
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                    {selectedDayDetail.lastClockOut
                      ? (selectedDayDetail.lastClockOut.formattedTime || new Date(selectedDayDetail.lastClockOut.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }))
                      : (selectedDayDetail.firstClockIn ? 'In Progress' : 'N/A')}
                  </div>
                </div>
              </div>

              {/* Total Day Duration Banner */}
              <div style={{
                padding: '12px 16px',
                borderRadius: '12px',
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1d4ed8' }}>
                  <Clock size={18} />
                  <span style={{ fontSize: '13px', fontWeight: '600' }}>Total Day Duration:</span>
                </div>
                <span style={{ fontSize: '14px', fontWeight: '800', color: '#1e40af' }}>
                  {selectedDayDetail.durationFormatted || `${selectedDayDetail.totalDurationHours} hrs`}
                </span>
              </div>

              {/* Logs Timeline */}
              <h4 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                Punches & Biometric Photos ({selectedDayDetail.logs?.length || 0})
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {selectedDayDetail.logs?.map((log, idx) => (
                  <div key={log.id || idx} style={{
                    display: 'flex',
                    gap: '12px',
                    padding: '10px',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#ffffff'
                  }}>
                    {/* Geotagged Selfie Thumbnail */}
                    {log.imageUrl ? (
                      <div style={{ width: '70px', height: '70px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, backgroundColor: '#000' }}>
                        <img src={log.imageUrl} alt="Punch Selfie" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ) : (
                      <div style={{ width: '70px', height: '70px', borderRadius: '8px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', flexShrink: 0 }}>
                        <Clock size={24} />
                      </div>
                    )}

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{
                          fontSize: '13px',
                          fontWeight: '700',
                          color: log.attendanceType === 'Clock-In' ? '#0052cc' : '#ef4444',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          {log.attendanceType === 'Clock-In' ? <LogIn size={13} /> : <LogOut size={13} />}
                          {log.attendanceType}
                        </span>
                        <span style={{ fontSize: '11px', color: '#059669', fontWeight: '600', backgroundColor: '#d1fae5', padding: '2px 6px', borderRadius: '6px' }}>
                          <ShieldCheck size={11} style={{ display: 'inline', marginRight: '2px' }} /> Face Verified
                        </span>
                      </div>

                      <div style={{ fontSize: '12px', color: '#475569', fontWeight: '600', marginBottom: '2px' }}>
                        🕒 {log.formattedTime || new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </div>

                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                        📍 {log.address || `Lat ${log.lat}, Lng ${log.lng}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
