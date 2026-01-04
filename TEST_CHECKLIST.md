# 🧪 Test Checklist

Use this checklist to verify all features work correctly before deployment.

---

## 🔐 Authentication

### Login Page
- [ ] Page loads at `/login`
- [ ] Form validation shows errors for empty fields
- [ ] Invalid credentials show error message
- [ ] Successful login redirects to correct dashboard based on role
- [ ] Token and user cookies are set after login

### Logout
- [ ] Logout button works in sidebar
- [ ] Cookies are cleared after logout
- [ ] Redirects to login page

### Route Protection
- [ ] Unauthenticated users redirected to login
- [ ] Students cannot access `/dashboard/admin/*`
- [ ] Staff cannot access admin-only routes
- [ ] Each role lands on correct dashboard

---

## 👤 Student Features

### Dashboard (`/dashboard/student`)
- [ ] Welcome message shows user's first name
- [ ] Stats cards show real data from API
- [ ] Quick action links work
- [ ] Recommended books section loads
- [ ] Current borrows table displays

### Book Catalog (`/dashboard/catalog`)
- [ ] Books load on page open
- [ ] Search filters books by title/author
- [ ] Faculty filter works
- [ ] Category filter works
- [ ] Availability filter works
- [ ] Sorting works (A-Z, Z-A, Newest, Oldest)
- [ ] Pagination works
- [ ] Book cards link to detail page

### Book Detail (`/dashboard/catalog/[id]`)
- [ ] Book information displays correctly
- [ ] Authors, ISBN, publisher shown
- [ ] Campus availability shows correct counts
- [ ] Reserve button visible when copies available
- [ ] Campus selector for reservation works

### My Borrowed Books (`/dashboard/borrowed`)
- [ ] Lists user's borrowed books
- [ ] Shows due dates and days remaining
- [ ] Overdue books highlighted in red
- [ ] Extend button works
- [ ] Extension count displays
- [ ] Filter tabs work (All, Active, Returned)

### My Reservations (`/dashboard/reservations`)
- [ ] Lists user's reservations
- [ ] Status badges show correctly
- [ ] Ready for pickup alert shows when applicable
- [ ] Cancel button works for pending reservations
- [ ] Filter tabs work

### AI Assistant (`/dashboard/ai-assistant`)
- [ ] Chat interface loads
- [ ] Can send messages
- [ ] AI responds with relevant information
- [ ] Suggested questions work
- [ ] Chat history maintained in session

### Profile (`/dashboard/profile`)
- [ ] User info displays correctly
- [ ] Faculty name shown if available
- [ ] Edit interests works
- [ ] Add/remove interest tags
- [ ] Save interests persists changes
- [ ] Borrow policy card shows correct limits

---

## 👨‍💼 Admin Features

### Admin Dashboard (`/dashboard/admin`)
- [ ] Stats cards show real data
- [ ] Pending reservations count accurate
- [ ] Overdue books count accurate
- [ ] Recent activity feed loads
- [ ] Quick action links work

### Manage Users (`/dashboard/admin/users`)
- [ ] Users list loads
- [ ] Search by name/email works
- [ ] Role filter works
- [ ] Status filter works
- [ ] Pagination works
- [ ] Activate/Deactivate buttons work
- [ ] Status updates immediately

### Manage Books (`/dashboard/admin/books`)
- [ ] Books list loads
- [ ] Search works
- [ ] Shows available/total copies
- [ ] Edit link goes to book detail
- [ ] Delete button works (with confirmation)
- [ ] Pagination works

### Pending Reservations (`/dashboard/admin/reservations`)
- [ ] Shows only pending reservations
- [ ] User info displayed
- [ ] Book info displayed
- [ ] Branch displayed
- [ ] Approve button works
- [ ] Reject button works
- [ ] List updates after action

---

## 🎨 UI/UX

### Responsive Design
- [ ] Desktop layout works (1920px)
- [ ] Laptop layout works (1366px)
- [ ] Tablet layout works (768px)
- [ ] Mobile layout works (375px)

### Navigation
- [ ] Sidebar collapses on mobile
- [ ] Mobile menu toggle works
- [ ] Active route highlighted
- [ ] All links navigate correctly

### Notifications
- [ ] Success toasts appear (green)
- [ ] Error toasts appear (red)
- [ ] Toasts auto-dismiss

### Loading States
- [ ] Skeleton loaders show during data fetch
- [ ] Buttons show loading state when processing
- [ ] Empty states display when no data

---

## 🔧 API Endpoints

### Books API
- [ ] `GET /books` - List with filters
- [ ] `GET /books/:id` - Single book
- [ ] `GET /books/categories` - Categories list
- [ ] `GET /books/faculties` - Faculties list

### Borrows API
- [ ] `GET /borrows/my` - User's borrows
- [ ] `PATCH /borrows/:id/extend` - Extend borrow
- [ ] `GET /borrows/stats` - Stats (admin)

### Reservations API
- [ ] `GET /reservations/my` - User's reservations
- [ ] `POST /reservations` - Create reservation
- [ ] `PATCH /reservations/:id/cancel` - Cancel
- [ ] `PATCH /reservations/:id/approve` - Approve (admin)
- [ ] `PATCH /reservations/:id/reject` - Reject (admin)
- [ ] `GET /reservations/pending` - Pending list (admin)

### Dashboard API
- [ ] `GET /dashboard/admin` - Admin stats
- [ ] `GET /dashboard/student` - Student stats
- [ ] `GET /dashboard/activity` - Recent activity

### Users API
- [ ] `GET /users` - List users (admin)
- [ ] `PATCH /users/:id/activate` - Activate
- [ ] `PATCH /users/:id/deactivate` - Deactivate

---

## 🐳 Docker

- [ ] `docker-compose up -d` starts all services
- [ ] Frontend accessible at localhost:3000
- [ ] API accessible at localhost:3001
- [ ] Database connects successfully
- [ ] Migrations run correctly
- [ ] Seed data populates

---

## 📝 Notes

### Known Issues
- (List any known issues here)

### Test Environment
- **OS:** 
- **Browser:** 
- **Node Version:** 
- **Date Tested:** 

### Tester
- **Name:** 
- **Date:** 

---

## ✅ Sign-Off

- [ ] All critical features tested
- [ ] No blocking bugs found
- [ ] Ready for deployment

**Approved by:** _________________ **Date:** _________________
