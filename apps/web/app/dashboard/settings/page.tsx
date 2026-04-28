'use client';

import { useState, useEffect } from 'react';
import { Moon, Sun, Bell, Mail, Shield, Globe, Palette, Save, Check, Eye, EyeOff, Download, Key } from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { authApi, usersApi } from '@/lib/api';

interface NotificationPrefs {
  emailNotifications: boolean;
  dueDateReminders: boolean;
  reservationAlerts: boolean;
}

interface PasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function SettingsPage() {
  const [darkMode, setDarkMode] = useState(false);
  const [language, setLanguage] = useState('en');
  const [prefs, setPrefs] = useState<NotificationPrefs>({
    emailNotifications: true,
    dueDateReminders: true,
    reservationAlerts: true,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Change password modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Load settings on mount
  useEffect(() => {
    // Dark mode from localStorage (controlled by dashboard layout)
    const saved = localStorage.getItem('darkMode') === 'true';
    setDarkMode(saved);

    // Language from localStorage (frontend-only)
    const savedLang = localStorage.getItem('language') ?? 'en';
    setLanguage(savedLang);

    // Notification prefs from backend
    usersApi.getPreferences()
      .then(({ notificationPrefs }) => {
        setPrefs({
          emailNotifications: notificationPrefs.emailNotifications ?? true,
          dueDateReminders: notificationPrefs.dueDateReminders ?? true,
          reservationAlerts: notificationPrefs.reservationAlerts ?? true,
        });
      })
      .catch(() => {
        // Fallback to localStorage if backend fails
        const local = localStorage.getItem('notificationPrefs');
        if (local) setPrefs(JSON.parse(local));
      });
  }, []);

  const handleDarkModeToggle = () => {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem('darkMode', String(next));
    if (next) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    toast.success(next ? 'Dark mode enabled' : 'Light mode enabled');
  };

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    localStorage.setItem('language', lang);
  };

  const handlePrefToggle = (key: keyof NotificationPrefs) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await usersApi.updatePreferences(prefs);
      setSaved(true);
      toast.success('Settings saved');
      setTimeout(() => setSaved(false), 2000);
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const blob = await usersApi.exportData();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `my-library-data-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Data downloaded');
    } catch {
      toast.error('Failed to download data');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    setIsChangingPassword(true);
    try {
      await authApi.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      toast.success('Password changed successfully');
      setShowPasswordModal(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      const message = err.response?.data?.message ?? 'Failed to change password';
      toast.error(message);
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-gray-500 dark:text-gray-400">Manage your account preferences</p>
      </div>

      {/* Appearance */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-black/[0.06] dark:border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-gray-400" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Appearance</h2>
          </div>
        </div>
        <div className="p-4 space-y-4">
          {/* Dark Mode */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {darkMode ? (
                <Moon className="w-5 h-5 text-indigo-500" />
              ) : (
                <Sun className="w-5 h-5 text-amber-500" />
              )}
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Dark Mode</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Switch between light and dark theme</p>
              </div>
            </div>
            <button
              role="switch"
              aria-checked={darkMode}
              aria-label="Dark Mode"
              onClick={handleDarkModeToggle}
              className={cn('relative w-12 h-6 rounded-full transition-colors', darkMode ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600')}
            >
              <span className={cn('absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform', darkMode ? 'translate-x-6' : 'translate-x-0')} />
            </button>
          </div>

          {/* Language */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-blue-500" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Language</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Choose your preferred language</p>
              </div>
            </div>
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-400/50"
              style={{ background: 'var(--glass-btn-bg)', border: '1px solid var(--glass-border)', backdropFilter: 'blur(12px)' }}
            >
              <option value="en">English</option>
              <option value="tr">Türkçe</option>
            </select>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-black/[0.06] dark:border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-gray-400" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Notifications</h2>
          </div>
        </div>
        <div className="p-4 space-y-4">
          {(
            [
              { key: 'emailNotifications' as const, label: 'Email Notifications', desc: 'Receive email updates about your account', icon: <Mail className="w-5 h-5 text-gray-400" /> },
              { key: 'dueDateReminders' as const, label: 'Due Date Reminders', desc: 'Get notified before your books are due', icon: <Bell className="w-5 h-5 text-amber-500" /> },
              { key: 'reservationAlerts' as const, label: 'Reservation Alerts', desc: 'Get notified when reserved books are ready', icon: <Bell className="w-5 h-5 text-green-500" /> },
            ]
          ).map(({ key, label, desc, icon }) => (
            <div key={key} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {icon}
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{label}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{desc}</p>
                </div>
              </div>
              <button
                role="switch"
                aria-checked={prefs[key]}
                aria-label={label}
                onClick={() => handlePrefToggle(key)}
                className={cn('relative w-12 h-6 rounded-full transition-colors', prefs[key] ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600')}
              >
                <span className={cn('absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform', prefs[key] ? 'translate-x-6' : 'translate-x-0')} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Privacy & Security */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-black/[0.06] dark:border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-gray-400" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Privacy & Security</h2>
          </div>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Change Password</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Update your account password</p>
            </div>
            <button
              onClick={() => setShowPasswordModal(true)}
              className="px-4 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
            >
              Change
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Download My Data</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Get a copy of your library data</p>
            </div>
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="px-4 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {isDownloading ? (
                <div className="w-3.5 h-3.5 border-2 border-primary-400/30 border-t-primary-400 rounded-full animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              Download
            </button>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={cn('glass-button glass-button-primary flex items-center gap-2 px-6 py-3 font-medium transition-all disabled:opacity-50', saved && 'bg-green-500/80 border-green-400/30')}
        >
          {saved ? (
            <><Check className="w-5 h-5" />Saved</>
          ) : isSaving ? (
            <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving...</>
          ) : (
            <><Save className="w-5 h-5" />Save Settings</>
          )}
        </button>
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="glass-card w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Key className="w-5 h-5 text-teal-500" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Change Password</h3>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              {/* Current Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))}
                    className="w-full px-3 py-2.5 pr-10 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-400/50"
                    style={{ background: 'var(--glass-btn-bg)', border: '1px solid var(--glass-border)' }}
                    placeholder="Enter current password"
                    required
                  />
                  <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Password</label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
                    className="w-full px-3 py-2.5 pr-10 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-400/50"
                    style={{ background: 'var(--glass-btn-bg)', border: '1px solid var(--glass-border)' }}
                    placeholder="Min. 8 characters"
                    required
                  />
                  <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-400/50"
                  style={{ background: 'var(--glass-btn-bg)', border: '1px solid var(--glass-border)' }}
                  placeholder="Repeat new password"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowPasswordModal(false); setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' }); }}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-xl transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                  style={{ border: '1px solid var(--glass-border)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #2A9D9D 0%, #1D7A7A 100%)' }}
                >
                  {isChangingPassword ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Update Password'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
