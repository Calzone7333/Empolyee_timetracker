const API_BASE_URL = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
    ? `http://localhost:8084/api`
    : `http://103.181.108.248/api`;

// User Management APIs
export const registerUser = async (userData) => {
    try {
        const response = await fetch(`${API_BASE_URL}/users/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        return await response.json();
    } catch (error) {
        console.error('Error registering user:', error);
        return null;
    }
};

export const getAllUsers = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/users`);
        return await response.json();
    } catch (error) {
        console.error('Error fetching users:', error);
        return [];
    }
};

export const deleteUser = async (id) => {
    try {
        const response = await fetch(`${API_BASE_URL}/users/${id}`, {
            method: 'DELETE'
        });
        return await response.json();
    } catch (error) {
        console.error('Error deleting user:', error);
        return null;
    }
};

export const getUserActivity = async (userId, date, range) => {
    try {
        const response = await fetch(`${API_BASE_URL}/activity/${userId}?date=${date}${range ? `&range=${range}` : ''}`);
        return await response.json();
    } catch (error) {
        console.error('Error fetching user activity:', error);
        return null;
    }
};

export const updateUser = async (id, userData) => {
    try {
        const response = await fetch(`${API_BASE_URL}/users/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        return await response.json();
    } catch (error) {
        console.error('Error updating user:', error);
        return null;
    }
};

// Activity Tracking APIs
export const trackActivity = async (activityData) => {
    try {
        const response = await fetch(`${API_BASE_URL}/activity/track`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(activityData)
        });
        return await response.json();
    } catch (error) {
        console.error('Error tracking activity:', error);
        return null;
    }
};

export const getScreenshots = async (userId, date) => {
    try {
        const response = await fetch(`${API_BASE_URL}/screenshots/${userId}?date=${date}`);
        return await response.json();
    } catch (error) {
        console.error('Error fetching screenshots:', error);
        return [];
    }
};

export const getActivityLevels = async (userId, date, range) => {
    try {
        const response = await fetch(`${API_BASE_URL}/activity/levels/${userId}?date=${date}${range ? `&range=${range}` : ''}`);
        return await response.json();
    } catch (error) {
        console.error('Error fetching activity levels:', error);
        return [];
    }
};

// Attendance APIs
export const getAttendance = async (userId, date) => {
    try {
        const response = await fetch(`${API_BASE_URL}/attendance/${userId}?date=${date}`);
        return await response.json();
    } catch (error) {
        console.error('Error fetching attendance:', error);
        return [];
    }
};

// Applications and Websites APIs
export const getApplicationsUsed = async (userId, date, range) => {
    try {
        const response = await fetch(`${API_BASE_URL}/activity/applications/${userId}?date=${date}${range ? `&range=${range}` : ''}`);
        return await response.json();
    } catch (error) {
        console.error('Error fetching applications:', error);
        return [];
    }
};

export const getWebsitesVisited = async (userId, date, range) => {
    try {
        const response = await fetch(`${API_BASE_URL}/activity/websites/${userId}?date=${date}${range ? `&range=${range}` : ''}`);
        return await response.json();
    } catch (error) {
        console.error('Error fetching websites:', error);
        return [];
    }
};

// Teams and Departments APIs
export const getTeams = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/teams`);
        return await response.json();
    } catch (error) {
        console.error('Error fetching teams:', error);
        return [];
    }
};

export const getDepartments = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/departments`);
        return await response.json();
    } catch (error) {
        console.error('Error fetching departments:', error);
        return [];
    }
};

export const createTeam = async (teamData) => {
    try {
        const response = await fetch(`${API_BASE_URL}/teams`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(teamData)
        });
        return await response.json();
    } catch (error) {
        console.error('Error creating team:', error);
        return null;
    }
};

export const createDepartment = async (deptData) => {
    try {
        const response = await fetch(`${API_BASE_URL}/departments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(deptData)
        });
        return await response.json();
    } catch (error) {
        console.error('Error creating department:', error);
        return null;
    }
};

// Time Claims APIs
export const getTimeClaims = async (userId) => {
    try {
        const response = await fetch(`${API_BASE_URL}/claims/${userId}`);
        return await response.json();
    } catch (error) {
        console.error('Error fetching claims:', error);
        return [];
    }
};

export const addTimeClaim = async (claimData) => {
    try {
        const response = await fetch(`${API_BASE_URL}/claims/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(claimData)
        });
        return await response.json();
    } catch (error) {
        console.error('Error adding claim:', error);
        return null;
    }
};

export const updateClaimStatus = async (claimId, status) => {
    try {
        const response = await fetch(`${API_BASE_URL}/claims/status/${claimId}?status=${status}`, {
            method: 'PUT'
        });
        return await response.json();
    } catch (error) {
        console.error('Error updating claim status:', error);
        return null;
    }
};

// Historical Comparison Helper
export const getDetailedHistory = async (userId, dates) => {
    // dates: array of 'YYYY-MM-DD'
    const results = {};
    for (const date of dates) {
        results[date] = await getUserActivity(userId, date);
    }
    return results;
};
