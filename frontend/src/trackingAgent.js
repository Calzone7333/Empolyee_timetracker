// This simulates the behavior of the installed exe file
// In production, this would be a desktop application

import { registerUser, trackActivity } from './api';

class EmployeeTrackingAgent {
    constructor() {
        // Start empty every time for the demo flow
        this.users = [];
        // this.users = JSON.parse(localStorage.getItem('registered_users') || '[]');
    }

    // Generate a new user (User 1, User 2, etc.)
    createNewUser() {
        const nextId = this.users.length + 1;
        const newUser = {
            id: `USER_${Date.now()}_${nextId}`,
            employeeId: `EMP${1000 + nextId}`,
            userName: `User ${nextId}`,
            email: `user${nextId}@company.com`,
            computerName: `DESKTOP-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
            installedAt: new Date().toISOString(),
            status: 'Active',
            activeTime: '00:00',
            productivity: [
                { name: 'Productive', value: 100, color: '#26a69a' },
                { name: 'Non-Productive', value: 0, color: '#ffb300' },
                { name: 'Neutral', value: 0, color: '#90a4ae' }
            ],
            topApps: [],
            attendance: []
        };

        this.users.push(newUser);
        this.saveUsers();
        return newUser;
    }

    saveUsers() {
        localStorage.setItem('registered_users', JSON.stringify(this.users));
    }

    getUsers() {
        return this.users;
    }

    clearUsers() {
        this.users = [];
        this.saveUsers();
    }

    generateRandomTime() {
        return "00:00"; // Fallback, shouldn't be used directly now
    }

    // Pool of apps that the agent "detects" on the system
    // Pool of apps that the agent "detects" on the system
    // COMPLETELY DYNAMIC: No static list. Generates a fresh list every time.
    getAvailableApps() {
        const apps = [];
        // Generate 15 random "detected" apps for this session
        for (let i = 0; i < 15; i++) {
            apps.push(this.generateRandomProcess());
        }
        return apps;
    }

    // Generate a random process name to simulate arbitrary user activity
    generateRandomProcess() {
        const prefixes = ['Project', 'System', 'Win', 'Data', 'Check', 'App', 'Task', 'Service', 'Client', 'Server'];
        const suffixes = ['Manager', 'Tool', 'Builder', 'Viewer', 'Editor', 'Runner', 'Host', 'Service', 'Monitor', 'Driver'];
        const extensions = ['.exe', '.xlsx', '.docx', '.pdf', '.bat', '.sh'];

        const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
        const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
        const ext = extensions[Math.floor(Math.random() * extensions.length)];
        const version = Math.floor(Math.random() * 9) + 1;

        const exeName = `${prefix}_${suffix}_v${version}${ext}`;
        const fullName = `${prefix} ${suffix} v${version}`;

        return { exe: exeName, name: fullName };
    }

    // Core Simulation Logic
    updateUserSimulation(user) {
        if (!user.simulationState) {
            user.simulationState = {
                startTime: Date.now(),
                lastUpdate: Date.now(),
                accumulatedMinutes: 0,
                currentApp: '',
                apps: {},
                screenshots: [],
                activityLog: []
            };

            // Generate initial history
            this.prefillHistory(user.simulationState);

            // Reset for new calculation after prefill
            user.simulationState.accumulatedMinutes = 0;
            user.simulationState.idleMinutes = 0;
            user.simulationState.awayMinutes = 0;
            const initialApp = this.getRandomApp();
            user.simulationState.apps = {};
            user.simulationState.apps[initialApp.exe] = { time: 0, full: initialApp.name };
            user.simulationState.currentApp = initialApp.exe;
        }

        const state = user.simulationState;
        const now = Date.now();
        const diffMs = now - state.lastUpdate;

        // Only update if > 5 seconds passed to avoid jitter
        if (diffMs > 5000) {
            const minutesPassed = diffMs / 60000;
            state.lastUpdate = now;

            // Simulate States: Active (85%), Idle (10%), Away (5%)
            const rand = Math.random();
            if (rand > 0.95) {
                // Away
                state.awayMinutes += minutesPassed;
            } else if (rand > 0.85) {
                // Idle
                state.idleMinutes += minutesPassed;
                state.accumulatedMinutes += minutesPassed; // Idle counts as "logged in" but maybe not productive
            } else {
                // Active Work
                state.accumulatedMinutes += minutesPassed;

                // App Logic
                if (Math.random() > 0.7) {
                    if (Math.random() > 0.6) {
                        let newApp;
                        if (Math.random() > 0.5) {
                            const available = this.getAvailableApps();
                            newApp = available[Math.floor(Math.random() * available.length)];
                        } else {
                            newApp = this.generateRandomProcess();
                        }

                        if (!state.apps[newApp.exe]) {
                            state.apps[newApp.exe] = { time: 0, full: newApp.name };
                        }
                        state.currentApp = newApp.exe;
                    } else {
                        const existingApps = Object.keys(state.apps);
                        state.currentApp = existingApps[Math.floor(Math.random() * existingApps.length)];
                    }
                }

                if (state.apps[state.currentApp]) {
                    state.apps[state.currentApp].time += minutesPassed;
                }
            }

            // Add Screenshot if 10 mins passed since last shot
            const lastShotTime = state.screenshots.length > 0 ? state.screenshots[0].timestamp : 0;
            if (now - lastShotTime > 10 * 60 * 1000) {
                const d = new Date();
                const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
                // Add to bucket logic can go here if needed
            }
        }

        return state;
    }

    // Helper to get a random app (either real or generated)
    getRandomApp() {
        if (Math.random() > 0.4) {
            const available = this.getAvailableApps();
            const app = available[Math.floor(Math.random() * available.length)];
            return { exe: app.exe, name: app.name };
        } else {
            return this.generateRandomProcess();
        }
    }

    prefillHistory(state) {
        // Add some realistic "past" data for the demo start
        // COMPLETELY DYNAMIC: No hardcoded apps

        // Randomize start values (between 30 and 60 mins of history)
        const initialMinutes = Math.floor(Math.random() * 30) + 30;
        state.accumulatedMinutes = initialMinutes;
        state.idleMinutes = Math.floor(Math.random() * 15);
        state.awayMinutes = Math.floor(Math.random() * 10);

        let remainingTime = initialMinutes;

        // Add 3-5 random apps to history
        const appCount = Math.floor(Math.random() * 3) + 3;

        for (let i = 0; i < appCount; i++) {
            const app = this.getRandomApp();
            // Assign random portion of time
            const timeSpent = i === appCount - 1 ? remainingTime : Math.floor(Math.random() * (remainingTime / 2));

            if (timeSpent > 0) {
                state.apps[app.exe] = { time: timeSpent, full: app.name };
                remainingTime -= timeSpent;
            }
        }
    }

    // For the dashboard, we need aggregated data or data for a specific user
    getDashboardData(userId = null) {
        let targetUser = userId ? this.users.find(u => u.id === userId) : this.users[0];

        // If no users exist, return null (empty state)
        if (!targetUser) return null;

        // Update Simulation State
        const simState = this.updateUserSimulation(targetUser);

        // Helper to format minutes to HH:MM
        const formatTime = (totalMins) => {
            const h = Math.floor(Math.max(0, totalMins) / 60);
            const m = Math.floor(Math.max(0, totalMins) % 60);
            return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        };

        const activeTimeStr = formatTime(simState.accumulatedMinutes);

        // Top Apps - Sort by usage
        const sortedApps = Object.entries(simState.apps)
            .sort(([, a], [, b]) => b.time - a.time)
            .map(([name, data]) => ({
                name: name,
                value: Math.round(data.time),
                full: formatTime(data.time)
            })).slice(0, 5);

        // Productivity
        const prodMins = Math.floor(simState.accumulatedMinutes * 0.85);
        const nonProdMins = Math.floor(simState.accumulatedMinutes * 0.10);
        const neutralMins = Math.floor(simState.accumulatedMinutes * 0.05);

        const productivity = [
            { name: 'Productive Hours', value: prodMins, full: `${formatTime(prodMins)} (85%)`, color: '#26a69a' },
            { name: 'Non-Productive Hours', value: nonProdMins, full: `${formatTime(nonProdMins)} (10%)`, color: '#ffb300' },
            { name: 'Neutral Hours', value: neutralMins, full: `${formatTime(neutralMins)} (5%)`, color: '#90a4ae' },
        ];

        // Dynamic Attendance Building
        const now = new Date();
        const currentHour = now.getHours();
        const currentMin = now.getMinutes();
        const currentTimeStr = `${currentHour.toString().padStart(2, '0')}:${currentMin.toString().padStart(2, '0')}`;

        const attendanceLog = [];

        // Always start at 09:00 for the simulation baseline
        const startHour = 9;

        if (currentHour >= startHour) {
            // 1. Morning Session (09:00 - Lunch or Now)
            const lunchStart = 13;
            if (currentHour < lunchStart) {
                attendanceLog.push({
                    start: '09:00',
                    end: currentTimeStr,
                    spent: formatTime((currentHour - 9) * 60 + currentMin),
                    activity: 'Working', status: 'Working', reason: '', type: 'working'
                });
            } else {
                // Passed Lunch Start
                attendanceLog.push({
                    start: '09:00', end: '13:00', spent: '04:00',
                    activity: 'Working', status: 'Working', reason: '', type: 'working'
                });

                // 2. Lunch Session (13:00 - 13:45 or Now)
                const lunchEndHour = 13;
                const lunchEndMin = 45;

                if (currentHour === 13 && currentMin < 45) {
                    attendanceLog.push({
                        start: '13:00', end: currentTimeStr,
                        spent: formatTime(currentMin),
                        activity: 'Offline', status: 'Non-Working', reason: 'Lunch', type: 'offline'
                    });
                } else {
                    attendanceLog.push({
                        start: '13:00', end: '13:45', spent: '00:45',
                        activity: 'Offline', status: 'Non-Working', reason: 'Lunch', type: 'offline'
                    });

                    // 3. Afternoon Session (13:45 - Now)
                    attendanceLog.push({
                        start: '13:45', end: currentTimeStr,
                        spent: formatTime((currentHour * 60 + currentMin) - (13 * 60 + 45)),
                        activity: 'Working', status: 'Working', reason: '', type: 'working'
                    });
                }
            }
        } else {
            // Early morning login? Just show from login time
            attendanceLog.push({
                start: '08:00', end: currentTimeStr,
                spent: formatTime((currentHour - 8) * 60 + currentMin),
                activity: 'Working', status: 'Working', reason: 'Early Login', type: 'working'
            });
        }

        return {
            user: targetUser,
            activeTime: activeTimeStr,
            productivity: productivity,
            attendance: attendanceLog,
            topApps: sortedApps,
            awayTime: formatTime(simState.awayMinutes),
            idleTime: formatTime(simState.idleMinutes),
            timeline: this.generateTimelineData(),
            screenshots: this.generateScreenshotsData(),
            activityLevels: this.generateActivityLevelsData()
        };
    }

    generateTimelineData() {
        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            // Generate random 'present' status, less likely on weekends but possible
            const isPresent = isWeekend ? Math.random() > 0.8 : Math.random() > 0.2;

            days.push({
                date: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
                day: `[${d.toLocaleDateString('en-GB', { weekday: 'short' })}]`,
                data: isPresent
            });
        }
        return days;
    }

    generateScreenshotsData() {
        const shots = [];
        const now = new Date();
        const currentHour = now.getHours();

        for (let h = 0; h < 3; h++) {
            const hour = currentHour - h;
            if (hour < 9) break; // Don't show before 9 AM

            const hourLabel = `${hour.toString().padStart(2, '0')}:00 - ${(hour + 1).toString().padStart(2, '0')}:00`;
            const times = [];
            const count = Math.floor(Math.random() * 6) + 2;

            for (let i = 0; i < count; i++) {
                const min = Math.floor(Math.random() * 60);
                times.push(`${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`);
            }
            times.sort().reverse();
            shots.push({ label: hourLabel, shots: times });
        }
        return shots;
    }

    generateActivityLevelsData() {
        const data = [];
        const now = new Date();
        for (let i = 20; i >= 0; i--) {
            const time = new Date(now.getTime() - i * 5 * 60000);
            data.push({
                time: `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`,
                keys: Math.floor(Math.random() * 300),
                clicks: Math.floor(Math.random() * 200)
            });
        }
        return data;
    }

    // Check if any agent is installed
    isInstalled() {
        return this.users.length > 0;
    }
}

// Create singleton instance
const trackingAgent = new EmployeeTrackingAgent();

export default trackingAgent;
