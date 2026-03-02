import React, { useState } from 'react';
import {
    Search, Plus, Info, Edit2, Globe, Monitor,
    Trash2, PlusCircle, MoreHorizontal, Lock, Download,
    ChevronDown, Settings
} from 'lucide-react';

const CATEGORIES = [
    { name: 'Education', status: 'DEFAULT' },
    { name: 'Email', status: 'DEFAULT' },
    { name: 'Entertainment', status: 'DEFAULT' },
    { name: 'Marketing', status: 'DEFAULT' },
    { name: 'News', status: 'DEFAULT' },
    { name: 'Office Apps', status: 'DEFAULT' },
    { name: 'Others', status: 'PRODUCTIVE' },
    { name: 'Social Media', status: 'DEFAULT' },
];

const USERS_DATA = [
    { name: 'Deepak Deepak' },
    { name: 'prakash prakash' },
];

const MAPPING_DATA = [
    { type: 'APP', name: 'Antigravity.exe', group: 'Others' },
    { type: 'URL', name: 'chatgpt.com', group: 'Others' },
    { type: 'APP', name: 'Chrome (chrome.exe)', group: 'Others' },
    { type: 'APP', name: 'Command Prompt (cmd.exe)', group: 'Others' },
    { type: 'APP', name: 'File Explorer (Explorer.EXE)', group: 'Others' },
    { type: 'URL', name: 'hado.v5.timechamp.io', group: 'Others' },
    { type: 'APP', name: 'Microsoft (ShellExperienceHost.exe)', group: 'Others' },
    { type: 'URL', name: 'Microsoft teams (teams.microsoft.com)', group: 'Others' },
    { type: 'APP', name: 'Notepad (NOTEPAD.EXE)', group: 'Others' },
    { type: 'APP', name: 'SearchHost.exe', group: 'Others' },
];

const APP_GROUPS_DATA = [
    { group: 'Education', category: 'Uncategorized' },
    { group: 'Email', category: 'Uncategorized' },
    { group: 'Entertainment', category: 'Uncategorized' },
    { group: 'Marketing', category: 'Uncategorized' },
    { group: 'News', category: 'Uncategorized' },
    { group: 'Office Apps', category: 'Uncategorized' },
    { group: 'Others', category: 'Uncategorized' },
    { group: 'Social Media', category: 'Uncategorized' },
];

const ConfigureApps = () => {
    const [activeMainTab, setActiveMainTab] = useState('Productivity Profile');
    const [activeSubTab, setActiveSubTab] = useState('Application Groups');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Top Breadcrumb Nav */}
            <div className="sub-tab-nav">
                {['Productivity Profile', 'Mapping', 'Application Groups'].map((tab) => (
                    <div
                        key={tab}
                        className={`sub-tab-item ${activeMainTab === tab ? 'active' : ''}`}
                        onClick={() => setActiveMainTab(tab)}
                    >
                        {tab}
                    </div>
                ))}
            </div>

            <div className="config-layout" style={{ flex: 1 }}>
                {activeMainTab === 'Productivity Profile' ? (
                    <>
                        {/* Left Sidebar */}
                        <div className="config-left-pane">
                            <div className="config-search-container">
                                <input type="text" placeholder="Search" className="config-search-input" />
                                <button className="plus-btn"><Plus size={18} /></button>
                            </div>
                            <div className="config-list-item">
                                Default <Info size={14} />
                            </div>
                        </div>

                        {/* Right Content */}
                        <div className="config-right-pane">
                            <div className="sub-tab-nav" style={{ background: 'white', padding: '0 15px' }}>
                                {['Application Groups', 'Teams', 'Users'].map((tab) => (
                                    <div
                                        key={tab}
                                        className={`sub-tab-item ${activeSubTab === tab ? 'active' : ''}`}
                                        style={{ fontSize: '12px' }}
                                        onClick={() => setActiveSubTab(tab)}
                                    >
                                        {tab}
                                    </div>
                                ))}
                            </div>

                            <div style={{ padding: '15px' }}>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15px' }}>
                                    <input type="text" placeholder="Search" className="config-search-input" style={{ maxWidth: '200px' }} />
                                </div>

                                <div className="table-responsive">
                                    {activeSubTab === 'Application Groups' ? (
                                        <table className="custom-table">
                                            <thead>
                                                <tr style={{ background: '#f8f9fa' }}>
                                                    <th style={{ background: 'transparent' }}>Application Group</th>
                                                    <th style={{ background: 'transparent' }}>Idle Time Configuration</th>
                                                    <th style={{ background: 'transparent', textAlign: 'right' }}></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {CATEGORIES.map((cat, i) => (
                                                    <tr key={i}>
                                                        <td>{cat.name}</td>
                                                        <td style={{ color: '#90a4ae' }}>Default</td>
                                                        <td>
                                                            <div className="productivity-toggle" style={{ justifyContent: 'flex-end' }}>
                                                                <button className={`toggle-option ${cat.status === 'PRODUCTIVE' ? 'active' : ''}`}>Productive</button>
                                                                <button className="toggle-option">Non-Productive</button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : activeSubTab === 'Users' ? (
                                        <table className="custom-table">
                                            <thead>
                                                <tr style={{ background: '#f8f9fa' }}>
                                                    <th style={{ background: 'transparent' }}>UserName</th>
                                                    <th style={{ background: 'transparent', textAlign: 'right' }}>Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {USERS_DATA.map((user, i) => (
                                                    <tr key={i}>
                                                        <td style={{ color: '#546e7a' }}>{user.name}</td>
                                                        <td style={{ textAlign: 'right' }}>
                                                            <Edit2 size={16} color="#26a69a" style={{ cursor: 'pointer' }} />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <div style={{ padding: '20px', textAlign: 'center', color: '#90a4ae' }}>{activeSubTab} content goes here</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                ) : activeMainTab === 'Mapping' ? (
                    <div className="config-right-pane" style={{ background: 'white' }}>
                        <div style={{ padding: '15px', borderBottom: '1px solid #eee' }}>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <input type="text" placeholder="Search" className="config-search-input" style={{ maxWidth: '150px' }} />
                                <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                                    <div style={{ fontSize: '11px', color: '#90a4ae' }}>Is App<div style={{ color: '#455a64', display: 'flex', alignItems: 'center' }}>Show All <ChevronDown size={14} /></div></div>
                                    <div style={{ fontSize: '11px', color: '#90a4ae' }}>Group Config<div style={{ color: '#455a64', display: 'flex', alignItems: 'center' }}>ALL <ChevronDown size={14} /></div></div>
                                    <div style={{ fontSize: '11px', color: '#90a4ae' }}>Application Group<div style={{ color: '#455a64', display: 'flex', alignItems: 'center' }}>All <ChevronDown size={14} /></div></div>
                                    <div style={{ fontSize: '11px', color: '#90a4ae' }}>Regular Expression<div style={{ color: '#455a64', display: 'flex', alignItems: 'center' }}>All <ChevronDown size={14} /></div></div>
                                </div>
                                <button style={{ background: '#4db6ac', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}><Plus size={14} /> Add Group</button>
                                <button style={{ background: '#4db6ac', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}><Plus size={14} /> Add new rule</button>
                                <MoreHorizontal size={18} color="#90a4ae" />
                            </div>
                        </div>
                        <div style={{ padding: '0 15px' }}>
                            <table className="custom-table mapping-table">
                                <tbody>
                                    {MAPPING_DATA.map((item, i) => (
                                        <tr key={i}>
                                            <td style={{ width: '60px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#90a4ae' }}>
                                                    {item.type === 'APP' ? <Monitor size={14} /> : <Globe size={14} />} {item.type}
                                                </div>
                                            </td>
                                            <td style={{ color: '#546e7a' }}>{item.name}</td>
                                            <td style={{ color: '#546e7a' }}>{item.group}</td>
                                            <td style={{ textAlign: 'right', color: '#90a4ae', fontSize: '12px' }}>Actions</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : activeMainTab === 'Application Groups' ? (
                    <div className="config-right-pane" style={{ background: 'white' }}>
                        <div style={{ padding: '15px' }}>
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                                <input type="text" placeholder="Search" className="config-search-input" style={{ maxWidth: '150px' }} />
                                <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px', alignItems: 'center' }}>
                                    <button style={{ background: '#4db6ac', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}><Settings size={14} /> Signature Matching <Lock size={12} /></button>
                                    <button style={{ background: '#4db6ac', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}><Plus size={14} /> Add Group</button>
                                    <div style={{ width: '40px', height: '18px', background: '#eee', borderRadius: '10px', position: 'relative' }}><div style={{ width: '14px', height: '14px', background: 'white', borderRadius: '50%', position: 'absolute', right: '2px', top: '2px' }}></div></div>
                                </div>
                            </div>
                            <table className="custom-table">
                                <thead>
                                    <tr style={{ background: '#f8f9fa' }}>
                                        <th style={{ background: 'transparent' }}>Application Group <ChevronDown size={12} style={{ display: 'inline' }} /></th>
                                        <th style={{ background: 'transparent' }}>Category Name</th>
                                        <th style={{ background: 'transparent' }}>Priority</th>
                                        <th style={{ background: 'transparent' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {APP_GROUPS_DATA.map((row, i) => (
                                        <tr key={i}>
                                            <td style={{ color: '#455a64' }}>{row.group}</td>
                                            <td style={{ color: '#7e57c2' }}>{row.category}</td>
                                            <td></td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '10px' }}>
                                                    <Edit2 size={16} color="#26a69a" style={{ cursor: 'pointer' }} />
                                                    <Trash2 size={16} color="#26a69a" style={{ cursor: 'pointer' }} />
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
};

export default ConfigureApps;
