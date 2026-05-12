# Learning Style Settings - Implementation Plan

## Overview

Add a **Learning Style** preference that allows users to choose how strictly they want to follow their learning journey/path. This introduces the "student object" concept into the platform.

## Learning Style Options

| Style | Default | Description | Behavior |
|-------|---------|-------------|----------|
| **Free Flow** | Yes | Complete the path at your own pace. Recommendations available but never required. | No blocking, no nudges, full freedom |
| **Guided Practice** | No | Get nudges to complete recommended sessions between checkpoints. | Soft reminders, non-blocking progress |
| **Strict Mode** | No | Must complete recommended sessions before proceeding to next checkpoint. | Blocking progress, required completion |

## Current State Analysis

### What Exists

1. **Database Schema** (`profiles` table):
   - Assessment results: `skill_level`, `assessment_completed`, `primary_goal`, etc.
   - Journey assignment via `user_journeys` table
   - No learning style preference column yet

2. **Types** (`libs/contracts/src/types/`):
   - `UserProfile` with `preferences: UserPreferences`
   - `UserPreferences` contains: `theme`, `emailNotifications`, `defaultMetronomeSettings`, `bassConfiguration`
   - No learning style field yet

3. **Journey System**:
   - `LearningJourney` templates with milestones
   - `UserJourney` tracks progress: `currentMilestoneIndex`, `completedMilestones`, `status`
   - `MilestoneUnlockCriteria` exists but isn't fully implemented

4. **Settings Page** (`/app/settings`):
   - Already exists at `apps/frontend/src/app/app/settings/page.tsx`
   - Has Profile Information, Admin Tools, Account Settings sections
   - Uses dialogs for profile editing, password change, account deletion
   - Dark theme styling with zinc colors

5. **Backend Services**:
   - `UserService.updateProfile()` - updates basic profile fields
   - `UserController` - GET/PUT `/api/user/profile`

---

## Implementation Plan

### Phase 1: Database Schema

**File**: `supabase/migrations/20260130000001_add_learning_style_to_profiles.sql`

```sql
-- Add learning_style column to profiles table
ALTER TABLE profiles
ADD COLUMN learning_style TEXT DEFAULT 'free_flow'
CHECK (learning_style IN ('free_flow', 'guided_practice', 'strict_mode'));

-- Add index for efficient queries
CREATE INDEX idx_profiles_learning_style ON profiles(learning_style);

-- Comment for documentation
COMMENT ON COLUMN profiles.learning_style IS
  'User preference for learning journey progression: free_flow (default), guided_practice, strict_mode';
```

---

### Phase 2: Type Definitions

**File**: `libs/contracts/src/types/user.ts`

Add new type and update `UserPreferences`:

```typescript
// New type for learning style
export type LearningStyle = 'free_flow' | 'guided_practice' | 'strict_mode';

// Update UserPreferences interface
export interface UserPreferences {
  theme: 'light' | 'dark';
  emailNotifications: boolean;
  defaultMetronomeSettings: MetronomeSettings;
  bassConfiguration: BassConfiguration;
  learningStyle: LearningStyle;  // NEW
}
```

**File**: `libs/contracts/src/types/index.ts`

Export the new type:
```typescript
export type { LearningStyle } from './user.js';
```

---

### Phase 3: Backend Updates

#### 3.1 Update UserService

**File**: `apps/backend/src/domains/user/user.service.ts`

Add method to update learning style:

```typescript
async updateLearningStyle(
  userId: string,
  learningStyle: LearningStyle,
): Promise<UserProfile> {
  const validStyles = ['free_flow', 'guided_practice', 'strict_mode'];
  if (!validStyles.includes(learningStyle)) {
    throw new BadRequestException('Invalid learning style');
  }

  const { data: updatedProfile, error } = await this.db.supabase
    .from('profiles')
    .update({
      learning_style: learningStyle,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update learning style: ${error.message}`);
  }

  return this.mapProfileToUserProfile(updatedProfile);
}
```

Update `mapProfileToUserProfile()` to include learning style:

```typescript
private mapProfileToUserProfile(profile: any): UserProfile {
  return {
    // ... existing fields ...
    preferences: {
      // ... existing preferences ...
      learningStyle: profile.learning_style || 'free_flow',
    },
  };
}
```

#### 3.2 Update UserController

**File**: `apps/backend/src/domains/user/user.controller.ts`

Add new endpoint:

```typescript
@Put('preferences/learning-style')
@UseGuards(AuthGuard)
@HttpCode(HttpStatus.OK)
async updateLearningStyle(
  @Body() body: { learningStyle: LearningStyle },
  @Req() request: FastifyRequest & { user: any },
): Promise<ApiResponse<UserProfile>> {
  try {
    const updatedProfile = await this.userService.updateLearningStyle(
      request.user.id,
      body.learningStyle,
    );
    return {
      success: true,
      message: 'Learning style updated successfully',
      data: updatedProfile,
    };
  } catch (error) {
    // error handling...
  }
}
```

---

### Phase 4: Frontend Updates

#### 4.1 Update Profile API Service

**File**: `apps/frontend/src/domains/user/api/profile.ts`

Add method:

```typescript
async updateLearningStyle(learningStyle: LearningStyle): Promise<UserProfile> {
  const headers = await this.getAuthHeaders();
  const response = await fetch(
    `${this.backendUrl}/api/user/preferences/learning-style`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify({ learningStyle }),
    }
  );

  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.message || 'Failed to update learning style');
  }
  return result.data;
}
```

#### 4.2 Create Learning Style Settings Component

**File**: `apps/frontend/src/domains/user/components/LearningStyleSettings.tsx`

A radio-button style component matching the existing settings page dark theme.

#### 4.3 Update Settings Page

**File**: `apps/frontend/src/app/app/settings/page.tsx`

Add a new "Learning Style" section between "Profile Information" and "Features & Animation Demo":

```tsx
{/* Learning Style Section - NEW */}
<div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 sm:p-6">
  <LearningStyleSettings
    currentStyle={profile?.preferences?.learningStyle ?? 'free_flow'}
    onUpdate={loadProfileData}
  />
</div>
```

---

### Phase 5: Integration with Journey System (Future)

This phase will implement the actual behavior changes based on learning style. Not in initial scope but documented for planning:

#### 5.1 Free Flow (Default)
- No changes to current behavior
- User can access any tutorial/exercise at any time
- Journey progress is tracked but not enforced

#### 5.2 Guided Practice
- Show reminder banners when user skips recommended content
- Highlight recommended next steps in UI
- Send optional push/email reminders (if enabled)
- Never block progress

#### 5.3 Strict Mode
- Milestone completion required before next milestone unlocks
- Show "locked" state on future milestones
- Progress bar shows gating clearly
- Option to "unlock" specific content with confirmation

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/20260130000001_*.sql` | CREATE | Add learning_style column |
| `libs/contracts/src/types/user.ts` | EDIT | Add LearningStyle type, update UserPreferences |
| `libs/contracts/src/types/index.ts` | EDIT | Export LearningStyle |
| `apps/backend/src/domains/user/user.service.ts` | EDIT | Add updateLearningStyle method, update mapProfileToUserProfile |
| `apps/backend/src/domains/user/user.controller.ts` | EDIT | Add PUT endpoint |
| `apps/frontend/src/domains/user/api/profile.ts` | EDIT | Add updateLearningStyle method |
| `apps/frontend/src/domains/user/components/LearningStyleSettings.tsx` | CREATE | Radio-style settings UI component |
| `apps/frontend/src/app/app/settings/page.tsx` | EDIT | Add Learning Style section (page already exists) |

---

## Testing Checklist

- [ ] Migration runs successfully
- [ ] Default value `free_flow` is set for existing users
- [ ] API endpoint validates input
- [ ] Frontend displays current setting correctly
- [ ] Selection updates and persists
- [ ] Settings accessible from user menu
- [ ] Error handling for failed updates
- [ ] Loading states during update

---

## Risks & Considerations

1. **Migration Safety**: The column has a default value, so existing users won't break
2. **Type Safety**: Ensure contracts lib is rebuilt after type changes
3. **Cache Invalidation**: Profile cache should invalidate after learning style update
4. **Mobile Responsive**: Settings UI should work on mobile

---

## Timeline Estimate

| Phase | Effort |
|-------|--------|
| Phase 1: Database | ~30 min |
| Phase 2: Types | ~15 min |
| Phase 3: Backend | ~1 hour |
| Phase 4: Frontend | ~2 hours |
| Testing | ~1 hour |
| **Total** | **~4-5 hours** |

---

## Open Questions

1. Should the learning style affect the UI immediately or only on next journey assignment?
2. Where should the Learning Style section appear in the settings page order?
   - Option A: After "Profile Information" (recommended - it's a core user preference)
   - Option B: Before "Account Settings" (with other preferences)
