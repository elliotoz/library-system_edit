'use client';

import { useState, useEffect, useRef } from 'react';
import { User, Mail, Building, BookOpen, Tag, Save, X, Pencil, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import toast from 'react-hot-toast';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  studentId?: string;
  staffId?: string;
  interests: string[];
  avatarUrl?: string;
  faculty?: { id: string; name: string; code: string };
  isActive: boolean;
  createdAt: string;
  bio?: string;
  department?: string;
  courses?: string[];
}

const roleColors = {
  STUDENT: 'bg-blue-100 text-blue-700',
  INSTRUCTOR: 'bg-purple-100 text-purple-700',
  STAFF: 'bg-orange-100 text-orange-700',
  ADMIN: 'bg-red-100 text-red-700',
};

export default function ProfilePage() {
  const { refreshUser } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [interests, setInterests] = useState<string[]>([]);
  const [newInterest, setNewInterest] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [editBio, setEditBio] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editCourses, setEditCourses] = useState<string[]>([]);
  const [newCourse, setNewCourse] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch('/api/auth/me', { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          setProfile(data);
          setInterests(data.interests || []);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleAddInterest = () => {
    if (newInterest.trim() && !interests.includes(newInterest.trim())) {
      setInterests([...interests, newInterest.trim()]);
      setNewInterest('');
    }
  };

  const handleRemoveInterest = (interest: string) => {
    setInterests(interests.filter((i) => i !== interest));
  };

  const handleSaveInterests = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/users/interests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ interests }),
      });
      if (response.ok) {
        toast.success('Interests updated');
        setIsEditing(false);
        setProfile((prev) => prev ? { ...prev, interests } : null);
      } else {
        toast.error('Failed to update interests');
      }
    } catch (error) {
      toast.error('Failed to update interests');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditProfile = () => {
    if (profile) {
      setEditName(profile.name);
      setAvatarFile(null);
      setAvatarPreview(null);
      setEditBio(profile.bio || '');
      setEditDepartment(profile.department || '');
      setEditCourses(profile.courses || []);
      setNewCourse('');
      setIsEditingProfile(true);
    }
  };

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSaveProfile = async () => {
    if (!editName.trim() || editName.trim().length < 2) {
      toast.error('Name must be at least 2 characters');
      return;
    }

    const nameChanged = editName.trim() !== profile?.name;
    const isInstructor = profile?.role === 'INSTRUCTOR';
    const bioChanged = isInstructor && editBio !== (profile?.bio || '');
    const deptChanged = isInstructor && editDepartment !== (profile?.department || '');
    const coursesChanged = isInstructor && JSON.stringify(editCourses) !== JSON.stringify(profile?.courses || []);

    if (!nameChanged && !avatarFile && !bioChanged && !deptChanged && !coursesChanged) {
      setIsEditingProfile(false);
      return;
    }

    setIsSavingProfile(true);
    try {
      const formData = new FormData();
      if (nameChanged) formData.append('name', editName.trim());
      if (avatarFile) formData.append('avatar', avatarFile);
      if (bioChanged) formData.append('bio', editBio);
      if (deptChanged) formData.append('department', editDepartment);
      if (coursesChanged) formData.append('courses', JSON.stringify(editCourses));

      const response = await fetch('/api/users/profile', {
        method: 'PATCH',
        credentials: 'include',
        body: formData,
      });
      if (response.ok) {
        const updated = await response.json();
        setProfile((prev) => prev ? { ...prev, name: updated.name, avatarUrl: updated.avatarUrl, bio: updated.bio, department: updated.department, courses: updated.courses } : null);
        await refreshUser();
        toast.success('Profile updated');
        setIsEditingProfile(false);
        if (avatarPreview) {
          URL.revokeObjectURL(avatarPreview);
          setAvatarPreview(null);
        }
        setAvatarFile(null);
      } else {
        const err = await response.json().catch(() => null);
        const msg = err?.message;
        toast.error(Array.isArray(msg) ? msg[0] : msg || 'Failed to update profile');
      }
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-gray-200 rounded" />
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex gap-6">
            <div className="w-24 h-24 bg-gray-200 rounded-full" />
            <div className="flex-1 space-y-3">
              <div className="h-6 bg-gray-200 rounded w-1/3" />
              <div className="h-4 bg-gray-200 rounded w-1/4" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900">Profile not found</h3>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row gap-6">
          <div className="flex-shrink-0">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt={profile.name} className="w-24 h-24 rounded-full object-cover" />
            ) : (
              <div className="w-24 h-24 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white text-3xl font-bold">
                {profile.name.split(' ').map((n) => n[0]).join('').toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-start justify-between">
              {isEditingProfile ? (
                <div className="flex-1 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Avatar</label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleAvatarSelect}
                      className="hidden"
                    />
                    <div className="flex items-center gap-3">
                      {avatarPreview ? (
                        <img src={avatarPreview} alt="Preview" className="w-16 h-16 rounded-full object-cover" />
                      ) : profile.avatarUrl ? (
                        <img src={profile.avatarUrl} alt={profile.name} className="w-16 h-16 rounded-full object-cover" />
                      ) : (
                        <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center text-gray-400">
                          <Camera className="w-6 h-6" />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        {avatarPreview || profile.avatarUrl ? 'Change image' : 'Upload image'}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-400"
                    />
                  </div>
                  {profile.role === 'INSTRUCTOR' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                        <textarea
                          value={editBio}
                          onChange={(e) => setEditBio(e.target.value)}
                          maxLength={500}
                          rows={3}
                          placeholder="Tell students about yourself..."
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-400 resize-none"
                        />
                        <p className="text-xs text-gray-400 mt-1">{editBio.length}/500</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                        <input
                          type="text"
                          value={editDepartment}
                          onChange={(e) => setEditDepartment(e.target.value)}
                          placeholder="e.g. Software Engineering"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-400"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Courses</label>
                        <div className="flex gap-2 mb-2">
                          <input
                            type="text"
                            value={newCourse}
                            onChange={(e) => setNewCourse(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (newCourse.trim() && !editCourses.includes(newCourse.trim())) {
                                  setEditCourses([...editCourses, newCourse.trim()]);
                                  setNewCourse('');
                                }
                              }
                            }}
                            placeholder="Add a course..."
                            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-400"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (newCourse.trim() && !editCourses.includes(newCourse.trim())) {
                                setEditCourses([...editCourses, newCourse.trim()]);
                                setNewCourse('');
                              }
                            }}
                            className="px-3 py-2 bg-primary-500 text-white rounded-lg text-sm hover:bg-primary-600"
                          >
                            Add
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {editCourses.map((course) => (
                            <span
                              key={course}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-sm"
                            >
                              {course}
                              <button
                                type="button"
                                onClick={() => setEditCourses(editCourses.filter((c) => c !== course))}
                                className="hover:text-purple-900"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => { setIsEditingProfile(false); if (avatarPreview) URL.revokeObjectURL(avatarPreview); setAvatarPreview(null); setAvatarFile(null); }} className="text-gray-500 hover:text-gray-700 text-sm">Cancel</button>
                    <button onClick={handleSaveProfile} disabled={isSavingProfile} className="flex items-center gap-1 px-3 py-1 bg-primary-500 text-white rounded-lg text-sm hover:bg-primary-600 disabled:opacity-50">
                      <Save className="w-4 h-4" />{isSavingProfile ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{profile.name}</h2>
                    <span className={cn('inline-block px-3 py-1 rounded-full text-sm font-medium mt-1', roleColors[profile.role as keyof typeof roleColors])}>
                      {profile.role}
                    </span>
                  </div>
                  <button onClick={handleEditProfile} className="text-primary-600 hover:text-primary-700" title="Edit profile">
                    <Pencil className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div className="flex items-center gap-2 text-gray-600">
                <Mail className="w-4 h-4" />
                <span>{profile.email}</span>
              </div>
              {profile.faculty && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Building className="w-4 h-4" />
                  <span>{profile.faculty.name}</span>
                </div>
              )}
              {profile.studentId && (
                <div className="flex items-center gap-2 text-gray-600">
                  <BookOpen className="w-4 h-4" />
                  <span>Student ID: {profile.studentId}</span>
                </div>
              )}
              {profile.staffId && (
                <div className="flex items-center gap-2 text-gray-600">
                  <BookOpen className="w-4 h-4" />
                  <span>Staff ID: {profile.staffId}</span>
                </div>
              )}
            </div>
            <p className="text-sm text-gray-400 mt-4">Member since {new Date(profile.createdAt).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-primary-500" />
            <h3 className="text-lg font-semibold text-gray-900">My Interests</h3>
          </div>
          {!isEditing ? (
            <button onClick={() => setIsEditing(true)} className="text-primary-600 hover:text-primary-700 text-sm font-medium">Edit</button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => { setIsEditing(false); setInterests(profile.interests || []); }} className="text-gray-500 hover:text-gray-700 text-sm">Cancel</button>
              <button onClick={handleSaveInterests} disabled={isSaving} className="flex items-center gap-1 px-3 py-1 bg-primary-500 text-white rounded-lg text-sm hover:bg-primary-600 disabled:opacity-50">
                <Save className="w-4 h-4" />Save
              </button>
            </div>
          )}
        </div>
        <p className="text-sm text-gray-500 mb-4">Your interests help us recommend relevant books for you.</p>
        {isEditing && (
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newInterest}
              onChange={(e) => setNewInterest(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddInterest()}
              placeholder="Add an interest..."
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-400"
            />
            <button onClick={handleAddInterest} className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600">Add</button>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {interests.length === 0 ? (
            <p className="text-gray-400">No interests added yet</p>
          ) : (
            interests.map((interest, index) => (
              <span key={index} className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-full text-sm">
                {interest}
                {isEditing && (
                  <button onClick={() => handleRemoveInterest(interest)} className="hover:text-primary-900">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            ))
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Borrow Policy</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">Max Books</p>
            <p className="text-2xl font-bold text-gray-900">
              {profile.role === 'STUDENT' ? '5' : profile.role === 'INSTRUCTOR' ? '10' : profile.role === 'ADMIN' ? '20' : '5'}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">Borrow Duration</p>
            <p className="text-2xl font-bold text-gray-900">
              {profile.role === 'STUDENT' ? '14' : profile.role === 'INSTRUCTOR' ? '30' : profile.role === 'ADMIN' ? '60' : '14'} days
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">Max Extensions</p>
            <p className="text-2xl font-bold text-gray-900">
              {profile.role === 'STUDENT' ? '2' : profile.role === 'INSTRUCTOR' ? '3' : profile.role === 'ADMIN' ? '5' : '2'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
