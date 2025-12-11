# Story 4.2: Testing & Deployment Plan

## Admin Tutorial & Exercise Creation System

**Date Created:** 2025-10-16
**Status:** Testing Phase
**Implementation:** ✅ Complete
**Testing:** 🚧 In Progress

---

## Executive Summary

Story 4.2 implementation is **complete** with all frontend components, backend APIs, database migrations, and storage configuration ready. This document outlines the testing and deployment strategy to validate the implementation and move to production.

## Implementation Status ✅

### Completed Components

#### Frontend (✅ Complete)

- **Admin Pages:**
  - `/admin/tutorials` - Tutorial list page
  - `/admin/tutorials/new` - Create new tutorial
  - `/admin/tutorials/[slug]/edit` - Edit tutorial page
  - `/admin/layout.tsx` - Admin layout wrapper

- **Shared Components:**
  - `domains/admin/components/AdminToolbar.tsx` - Save/publish controls
  - `domains/admin/components/EditableField.tsx` - In-place editing wrapper
  - `domains/admin/components/MidiDropZone.tsx` - MIDI file upload
  - `domains/admin/components/ExerciseFormModal.tsx` - Exercise creation/editing
  - `domains/admin/components/ExerciseListEdit.tsx` - Exercise management

#### Backend (✅ Complete)

- **Controllers:**
  - `AdminTutorialsController` - Full CRUD for tutorials
  - `AdminExercisesController` - Full CRUD for exercises

- **Services:**
  - `AdminTutorialsService` - Tutorial business logic
  - `AdminExercisesService` - Exercise business logic

- **Security:**
  - `AdminGuard` - Role-based access control
  - `CurrentUser` decorator - User extraction
  - `CorrelationId` decorator - Request tracking

#### Database (✅ Complete)

- **Migrations:**
  - `20250723000002_enhance_tutorials_exercises_story42.sql`
  - `20251002000002_create_exercise_midi_bucket.sql`
  - Admin role enhancements
  - MIDI file tracking fields
  - RLS policies for admin access

---

## Testing Requirements

### 1. Database Migration Validation

**Prerequisites:**

- Supabase project accessible
- Migrations applied to test database
- Test admin user created

**Steps:**

```bash
# 1. Check Supabase connection
curl https://htuztkrbuewheehjspcz.supabase.co/rest/v1/

# 2. Verify migrations are applied
# Login to Supabase dashboard and check:
# - tutorials table has all Story 4.2 fields
# - exercises table has MIDI tracking fields
# - tutorial_sections table exists
# - RLS policies are in place
# - exercise-midi-files bucket exists

# 3. Create test admin user (if not exists)
# In Supabase SQL Editor:
UPDATE profiles
SET role = 'admin'
WHERE email = 'YOUR_TEST_EMAIL@example.com';
```

**Verification Checklist:**

- [ ] All Story 4.2 migrations applied successfully
- [ ] `tutorials` table has: `author_name`, `category`, `tags`, `order_index`, `published_at`, `view_count`, `created_by`
- [ ] `exercises` table has: `has_metronome_midi`, `has_drums_midi`, `has_bass_midi`, `has_harmony_midi`
- [ ] `tutorial_sections` table exists
- [ ] RLS policies allow admin access
- [ ] Storage bucket `exercise-midi-files` exists
- [ ] Test admin user has `role = 'admin'` in profiles table

---

### 2. Backend API Testing

#### Test 1: Authentication & Authorization

```bash
# Test without authentication (should fail)
curl -X GET http://localhost:3000/api/v1/tutorials \
  -H "Content-Type: application/json"

# Expected: 401 Unauthorized or access with limited data

# Test with admin authentication
# First, login to get JWT token:
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"your_password"}'

# Use the token for subsequent requests:
export TOKEN="your_jwt_token"
```

#### Test 2: Tutorial CRUD Operations

```bash
# 1. Create Tutorial
curl -X POST http://localhost:3000/api/v1/tutorials \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Tutorial for Story 4.2",
    "description": "Testing admin creation system",
    "youtube_video_id": "dQw4w9WgXcQ",
    "difficulty": "beginner",
    "category": "bass-techniques"
  }'

# Expected: 201 Created with tutorial object

# 2. List Tutorials
curl -X GET "http://localhost:3000/api/v1/tutorials?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN"

# Expected: 200 OK with paginated tutorial list

# 3. Get Tutorial by ID
curl -X GET http://localhost:3000/api/v1/tutorials/TUTORIAL_ID \
  -H "Authorization: Bearer $TOKEN"

# Expected: 200 OK with tutorial details

# 4. Update Tutorial
curl -X PUT http://localhost:3000/api/v1/tutorials/TUTORIAL_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Test Tutorial",
    "description": "Updated description"
  }'

# Expected: 200 OK with updated tutorial

# 5. Publish Tutorial
curl -X POST http://localhost:3000/api/v1/tutorials/TUTORIAL_ID/publish \
  -H "Authorization: Bearer $TOKEN"

# Expected: 200 OK, tutorial.published_at is set

# 6. Delete Tutorial
curl -X DELETE http://localhost:3000/api/v1/tutorials/TUTORIAL_ID \
  -H "Authorization: Bearer $TOKEN"

# Expected: 204 No Content
```

#### Test 3: Exercise CRUD Operations

```bash
# 1. Create Exercise
curl -X POST http://localhost:3000/api/v1/exercises \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tutorial_id": "TUTORIAL_ID",
    "title": "Test Exercise 1",
    "description": "Testing exercise creation",
    "bpm": 120,
    "duration": 240,
    "time_signature": {"numerator": 4, "denominator": 4},
    "difficulty": "beginner",
    "order_index": 1
  }'

# Expected: 201 Created with exercise object

# 2. List Exercises for Tutorial
curl -X GET http://localhost:3000/api/v1/exercises/tutorial/TUTORIAL_ID \
  -H "Authorization: Bearer $TOKEN"

# Expected: 200 OK with exercise list

# 3. Update Exercise
curl -X PUT http://localhost:3000/api/v1/exercises/EXERCISE_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bpm": 140,
    "title": "Updated Exercise"
  }'

# Expected: 200 OK with updated exercise

# 4. Update MIDI Status
curl -X PATCH http://localhost:3000/api/v1/exercises/EXERCISE_ID/midi-status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "track": "bass",
    "has_midi": true
  }'

# Expected: 200 OK with updated exercise

# 5. Delete Exercise
curl -X DELETE http://localhost:3000/api/v1/exercises/EXERCISE_ID \
  -H "Authorization: Bearer $TOKEN"

# Expected: 204 No Content
```

**API Testing Checklist:**

- [ ] Admin guard blocks non-admin users
- [ ] Tutorial creation works
- [ ] Tutorial listing with pagination works
- [ ] Tutorial retrieval by ID works
- [ ] Tutorial update works
- [ ] Tutorial publish/unpublish works
- [ ] Tutorial deletion works (cascades to exercises)
- [ ] Exercise creation works
- [ ] Exercise listing by tutorial works
- [ ] Exercise update works
- [ ] MIDI status updates work
- [ ] Exercise deletion works
- [ ] Error handling returns proper HTTP status codes
- [ ] Correlation IDs are logged for all requests

---

### 3. Frontend Testing

#### Manual Testing Steps

**Setup:**

1. Start backend: `pm2 restart bassnotion-backend`
2. Start frontend: `pm2 restart bassnotion-frontend`
3. Navigate to `http://localhost:3001`
4. Login as admin user

**Test 1: Admin Access**

- [ ] Navigate to `/admin` (should redirect to `/admin/tutorials`)
- [ ] Admin layout loads correctly
- [ ] Navigation menu shows admin options

**Test 2: Tutorial List Page (`/admin/tutorials`)**

- [ ] Page loads without errors
- [ ] Tutorials are displayed in a table/list
- [ ] Pagination works (if >20 tutorials)
- [ ] "Create New Tutorial" button is visible
- [ ] Search functionality works (if implemented)
- [ ] Clicking tutorial redirects to edit page

**Test 3: Create Tutorial (`/admin/tutorials/new`)**

- [ ] Page loads without errors
- [ ] Form has all required fields:
  - Title (required)
  - Description
  - YouTube Video ID
  - Difficulty (dropdown)
  - Category
  - Tags
- [ ] YouTube video preview works (when ID entered)
- [ ] "Save Draft" button works
- [ ] "Publish" button works
- [ ] Form validation shows errors for invalid input
- [ ] Success message after save
- [ ] Redirects to edit page after creation

**Test 4: Edit Tutorial (`/admin/tutorials/[slug]/edit`)**

- [ ] Page loads with tutorial data
- [ ] All fields are editable
- [ ] In-place editing works (if implemented)
- [ ] Auto-save works (if implemented)
- [ ] "Save" button updates tutorial
- [ ] "Preview" mode shows student view
- [ ] Exercise list displays correctly
- [ ] "Add Exercise" button opens modal/form

**Test 5: Exercise Management**

- [ ] "Add Exercise" button opens form modal
- [ ] Exercise form has all fields:
  - Title (required)
  - Description
  - BPM (40-200 validation)
  - Duration (measures/beats)
  - Time signature
  - Difficulty
- [ ] Exercise creation adds to list
- [ ] Exercise list shows all exercises
- [ ] Drag-and-drop reordering works (if implemented)
- [ ] Edit exercise button opens form with data
- [ ] Delete exercise button works (with confirmation)
- [ ] Exercise order persists after save

**Test 6: MIDI File Upload**

- [ ] MIDI drop zones visible for each track type:
  - Metronome
  - Drums
  - Bass
  - Harmony
- [ ] Drag-and-drop file upload works
- [ ] Click to select file works
- [ ] File validation works (MIDI files only)
- [ ] Upload progress indicator shows
- [ ] Success message after upload
- [ ] File name displays after upload
- [ ] Exercise `has_*_midi` flags update
- [ ] Can replace existing MIDI file

**Test 7: Preview & Playback**

- [ ] "Preview" button switches to student view
- [ ] All components render correctly in preview
- [ ] MIDI files play correctly (if uploaded)
- [ ] Playback controls work
- [ ] Can return to edit mode

**Test 8: Publish Workflow**

- [ ] "Publish" button visible
- [ ] Publishing marks tutorial as active
- [ ] Published tutorials visible to non-admin users
- [ ] "Unpublish" button works
- [ ] Unpublished tutorials hidden from non-admin

**Frontend Testing Checklist:**

- [ ] No console errors on any page
- [ ] All forms validate input correctly
- [ ] All CRUD operations work end-to-end
- [ ] Loading states display during async operations
- [ ] Error messages display for failures
- [ ] Success notifications show for successful operations
- [ ] Navigation works correctly
- [ ] Responsive design works on different screen sizes
- [ ] Keyboard navigation works
- [ ] Accessibility (a11y) - basic checks

---

### 4. Integration Testing

**End-to-End Workflow Test:**

1. **Create Complete Tutorial:**
   - [ ] Login as admin
   - [ ] Create new tutorial with all fields
   - [ ] Verify tutorial saved to database
   - [ ] Add 3 exercises to tutorial
   - [ ] Upload MIDI files for each exercise (all 4 tracks)
   - [ ] Verify files uploaded to Supabase storage
   - [ ] Verify exercise metadata updated
   - [ ] Reorder exercises
   - [ ] Save tutorial

2. **Publish & Verify:**
   - [ ] Publish tutorial
   - [ ] Logout
   - [ ] Login as regular user (or view without login)
   - [ ] Navigate to library/tutorials
   - [ ] Verify tutorial is visible
   - [ ] Open tutorial
   - [ ] Verify all exercises load
   - [ ] Play exercise
   - [ ] Verify MIDI files play correctly
   - [ ] Verify all 4 tracks play in sync

3. **Edit & Unpublish:**
   - [ ] Login as admin
   - [ ] Edit tutorial (change title, description)
   - [ ] Update exercise (change BPM, duration)
   - [ ] Replace MIDI file
   - [ ] Unpublish tutorial
   - [ ] Verify tutorial no longer visible to non-admin

4. **Delete & Cleanup:**
   - [ ] Delete tutorial
   - [ ] Verify exercises deleted (cascade)
   - [ ] Verify MIDI files removed from storage (manual check)

**Integration Checklist:**

- [ ] Full create-to-publish workflow works
- [ ] MIDI files play correctly in student view
- [ ] Multi-track synchronization works
- [ ] Tutorial visibility respects published state
- [ ] Admin-only features blocked for non-admin
- [ ] Data consistency across frontend/backend/database
- [ ] File storage correctly linked to database records

---

### 5. Performance Testing

**Metrics to Measure:**

- [ ] Tutorial list page load time (<2 seconds)
- [ ] Tutorial edit page load time (<3 seconds)
- [ ] MIDI file upload time (<5 seconds for 1MB file)
- [ ] Tutorial save/update time (<1 second)
- [ ] Exercise playback initialization (<2 seconds)

**Load Testing (Optional):**

- [ ] 10 concurrent admin users creating tutorials
- [ ] 100 concurrent students viewing tutorials
- [ ] Multiple MIDI uploads simultaneously

---

### 6. Security Testing

**Access Control:**

- [ ] Non-admin cannot access `/admin` routes (401/403)
- [ ] Non-admin cannot call admin API endpoints
- [ ] Authenticated non-admin cannot modify tutorials
- [ ] Unauthenticated users cannot upload files
- [ ] RLS policies enforce data access rules

**Input Validation:**

- [ ] XSS prevention (script tags in title/description)
- [ ] SQL injection prevention (tested by ORM)
- [ ] File upload validation (MIDI only, size limit)
- [ ] BPM range validation (40-200)
- [ ] Slug uniqueness validation

**Data Protection:**

- [ ] Sensitive data not exposed in API responses
- [ ] JWT tokens have proper expiration
- [ ] Service role key not exposed to frontend

---

## Deployment Plan

### Pre-Deployment Checklist

- [ ] All tests passing (unit, integration, e2e)
- [ ] No console errors in production build
- [ ] Environment variables configured for staging
- [ ] Database migrations ready to apply
- [ ] Storage buckets configured
- [ ] Admin users identified and roles assigned
- [ ] Rollback plan documented

### Staging Deployment

**Step 1: Database Migration**

```bash
# Connect to staging Supabase project
# Apply migrations in order:
# 1. 20250723000002_enhance_tutorials_exercises_story42.sql
# 2. 20251002000002_create_exercise_midi_bucket.sql
# 3. Verify all migrations applied successfully
```

**Step 2: Backend Deployment**

```bash
# Build backend
cd apps/backend
pnpm build

# Deploy to staging (Railway, Render, etc.)
# Set environment variables:
# - SUPABASE_URL
# - SUPABASE_SERVICE_ROLE_KEY
# - JWT_SECRET
# - PORT
# - NODE_ENV=staging

# Verify deployment
curl https://staging-api.bassnotion.com/health
```

**Step 3: Frontend Deployment**

```bash
# Build frontend
cd apps/frontend
pnpm next build

# Deploy to staging (Vercel, Netlify, etc.)
# Set environment variables:
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
# - NEXT_PUBLIC_API_URL

# Verify deployment
open https://staging.bassnotion.com
```

**Step 4: Smoke Testing**

- [ ] Access staging admin panel
- [ ] Create test tutorial
- [ ] Upload test MIDI files
- [ ] Publish tutorial
- [ ] Verify in student view
- [ ] Delete test tutorial

**Step 5: Stakeholder Demo**

- [ ] Schedule demo with product owner
- [ ] Walk through admin workflow
- [ ] Collect feedback
- [ ] Document issues

### Production Deployment

**Prerequisites:**

- [ ] Staging tested and approved
- [ ] All stakeholders signed off
- [ ] Rollback plan tested
- [ ] Backup database before deployment

**Deployment Steps:**

1. [ ] Apply database migrations to production
2. [ ] Deploy backend to production
3. [ ] Deploy frontend to production
4. [ ] Run smoke tests on production
5. [ ] Monitor logs for errors
6. [ ] Notify users of new features

---

## Known Issues & Limitations

### Current Limitations:

1. **MIDI File Preview:** No inline MIDI player in admin interface (must test in preview mode)
2. **Batch Operations:** No bulk upload or batch editing
3. **Version History:** No undo/redo or version tracking
4. **Collaborative Editing:** Single admin at a time
5. **Asset Management:** No built-in MIDI file library browser

### Technical Debt:

1. Need unit tests for admin components
2. Need E2E tests for admin workflows
3. Error recovery for failed uploads
4. Optimistic UI updates needed

### Future Enhancements:

1. MIDI file editor/viewer
2. Auto-save every 30 seconds
3. Collaborative editing (multiple admins)
4. Version history and rollback
5. Template system for tutorials
6. Batch import from CSV/JSON

---

## Success Criteria

Story 4.2 is considered **COMPLETE** when:

- [x] All backend API endpoints working
- [x] All frontend components implemented
- [ ] All tests passing (unit, integration, e2e)
- [ ] Admin can create tutorial with exercises
- [ ] Admin can upload MIDI files successfully
- [ ] MIDI files play correctly in student view
- [ ] Published tutorials visible to students
- [ ] Deployed to staging successfully
- [ ] Stakeholder demo completed and approved
- [ ] Deployed to production successfully
- [ ] No critical bugs in production

---

## Testing Timeline

**Week 1 (Current):**

- Day 1-2: Database migration validation
- Day 3-4: Backend API testing
- Day 5: Frontend manual testing

**Week 2:**

- Day 1-2: Integration testing
- Day 3: Performance and security testing
- Day 4: Staging deployment
- Day 5: Stakeholder demo

**Week 3:**

- Day 1-2: Fix issues from testing
- Day 3: Final regression testing
- Day 4: Production deployment
- Day 5: Post-deployment monitoring

---

## Contact & Support

**Technical Lead:** [Your Name]
**QA Lead:** [QA Name]
**Product Owner:** [PO Name]

**Issues:** Report to GitHub Issues or internal ticket system
**Questions:** Slack #bassnotion-dev channel

---

## Appendix

### A. Test Data

**Sample Tutorial:**

```json
{
  "title": "Walking Bass Fundamentals",
  "description": "Learn the fundamentals of walking bass lines",
  "youtube_video_id": "dQw4w9WgXcQ",
  "difficulty": "beginner",
  "category": "bass-techniques",
  "tags": ["walking-bass", "jazz", "fundamentals"]
}
```

**Sample Exercise:**

```json
{
  "title": "Exercise 1: Basic Walking Pattern",
  "description": "Practice basic quarter note walking pattern",
  "bpm": 120,
  "duration": 240,
  "time_signature": { "numerator": 4, "denominator": 4 },
  "difficulty": "beginner",
  "order_index": 1
}
```

### B. API Endpoints Reference

See `apps/backend/src/domains/tutorials/admin-tutorials.controller.ts` and
`apps/backend/src/domains/exercises/admin-exercises.controller.ts` for full API documentation.

### C. Database Schema

See migration files:

- `apps/backend/supabase/migrations/20250723000002_enhance_tutorials_exercises_story42.sql`
- `apps/backend/supabase/migrations/20251002000002_create_exercise_midi_bucket.sql`

---

**Last Updated:** 2025-10-16
**Document Version:** 1.0
**Next Review Date:** After staging deployment
