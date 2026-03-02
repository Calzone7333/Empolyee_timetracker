import { useState, useEffect } from 'react';
import * as api from './api';

// Hook for fetching users
export const useUsers = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const data = await api.getAllUsers();
            setUsers(data);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
        // Refresh every 30 seconds
        const interval = setInterval(fetchUsers, 30000);
        return () => clearInterval(interval);
    }, []);

    return { users, loading, error, refetch: fetchUsers };
};

// Hook for fetching user activity
export const useUserActivity = (userId, date) => {
    const [activity, setActivity] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchActivity = async () => {
        if (!userId) return;

        try {
            setLoading(true);
            const data = await api.getUserActivity(userId, date);
            setActivity(data);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchActivity();
    }, [userId, date]);

    return { activity, loading, error, refetch: fetchActivity };
};

// Hook for fetching screenshots
export const useScreenshots = (userId, date) => {
    const [screenshots, setScreenshots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchScreenshots = async () => {
        if (!userId) return;

        try {
            setLoading(true);
            const data = await api.getScreenshots(userId, date);
            setScreenshots(data);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchScreenshots();
    }, [userId, date]);

    return { screenshots, loading, error, refetch: fetchScreenshots };
};

// Hook for fetching activity levels
export const useActivityLevels = (userId, date) => {
    const [activityData, setActivityData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchActivityLevels = async () => {
        if (!userId) return;

        try {
            setLoading(true);
            const data = await api.getActivityLevels(userId, date);
            setActivityData(data);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchActivityLevels();
    }, [userId, date]);

    return { activityData, loading, error, refetch: fetchActivityLevels };
};

// Hook for fetching applications
export const useApplications = (userId, date) => {
    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchApplications = async () => {
        if (!userId) return;

        try {
            setLoading(true);
            const data = await api.getApplicationsUsed(userId, date);
            setApplications(data);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchApplications();
    }, [userId, date]);

    return { applications, loading, error, refetch: fetchApplications };
};

// Hook for fetching websites
export const useWebsites = (userId, date) => {
    const [websites, setWebsites] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchWebsites = async () => {
        if (!userId) return;

        try {
            setLoading(true);
            const data = await api.getWebsitesVisited(userId, date);
            setWebsites(data);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchWebsites();
    }, [userId, date]);

    return { websites, loading, error, refetch: fetchWebsites };
};

// Hook for fetching teams
export const useTeams = () => {
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchTeams = async () => {
        try {
            setLoading(true);
            const data = await api.getTeams();
            setTeams(data);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTeams();
    }, []);

    return { teams, loading, error, refetch: fetchTeams };
};

// Hook for fetching departments
export const useDepartments = () => {
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchDepartments = async () => {
        try {
            setLoading(true);
            const data = await api.getDepartments();
            setDepartments(data);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDepartments();
    }, []);

    return { departments, loading, error, refetch: fetchDepartments };
};
