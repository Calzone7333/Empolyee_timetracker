import React, { useState, useEffect } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  ComposedChart, Scatter
} from 'recharts';
import {
  Clock, PieChart as PieIcon, Activity, Monitor,
  Tv, FileText, Settings, Download, Search,
  ChevronRight, Calendar, ChevronLeft, HelpCircle,
  ChevronDown, LayoutDashboard, BarChart3, RefreshCw,
  Ticket, Info, History, PlusCircle, Globe, Users, FolderTree, X
} from 'lucide-react';
import ConfigureApps from './ConfigureApps';

import {
  useUsers,
  useScreenshots,
  useActivityLevels,
  useApplications,
  useWebsites,
  useTeams,
  useDepartments
} from './hooks';


import trackingAgent from './trackingAgent';
import {
  getAllUsers,
  getUserActivity,
  deleteUser,
  getScreenshots as fetchScreenshots,
  getActivityLevels as fetchActivityLevels,
  getApplicationsUsed,
  getWebsitesVisited,
  getTeams,
  getDepartments,
  getTimeClaims,
  addTimeClaim,
  updateClaimStatus
} from './api';

const COLORS = ['#00bfa5', '#ec407a', '#1e88e5', '#37474f', '#ffb300'];

const SidebarItem = ({ icon: Icon, label, items, isOpen, onToggle, activeItem, onItemClick, isPrimary }) => {
  const headerClass = isPrimary ? 'active-header' : (isOpen ? 'open-header' : '');
  const iconColor = headerClass === 'active-header' ? '#ffffff' : (headerClass === 'open-header' ? '#26a69a' : '#546e7a');

  return (
    <div className="nav-group">
      <div
        className={`nav-item ${headerClass}`}
        onClick={onToggle}
      >
        {Icon && <Icon size={18} color={iconColor} />}
        <span style={{ color: headerClass === 'active-header' ? 'white' : (headerClass === 'open-header' ? '#26a69a' : 'inherit') }}>
          {label}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
          {isOpen ? <ChevronDown size={14} color={iconColor} /> : <ChevronRight size={14} color="#90a4ae" />}
        </div>
      </div>

      {isOpen && items && (
        <div className="sub-items-container">
          {items.map(item => (
            <div
              key={item}
              className={`nav-item sub-item ${activeItem === item ? 'active' : ''}`}
              onClick={() => onItemClick(item)}
            >
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const MetricCard = ({ label, value, className }) => (
  <div className="metric-card">
    <div className="metric-label">{label}</div>
    <div className={`metric-value ${className}`}>{value}</div>
  </div>
);

const Switch = ({ checked = false, label, description }) => (
  <div className="config-row">
    <div className="config-label-group">
      <span style={{ fontSize: '13px', color: '#546e7a' }}>{label}</span>
      {description && <span className="config-desc">{description}</span>}
    </div>
    <label className="switch">
      <input type="checkbox" defaultChecked={checked} />
      <span className="slider-round"></span>
    </label>
  </div>
);

function App({ dynamicData }) {
  const [openGroup, setOpenGroup] = useState('Time Tracker');
  const [activeItem, setActiveItem] = useState('Dashboard');
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [screenshotSize, setScreenshotSize] = useState('Large'); // 'Tiny', 'Small', 'Medium', 'Large'
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isAgentInstalled, setIsAgentInstalled] = useState(trackingAgent.isInstalled());
  const [isInstalling, setIsInstalling] = useState(false);
  const [monitoringData, setMonitoringData] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeRange, setActiveRange] = useState('Day');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showRefreshMenu, setShowRefreshMenu] = useState(false);

  // Pagination States
  const [appGroupsPage, setAppGroupsPage] = useState(1);
  const [categoriesPage, setCategoriesPage] = useState(1);
  const [websitesPage, setWebsitesPage] = useState(1);
  const [appsPage, setAppsPage] = useState(1);
  const [detailedPage, setDetailedPage] = useState(1);
  const itemsPerPage = 20;

  // Reset pages when user changes
  useEffect(() => {
    setAppGroupsPage(1);
    setCategoriesPage(1);
    setWebsitesPage(1);
    setAppsPage(1);
    setDetailedPage(1);
  }, [selectedUserId, activeTab]);

  // Dynamic Monitoring Data
  const [screenshots, setScreenshots] = useState([]);
  const [activityData, setActivityData] = useState([]);
  const [recordings, setRecordings] = useState([]);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [userToEdit, setUserToEdit] = useState(null);
  const [manualClaims, setManualClaims] = useState([]);
  const [newClaim, setNewClaim] = useState({ date: '', duration: '', reason: '' });

  // Initialize dynamic data
  useEffect(() => {
    updateData();
    const interval = setInterval(updateData, 60000); // 1 minute refresh
    return () => clearInterval(interval);
  }, [selectedUserId, selectedDate, activeRange]);

  const updateData = async () => {
    // 1. Fetch REAL users from backend
    const realUsers = await getAllUsers();
    setUsersList(realUsers);

    // 2. Fetch Teams and Departments (for Admin views)
    const teamsData = await getTeams();
    const deptsData = await getDepartments();

    // Auto-select first user if none selected
    let currentId = selectedUserId;
    if (!currentId && realUsers.length > 0) {
      currentId = realUsers[0].id;
      setSelectedUserId(currentId);
    }

    // 3. Fetch data for selected user
    if (currentId) {
      const formattedDate = selectedDate.getFullYear() + '-' + String(selectedDate.getMonth() + 1).padStart(2, '0') + '-' + String(selectedDate.getDate()).padStart(2, '0');
      const rangeParam = activeRange.toLowerCase();

      // Parallelize all heavy dashboard endpoints
      const [
        activity,
        apps,
        websites,
        recentScreenshots,
        stats,
        claims,
        yesterdayActivity,
        weekActivity
      ] = await Promise.all([
        getUserActivity(currentId, formattedDate, rangeParam),
        getApplicationsUsed(currentId, formattedDate, rangeParam),
        getWebsitesVisited(currentId, formattedDate, rangeParam),
        fetchScreenshots(currentId, formattedDate),
        fetchActivityLevels(currentId, formattedDate, rangeParam),
        getTimeClaims(currentId),

        // Comparative data for Trends
        getUserActivity(currentId, (() => {
          const y = new Date(selectedDate);
          y.setDate(y.getDate() - 1);
          return y.toISOString().split('T')[0];
        })()),
        getUserActivity(currentId, formattedDate, 'week')
      ]);

      setManualClaims(claims);

      console.log('Fetching for ID:', currentId);
      const currentUser = realUsers.find(u => u.id == currentId);
      console.log('Found user:', currentUser);
      console.log('DEBUG: APPS RECEIVED:', apps);
      console.log('DEBUG: WEBSITES RECEIVED:', websites);

      const formatDur = (s) => {
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        return `${h}:${m.toString().padStart(2, '0')}`;
      };

      // 4. Calculate productivity based on the 'apps' and 'websites' summaries from backend
      let prodSecs = 0, nonProdSecs = 0, neutralSecs = 0;
      let groupsInfo = { 'Productivity Apps': 0, 'Internet Browsing': 0, 'Others': 0 };

      apps.forEach(a => {
        if (a.group === 'Productive') prodSecs += (a.durationSecs || 0);
        else if (a.group === 'Non-Productive') nonProdSecs += (a.durationSecs || 0);
        else neutralSecs += (a.durationSecs || 0);

        if (a.group === 'Productive') groupsInfo['Productivity Apps'] += (a.durationSecs || 0);
        else groupsInfo['Others'] += (a.durationSecs || 0);
      });

      websites.forEach(w => {
        if (w.group === 'Productive') prodSecs += (w.durationSecs || 0);
        else if (w.group === 'Non-Productive') nonProdSecs += (w.durationSecs || 0);
        else neutralSecs += (w.durationSecs || 0);

        groupsInfo['Internet Browsing'] += (w.durationSecs || 0);
      });

      const totalSecs = prodSecs + nonProdSecs + neutralSecs || 1;
      const productivityData = [
        { name: 'Productive', value: Math.round((prodSecs / totalSecs) * 100), full: `${formatDur(prodSecs)} (${Math.round((prodSecs / totalSecs) * 100)}%)`, color: '#26a69a' },
        { name: 'Non-Productive', value: Math.round((nonProdSecs / totalSecs) * 100), full: `${formatDur(nonProdSecs)} (${Math.round((nonProdSecs / totalSecs) * 100)}%)`, color: '#ffb300' },
        { name: 'Neutral', value: Math.round((neutralSecs / totalSecs) * 100), full: `${formatDur(neutralSecs)} (${Math.round((neutralSecs / totalSecs) * 100)}%)`, color: '#90a4ae' }
      ];

      const appGroupsData = Object.entries(groupsInfo).filter(([k, v]) => v > 0).map(([name, valSecs]) => ({
        name,
        duration: formatDur(valSecs),
        percentage: Math.round((valSecs / totalSecs) * 100) + '%'
      }));

      const categoriesData = [
        { name: 'Productive', duration: formatDur(prodSecs), percentage: Math.round((prodSecs / totalSecs) * 100) + '%' },
        { name: 'Non-Productive', duration: formatDur(nonProdSecs), percentage: Math.round((nonProdSecs / totalSecs) * 100) + '%' },
        { name: 'Neutral', duration: formatDur(neutralSecs), percentage: Math.round((neutralSecs / totalSecs) * 100) + '%' }
      ].filter(c => parseInt(c.percentage) > 0);

      let attendanceData = [];
      let timelineData = [];

      if (activity.length > 0) {
        const first = new Date(activity[0].timestamp);
        const last = new Date(activity[activity.length - 1].timestamp);
        const spentMs = last - first; // Duration between first and last ping

        // Format HH:MM
        const formatTime = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const spentH = Math.floor(spentMs / 3600000);
        const spentM = Math.floor((spentMs % 3600000) / 60000);

        attendanceData.push({
          start: formatTime(first),
          end: formatTime(last),
          spent: `${spentH.toString().padStart(2, '0')}:${spentM.toString().padStart(2, '0')}`,
          activity: 'Working',
          status: 'Active',
          type: 'working'
        });

        // Calculate continuous timeline segments
        let currentType = null;
        let currentCount = 0;
        const totalPings = activity.length;
        const segments = [];

        activity.forEach(a => {
          let type = 'neutral';
          const app = (a.application || '').toLowerCase();
          const site = (a.website || '').toLowerCase();

          if (app.includes('code') || app.includes('studio') || app.includes('visual') ||
            app.includes('word') || app.includes('excel') || app.includes('slack') ||
            site.includes('github') || site.includes('stackoverflow') || site.includes('jira') ||
            site.includes('google') || site.includes('canva') || site.includes('figma')) {
            type = 'productive';
          } else if (site.includes('youtube') || site.includes('facebook') || site.includes('instagram') ||
            site.includes('netflix') || site.includes('twitter') || site.includes('reddit') || app.includes('game')) {
            type = 'non-productive';
          }

          if (type === currentType) {
            currentCount++;
          } else {
            if (currentType) segments.push({ type: currentType, width: (currentCount / totalPings) * 100 });
            currentType = type;
            currentCount = 1;
          }
        });
        if (currentType) segments.push({ type: currentType, width: (currentCount / totalPings) * 100 });

        timelineData.push({
          date: new Date().toLocaleDateString('en-GB'),
          day: 'Today',
          data: true,
          segments: segments
        });
      } else {
        attendanceData.push({ start: '-', end: '-', spent: '00:00', activity: '-', status: 'Absent', type: 'absent' });
      }

      // Trends Comparison Helper
      const getStatsFor = (list) => {
        let p = 0, np = 0, n = 0;
        list.forEach(a => {
          const app = (a.application || '').toLowerCase();
          const site = (a.website || '').toLowerCase();
          if (app.includes('code') || app.includes('studio') || site.includes('github') || site.includes('google')) p++;
          else if (site.includes('youtube') || site.includes('facebook') || site.includes('netflix')) np++;
          else n++;
        });
        const total = list.length || 1;
        return {
          productive: formatDur(p * 10),
          nonProductive: formatDur(np * 10),
          neutral: formatDur(n * 10),
          pPerc: Math.round((p / total) * 100),
          npPerc: Math.round((np / total) * 100),
          nPerc: Math.round((n / total) * 100)
        };
      };

      const yesterdayStats = getStatsFor(yesterdayActivity);
      const weekStats = getStatsFor(weekActivity);

      // Weekly Balance Data
      const weeklyBalance = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() - i);
        const dStr = d.toISOString().split('T')[0];
        const dayLogs = weekActivity.filter(a => a.timestamp && a.timestamp.split('T')[0] === dStr);
        weeklyBalance.push({
          date: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
          actual: parseFloat((dayLogs.length * 10 / 3600).toFixed(1)),
          expected: 8
        });
      }

      // Map backend response to UI structure
      const activeActivitiesList = activity.filter(a => a.type === 'active');
      setMonitoringData({
        user: currentUser,
        activeTime: activeActivitiesList.length > 0 ? `${Math.floor(activeActivitiesList.length * 10 / 3600).toString().padStart(2, '0')}:${Math.floor((activeActivitiesList.length * 10 / 60) % 60).toString().padStart(2, '0')}` : '00:00',
        productivity: productivityData,
        attendance: attendanceData,
        appGroups: appGroupsData,
        categories: categoriesData,
        topApps: apps.map(a => ({
          name: a.app,
          value: Math.round(a.percVal || 0),
          full: a.dur,
          group: a.group,
          perc: a.perc,
          title: a.title,
          durationSecs: a.durationSecs
        })),
        topSites: websites.map(w => ({
          name: w.site,
          value: Math.round(w.percVal || 0),
          full: w.dur,
          group: w.group,
          perc: w.perc,
          fullTitle: w.fullTitle,
          durationSecs: w.durationSecs
        })),
        awayTime: '00:00',
        idleTime: formatDur(activity.filter(a => (a.idleTime || 0) > 0).length * 10),
        timeline: timelineData,
        screenshots: recentScreenshots,
        activityLevels: stats,
        rawActivities: activity,
        teams: teamsData,
        departments: deptsData,
        trends: {
          today: { productive: formatDur(prodSecs), nonProductive: formatDur(nonProdSecs), neutral: formatDur(neutralSecs), pPerc: Math.round((prodSecs / totalSecs) * 100), npPerc: Math.round((nonProdSecs / totalSecs) * 100), nPerc: Math.round((neutralSecs / totalSecs) * 100) },
          yesterday: yesterdayStats,
          week: weekStats
        },
        weeklyBalance
      });

      // Also update separate states if needed by other components
      setScreenshots(recentScreenshots);
      setActivityData(stats);
    }

    setIsAgentInstalled(realUsers.length > 0);
  };

  // State for connection listening
  const [isListening, setIsListening] = useState(false);

  const handlePrevDate = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d);
  };

  const handleNextDate = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d);
  };

  const handleDownloadAgent = async () => {
    setIsInstalling(true);

    try {
      // Direct link to backend agent download
      window.location.href = `http://103.181.108.248:8084/api/download-agent`;

      // Give it a moment to trigger the browse download before changing UI state
      await new Promise(resolve => setTimeout(resolve, 3000));

      setIsInstalling(false);
      setIsListening(true); // Start "Listening" mode

      // Polling for new connections automatically is handled by the 1-minute interval,
      // but we can trigger an immediate check later.
      setTimeout(() => {
        setIsListening(false);
        updateData();
      }, 15000);
    } catch (err) {
      console.error("Download failed:", err);
      alert("Failed to download agent. Make sure the backend is running and the agent is built.");
      setIsInstalling(false);
    }
  };

  const simulateNewConnection = (silent = false) => {
    const newUser = trackingAgent.createNewUser();
    if (!silent) {
      alert(`New device connected: ${newUser.userName} (${newUser.computerName})`);
    }
    updateData();
    setSelectedUserId(newUser.id); // Switch to new user
  };

  // Generate dynamic screenshots
  useEffect(() => {
    if (monitoringData && monitoringData.screenshots) {
      setScreenshots(monitoringData.screenshots);
    }
  }, [monitoringData]);

  // Generate dynamic activity levels
  useEffect(() => {
    if (monitoringData && monitoringData.activityLevels) {
      setActivityData(monitoringData.activityLevels);
    }
  }, [monitoringData]);

  // Fetch Screen Recordings (Placeholder as agent does not record video currently)
  useEffect(() => {
    setRecordings([]);
  }, []);

  const toggleGroup = (group) => {
    setOpenGroup(openGroup === group ? null : group);
  };

  const PaginationControls = ({ currentPage, totalItems, itemsPerPage, onPageChange }) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (totalPages <= 1) {
      return (
        <div className="table-pagination">
          <span className="page-info">1 - {totalItems} of {totalItems} Items</span>
        </div>
      );
    }

    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }

    return (
      <div className="table-pagination">
        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
          <div className="circle-btn" onClick={() => onPageChange(1)} style={{ opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? 'default' : 'pointer' }}>
            <ChevronLeft size={14} /><ChevronLeft size={14} style={{ marginLeft: '-8px' }} />
          </div>
          <div className="circle-btn" onClick={() => onPageChange(Math.max(1, currentPage - 1))} style={{ opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? 'default' : 'pointer' }}>
            <ChevronLeft size={14} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '4px' }}>
          {pages.map((p, i) => (
            p === '...' ? <span key={`dots-${i}`} style={{ padding: '0 4px', color: '#90a4ae' }}>...</span> :
              <button
                key={p}
                className={`page-btn ${currentPage === p ? 'active' : ''}`}
                onClick={() => onPageChange(p)}
                style={{
                  width: '28px',
                  height: '28px',
                  fontSize: '12px',
                  background: currentPage === p ? '#26a69a' : 'white',
                  color: currentPage === p ? 'white' : '#546e7a',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                {p}
              </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
          <div className="circle-btn" onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))} style={{ opacity: currentPage === totalPages ? 0.5 : 1, cursor: currentPage === totalPages ? 'default' : 'pointer' }}>
            <ChevronRight size={14} />
          </div>
          <div className="circle-btn" onClick={() => onPageChange(totalPages)} style={{ opacity: currentPage === totalPages ? 0.5 : 1, cursor: currentPage === totalPages ? 'default' : 'pointer' }}>
            <ChevronRight size={14} /><ChevronRight size={14} style={{ marginLeft: '-8px' }} />
          </div>
        </div>

        <span className="page-info">
          {Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)} - {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} Items
        </span>
      </div>
    );
  };

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <aside
        className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''} ${isHovered ? 'is-hovered' : ''}`}
        onMouseEnter={() => isSidebarCollapsed && setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="sidebar-logo">
          <Monitor size={22} color="#26a69a" />
          <div style={{ fontWeight: '600', color: '#455a64', flex: 1, whiteSpace: 'nowrap', opacity: isSidebarCollapsed && !isHovered ? 0 : 1, paddingLeft: '12px' }}>
            Time Champ
          </div>
          <div style={{ cursor: 'pointer', flexShrink: 0, opacity: isSidebarCollapsed && !isHovered ? 0 : 1, paddingRight: '15px' }}>
            {isSidebarCollapsed ?
              <ChevronRight size={16} color="#ccc" onClick={(e) => { e.stopPropagation(); setIsSidebarCollapsed(false); }} /> :
              <ChevronLeft size={16} color="#ccc" onClick={() => setIsSidebarCollapsed(true)} />
            }
          </div>
        </div>

        <nav className="sidebar-nav">
          <SidebarItem
            icon={History}
            label="Time Tracker"
            items={['Dashboard', 'Attendance', 'Time Claim']}
            isOpen={openGroup === 'Time Tracker'}
            onToggle={() => toggleGroup('Time Tracker')}
            activeItem={activeItem}
            onItemClick={(item) => {
              setActiveItem(item);
              if (item === 'Dashboard' || item === 'Attendance' || item === 'Time Claim') {
                setActiveTab(item);
              }
            }}
            isPrimary={activeItem === 'Dashboard' || activeItem === 'Attendance' || activeItem === 'Time Claim'}
          />
          <SidebarItem
            icon={BarChart3}
            label="Productivity"
            items={['Trends', 'Time Line', 'Configure Apps']}
            isOpen={openGroup === 'Productivity'}
            onToggle={() => toggleGroup('Productivity')}
            activeItem={activeItem}
            onItemClick={(item) => {
              setActiveItem(item);
              if (item === 'Trends' || item === 'Time Line' || item === 'Configure Apps') {
                setActiveTab(item);
              }
            }}
          />
          <SidebarItem
            icon={Ticket}
            label="Activity"
            items={['By Application Groups', 'By Categories', 'Websites Visited', 'Applications Used', 'Detailed Activity']}
            isOpen={openGroup === 'Activity'}
            onToggle={() => toggleGroup('Activity')}
            activeItem={activeItem}
            onItemClick={(item) => {
              setActiveItem(item);
              const activityTabs = ['By Application Groups', 'By Categories', 'Websites Visited', 'Applications Used', 'Detailed Activity'];
              if (activityTabs.includes(item)) {
                setActiveTab(item);
              }
            }}
          />
          <SidebarItem
            icon={Monitor}
            label="Monitoring"
            items={['Screenshots', 'Screen Recordings', 'Activity Levels']}
            isOpen={openGroup === 'Monitoring'}
            onToggle={() => toggleGroup('Monitoring')}
            activeItem={activeItem}
            onItemClick={(item) => {
              setActiveItem(item);
              const monitoringTabs = ['Screenshots', 'Screen Recordings', 'Activity Levels'];
              if (monitoringTabs.includes(item)) {
                setActiveTab(item);
              }
            }}
          />
          <SidebarItem
            icon={Tv}
            label="Office TV"
            items={['Favourites', 'Live Screens']}
            isOpen={openGroup === 'Office TV'}
            onToggle={() => toggleGroup('Office TV')}
            activeItem={activeItem}
            onItemClick={setActiveItem}
          />
          <SidebarItem
            icon={PieIcon}
            label="Reports"
            items={['Time & Attendance', 'Activity']}
            isOpen={openGroup === 'Reports'}
            onToggle={() => toggleGroup('Reports')}
            activeItem={activeItem}
            onItemClick={setActiveItem}
          />
          <SidebarItem
            icon={Settings}
            label="Administration"
            items={['Profile', 'Configuration', 'Users', 'Teams', 'Departments', 'Advanced']}
            isOpen={openGroup === 'Administration'}
            onToggle={() => toggleGroup('Administration')}
            activeItem={activeItem}
            onItemClick={(item) => {
              setActiveItem(item);
              const adminTabs = ['Profile', 'Configuration', 'Users', 'Teams', 'Departments', 'Advanced'];
              if (adminTabs.includes(item)) {
                setActiveTab(item);
              }
            }}
          />
        </nav>
      </aside>

      {/* Employee List Pane */}
      <div className="employee-pane">
        <div className="employee-tabs">
          <div className="employee-tab active">Employees</div>
          <div className="employee-tab">Teams</div>
        </div>
        <div className="org-name">hado</div>

        {usersList.length === 0 ? (
          <div style={{ padding: '15px', textAlign: 'center', color: '#90a4ae', fontSize: '12px' }}>
            No agents installed. <br />
            <span style={{ color: '#26a69a', cursor: 'pointer', fontWeight: '500' }} onClick={handleDownloadAgent}>Download Agent</span>
          </div>
        ) : (
          usersList.map(u => (
            <div
              key={u.id}
              className={`employee-item ${selectedUserId == u.id ? 'active' : ''}`}
              style={{ cursor: 'pointer' }}
              onClick={() => {
                console.log('Selected user:', u.id);
                setSelectedUserId(u.id);
              }}
            >
              {u.userName} ({u.employeeId || 'ID'})
            </div>
          ))
        )}

        {/* Simulation Controls - Removed for Production Build */}
      </div>

      {/* Main Content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header className="header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              onClick={handleDownloadAgent}
              style={{ padding: '6px 12px', background: '#f5f7f9', border: '1px solid #eee', borderRadius: '4px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px', cursor: (isInstalling || isListening) ? 'wait' : 'pointer' }}
            >
              {isInstalling ? (
                <>
                  <div className="spinner" style={{ width: '12px', height: '12px', border: '2px solid #ccc', borderTopColor: '#546e7a', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                  <span style={{ color: '#546e7a', fontWeight: '500' }}>Downloading...</span>
                </>
              ) : isListening ? (
                <>
                  <div className="spinner" style={{ width: '12px', height: '12px', border: '2px solid #ccc', borderTopColor: '#26a69a', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                  <span style={{ color: '#26a69a', fontWeight: '500' }}>Waiting...</span>
                </>
              ) : (
                <>
                  <Download size={14} color="#546e7a" />
                  <span style={{ color: '#546e7a', fontWeight: '500' }}>Download Agent</span>
                </>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                className="circle-btn"
                title="Refresh Data"
                onClick={updateData}
                style={{ background: '#f5f7f9', padding: '6px' }}
              >
                <Activity size={16} color="#26a69a" />
              </div>
              <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#880e4f', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', fontSize: '11px' }}>
                {monitoringData?.user?.userName?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div style={{ fontSize: '11px' }}>
                <div style={{ fontWeight: '600', color: '#263238' }}>{monitoringData?.user?.userName || 'No User'}</div>
                <div style={{ color: '#90a4ae', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Monitor size={10} /> {monitoringData?.user?.computerName || 'Detecting...'}
                </div>
              </div>
            </div>
          </div>
        </header>

        {usersList.length > 0 ? (
          <>
            <div className="sub-header">
              <div className="breadcrumb">{monitoringData?.user?.userName || 'User'}</div>
              <div className="controls-right">
                <div className="circle-btn" onClick={handlePrevDate}><ChevronLeft size={16} /></div>
                <div className="pill-container" style={{ position: 'relative' }}>
                  <span onClick={() => setShowDatePicker(!showDatePicker)} style={{ cursor: 'pointer' }}>
                    {selectedDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <Calendar size={14} color="#78909c" onClick={() => setShowDatePicker(!showDatePicker)} style={{ cursor: 'pointer' }} />
                  {showDatePicker && (
                    <input
                      type="date"
                      value={selectedDate.toISOString().split('T')[0]}
                      onChange={(e) => {
                        setSelectedDate(new Date(e.target.value));
                        setShowDatePicker(false);
                      }}
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        zIndex: 1000,
                        opacity: 0.1,
                        width: '100%',
                        height: '100%'
                      }}
                      autoFocus
                      onBlur={() => setTimeout(() => setShowDatePicker(false), 200)}
                    />
                  )}
                </div>
                <div className="circle-btn" onClick={handleNextDate}><ChevronRight size={16} /></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', marginLeft: '8px', cursor: 'pointer' }}>
                  IST <ChevronDown size={14} />
                </div>
                <div className="toggle-group" style={{ marginLeft: '12px' }}>
                  <button
                    className={`toggle-btn ${activeRange === 'Day' ? 'active' : ''}`}
                    onClick={() => setActiveRange('Day')}
                    style={activeRange === 'Day' ? { border: '1px solid #26a69a', color: '#26a69a' } : {}}
                  >
                    Day
                  </button>
                  <button
                    className={`toggle-btn ${activeRange === 'Week' ? 'active' : ''}`}
                    onClick={() => setActiveRange('Week')}
                    style={activeRange === 'Week' ? { border: '1px solid #26a69a', color: '#26a69a' } : {}}
                  >
                    Week
                  </button>
                  <button
                    className={`toggle-btn ${activeRange === 'Month' ? 'active' : ''}`}
                    onClick={() => setActiveRange('Month')}
                    style={activeRange === 'Month' ? { border: '1px solid #26a69a', color: '#26a69a' } : {}}
                  >
                    Month
                  </button>
                  <button
                    className={`toggle-btn ${activeRange === 'Date Range' ? 'active' : ''}`}
                    onClick={() => setActiveRange('Date Range')}
                    style={activeRange === 'Date Range' ? { border: '1px solid #26a69a', color: '#26a69a' } : {}}
                  >
                    Date Range
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <div
                    style={{ display: 'flex', gap: '3px', marginLeft: '8px', cursor: 'pointer', padding: '10px 5px' }}
                    onClick={() => setShowRefreshMenu(!showRefreshMenu)}
                  >
                    {[1, 2, 3].map(i => <div key={i} style={{ width: '3px', height: '3px', background: '#ccc', borderRadius: '50%' }} />)}
                  </div>
                  {showRefreshMenu && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        right: 0,
                        background: 'white',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        borderRadius: '4px',
                        zIndex: 1000,
                        minWidth: '120px',
                        padding: '5px 0',
                        border: '1px solid #eee'
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '10px 15px',
                          fontSize: '13px',
                          color: '#37474f',
                          cursor: 'pointer',
                          transition: 'background 0.2s',
                          borderBottom: '1px solid #f5f5f5'
                        }}
                        onClick={() => {
                          updateData();
                          setShowRefreshMenu(false);
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f5f7f9'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <RefreshCw size={14} color="#26a69a" />
                        <span>Refresh Data</span>
                      </div>
                      <div
                        style={{
                          padding: '8px 15px',
                          fontSize: '11px',
                          color: '#90a4ae',
                          background: '#fcfcfc'
                        }}
                      >
                        Last sync: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="view-tabs">
              {['Dashboard', 'Attendance', 'Time Claim'].includes(activeItem) || (['Dashboard', 'Attendance', 'Time Claim'].includes(activeTab) && !['Trends', 'Time Line', 'Configure Apps', 'By Application Groups', 'By Categories', 'Websites Visited', 'Applications Used', 'Detailed Activity'].includes(activeItem)) ? (
                <>
                  <div className={`tab-item ${activeTab === 'Dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('Dashboard')}>
                    <LayoutDashboard size={14} /> Dashboard
                  </div>
                  <div className={`tab-item ${activeTab === 'Attendance' ? 'active' : ''}`} onClick={() => setActiveTab('Attendance')}>
                    <Calendar size={14} /> Attendance
                  </div>
                  <div className={`tab-item ${activeTab === 'Time Claim' ? 'active' : ''}`} onClick={() => setActiveTab('Time Claim')}>
                    <Clock size={14} /> Time Claim
                  </div>
                </>
              ) : ['Trends', 'Time Line', 'Configure Apps'].includes(activeItem) || ['Trends', 'Time Line', 'Configure Apps'].includes(activeTab) && !['By Application Groups', 'By Categories', 'Websites Visited', 'Applications Used', 'Detailed Activity'].includes(activeItem) ? (
                <>
                  <div className={`tab-item ${activeTab === 'Trends' ? 'active' : ''}`} onClick={() => setActiveTab('Trends')}>
                    <BarChart3 size={14} /> Trends
                  </div>
                  <div className={`tab-item ${activeTab === 'Time Line' ? 'active' : ''}`} onClick={() => setActiveTab('Time Line')}>
                    <History size={14} /> Time Line
                  </div>
                  <div className={`tab-item ${activeTab === 'Configure Apps' ? 'active' : ''}`} onClick={() => setActiveTab('Configure Apps')}>
                    <Settings size={14} /> Configure Apps
                  </div>
                </>
              ) : ['Screenshots', 'Screen Recordings', 'Activity Levels'].includes(activeItem) || ['Screenshots', 'Screen Recordings', 'Activity Levels'].includes(activeTab) ? (
                <>
                  <div className={`tab-item ${activeTab === 'Screenshots' ? 'active' : ''}`} onClick={() => setActiveTab('Screenshots')}>
                    <Monitor size={14} /> Screenshots
                  </div>
                  <div className={`tab-item ${activeTab === 'Screen Recordings' ? 'active' : ''}`} onClick={() => setActiveTab('Screen Recordings')}>
                    <Monitor size={14} /> Screen Recordings
                  </div>
                  <div className={`tab-item ${activeTab === 'Activity Levels' ? 'active' : ''}`} onClick={() => setActiveTab('Activity Levels')}>
                    <Activity size={14} /> Activity Levels
                  </div>
                </>
              ) : ['Profile', 'Configuration', 'Users', 'Teams', 'Departments', 'Advanced'].includes(activeItem) || ['Profile', 'Configuration', 'Users', 'Teams', 'Departments', 'Advanced'].includes(activeTab) ? (
                <>
                  <div className={`tab-item ${activeTab === 'Profile' ? 'active' : ''}`} onClick={() => setActiveTab('Profile')}>
                    <Info size={14} /> Profile
                  </div>
                  <div className={`tab-item ${activeTab === 'Configuration' ? 'active' : ''}`} onClick={() => setActiveTab('Configuration')}>
                    <Settings size={14} /> Configuration
                  </div>
                  <div className={`tab-item ${activeTab === 'Users' ? 'active' : ''}`} onClick={() => setActiveTab('Users')}>
                    <Users size={14} /> Users
                  </div>
                  <div className={`tab-item ${activeTab === 'Teams' ? 'active' : ''}`} onClick={() => setActiveTab('Teams')}>
                    <Users size={14} /> Teams
                  </div>
                  <div className={`tab-item ${activeTab === 'Departments' ? 'active' : ''}`} onClick={() => setActiveTab('Departments')}>
                    <FolderTree size={14} /> Departments
                  </div>
                  <div className={`tab-item ${activeTab === 'Advanced' ? 'active' : ''}`} onClick={() => setActiveTab('Advanced')}>
                    <Settings size={14} /> Advanced
                  </div>
                </>
              ) : (
                <>
                  <div className={`tab-item ${activeTab === 'By Application Groups' ? 'active' : ''}`} onClick={() => setActiveTab('By Application Groups')}>
                    <PlusCircle size={14} /> By Application Groups
                  </div>
                  <div className={`tab-item ${activeTab === 'By Categories' ? 'active' : ''}`} onClick={() => setActiveTab('By Categories')}>
                    <PlusCircle size={14} /> By Categories
                  </div>
                  <div className={`tab-item ${activeTab === 'Websites Visited' ? 'active' : ''}`} onClick={() => setActiveTab('Websites Visited')}>
                    <Globe size={14} /> Websites Visited
                  </div>
                  <div className={`tab-item ${activeTab === 'Applications Used' ? 'active' : ''}`} onClick={() => setActiveTab('Applications Used')}>
                    <Monitor size={14} /> Applications Used
                  </div>
                  <div className={`tab-item ${activeTab === 'Detailed Activity' ? 'active' : ''}`} onClick={() => setActiveTab('Detailed Activity')}>
                    <Activity size={14} /> Detailed Activity
                  </div>
                </>
              )}
            </div>
          </>
        ) : null}
        {/* Admin Deployment Hub - Empty State */}
        {usersList.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f7f9', padding: '40px' }}>
            <div style={{ background: 'white', padding: '40px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', textAlign: 'center', maxWidth: '600px' }}>
              <Monitor size={64} color="#26a69a" style={{ marginBottom: '20px' }} />
              <h2 style={{ color: '#37474f', marginBottom: '10px' }}>Welcome to TimeChamp Admin</h2>
              <p style={{ color: '#78909c', fontSize: '15px', lineHeight: '1.6', marginBottom: '30px' }}>
                You are currently in the <strong>Admin Console</strong>. To start monitoring your employees, you need to deploy the agent to their machines.
              </p>

              <div style={{ textAlign: 'left', background: '#f5f7f9', padding: '20px', borderRadius: '6px', marginBottom: '30px' }}>
                <h4 style={{ margin: '0 0 15px 0', color: '#455a64' }}>Deployment Instructions:</h4>
                <ol style={{ margin: 0, paddingLeft: '20px', color: '#546e7a', fontSize: '14px', lineHeight: '2' }}>
                  <li>Click the <strong>Download Installer</strong> button below.</li>
                  <li>Transfer the <code>.exe</code> file to your employee's computer (via USB, Email, or Network Share).</li>
                  <li>Run the executable on their machine.</li>
                  <li>The dashboard will <strong>automatically refresh</strong> when they connect.</li>
                </ol>
              </div>

              {isListening ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#26a69a', fontWeight: '500' }}>
                  <div className="spinner" style={{ width: '16px', height: '16px', border: '2px solid #b2dfdb', borderTopColor: '#26a69a', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                  Checking for active agents...
                </div>
              ) : (
                <button
                  onClick={handleDownloadAgent}
                  disabled={isInstalling}
                  style={{ padding: '12px 24px', background: '#26a69a', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 auto', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
                >
                  {isInstalling ? 'Downloading...' : <><Download size={18} /> Download Employer Installer (.exe)</>}
                </button>
              )}
              <p style={{ fontSize: '12px', color: '#b0bec5', marginTop: '15px' }}>
                Ensure the employee machine is connected to the same network: <strong>{window.location.hostname}</strong>
              </p>
            </div>
          </div>
        ) : null}

        {/* Main Dashboard Content - Only show when users exist */}
        {usersList.length > 0 && (
          <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#f5f7f9' }}>
            {activeTab === 'Dashboard' ? (
              <>
                <div className="metrics-row">
                  <MetricCard label="Start Time" value={monitoringData?.attendance?.[0]?.start || '09:00'} className="val-blue" />
                  <MetricCard label="Working Hours" value={monitoringData?.activeTime || '00:00'} className="val-navy" />
                  <MetricCard label="Last Seen" value={monitoringData?.rawActivities?.length > 0 ? new Date(monitoringData.rawActivities[monitoringData.rawActivities.length - 1].timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : (new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))} className="val-orange" />
                  <MetricCard label="Productive Hours" value={monitoringData?.productivity?.[0]?.full?.split(' ')[0] || '00:00'} className="val-green" />
                  <MetricCard label="Non-Productive Hours" value={monitoringData?.productivity?.[1]?.full?.split(' ')[0] || '00:00'} className="val-red" />
                  <MetricCard label="Neutral Hours" value={monitoringData?.productivity?.[2]?.full?.split(' ')[0] || '00:00'} className="val-grey" />
                  <MetricCard label="Away Hours" value={monitoringData?.awayTime || '00:00'} className="val-grey" />
                </div>

                <div className="content-grid">
                  {/* Top 5 Apps */}
                  <div className="card">
                    <div className="card-title">Top 5 websites & applications <HelpCircle size={14} color="#cfd8dc" /></div>
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                      <div style={{ width: '160px', height: '160px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={monitoringData?.topApps || []} innerRadius={50} outerRadius={70} dataKey="value" stroke="none">
                              {(monitoringData?.topApps || []).map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div style={{ flex: 1, minWidth: '150px', fontSize: '12px' }}>
                        {(monitoringData?.topApps || []).map((item, index) => (
                          <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1 }}>
                              <div style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: COLORS[index % COLORS.length], flexShrink: 0 }}></div>
                              <span style={{ color: '#546e7a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</span>
                            </div>
                            <span style={{ fontWeight: '600', marginLeft: '10px' }}>{item.full.split(' ')[0]}</span>
                          </div>
                        ))}
                        <div style={{ color: '#90a4ae', marginTop: '10px', fontSize: '11px', textAlign: 'center' }}> &lt; 1/2 &gt; </div>
                      </div>
                    </div>
                  </div>

                  {/* Working Hours Avg */}
                  <div className="card">
                    <div className="card-title">Working Hours(Avg) <Download size={14} color="#26a69a" style={{ marginLeft: 'auto', cursor: 'pointer' }} /></div>
                    <div className="table-responsive">
                      <table className="custom-table">
                        <thead>
                          <tr>
                            <th>Employee Id</th>
                            <th>Name</th>
                            <th>Role</th>
                            <th>Man Days</th>
                            <th>Working Hours(Avg)</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td style={{ color: '#90a4ae' }}>{monitoringData?.user?.employeeId || '-'}</td>
                            <td style={{ color: '#d84315', fontWeight: '500' }}>{monitoringData?.user?.userName || '-'}</td>
                            <td style={{ color: '#546e7a' }}>User</td>
                            <td style={{ textAlign: 'center' }}>1</td>
                            <td style={{ fontWeight: '600', color: '#263238' }}>{monitoringData?.activeTime || '00:00'}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Productivity Split */}
                  <div className="card full-width">
                    <div className="card-title">Productivity Split <Download size={14} color="#26a69a" style={{ marginLeft: 'auto', cursor: 'pointer' }} /></div>
                    <div className="table-responsive">
                      <table className="custom-table" style={{ textAlign: 'center' }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left' }}>Employee Id</th>
                            <th style={{ textAlign: 'left' }}>Name</th>
                            <th style={{ textAlign: 'left' }}>Role</th>
                            <th>Man Days</th>
                            <th>Over Worked</th>
                            <th>Healthy</th>
                            <th>Under Worked</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td style={{ color: '#90a4ae', textAlign: 'left' }}>{monitoringData?.user?.employeeId || '-'}</td>
                            <td style={{ color: '#d84315', fontWeight: '500', textAlign: 'left' }}>{monitoringData?.user?.userName || '-'}</td>
                            <td style={{ color: '#546e7a', textAlign: 'left' }}>User</td>
                            <td>1</td>
                            <td>{parseFloat((monitoringData?.activeTime || '0').replace(':', '.')) > 9 ? '1' : '0'}</td>
                            <td>{parseFloat((monitoringData?.activeTime || '0').replace(':', '.')) >= 8 && parseFloat((monitoringData?.activeTime || '0').replace(':', '.')) <= 9 ? '1' : '0'}</td>
                            <td>{parseFloat((monitoringData?.activeTime || '0').replace(':', '.')) < 8 ? '1' : '0'}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Productive Activity */}
                  <div className="card">
                    <div className="card-title">Productive Activity</div>
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                      <div style={{ width: '160px', height: '160px' }}>
                        <ResponsiveContainer width="100%" height="100%" minHeight={160}>
                          <PieChart>
                            <Pie data={monitoringData?.productivity || []} innerRadius={50} outerRadius={70} dataKey="value" stroke="none">
                              {(monitoringData?.productivity || []).map((e, i) => <Cell key={i} fill={e.color} />)}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div style={{ flex: 1, minWidth: '200px', fontSize: '12px' }}>
                        {(monitoringData?.productivity || []).map((item, index) => (
                          <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.color }}></div>
                            <span style={{ color: '#546e7a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name} {item.full}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Work Time Metrics */}
                  <div className="card full-width">
                    <div className="card-title">Work Time Metrics <Download size={14} color="#26a69a" style={{ marginLeft: 'auto', cursor: 'pointer' }} /></div>
                    <div className="table-responsive">
                      <table className="custom-table">
                        <thead>
                          <tr>
                            <th>Employee Id</th>
                            <th>Name</th>
                            <th>Role</th>
                            <th>Active Time(Avg)</th>
                            <th>Approved Away Hours(Avg)</th>
                            <th>Idle Hours(Avg)</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td style={{ color: '#90a4ae' }}>{monitoringData?.user?.employeeId || '-'}</td>
                            <td style={{ color: '#d84315', fontWeight: '500' }}>{monitoringData?.user?.userName || '-'}</td>
                            <td style={{ color: '#546e7a' }}>User</td>
                            <td style={{ textAlign: 'center' }}>{monitoringData?.activeTime || '00:00'}</td>
                            <td style={{ textAlign: 'center' }}>{monitoringData?.awayTime || '00:00'}</td>
                            <td style={{ textAlign: 'center' }}>{monitoringData?.idleTime || '00:00'}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Work vs Life Balance */}
                  <div className="card full-width" style={{ position: 'relative' }}>
                    <div className="card-title">Work vs Life Balance</div>
                    <div style={{ height: '300px', width: '100%', marginTop: '20px' }}>
                      <ResponsiveContainer width="100%" height="100%" minHeight={300}>
                        <ComposedChart data={monitoringData?.weeklyBalance || []} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#90a4ae', fontSize: 11 }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fill: '#90a4ae', fontSize: 11 }} tickFormatter={(val) => `${val}h`} domain={[0, 12]} />
                          <Tooltip />
                          <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                          <Bar dataKey="actual" name="Actual Hours" fill="#42a5f5" radius={[2, 2, 0, 0]} barSize={40} />
                          <Scatter dataKey="expected" name="Expected Hours" fill="#ffb74d" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </>
            ) : activeTab === 'Attendance' ? (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="metrics-row" style={{ borderBottom: '1px solid #eee', marginBottom: '0' }}>
                  <MetricCard label="Total Working Time" value={monitoringData?.activeTime || '00:00'} className="val-green" />
                  <MetricCard label="Time Spent" value={monitoringData?.attendance?.reduce((acc, curr) => {
                    const [h, m] = curr.spent.split(':').map(Number);
                    const [accH, accM] = acc.split(':').map(Number);
                    let newM = m + accM;
                    let newH = h + accH + Math.floor(newM / 60);
                    newM = newM % 60;
                    return `${newH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}`;
                  }, '00:00') || '00:00'} className="val-blue" />
                  <MetricCard label="Productive Time" value={monitoringData?.productivity?.[0]?.full?.split(' ')[0] || '00:00'} className="val-green" />
                  <MetricCard label="Idle Time" value={monitoringData?.idleTime || '00:00'} className="val-orange" />
                  <MetricCard label="Away Time" value={monitoringData?.awayTime || '00:00'} className="val-grey" />
                </div>

                {/* Timeline Container */}
                <div className="timeline-container" style={{ margin: '20px 16px', background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #eee' }}>
                  <div style={{ fontSize: '12px', color: '#90a4ae', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Activity Timeline</span>
                    <span>{monitoringData?.attendance?.[0]?.start} - {monitoringData?.attendance?.[0]?.end}</span>
                  </div>
                  <div className="timeline-bar" style={{ height: '30px', display: 'flex', borderRadius: '4px', overflow: 'hidden', background: '#f5f7f9' }}>
                    {monitoringData?.timeline?.[0]?.segments?.length > 0 ? (
                      monitoringData.timeline[0].segments.map((seg, i) => (
                        <div
                          key={i}
                          style={{
                            width: `${seg.width}%`,
                            backgroundColor: seg.type === 'productive' ? '#26a69a' : (seg.type === 'non-productive' ? '#ffb300' : '#cfd8dc'),
                            height: '100%'
                          }}
                          title={`${seg.type} segment`}
                        />
                      ))
                    ) : (
                      <div style={{ width: '100%', height: '100%', background: '#eee' }}></div>
                    )}
                  </div>
                  <div className="timeline-labels" style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#90a4ae' }}>
                    <span>{monitoringData?.attendance?.[0]?.start}</span>
                    <span>Mid-day</span>
                    <span>{monitoringData?.attendance?.[0]?.end}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '15px', marginTop: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px' }}>
                      <div style={{ width: '10px', height: '10px', background: '#26a69a', borderRadius: '2px' }}></div> Productive
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px' }}>
                      <div style={{ width: '10px', height: '10px', background: '#ffb300', borderRadius: '2px' }}></div> Non-Productive
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px' }}>
                      <div style={{ width: '10px', height: '10px', background: '#cfd8dc', borderRadius: '2px' }}></div> Neutral
                    </div>
                  </div>
                </div>

                {/* Attendance Table */}
                <div style={{ padding: '0 16px 24px' }}>
                  <div className="table-responsive" style={{ background: 'white', borderRadius: '4px', border: '1px solid #eee' }}>
                    <table className="custom-table attendance-table">
                      <thead>
                        <tr>
                          <th style={{ width: '100px' }}>Start time</th>
                          <th style={{ width: '100px' }}>End time</th>
                          <th style={{ width: '120px' }}>Spent Time</th>
                          <th style={{ width: '150px' }}>User Activity Status</th>
                          <th style={{ width: '150px' }}>Working Status</th>
                          <th>Reason</th>
                          <th style={{ width: '100px' }}>Status <Info size={12} style={{ verticalAlign: 'middle', marginLeft: '4px' }} /></th>
                        </tr>
                      </thead>
                      <tbody>
                        {(monitoringData?.attendance || []).map((row, idx) => (
                          <tr key={idx} className={`row-${row.type}`} style={{ borderBottom: '1px solid #f5f5f5' }}>
                            <td>{row.start}</td>
                            <td>{row.end}</td>
                            <td style={{ fontWeight: '500' }}>{row.spent}</td>
                            <td>{row.activity}</td>
                            <td>{row.status}</td>
                            <td>{row.reason}</td>
                            <td style={{ position: 'relative' }}>
                              {row.editable && <Activity size={12} color="#00bfa5" style={{ position: 'absolute', right: '40px', top: '15px' }} />}
                              Original
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : activeTab === 'Time Claim' ? (
              <div style={{ padding: '24px' }}>
                <div className="metrics-row" style={{ marginBottom: '24px' }}>
                  <MetricCard label="Pending Claims" value={manualClaims.filter(c => c.status === 'Pending').length} className="val-orange" />
                  <MetricCard label="Approved Claims" value={manualClaims.filter(c => c.status === 'Approved').length} className="val-green" />
                  <MetricCard label="Rejected Claims" value={manualClaims.filter(c => c.status === 'Rejected').length} className="val-red" />
                  <MetricCard label="Total Claimed Hours" value={manualClaims.filter(c => c.status === 'Approved').reduce((acc, curr) => {
                    const h = parseInt(curr.duration.split(':')[0]);
                    const m = parseInt(curr.duration.split(':')[1]);
                    return acc + h + (m / 60);
                  }, 0).toFixed(1) + 'h'} className="val-blue" />
                </div>
                <div className="card" style={{ padding: '0', borderRadius: '8px', overflow: 'hidden', border: '1px solid #eee', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                  <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', background: 'white' }}>
                    <div className="card-title" style={{ margin: 0, fontSize: '16px', color: '#37474f' }}>Time Claims History</div>
                    <button
                      className="admin-btn-primary"
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: '#26a69a', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '500', fontSize: '13px' }}
                      onClick={() => setShowClaimModal(true)}
                    >
                      <PlusCircle size={16} /> Add Claim
                    </button>
                  </div>
                  <div className="table-responsive" style={{ background: 'white' }}>
                    <table className="custom-table" style={{ margin: 0, width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f8f9fa', textAlign: 'left' }}>
                          <th style={{ padding: '15px 20px', borderBottom: '1px solid #eee', color: '#90a4ae', fontWeight: '500', fontSize: '13px' }}>Date Submitted</th>
                          <th style={{ padding: '15px 20px', borderBottom: '1px solid #eee', color: '#90a4ae', fontWeight: '500', fontSize: '13px' }}>Claim Date</th>
                          <th style={{ padding: '15px 20px', borderBottom: '1px solid #eee', color: '#90a4ae', fontWeight: '500', fontSize: '13px' }}>Duration</th>
                          <th style={{ padding: '15px 20px', borderBottom: '1px solid #eee', color: '#90a4ae', fontWeight: '500', fontSize: '13px' }}>Reason</th>
                          <th style={{ padding: '15px 20px', borderBottom: '1px solid #eee', color: '#90a4ae', fontWeight: '500', fontSize: '13px' }}>Status</th>
                          <th style={{ padding: '15px 20px', borderBottom: '1px solid #eee', color: '#90a4ae', fontWeight: '500', fontSize: '13px' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {manualClaims.map((row) => (
                          <tr key={row.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                            <td style={{ padding: '15px 20px', color: '#546e7a', fontSize: '13px' }}>{row.submittedAt ? new Date(row.submittedAt).toLocaleDateString('en-GB') : '-'}</td>
                            <td style={{ padding: '15px 20px', color: '#546e7a', fontSize: '13px' }}>{new Date(row.claimDate).toLocaleDateString('en-GB')}</td>
                            <td style={{ padding: '15px 20px', fontWeight: '600', color: '#263238', fontSize: '13px' }}>{row.duration}</td>
                            <td style={{ padding: '15px 20px', color: '#546e7a', fontSize: '13px', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.reason}</td>
                            <td style={{ padding: '15px 20px' }}>
                              <span style={{
                                padding: '4px 10px',
                                borderRadius: '12px',
                                background: row.status === 'Pending' ? '#fff3e0' : (row.status === 'Approved' ? '#e8f5e9' : '#ffebee'),
                                color: row.status === 'Pending' ? '#ef6c00' : (row.status === 'Approved' ? '#2e7d32' : '#c62828'),
                                fontSize: '12px',
                                fontWeight: '600'
                              }}>
                                {row.status}
                              </span>
                            </td>
                            <td style={{ padding: '15px 20px' }}>
                              {row.status === 'Pending' ? (
                                <div style={{ display: 'flex', gap: '10px' }}>
                                  <span
                                    style={{ color: '#26a69a', cursor: 'pointer', fontWeight: '500', fontSize: '13px' }}
                                    onClick={async () => {
                                      const updated = await updateClaimStatus(row.id, 'Approved');
                                      if (updated) setManualClaims(manualClaims.map(c => c.id === row.id ? updated : c));
                                    }}
                                  >
                                    Approve
                                  </span>
                                  <span
                                    style={{ color: '#ef5350', cursor: 'pointer', fontWeight: '500', fontSize: '13px' }}
                                    onClick={async () => {
                                      const updated = await updateClaimStatus(row.id, 'Rejected');
                                      if (updated) setManualClaims(manualClaims.map(c => c.id === row.id ? updated : c));
                                    }}
                                  >
                                    Reject
                                  </span>
                                </div>
                              ) : (
                                <span style={{ color: '#90a4ae', fontSize: '13px' }}>Reviewed</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : activeTab === 'Trends' ? (
              <div style={{ padding: '0 0 24px' }}>
                <div className="metrics-row" style={{ padding: '16px' }}>
                  <MetricCard label="Working Hours" value={monitoringData?.activeTime || '00:00'} className="val-blue" />
                  <MetricCard label="Productive Hours" value={monitoringData?.productivity?.[0]?.full?.split(' ')[0] || '00:00'} className="val-green" />
                  <MetricCard label="Non-Productive Hours" value={monitoringData?.productivity?.[1]?.full?.split(' ')[0] || '00:00'} className="val-red" />
                  <MetricCard label="Neutral Hours" value={monitoringData?.productivity?.[2]?.full?.split(' ')[0] || '00:00'} className="val-grey" />
                  <MetricCard label="Away Hours" value={monitoringData?.awayTime || '00:00'} className="val-grey" />
                </div>

                <div className="content-grid">
                  <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div className="card-title">Productive Activity</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '20px' }}>
                      <div style={{ width: '160px', height: '160px' }}>
                        <ResponsiveContainer width="100%" height="100%" minHeight={160}>
                          <PieChart>
                            <Pie data={monitoringData?.productivity || []} innerRadius={50} outerRadius={70} dataKey="value" stroke="none">
                              {(monitoringData?.productivity || []).map((e, i) => <Cell key={i} fill={e.color} />)}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div style={{ fontSize: '13px', color: '#546e7a' }}>
                        {(monitoringData?.productivity || []).map((item, index) => (
                          <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.color }}></div>
                            {item.name.replace(' Hours', '')} - {item.value}%
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-title">Productive Break Down <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#90a4ae', fontWeight: '400' }}>Exp - Expected Hours</span></div>
                    <div className="table-responsive">
                      <table className="custom-table trends-table">
                        <thead>
                          <tr>
                            <th>Activity</th>
                            <th>Today</th>
                            <th>Yesterday</th>
                            <th>This Week</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { name: 'Productive Hours', key: 'productive', percKey: 'pPerc', color: '#26a69a' },
                            { name: 'Non-Productive Hours', key: 'nonProductive', percKey: 'npPerc', color: '#ffb300' },
                            { name: 'Neutral Hours', key: 'neutral', percKey: 'nPerc', color: '#90a4ae' }
                          ].map((row, i) => (
                            <tr key={i}>
                              <td style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: row.color }}></div>
                                {row.name}
                              </td>
                              <td>
                                <div style={{ fontWeight: '500' }}>{monitoringData?.trends?.today?.[row.key] || '0:00'}</div>
                                <div style={{ fontSize: '11px', color: '#26a69a' }}>{monitoringData?.trends?.today?.[row.percKey]}%</div>
                              </td>
                              <td>
                                <div style={{ fontWeight: '500' }}>{monitoringData?.trends?.yesterday?.[row.key] || '0:00'}</div>
                                <div style={{ fontSize: '11px', color: '#26a69a' }}>{monitoringData?.trends?.yesterday?.[row.percKey]}%</div>
                              </td>
                              <td>
                                <div style={{ fontWeight: '500' }}>{monitoringData?.trends?.week?.[row.key] || '0:00'}</div>
                                <div style={{ fontSize: '11px', color: '#26a69a' }}>{monitoringData?.trends?.week?.[row.percKey]}%</div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-title">Productive Application Groups <Activity size={14} color="#26a69a" /></div>
                    <div style={{ fontSize: '13px', paddingTop: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <span>{monitoringData?.appGroups?.find(g => g.name === 'Productivity Apps')?.name || 'Productivity Apps'}</span>
                        <div style={{ display: 'flex', gap: '15px' }}>
                          <span>{monitoringData?.appGroups?.find(g => g.name === 'Productivity Apps')?.duration || '00:00'}</span>
                          <span style={{ color: '#90a4ae' }}>({monitoringData?.appGroups?.find(g => g.name === 'Productivity Apps')?.percentage || '0%'})</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-title">Non-Productive Application Groups <Activity size={14} color="#ef5350" /></div>
                    <div style={{ fontSize: '13px', paddingTop: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <span>{monitoringData?.appGroups?.length > 0 ? 'Internet / Social' : 'None yet'}</span>
                        <div style={{ display: 'flex', gap: '15px' }}>
                          <span>{monitoringData?.productivity?.[1]?.full?.split(' ')[0] || '00:00'}</span>
                          <span style={{ color: '#90a4ae' }}>({monitoringData?.productivity?.[1]?.value || 0}%)</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-title">Neutral Application Groups <Activity size={14} color="#9fa8da" /></div>
                    <div style={{ fontSize: '13px', paddingTop: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <span>{monitoringData?.appGroups?.find(g => g.name === 'Others')?.name || 'Others'}</span>
                        <div style={{ display: 'flex', gap: '15px' }}>
                          <span>{monitoringData?.appGroups?.find(g => g.name === 'Others')?.duration || '00:00'}</span>
                          <span style={{ color: '#90a4ae' }}>({monitoringData?.appGroups?.find(g => g.name === 'Others')?.percentage || '0%'})</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="card full-width">
                    <div className="card-title">Productivity Bar
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: '15px', fontSize: '11px', fontWeight: '400', color: '#546e7a' }}>
                        <span><Clock size={12} /> Work Shift 07:00 - 06:55</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#26a69a' }}></div> Productive Time</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef5350' }}></div> Non-Productive Time</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#9fa8da' }}></div> Neutral Time</span>
                      </div>
                    </div>
                    <div style={{ height: '200px', width: '100%' }}>
                      <ResponsiveContainer>
                        <BarChart data={Array.from({ length: 24 }, (_, i) => ({ time: `${12 + i}:00`, value: Math.random() > 0.3 ? 90 : 20 }))}>
                          <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#90a4ae' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#90a4ae' }} tickFormatter={(v) => `${v}%`} />
                          <Bar dataKey="value" fill="#81c784" radius={[2, 2, 0, 0]} barSize={20} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-title">Application Group Break Down</div>
                    <div className="table-responsive">
                      <table className="custom-table">
                        <thead>
                          <tr>
                            <th>Application Group</th>
                            <th>Today</th>
                            <th>Yesterday</th>
                            <th>This Week</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#26a69a' }}></div>
                              Others
                            </td>
                            <td>{monitoringData?.activeTime || '00:00'}</td>
                            <td style={{ color: '#26a69a' }}>100%</td>
                            <td>0s</td>
                            <td style={{ color: '#26a69a' }}>0%</td>
                            <td>{monitoringData?.activeTime || '00:00'}</td>
                            <td style={{ color: '#26a69a' }}>100%</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div className="card-title">Categories Activity</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '20px' }}>
                      {monitoringData?.categories?.length > 0 ? (
                        <>
                          <div style={{ width: '160px', height: '160px' }}>
                            <ResponsiveContainer>
                              <PieChart>
                                <Pie data={monitoringData.categories.map(c => ({ name: c.name, value: parseInt(c.percentage) }))} innerRadius={50} outerRadius={70} dataKey="value" stroke="none">
                                  {monitoringData.categories.map((c, i) => <Cell key={i} fill={['#26a69a', '#ffb74d', '#42a5f5', '#ef5350'][i % 4]} />)}
                                </Pie>
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div style={{ fontSize: '13px', color: '#546e7a' }}>
                            {monitoringData.categories.map((c, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: ['#26a69a', '#ffb74d', '#42a5f5', '#ef5350'][i % 4] }}></div>
                                {c.name} - {c.percentage}
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div style={{ color: '#90a4ae', fontSize: '12px', textAlign: 'center', padding: '40px' }}>No categories data</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : activeTab === 'Time Line' ? (
              <div className="timeline-table-container">
                <div className="timeline-header-extras">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#26a69a' }}></div> Productive Hours</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef5350' }}></div> Non-Productive Hours</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#9fa8da' }}></div> Neutral Hours</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ffea00' }}></div> Idle Hours</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#cfd8dc' }}></div> Away Hours</span>
                  <Download size={16} color="#26a69a" style={{ cursor: 'pointer', marginLeft: '10px' }} />
                </div>
                <div className="table-responsive">
                  <table className="timeline-grid">
                    <thead>
                      <tr>
                        <th className="date-cell">DATE</th>
                        <th>
                          <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '10%', paddingRight: '10%' }}>
                            <span>12PM</span>
                            <span>1PM</span>
                            <span>2PM</span>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(monitoringData?.timeline || []).map((row, i) => (
                        <tr key={i}>
                          <td className="date-cell">{row.date} <span>{row.day}</span></td>
                          <td style={{ padding: '20px 0', position: 'relative' }}>
                            <div style={{ position: 'absolute', left: '10%', top: 0, bottom: 0, width: '1px', background: '#f0f0f0' }}></div>
                            <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '1px', background: '#f0f0f0' }}></div>
                            <div style={{ position: 'absolute', left: '90%', top: 0, bottom: 0, width: '1px', background: '#f0f0f0' }}></div>

                            {row.data && (
                              <div className="timeline-track" style={{ width: '80%', margin: '0 auto', position: 'relative', zIndex: 2, height: '10px', background: '#f5f5f5', borderRadius: '4px', display: 'flex', overflow: 'hidden' }}>
                                {row.segments.map((seg, idx) => (
                                  <div
                                    key={idx}
                                    style={{
                                      width: `${seg.width}%`,
                                      height: '100%',
                                      backgroundColor: seg.type === 'productive' ? '#26a69a' : seg.type === 'non-productive' ? '#ef5350' : '#cfd8dc'
                                    }}
                                    title={seg.type}
                                  ></div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : activeTab === 'Configure Apps' ? (
              <div className="activity-view-content" style={{ padding: '24px', background: 'white' }}>
                <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ margin: '0 0 5px 0', color: '#37474f' }}>Application & Categories Configuration</h3>
                    <p style={{ margin: 0, fontSize: '13px', color: '#78909c' }}>Manage how tracked applications and websites are categorized for {monitoringData?.user?.userName || 'employees'}.</p>
                  </div>
                  <button className="admin-btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: '#26a69a', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '500', fontSize: '13px' }} onClick={() => alert('Save configuration feature coming soon!')}>
                    <Settings size={16} /> Save Mappings
                  </button>
                </div>

                <div className="table-responsive" style={{ border: '1px solid #eee', borderRadius: '8px' }}>
                  <table className="custom-table" style={{ margin: 0, width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa', textAlign: 'left' }}>
                        <th style={{ padding: '15px 20px', borderBottom: '1px solid #eee', color: '#90a4ae', fontWeight: '500', fontSize: '13px' }}>Detected Application / URL</th>
                        <th style={{ padding: '15px 20px', borderBottom: '1px solid #eee', color: '#90a4ae', fontWeight: '500', fontSize: '13px' }}>Rule Type</th>
                        <th style={{ padding: '15px 20px', borderBottom: '1px solid #eee', color: '#90a4ae', fontWeight: '500', fontSize: '13px' }}>Productivity Status</th>
                        <th style={{ padding: '15px 20px', borderBottom: '1px solid #eee', color: '#90a4ae', fontWeight: '500', fontSize: '13px' }}>Category Mapping</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monitoringData?.topApps?.concat(monitoringData?.topSites || [])?.length > 0 ? (
                        [...new Set([...(monitoringData?.topApps || []), ...(monitoringData?.topSites || [])].map(a => a.name))].slice(0, 15).map((appName, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #f5f5f5' }}>
                            <td style={{ padding: '15px 20px', color: '#37474f', fontWeight: '500', fontSize: '13px' }}>{appName}</td>
                            <td style={{ padding: '10px 20px' }}>
                              <select style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '13px', color: '#546e7a' }}>
                                <option>Exact Match</option>
                                <option>Contains</option>
                                <option>Regex</option>
                              </select>
                            </td>
                            <td style={{ padding: '10px 20px' }}>
                              <select style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '13px', color: '#546e7a' }} defaultValue={appName.toLowerCase().includes('youtube') || appName.toLowerCase().includes('facebook') ? 'Non-Productive' : appName.toLowerCase().includes('code') ? 'Productive' : 'Neutral'}>
                                <option value="Productive">Productive</option>
                                <option value="Neutral">Neutral</option>
                                <option value="Non-Productive">Non-Productive</option>
                              </select>
                            </td>
                            <td style={{ padding: '10px 20px' }}>
                              <select style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '13px', color: '#546e7a' }} defaultValue={appName.toLowerCase().includes('code') ? 'Work/Coding' : 'Uncategorized'}>
                                <option value="Work/Coding">Work/Coding</option>
                                <option value="Internet Browsing">Internet Browsing</option>
                                <option value="Social/Entertainment">Social/Entertainment</option>
                                <option value="Uncategorized">Uncategorized</option>
                              </select>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="4" style={{ textAlign: 'center', padding: '30px', color: '#90a4ae' }}>No tracked apps to configure yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : activeTab === 'By Application Groups' ? (
              <div className="activity-view-content">
                <div className="table-header-controls">
                  <input type="text" placeholder="Search" className="config-search-input" style={{ maxWidth: '200px' }} />
                  <select className="config-search-input" style={{ maxWidth: '100px' }}><option>All</option></select>
                </div>
                <div className="table-responsive">
                  <table className="custom-table">
                    <thead>
                      <tr style={{ background: '#f8f9fa' }}>
                        <th style={{ background: 'transparent' }}>Application Group</th>
                        <th style={{ background: 'transparent' }}>Duration</th>
                        <th style={{ background: 'transparent' }}>Percentage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monitoringData?.appGroups?.length > 0 ? (
                        monitoringData.appGroups.slice((appGroupsPage - 1) * itemsPerPage, appGroupsPage * itemsPerPage).map((group, idx) => (
                          <tr key={idx}>
                            <td style={{ color: '#546e7a' }}>{group.name}</td>
                            <td>{group.duration}</td>
                            <td>{group.percentage}</td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan="3" style={{ textAlign: 'center', padding: '20px' }}>No group data found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <PaginationControls
                  currentPage={appGroupsPage}
                  totalItems={monitoringData?.appGroups?.length || 0}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setAppGroupsPage}
                />
              </div>
            ) : activeTab === 'By Categories' ? (
              <div className="activity-view-content">
                <div className="table-header-controls">
                  <input type="text" placeholder="Search" className="config-search-input" style={{ maxWidth: '150px' }} />
                </div>
                <div className="table-responsive">
                  <table className="custom-table">
                    <thead>
                      <tr style={{ background: '#f8f9fa' }}>
                        <th style={{ background: 'transparent' }}>Category</th>
                        <th style={{ background: 'transparent' }}>Duration</th>
                        <th style={{ background: 'transparent' }}>Percentage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monitoringData?.categories?.length > 0 ? (
                        monitoringData.categories.slice((categoriesPage - 1) * itemsPerPage, categoriesPage * itemsPerPage).map((cat, idx) => (
                          <tr key={idx}>
                            <td style={{ color: '#546e7a' }}>{cat.name}</td>
                            <td>{cat.duration}</td>
                            <td>{cat.percentage}</td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan="3" style={{ textAlign: 'center', padding: '20px' }}>No category data found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <PaginationControls
                  currentPage={categoriesPage}
                  totalItems={monitoringData?.categories?.length || 0}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCategoriesPage}
                />
              </div>
            ) : activeTab === 'Websites Visited' ? (
              <div className="activity-view-content">
                <div className="table-header-controls">
                  <input type="text" placeholder="Search" className="config-search-input" style={{ maxWidth: '150px' }} />
                  <select className="config-search-input" style={{ maxWidth: '100px' }}><option>All</option></select>
                </div>
                <div className="table-responsive">
                  <table className="custom-table">
                    <thead>
                      <tr style={{ background: '#f8f9fa' }}>
                        <th style={{ background: 'transparent' }}>Domain/Source</th>
                        <th style={{ background: 'transparent' }}>Page Title/URL</th>
                        <th style={{ background: 'transparent' }}>Group</th>
                        <th style={{ background: 'transparent' }}>Duration</th>
                        <th style={{ background: 'transparent' }}>Percentage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monitoringData?.topSites?.length > 0 ? (
                        monitoringData.topSites.slice((websitesPage - 1) * itemsPerPage, websitesPage * itemsPerPage).map((site, i) => (
                          <tr key={i}>
                            <td style={{ color: '#263238', fontWeight: '500' }}>{site.name}</td>
                            <td style={{ color: '#546e7a', fontSize: '12px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={site.fullTitle}>
                              {site.fullTitle}
                            </td>
                            <td>
                              <span style={{
                                padding: '3px 8px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: '600',
                                background: site.group === 'Productive' ? '#e0f2f1' : site.group === 'Non-Productive' ? '#ffebee' : '#f5f5f5',
                                color: site.group === 'Productive' ? '#00897b' : site.group === 'Non-Productive' ? '#c62828' : '#757575'
                              }}>
                                {site.group}
                              </span>
                            </td>
                            <td style={{ fontWeight: '600' }}>{site.full}</td>
                            <td>{site.perc}</td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan="5" style={{ textAlign: 'center', padding: '10px' }}>No websites visited yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <PaginationControls
                  currentPage={websitesPage}
                  totalItems={monitoringData?.topSites?.length || 0}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setWebsitesPage}
                />
              </div>
            ) : activeTab === 'Applications Used' ? (
              <div className="activity-view-content">
                <div className="table-header-controls">
                  <input type="text" placeholder="Search" className="config-search-input" style={{ maxWidth: '150px' }} />
                  <select className="config-search-input" style={{ maxWidth: '100px' }}><option>All</option></select>
                </div>
                <div className="table-responsive">
                  <table className="custom-table">
                    <thead>
                      <tr style={{ background: '#f8f9fa' }}>
                        <th style={{ background: 'transparent' }}>Application</th>
                        <th style={{ background: 'transparent' }}>Activity/Title</th>
                        <th style={{ background: 'transparent' }}>Group</th>
                        <th style={{ background: 'transparent' }}>Duration</th>
                        <th style={{ background: 'transparent' }}>Percentage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monitoringData?.topApps?.length > 0 ? (
                        monitoringData.topApps.slice((appsPage - 1) * itemsPerPage, appsPage * itemsPerPage).map((app, i) => (
                          <tr key={i}>
                            <td style={{ color: '#263238', fontWeight: '500' }}>{app.name}</td>
                            <td style={{ color: '#546e7a', fontSize: '12px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={app.title}>
                              {app.title || 'Main Window'}
                            </td>
                            <td>
                              <span style={{
                                padding: '3px 8px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: '600',
                                background: app.group === 'Productive' ? '#e0f2f1' : app.group === 'Non-Productive' ? '#ffebee' : '#f5f5f5',
                                color: app.group === 'Productive' ? '#00897b' : app.group === 'Non-Productive' ? '#c62828' : '#757575'
                              }}>
                                {app.group}
                              </span>
                            </td>
                            <td style={{ fontWeight: '600' }}>{app.full}</td>
                            <td>{app.perc}</td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan="5" style={{ textAlign: 'center', padding: '10px' }}>No data</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <PaginationControls
                  currentPage={appsPage}
                  totalItems={monitoringData?.topApps?.length || 0}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setAppsPage}
                />
              </div>
            ) : activeTab === 'Detailed Activity' ? (
              <div className="activity-view-content">
                <div className="table-header-controls">
                  <input type="text" placeholder="Search" className="config-search-input" style={{ maxWidth: '150px' }} />
                  <select className="config-search-input" style={{ maxWidth: '100px' }}><option>All</option></select>
                </div>
                <div className="table-responsive">
                  <table className="custom-table detailed-table">
                    <thead>
                      <tr style={{ background: '#f8f9fa' }}>
                        <th style={{ background: 'transparent' }}>Producti...</th>
                        <th style={{ background: 'transparent' }}>Date</th>
                        <th style={{ background: 'transparent' }}>Computer</th>
                        <th style={{ background: 'transparent' }}>Employee Id</th>
                        <th style={{ background: 'transparent' }}>User</th>
                        <th style={{ background: 'transparent' }}>Role</th>
                        <th style={{ background: 'transparent' }}>Duration</th>
                        <th style={{ background: 'transparent' }}>Inactive ...</th>
                        <th style={{ background: 'transparent' }}>Title</th>
                        <th style={{ background: 'transparent' }}>Description</th>
                        <th style={{ background: 'transparent' }}>Idle Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monitoringData?.rawActivities?.length > 0 ? (
                        monitoringData.rawActivities.slice().reverse().slice((detailedPage - 1) * itemsPerPage, detailedPage * itemsPerPage).map((act, i) => (
                          <tr key={i}>
                            <td><div className="status-circle" style={{ background: '#4db6ac', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}><ChevronDown size={10} color="white" style={{ transform: 'rotate(-135deg) translate(-1px, 1px)' }} /></div></td>
                            <td style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>
                              {new Date(act.timestamp).toLocaleDateString()}<br />
                              <span style={{ color: '#90a4ae' }}>{new Date(act.timestamp).toLocaleTimeString()}</span>
                            </td>
                            <td style={{ color: '#546e7a' }}>{monitoringData?.user?.computerName || 'PC'}</td>
                            <td style={{ color: '#546e7a' }}>{monitoringData?.user?.employeeId || 'ID'}</td>
                            <td style={{ color: '#546e7a' }}>{monitoringData?.user?.userName || 'User'}</td>
                            <td style={{ color: '#546e7a' }}>User</td>
                            <td>00:00:10</td>
                            <td>0 Mins</td>
                            <td style={{ color: '#546e7a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' }}>{act.application}</td>
                            <td style={{ color: '#546e7a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' }}>{act.website || act.application}</td>
                            <td>No</td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan="11" style={{ textAlign: 'center', padding: '20px' }}>No activity data available</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <PaginationControls
                  currentPage={detailedPage}
                  totalItems={monitoringData?.rawActivities?.length || 0}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setDetailedPage}
                />
              </div>
            ) : activeTab === 'Screenshots' ? (
              <div className="monitoring-layout">
                <div style={{ display: 'flex', borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '20px', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '13px', color: '#546e7a', fontWeight: '500' }}>Screenshots for {monitoringData?.user?.userName || '...'}</div>
                  <div className="size-slider">
                    {['Tiny', 'Small', 'Medium', 'Large'].map((size) => (
                      <span
                        key={size}
                        style={{
                          fontSize: '10px',
                          color: screenshotSize === size ? '#26a69a' : '#90a4ae',
                          cursor: 'pointer',
                          fontWeight: screenshotSize === size ? 'bold' : '400',
                          padding: '0 5px'
                        }}
                        onClick={() => setScreenshotSize(size)}
                      >
                        {size}
                      </span>
                    ))}
                    <div className="slider-track" style={{ width: '80px', margin: '0 10px' }}>
                      <div className="slider-node" style={{ left: '0%', background: screenshotSize === 'Tiny' ? '#26a69a' : 'white' }} onClick={() => setScreenshotSize('Tiny')}></div>
                      <div className="slider-node" style={{ left: '33%', background: screenshotSize === 'Small' ? '#26a69a' : 'white' }} onClick={() => setScreenshotSize('Small')}></div>
                      <div className="slider-node" style={{ left: '66%', background: screenshotSize === 'Medium' ? '#26a69a' : 'white' }} onClick={() => setScreenshotSize('Medium')}></div>
                      <div className="slider-node" style={{ left: '100%', background: screenshotSize === 'Large' ? '#26a69a' : 'white' }} onClick={() => setScreenshotSize('Large')}></div>
                    </div>
                  </div>
                </div>

                {screenshots.length > 0 ? screenshots.map((section, idx) => (
                  <div className="screenshot-section" key={idx}>
                    <div className="screenshot-time-label">{section.label}</div>
                    <div className="screenshot-grid" style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(auto-fill, minmax(${screenshotSize === 'Large' ? '280px' :
                        screenshotSize === 'Medium' ? '200px' :
                          screenshotSize === 'Small' ? '150px' : '100px'
                        }, 1fr))`,
                      gap: '15px',
                      flex: 1
                    }}>
                      {section.shots.map((shot, i) => {
                        const isReal = typeof shot === 'object';
                        const timeLabel = isReal ? shot.time : shot;
                        const imageUrl = isReal ? (shot.url.startsWith('http') ? shot.url : `http://103.181.108.248${shot.url}`) : `https://picsum.photos/id/${(idx * 15) + i + 25}/400/225`;

                        return (
                          <div className="screenshot-card" key={i} style={{ width: '100%', cursor: 'pointer' }} onClick={() => window.open(imageUrl, '_blank')}>
                            <div className="screenshot-thumb" style={{ height: screenshotSize === 'Tiny' ? '60px' : 'auto' }}>
                              <img src={imageUrl} alt="Screen" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                            {screenshotSize !== 'Tiny' && (
                              <div className="screenshot-info">
                                <span style={{ fontWeight: '500' }}>{monitoringData?.user?.userName || '...'}</span>
                                <span style={{ color: '#90a4ae' }}>{timeLabel} IST</span>
                              </div>
                            )}
                            {screenshotSize === 'Tiny' && (
                              <div style={{ textAlign: 'center', fontSize: '9px', padding: '2px', color: '#90a4ae' }}>{timeLabel}</div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )) : (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#90a4ae' }}>
                    <Monitor size={48} color="#e0e0e0" style={{ marginBottom: '10px' }} />
                    <p>No screenshots captured yet for {monitoringData?.user?.userName || '...'}.</p>
                  </div>
                )}
              </div>
            ) : activeTab === 'Screen Recordings' ? (
              <div className="activity-view-content" style={{ background: 'white', padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '16px', color: '#37474f', margin: 0 }}>Recent Recordings for {monitoringData?.user?.userName || '...'}</h3>
                  <button className="admin-btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: '#26a69a', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '500', fontSize: '13px' }} onClick={() => alert('Start manual recording logic would go here.')}>
                    <Monitor size={16} /> Start Recording
                  </button>
                </div>
                <div className="table-responsive" style={{ border: '1px solid #eee', borderRadius: '8px' }}>
                  <table className="custom-table" style={{ margin: 0, width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa', textAlign: 'left' }}>
                        <th style={{ padding: '15px 20px', borderBottom: '1px solid #eee', color: '#90a4ae', fontWeight: '500', fontSize: '13px' }}>Preview</th>
                        <th style={{ padding: '15px 20px', borderBottom: '1px solid #eee', color: '#90a4ae', fontWeight: '500', fontSize: '13px' }}>Recording ID</th>
                        <th style={{ padding: '15px 20px', borderBottom: '1px solid #eee', color: '#90a4ae', fontWeight: '500', fontSize: '13px' }}>Date & Time</th>
                        <th style={{ padding: '15px 20px', borderBottom: '1px solid #eee', color: '#90a4ae', fontWeight: '500', fontSize: '13px' }}>Duration</th>
                        <th style={{ padding: '15px 20px', borderBottom: '1px solid #eee', color: '#90a4ae', fontWeight: '500', fontSize: '13px' }}>File Size</th>
                        <th style={{ padding: '15px 20px', borderBottom: '1px solid #eee', color: '#90a4ae', fontWeight: '500', fontSize: '13px' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recordings.length > 0 ? recordings.map((rec, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f5f5f5' }}>
                          <td style={{ padding: '10px 20px' }}>
                            <div style={{ width: '80px', height: '45px', background: '#e0e0e0', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }} onClick={() => alert('Play video: ' + rec.id)}>
                              <Tv size={16} color="#757575" />
                              <div style={{ position: 'absolute', bottom: '2px', right: '4px', background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '9px', padding: '1px 3px', borderRadius: '2px' }}>{rec.duration}</div>
                            </div>
                          </td>
                          <td style={{ padding: '15px 20px', fontWeight: '500', color: '#546e7a', fontSize: '13px' }}>{rec.id}</td>
                          <td style={{ padding: '15px 20px', color: '#546e7a', fontSize: '13px' }}>{rec.timestamp}</td>
                          <td style={{ padding: '15px 20px', fontWeight: '600', color: '#263238', fontSize: '13px' }}>{rec.duration}</td>
                          <td style={{ padding: '15px 20px', color: '#546e7a', fontSize: '13px' }}>{rec.size}</td>
                          <td style={{ padding: '15px 20px' }}>
                            <span style={{ color: '#26a69a', cursor: 'pointer', fontWeight: '500', fontSize: '13px' }} onClick={() => alert('Play video: ' + rec.id)}>Play Video</span>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: '#90a4ae' }}>
                            <Monitor size={48} color="#e0e0e0" style={{ marginBottom: '10px' }} />
                            <p>No screen recordings available for {monitoringData?.user?.userName || '...'}.</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : activeTab === 'Activity Levels' ? (
              <div className="activity-view-content" style={{ background: 'white' }}>
                <div className="activity-chart-container">
                  <h3 style={{ fontSize: '14px', color: '#546e7a', textAlign: 'center', marginBottom: '15px' }}>Activity Level Chart</h3>
                  <div style={{ height: '200px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                      <BarChart data={activityData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                        <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#90a4ae' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#90a4ae' }} />
                        <Tooltip />
                        <Bar dataKey="keys" name="Key Strokes" fill="#4db6ac" stackId="a" />
                        <Bar dataKey="clicks" name="Mouse Clicks" fill="#80cbc4" stackId="a" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '10px', fontSize: '11px', color: '#546e7a' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '8px', height: '8px', background: '#4db6ac' }}></div> Key Strokes</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '8px', height: '8px', background: '#80cbc4' }}></div> Mouse Clicks</div>
                  </div>
                </div>
                <div className="table-responsive">
                  <table className="custom-table">
                    <thead>
                      <tr style={{ background: '#f8f9fa' }}>
                        <th style={{ background: 'transparent' }}>Productivity</th>
                        <th style={{ background: 'transparent' }}>Date <ChevronDown size={10} style={{ display: 'inline' }} /></th>
                        <th style={{ background: 'transparent' }}>Duration</th>
                        <th style={{ background: 'transparent' }}>Title</th>
                        <th style={{ background: 'transparent' }}>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monitoringData?.rawActivities?.length > 0 ? (
                        monitoringData.rawActivities.slice().reverse().slice((detailedPage - 1) * itemsPerPage, detailedPage * itemsPerPage).map((act, i) => (
                          <tr key={i}>
                            <td><div className="status-circle" style={{ background: '#4db6ac', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}><ChevronDown size={10} color="white" style={{ transform: 'rotate(-135deg) translate(-1px, 1px)' }} /></div></td>
                            <td style={{ color: '#546e7a', fontSize: '12px' }}>{new Date(act.timestamp).toLocaleDateString()}<br />{new Date(act.timestamp).toLocaleTimeString()}</td>
                            <td style={{ color: '#546e7a', fontSize: '12px' }}>00:00:10</td>
                            <td style={{ color: '#546e7a', fontSize: '12px', fontWeight: '500' }}>{act.application || 'Unknown Application'}</td>
                            <td style={{ color: '#d84315', fontSize: '12px', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={act.website || act.windowTitle || act.application}>{act.website || act.windowTitle || act.application || '-'}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: '#90a4ae' }}>No activity data available</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <PaginationControls
                  currentPage={detailedPage}
                  totalItems={monitoringData?.rawActivities?.length || 0}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setDetailedPage}
                />
              </div>
            ) : activeTab === 'Profile' ? (
              <div className="activity-view-content" style={{ background: '#f5f7f9', padding: '0' }}>
                <div style={{ background: 'white', padding: '30px', borderBottom: '1px solid #eee', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
                    <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'linear-gradient(135deg, #00897b, #4db6ac)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '36px', boxShadow: '0 4px 12px rgba(38,166,154,0.3)' }}>
                      {monitoringData?.user?.userName?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div>
                      <h2 style={{ fontSize: '24px', color: '#263238', marginBottom: '4px' }}>{monitoringData?.user?.userName || 'User Profile'}</h2>
                      <p style={{ color: '#90a4ae', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}><Globe size={14} /> Organization: Hado Tech</p>
                      <div style={{ marginTop: '12px', display: 'flex', gap: '10px' }}>
                        <span style={{ background: '#e0f2f1', color: '#00897b', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>Admin Account</span>
                        <span style={{ background: '#fff3e0', color: '#fb8c00', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>Pro Plan</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="content-grid" style={{ padding: '0 24px 24px' }}>
                  <div className="card">
                    <div className="card-title">Personal Information <Settings size={14} style={{ marginLeft: 'auto', cursor: 'pointer' }} /></div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px', marginTop: '10px' }}>
                      <div className="config-row" style={{ border: 'none', padding: '8px 0' }}>
                        <span style={{ color: '#90a4ae', fontSize: '13px' }}>Employee ID</span>
                        <span style={{ color: '#263238', fontWeight: '500' }}>{monitoringData?.user?.employeeId || 'EMP-001'}</span>
                      </div>
                      <div className="config-row" style={{ border: 'none', padding: '8px 0' }}>
                        <span style={{ color: '#90a4ae', fontSize: '13px' }}>Email Address</span>
                        <span style={{ color: '#263238', fontWeight: '500' }}>{monitoringData?.user?.email || 'admin@hado.com'}</span>
                      </div>
                      <div className="config-row" style={{ border: 'none', padding: '8px 0' }}>
                        <span style={{ color: '#90a4ae', fontSize: '13px' }}>Computer Name</span>
                        <span style={{ color: '#263238', fontWeight: '500' }}>{monitoringData?.user?.computerName || 'DELL-WORKSTATION'}</span>
                      </div>
                      <div className="config-row" style={{ border: 'none', padding: '8px 0' }}>
                        <span style={{ color: '#90a4ae', fontSize: '13px' }}>Working Since</span>
                        <span style={{ color: '#263238', fontWeight: '500' }}>Jan 12, 2024</span>
                      </div>
                    </div>
                    <button className="admin-btn-secondary" style={{ marginTop: '20px', width: '100%', justifyContent: 'center' }}>Edit Profile</button>
                  </div>

                  <div className="card">
                    <div className="card-title">Security & Access</div>
                    <div style={{ marginTop: '10px' }}>
                      <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                        <div style={{ color: '#263238', fontWeight: '600', fontSize: '14px', marginBottom: '4px' }}>Two-Factor Authentication</div>
                        <div style={{ color: '#90a4ae', fontSize: '12px', marginBottom: '10px' }}>Protect your account with an extra layer of security.</div>
                        <button className="admin-btn-primary" style={{ padding: '4px 12px', fontSize: '11px' }}>Enable 2FA</button>
                      </div>
                      <div className="config-row">
                        <span style={{ color: '#546e7a', fontSize: '13px' }}>Last Password Change</span>
                        <span style={{ color: '#90a4ae', fontSize: '12px' }}>3 months ago</span>
                      </div>
                      <div className="config-row">
                        <span style={{ color: '#546e7a', fontSize: '13px' }}>Active Sessions</span>
                        <span style={{ color: '#00897b', fontSize: '12px' }}>2 devices online</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : activeTab === 'Configuration' ? (
              <div className="activity-view-content" style={{ background: '#f5f7f9', padding: '24px' }}>
                <div style={{ marginBottom: '24px' }}>
                  <h2 style={{ fontSize: '18px', color: '#263238', marginBottom: '4px' }}>Global Configuration</h2>
                  <p style={{ color: '#90a4ae', fontSize: '13px' }}>Set organization-wide tracking policies and system behaviors.</p>
                </div>

                <div className="config-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
                  <div className="card">
                    <div className="card-title">Tracking Modes</div>
                    <div style={{ marginBottom: '20px', background: '#e0f2f1', padding: '12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Info size={20} color="#00897b" />
                      <span style={{ fontSize: '12px', color: '#00695c' }}>Interactive mode allows employees to manually start/pause their tracking.</span>
                    </div>
                    <Switch label="Allow Pause Tracking" description="Users can pause tracking during breaks" checked />
                    <Switch label="Show Work Timer" description="Display the floating timer on desktop" checked />
                    <Switch label="Auto-Stop on Shutdown" description="Complete shift automatically when PC turns off" checked />
                    <Switch label="Select Tasks" description="Require task selection before starting work" />
                  </div>

                  <div className="card">
                    <div className="card-title">Screenshot Settings</div>
                    <Switch label="Enable Screenshots" description="Capture employee screens at intervals" checked />
                    <div className="config-row">
                      <div className="config-label-group">
                        <span style={{ fontSize: '13px', color: '#546e7a' }}>Frequency</span>
                        <span className="config-desc">How often to capture a screenshot</span>
                      </div>
                      <select
                        className="config-search-input"
                        style={{ width: '150px' }}
                        value={monitoringData?.user?.screenshotInterval ? `Every ${monitoringData.user.screenshotInterval / 60} Minutes` : 'Every 1 Minute'}
                        onChange={async (e) => {
                          const val = e.target.value.split(' ')[1];
                          const seconds = parseInt(val) * 60;
                          const updated = await updateUser(selectedUserId, { screenshotInterval: seconds });
                          if (updated) {
                            setUsersList(usersList.map(u => u.id === updated.id ? updated : u));
                            setMonitoringData({ ...monitoringData, user: updated });
                          }
                        }}
                      >
                        <option value="Every 1 Minutes">Every 1 Minute</option>
                        <option value="Every 5 Minutes">Every 5 Minutes</option>
                        <option value="Every 10 Minutes">Every 10 Minutes</option>
                        <option value="Every 30 Minutes">Every 30 Minutes</option>
                      </select>
                    </div>
                    <Switch label="Blur Screenshots" description="Apply privacy blur to captured images" />
                    <Switch label="Dual Monitor Support" description="Capture all connected displays" checked />
                  </div>

                  <div className="card">
                    <div className="card-title">Privacy & Security</div>
                    <Switch label="Stealth Mode" description="Agent runs hidden in background (IT Admin only)" />
                    <Switch label="Collect Window Titles" description="Capture the active window text" checked />
                    <Switch label="Track Mouse & Keys" description="Calculate activity level metrics" checked />
                    <Switch label="GDPR Compliance Mode" description="Anonymize sensitive data in reports" />
                  </div>

                  <div className="card">
                    <div className="card-title">Notifications</div>
                    <Switch label="Productivity Alerts" description="Notify users of low productivity" checked />
                    <Switch label="Daily Email Summary" description="Send automated reports to managers" checked />
                    <Switch label="Late Login Alerts" description="Notify HR of delayed shift starts" />
                  </div>
                </div>
                <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button className="admin-btn-secondary">Reset to Default</button>
                  <button className="admin-btn-primary" style={{ padding: '10px 24px' }}>Save All Changes</button>
                </div>
              </div>
            ) : activeTab === 'Users' ? (
              <div className="activity-view-content" style={{ background: 'white' }}>
                <div className="table-header-controls">
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="admin-btn-primary" onClick={() => alert('New user registration flow would open here.')}><PlusCircle size={14} /> Add User</button>
                    <button className="admin-btn-secondary">Active <ChevronDown size={12} /></button>
                  </div>
                  <input type="text" placeholder="Search for user..." className="config-search-input" style={{ maxWidth: '300px' }} />
                </div>
                <div className="table-responsive" style={{ border: '1px solid #eee', borderRadius: '8px' }}>
                  <table className="custom-table" style={{ margin: 0 }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa' }}>
                        <th style={{ padding: '15px' }}>Employee Id</th>
                        <th style={{ padding: '15px' }}>Name / User Name</th>
                        <th style={{ padding: '15px' }}>Computer Details</th>
                        <th style={{ padding: '15px' }}>Role</th>
                        <th style={{ padding: '15px' }}>Status</th>
                        <th style={{ padding: '15px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usersList && usersList.length > 0 ? (
                        usersList.map(user => (
                          <tr
                            key={user.id}
                            style={{ cursor: 'pointer', background: selectedUserId === user.id ? '#f0fdfa' : 'white', transition: '0.2s' }}
                            onClick={() => setSelectedUserId(user.id)}
                          >
                            <td style={{ padding: '15px', color: '#546e7a', fontWeight: '500' }}>{user.employeeId || user.id}</td>
                            <td style={{ padding: '15px' }}>
                              <div style={{ color: '#d84315', fontWeight: '600' }}>{user.userName}</div>
                              <div style={{ fontSize: '11px', color: '#90a4ae' }}>{user.email || 'N/A'}</div>
                            </td>
                            <td style={{ padding: '15px', color: '#37474f' }}>
                              <Monitor size={14} style={{ verticalAlign: 'middle', marginRight: '6px', color: '#78909c' }} />
                              {user.computerName || 'N/A'}
                            </td>
                            <td style={{ padding: '15px', color: '#546e7a' }}>{user.role || 'Agent User'}</td>
                            <td style={{ padding: '15px' }}><span style={{ background: '#e0f2f1', color: '#00897b', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>Active</span></td>
                            <td style={{ padding: '15px' }}>
                              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                <span
                                  style={{ color: '#26a69a', fontWeight: '500', cursor: 'pointer' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setUserToEdit({ ...user });
                                    setShowEditUserModal(true);
                                  }}
                                >
                                  Edit
                                </span>
                                <span
                                  style={{ color: '#ef5350', fontWeight: '500', cursor: 'pointer' }}
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (window.confirm(`Are you sure you want to delete ${user.userName}?`)) {
                                      const res = await deleteUser(user.id);
                                      if (res && res.deleted) {
                                        setUsersList(usersList.filter(u => u.id !== user.id));
                                        if (selectedUserId === user.id) setSelectedUserId(null);
                                      }
                                    }
                                  }}
                                >
                                  Delete
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#90a4ae' }}>No agent users registered yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : activeTab === 'Teams' || activeTab === 'Departments' ? (
              <div className="activity-view-content" style={{ background: '#f5f7f9', padding: '24px' }}>
                <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2 style={{ fontSize: '18px', color: '#263238', marginBottom: '4px' }}>{activeTab} Management</h2>
                    <p style={{ color: '#90a4ae', fontSize: '13px' }}>Manage {activeTab.toLowerCase()} and assign leaders.</p>
                  </div>
                  <button className="admin-btn-primary">
                    <PlusCircle size={14} style={{ marginRight: '6px' }} /> Create {activeTab === 'Teams' ? 'New Team' : 'Department'}
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                  {((activeTab === 'Teams' && monitoringData?.teams?.length > 0) ? (
                    monitoringData.teams.map((team, i) => ({
                      name: team.name,
                      members: team.memberCount || 0,
                      lead: team.leadName || 'System Admin',
                      efficiency: '90%'
                    }))
                  ) : (activeTab === 'Teams' ? (
                    [
                      { name: 'Core Product', members: usersList.length || 3, lead: 'Alex Johnson', efficiency: '94%' },
                      { name: 'Infrastructure', members: 2, lead: 'Sarah Chen', efficiency: '88%' },
                      { name: 'Customer Success', members: 5, lead: 'Michael Ross', efficiency: '91%' },
                      { name: 'Design Studio', members: 4, lead: 'Emma Vance', efficiency: '96%' }
                    ]
                  ) : (activeTab === 'Departments' && monitoringData?.departments?.length > 0) ? (
                    monitoringData.departments.map((dept, i) => ({
                      name: dept.name,
                      members: dept.memberCount || 0,
                      head: dept.headName || 'Dept Head',
                      budget: 'Medium'
                    }))
                  ) : (
                    [
                      { name: 'Engineering', members: usersList.length || 8, head: 'David Wright', budget: 'High' },
                      { name: 'Marketing', members: 12, head: 'Jessica Alba', budget: 'Medium' },
                      { name: 'Human Resources', members: 4, head: 'Robert Ford', budget: 'Low' },
                      { name: 'Finance', members: 6, head: 'Linda Grey', budget: 'Medium' }
                    ]
                  ))).map((item, i) => (
                    <div className="card" key={i} style={{ borderLeft: '4px solid #26a69a' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <div style={{ fontWeight: '700', color: '#263238', fontSize: '15px' }}>{item.name}</div>
                        <Settings size={14} color="#90a4ae" style={{ cursor: 'pointer' }} />
                      </div>
                      <div style={{ fontSize: '13px', color: '#546e7a', marginBottom: '8px' }}>
                        <strong>{activeTab === 'Teams' ? 'Lead' : 'Head'}:</strong> {item.lead || item.head}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <Users size={14} color="#90a4ae" />
                        <span style={{ fontSize: '13px', color: '#546e7a' }}>{item.members} Active Members</span>
                      </div>
                      <div style={{ background: '#f8f9fa', padding: '10px', borderRadius: '4px', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '11px', color: '#90a4ae' }}>{activeTab === 'Teams' ? 'Efficiency Score' : 'Resources'}</span>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#26a69a' }}>{item.efficiency || item.budget}</span>
                      </div>
                      <button className="admin-btn-secondary" style={{ marginTop: '15px', width: '100%', fontSize: '11px' }}>Manage Group</button>
                    </div>
                  ))}
                </div>
              </div>
            ) : activeTab === 'Advanced' ? (
              <div className="activity-view-content" style={{ background: '#f5f7f9', padding: '24px' }}>
                <div style={{ marginBottom: '24px' }}>
                  <h2 style={{ fontSize: '18px', color: '#263238', marginBottom: '4px' }}>Advanced Administration</h2>
                  <p style={{ color: '#90a4ae', fontSize: '13px' }}>System health, logs, and developer configurations.</p>
                </div>

                <div className="config-container" style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px' }}>
                  <div className="card">
                    <div className="card-title">System Status</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', color: '#546e7a' }}>Backend API</span>
                        <span style={{ background: '#e0f2f1', color: '#00897b', padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold' }}>ONLINE</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', color: '#546e7a' }}>Database</span>
                        <span style={{ background: '#e0f2f1', color: '#00897b', padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold' }}>STABLE</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', color: '#546e7a' }}>Storage Used</span>
                        <span style={{ fontSize: '12px', color: '#263238' }}>1.2 GB / 50 GB</span>
                      </div>
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-title">API Management</div>
                    <div style={{ background: '#fff9c4', padding: '12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                      <Activity size={20} color="#fbc02d" />
                      <span style={{ fontSize: '12px', color: '#f57f17' }}>Developer API access allows you to pull activity data into 3rd party apps.</span>
                    </div>
                    <div style={{ border: '1px solid #eee', padding: '15px', borderRadius: '8px' }}>
                      <div style={{ color: '#90a4ae', fontSize: '11px', marginBottom: '8px', textTransform: 'uppercase' }}>Current API Key</div>
                      <div style={{ background: '#f5f7f9', padding: '8px 12px', borderRadius: '4px', fontSize: '13px', color: '#37474f', fontFamily: 'monospace', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        ************************8x9f2
                        <button className="admin-btn-secondary" style={{ padding: '2px 8px', fontSize: '10px' }}>Show</button>
                      </div>
                    </div>
                    <button className="admin-btn-primary" style={{ marginTop: '20px' }}>Regenerate API Key</button>
                  </div>
                </div>
              </div>
            ) : activeTab === 'Configure Apps' ? (
              <ConfigureApps />
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', color: '#90a4ae' }}>
                Content for {activeTab} is under construction...
              </div>
            )}
          </div>
        )}

      </main>

      {showClaimModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            background: 'white',
            width: '450px',
            borderRadius: '8px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '20px',
              borderBottom: '1px solid #eee',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#f8f9fa'
            }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#263238' }}>Add Manual Time Claim</h3>
              <X
                size={20}
                color="#90a4ae"
                style={{ cursor: 'pointer' }}
                onClick={() => setShowClaimModal(false)}
              />
            </div>
            <div style={{ padding: '24px' }}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#546e7a', marginBottom: '8px' }}>Claim Date</label>
                <input
                  type="date"
                  value={newClaim.date}
                  onChange={(e) => setNewClaim({ ...newClaim, date: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '14px' }}
                />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#546e7a', marginBottom: '8px' }}>Duration (HH:MM)</label>
                <input
                  type="text"
                  placeholder="e.g. 01:30"
                  value={newClaim.duration}
                  onChange={(e) => setNewClaim({ ...newClaim, duration: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '14px' }}
                />
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#546e7a', marginBottom: '8px' }}>Reason for Manual Claim</label>
                <textarea
                  rows="3"
                  placeholder="Explain why this time wasn't tracked automatically..."
                  value={newClaim.reason}
                  onChange={(e) => setNewClaim({ ...newClaim, reason: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '14px', resize: 'vertical' }}
                ></textarea>
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  style={{ padding: '10px 20px', borderRadius: '4px', border: '1px solid #ddd', background: 'white', color: '#37474f', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}
                  onClick={() => setShowClaimModal(false)}
                >
                  Cancel
                </button>
                <button
                  style={{ padding: '10px 20px', borderRadius: '4px', border: 'none', background: '#26a69a', color: 'white', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
                  onClick={async () => {
                    if (newClaim.date && newClaim.duration && newClaim.reason) {
                      const claim = {
                        userId: selectedUserId,
                        claimDate: newClaim.date,
                        duration: newClaim.duration + ' Hrs',
                        reason: newClaim.reason,
                        status: 'Pending'
                      };
                      const saved = await addTimeClaim(claim);
                      if (saved) {
                        setManualClaims([saved, ...manualClaims]);
                        setShowClaimModal(false);
                        setNewClaim({ date: '', duration: '', reason: '' });
                      }
                    } else {
                      alert('Please fill all fields');
                    }
                  }}
                >
                  Submit Claim
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditUserModal && userToEdit && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: 'white', width: '500px', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8f9fa' }}>
              <h3 style={{ margin: 0, fontSize: '16px' }}>Edit User: {userToEdit.userName}</h3>
              <X size={20} color="#90a4ae" style={{ cursor: 'pointer' }} onClick={() => setShowEditUserModal(false)} />
            </div>
            <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#546e7a', marginBottom: '5px' }}>Full Name</label>
                <input type="text" value={userToEdit.name || ''} onChange={(e) => setUserToEdit({ ...userToEdit, name: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#546e7a', marginBottom: '5px' }}>Email</label>
                <input type="email" value={userToEdit.email || ''} onChange={(e) => setUserToEdit({ ...userToEdit, email: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#546e7a', marginBottom: '5px' }}>Employee ID</label>
                <input type="text" value={userToEdit.employeeId || ''} onChange={(e) => setUserToEdit({ ...userToEdit, employeeId: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#546e7a', marginBottom: '5px' }}>Role</label>
                <input type="text" value={userToEdit.role || ''} onChange={(e) => setUserToEdit({ ...userToEdit, role: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#546e7a', marginBottom: '5px' }}>Department</label>
                <input type="text" value={userToEdit.department || ''} onChange={(e) => setUserToEdit({ ...userToEdit, department: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#546e7a', marginBottom: '5px' }}>Team</label>
                <input type="text" value={userToEdit.team || ''} onChange={(e) => setUserToEdit({ ...userToEdit, team: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
              </div>
              <div style={{ gridColumn: 'span 2', display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button style={{ padding: '8px 16px', borderRadius: '4px', border: '1px solid #ddd', background: 'white' }} onClick={() => setShowEditUserModal(false)}>Cancel</button>
                <button style={{ padding: '8px 16px', borderRadius: '4px', border: 'none', background: '#26a69a', color: 'white' }} onClick={async () => {
                  const updated = await updateUser(userToEdit.id, userToEdit);
                  if (updated) {
                    setUsersList(usersList.map(u => u.id === updated.id ? updated : u));
                    setShowEditUserModal(false);
                  }
                }}>Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div >
  );
}

export default App;
