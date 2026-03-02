# Employee Time Tracker - Dynamic System Implementation

## 🎯 Overview

This application now has a **fully dynamic system** that simulates employee tracking software with automatic user registration when the "exe" is installed.

## 🚀 Features Implemented

### 1. **Automatic User Registration**
- When someone "installs" the exe file (simulated), they are automatically registered in the system
- User information is captured: Computer Name, Username, Employee ID, Email
- Data is stored in `data.json` file (in production, this would be a database)

### 2. **Dynamic Data Generation**
- **Screenshots**: Automatically generated based on time
- **Activity Levels**: Real-time tracking of keystrokes and mouse clicks
- **Applications Used**: Tracks which applications are being used
- **Websites Visited**: Monitors website activity
- **Attendance**: Automatic check-in/check-out tracking

### 3. **Real-time Activity Tracking**
- Tracks user activity every 10 seconds
- Captures:
  - Current application
  - Current website
  - Keystrokes count
  - Mouse clicks count
  - Activity type (productive/neutral/non-productive/away)

## 📁 New Files Created

1. **`src/api.js`** - API service layer for all backend communications
2. **`src/hooks.js`** - Custom React hooks for data fetching
3. **`src/trackingAgent.js`** - Client-side agent that simulates the exe behavior
4. **`src/InstallationSimulator.jsx`** - UI component for installation simulation
5. **`server.js`** - Mock backend server with Express.js

## 🛠️ How to Run

### Option 1: Run Frontend and Backend Together
```bash
npm run dev:all
```

This will start:
- Frontend (Vite) on `http://localhost:5173`
- Backend API on `http://localhost:3001`

### Option 2: Run Separately

**Terminal 1 - Frontend:**
```bash
npm run dev
```

**Terminal 2 - Backend:**
```bash
npm run server
```

## 📊 How the System Works

### Installation Flow:
1. User opens the application
2. **InstallationSimulator** modal appears (simulating exe installation)
3. User clicks "Install Agent"
4. System captures computer information:
   - Computer Name (auto-generated or from localStorage)
   - Username (auto-generated or from localStorage)
   - Employee ID (auto-generated: PP + random number)
   - Email (generated from username)
5. Data is sent to `/api/users/register` endpoint
6. User is added to the system
7. Tracking starts automatically

### Activity Tracking Flow:
1. After installation, tracking agent starts
2. Every 10 seconds, it captures:
   - Current activity type
   - Application being used
   - Website being visited
   - Keyboard and mouse activity
3. Data is sent to `/api/activity/track` endpoint
4. Dashboard updates in real-time

### Data Flow:
```
User Action → trackingAgent.js → api.js → server.js → data.json
                                              ↓
Dashboard ← hooks.js ← api.js ← server.js ← data.json
```

## 🗄️ Data Storage

All data is stored in `data.json` file with the following structure:

```json
{
  "users": [
    {
      "id": 1,
      "employeeId": "PP1234",
      "name": "User Name",
      "email": "user.name@company.com",
      "computerName": "DESKTOP-ABC123",
      "role": "User",
      "status": "Active",
      "department": "IT",
      "team": "Development",
      "joinDate": "2026-02-12",
      "lastActive": "2026-02-12T12:00:00.000Z"
    }
  ],
  "activities": [
    {
      "id": 1,
      "userId": "1",
      "timestamp": "2026-02-12T12:00:00.000Z",
      "type": "productive",
      "application": "chrome.exe",
      "website": "github.com",
      "keyStrokes": 45,
      "mouseClicks": 23
    }
  ],
  "screenshots": [],
  "attendance": [],
  "teams": [],
  "departments": []
}
```

## 🔧 API Endpoints

### User Management
- `POST /api/users/register` - Register new user (called on exe installation)
- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get specific user

### Activity Tracking
- `POST /api/activity/track` - Track user activity
- `GET /api/activity/:userId` - Get user activity
- `GET /api/screenshots/:userId` - Get screenshots
- `GET /api/activity-levels/:userId` - Get activity levels

### Applications & Websites
- `GET /api/applications/:userId` - Get applications used
- `GET /api/websites/:userId` - Get websites visited

### Organization
- `GET /api/teams` - Get all teams
- `GET /api/departments` - Get all departments

## 🎨 UI Components

### InstallationSimulator
- Shows installation modal on first visit
- Displays tracking status indicator
- Allows pause/resume of tracking

### Dynamic Data Display
- All tables and charts now use real data from the API
- Auto-refresh every 30 seconds
- Loading states for better UX

## 🔄 Real-time Updates

The system updates data in real-time:
- **Users list**: Refreshes every 30 seconds
- **Activity data**: Updates every 10 seconds
- **Screenshots**: Generates new ones every minute
- **Activity levels**: Updates every 10 seconds

## 🎯 Testing the System

1. **First Time User:**
   - Open the app
   - You'll see the installation modal
   - Click "Install Agent"
   - You're now registered and tracking starts

2. **Returning User:**
   - Open the app
   - You'll see a small status indicator at bottom-right
   - Shows your name, employee ID, and tracking status
   - Can pause/resume tracking

3. **View Data:**
   - Navigate to different tabs to see dynamic data
   - Check "Users" tab to see all registered users
   - View "Screenshots", "Activity Levels", etc.

## 📝 Customization

### Change API URL:
Edit `src/api.js`:
```javascript
const API_BASE_URL = 'http://your-server:port/api';
```

### Modify Tracking Interval:
Edit `src/trackingAgent.js`:
```javascript
// Change from 10000 (10 seconds) to your preferred interval
this.trackingInterval = setInterval(() => {
  this.captureActivity();
}, 10000);
```

### Add More Data Fields:
1. Update `server.js` to handle new fields
2. Update `api.js` to send/receive new fields
3. Update `hooks.js` if needed
4. Update UI components to display new fields

## 🚀 Production Deployment

For production:
1. Replace `data.json` with a real database (MongoDB, PostgreSQL, etc.)
2. Add authentication and authorization
3. Implement proper security measures
4. Use environment variables for configuration
5. Deploy backend to a cloud service (AWS, Azure, etc.)
6. Build and deploy frontend

## 🐛 Troubleshooting

**Issue: API not connecting**
- Make sure backend server is running on port 3001
- Check console for CORS errors
- Verify API_BASE_URL in `src/api.js`

**Issue: No data showing**
- Check if backend server is running
- Open browser console for errors
- Verify `data.json` file exists and has data

**Issue: Installation modal keeps appearing**
- Clear browser localStorage
- Check if userId is being stored correctly

## 📞 Support

For issues or questions, check:
- Browser console for errors
- Backend server logs
- `data.json` file for stored data

---

**Note**: This is a development/demo setup. For production use, implement proper security, authentication, and use a real database instead of file-based storage.
