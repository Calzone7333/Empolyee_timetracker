import React, { useState, useEffect } from 'react';
import trackingAgent from './trackingAgent';
import { Download, CheckCircle, Activity } from 'lucide-react';

const InstallationSimulator = ({ onInstallComplete }) => {
    const [isInstalled, setIsInstalled] = useState(false);
    const [isInstalling, setIsInstalling] = useState(false);
    const [userInfo, setUserInfo] = useState(null);
    const [isTracking, setIsTracking] = useState(false);

    useEffect(() => {
        // Check if already installed
        if (trackingAgent.isInstalled()) {
            setIsInstalled(true);
            setUserInfo(trackingAgent.getCurrentUser());
            setIsTracking(true);
            trackingAgent.startTracking();
        }
    }, []);

    const handleInstall = async () => {
        setIsInstalling(true);

        // Simulate installation process
        await new Promise(resolve => setTimeout(resolve, 2000));

        const user = await trackingAgent.install();

        if (user) {
            setUserInfo({
                ...trackingAgent.getCurrentUser(),
                ...user
            });
            setIsInstalled(true);
            setIsInstalling(false);

            // Start tracking automatically after installation
            trackingAgent.startTracking();
            setIsTracking(true);

            if (onInstallComplete) {
                onInstallComplete(user);
            }
        } else {
            setIsInstalling(false);
            alert('Installation failed. Please try again.');
        }
    };

    const toggleTracking = () => {
        if (isTracking) {
            trackingAgent.stopTracking();
            setIsTracking(false);
        } else {
            trackingAgent.startTracking();
            setIsTracking(true);
        }
    };


    if (!isInstalled) {
        return null;
    }

    return (
        <div style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            background: 'white',
            borderRadius: '12px',
            padding: '16px 20px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            zIndex: 1000,
            maxWidth: '350px'
        }}>
            <div style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: isTracking ? '#26a69a' : '#ef5350',
                animation: isTracking ? 'pulse 2s infinite' : 'none'
            }}></div>
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#455a64' }}>
                    {userInfo?.userName || 'User'}
                </div>
                <div style={{ fontSize: '10px', color: '#90a4ae' }}>
                    {userInfo?.employeeId} • {isTracking ? 'Tracking Active' : 'Tracking Paused'}
                </div>
            </div>
            <button
                onClick={toggleTracking}
                style={{
                    background: isTracking ? '#ef5350' : '#26a69a',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '11px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                }}
            >
                {isTracking ? 'Pause' : 'Resume'}
            </button>
        </div>
    );
};

export default InstallationSimulator;
