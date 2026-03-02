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
    ChevronDown, LayoutDashboard, BarChart3,
    Ticket, Info, History, PlusCircle, Globe, Users, FolderTree
} from 'lucide-react';
import ConfigureApps from './ConfigureApps';
import InstallationSimulator from './InstallationSimulator';
import {
    useUsers,
    useScreenshots,
    useActivityLevels,
    useApplications,
    useWebsites,
    useTeams,
    useDepartments
} from './hooks';

const COLORS = ['#00bfa5', '#ec407a', '#1e88e5', '#37474f', '#ffb300'];

// Import the original App component
import OriginalApp from './App';

function AppWithDynamicData() {
    const [selectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [isInstalled, setIsInstalled] = useState(false);

    // Fetch dynamic data from API
    const { users, loading: usersLoading, refetch: refetchUsers } = useUsers();
    const { screenshots: apiScreenshots } = useScreenshots(selectedUserId, selectedDate);
    const { activityData: apiActivityData } = useActivityLevels(selectedUserId, selectedDate);
    const { applications } = useApplications(selectedUserId, selectedDate);
    const { websites } = useWebsites(selectedUserId, selectedDate);
    const { teams } = useTeams();
    const { departments } = useDepartments();

    // Check if user is already installed
    useEffect(() => {
        const userId = localStorage.getItem('userId');
        if (userId) {
            setIsInstalled(true);
            setSelectedUserId(userId);
        }
    }, []);

    // Set first user as selected by default
    useEffect(() => {
        if (users && users.length > 0 && !selectedUserId) {
            setSelectedUserId(users[0].id);
        }
    }, [users, selectedUserId]);

    const handleInstallComplete = (user) => {
        setIsInstalled(true);
        if (user) {
            setSelectedUserId(user.id);
            // Refetch users to update the list
            setTimeout(() => refetchUsers(), 1000);
        }
    };

    // Pass dynamic data as props to the original App
    const dynamicData = {
        users: users || [],
        screenshots: apiScreenshots || [],
        activityData: apiActivityData || [],
        applications: applications || [],
        websites: websites || [],
        teams: teams || [],
        departments: departments || [],
        selectedUserId,
        selectedDate,
        usersLoading
    };

    return (
        <>
            <OriginalApp dynamicData={dynamicData} />
            <InstallationSimulator onInstallComplete={handleInstallComplete} />
        </>
    );
}

export default AppWithDynamicData;
