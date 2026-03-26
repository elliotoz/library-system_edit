// types/index.ts

export type Role = 'STUDENT' | 'INSTRUCTOR' | 'STAFF' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  facultyId: string | null;
  facultyName: string | null;
  studentId: string | null;
  staffId: string | null;
  interests: string[];
  avatarUrl: string | null;
}

export interface AuthResponse {
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface Faculty {
  id: string;
  name: string;
  code: string;
  description: string | null;
  defaultBranchId: string | null;
}

export interface BorrowPolicy {
  id: string;
  role: Role;
  maxActiveBorrows: number;
  maxBorrowDays: number;
  maxExtensions: number;
  extensionDays: number;
  description: string | null;
}

export interface UserProfile extends User {
  faculty: Faculty | null;
  borrowPolicy: BorrowPolicy | null;
  activeBorrowsCount: number;
  remainingBorrows: number;
}

export interface ApiError {
  message: string;
  statusCode: number;
  error?: string;
}

// Role-based dashboard routes
export const DASHBOARD_ROUTES: Record<Role, string> = {
  STUDENT: '/dashboard/student',
  INSTRUCTOR: '/dashboard/instructor',
  STAFF: '/dashboard/staff',
  ADMIN: '/dashboard/admin',
};

// Role display names
export const ROLE_LABELS: Record<Role, string> = {
  STUDENT: 'Student',
  INSTRUCTOR: 'Instructor',
  STAFF: 'Staff',
  ADMIN: 'Admin',
};

// Role badge colors (Tailwind classes)
export const ROLE_COLORS: Record<Role, string> = {
  STUDENT: 'bg-blue-100 text-blue-700',
  INSTRUCTOR: 'bg-purple-100 text-purple-700',
  STAFF: 'bg-orange-100 text-orange-700',
  ADMIN: 'bg-red-100 text-red-700',
};
export type ReservationStatus =
  | 'PENDING'
  | 'READY_FOR_PICKUP'
  | 'COLLECTED'
  | 'CANCELLED'
  | 'EXPIRED';

export interface Reservation {
  id: string;
  status: ReservationStatus;
  createdAt: string;
  expiresAt: string | null;
  pickupDeadline: string | null;
  book: {
    id: string;
    title: string;
    authors: string[];
    coverImageUrl: string | null;
  };
  branch: {
    id: string;
    name: string;
    code: string;
    address?: string;
  };
}

export interface ReservationInfo {
  activeReservations: number;
  reservationLimit: number;
  remainingReservations: number;
  canReserve: boolean;
}

// Reservation limits by role
export const RESERVATION_LIMITS: Record<Role, number> = {
  STUDENT: 3,
  INSTRUCTOR: 5,
  STAFF: 3,
  ADMIN: 10,
};

// Book availability
export interface BranchAvailability {
  branch: {
    id: string;
    name: string;
    code: string;
  };
  total: number;
  available: number;
}

// Reading Lists
export interface ReadingListItem {
  id: string;
  orderIndex: number;
  notes: string | null;
  readingListId: string;
  bookId: string;
  createdAt: string;
  book: {
    id: string;
    title: string;
    authors: string[];
    coverImageUrl: string | null;
  };
}

export type ReadingListVisibility = 'PUBLIC' | 'FOLLOWERS_ONLY' | 'PRIVATE';
export type ReadingListStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface ReadingList {
  id: string;
  title: string;
  description: string | null;
  courseCode: string | null;
  semester: string | null;
  isActive: boolean;
  visibility: ReadingListVisibility;
  status: ReadingListStatus;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  items: ReadingListItem[];
  _count: { items: number };
  owner?: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    bio?: string | null;
    department?: string | null;
    courses?: string[];
  };
  locked?: boolean;
}

export interface InstructorProfile {
  instructor: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    role: string;
    bio?: string | null;
    department?: string | null;
    courses?: string[];
  };
  followersCount: number;
  isFollowing: boolean;
  readingLists: ReadingList[];
}

// Instructor Followers
export interface FollowedInstructor {
  id: string;
  followerId: string;
  instructorId: string;
  createdAt: string;
  instructor: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    role: string;
  };
}

export interface InstructorFollower {
  id: string;
  followerId: string;
  instructorId: string;
  createdAt: string;
  follower: {
    id: string;
    name: string;
    avatarUrl: string | null;
    role: string;
  };
}

export interface FollowersCount {
  instructorId: string;
  count: number;
}

export interface FollowingStatus {
  instructorId: string;
  isFollowing: boolean;
}

export interface BookDetail {
  id: string;
  title: string;
  authors: string[];
  isbn: string | null;
  description: string | null;
  publisher: string | null;
  publicationYear: number | null;
  edition: string | null;
  pageCount: number | null;
  language: string;
  category: string | null;
  subjectTags: string[];
  coverImageUrl: string | null;
  isEbookAvailable: boolean;
  mainFaculty: { id: string; name: string; code: string } | null;
  totalCopies: number;
  availableCopies: number;
  isAvailable: boolean;
  availability: BranchAvailability[];
}
