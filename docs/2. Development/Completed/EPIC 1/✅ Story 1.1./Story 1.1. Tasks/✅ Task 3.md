## 🎯 Task 3 Implementation Plan: Frontend Integration with Supabase Auth

### **Task 3 Goals**

Develop frontend integration with Supabase Auth for user sign-up, creating production-ready registration and login routes.

**Target Files**:

- `apps/frontend/src/domains/user/api/auth.ts` (Supabase service)
- `apps/frontend/src/app/register/page.tsx` (Production registration route)
- `apps/frontend/src/app/login/page.tsx` (Production login route)

### **What We Need**

#### **Dependencies & Tools**

1. **Supabase Client**: `@supabase/supabase-js` for authentication
2. **UI Components**: shadcn/ui (Button, Input, Form, toast notifications)
3. **Form Components**: Existing `RegistrationForm` and `LoginForm` from Task 1
4. **Routing**: Next.js App Router for `/register` and `/login` routes
5. **State Management**: React Query for API calls + Zustand for auth state
6. **Error Handling**: Toast notifications for user feedback

#### **File Structure Setup**

```
apps/frontend/src/
├── app/
│   ├── register/
│   │   └── page.tsx             # Production registration route
│   ├── login/
│   │   └── page.tsx             # Production login route
│   └── dashboard/
│       └── page.tsx             # Redirect destination (to be created)
├── domains/user/
│   ├── api/
│   │   └── auth.ts              # Supabase Auth service (Task 3)
│   ├── components/auth/
│   │   ├── RegistrationForm.tsx # Existing from Task 1
│   │   └── LoginForm.tsx        # Existing from Task 1
│   └── hooks/
│       ├── use-auth.ts          # Auth state hooks
│       └── use-auth-redirect.ts # Post-auth navigation
└── infrastructure/supabase/
    ├── client.ts                # Supabase client setup
    └── types.ts                 # Supabase-generated types
```

### **Implementation Process**

#### **Phase 1: Supabase Setup**

1. **Set up Supabase client configuration**
2. **Create auth service layer**
3. **Define auth hooks for state management**

#### **Phase 2: Subtask Implementation**

- **Subtask 3.1**: Implement `supabase.auth.signUp({ email, password })`
- **Subtask 3.2**: Handle successful response and session creation
- **Subtask 3.3**: Implement redirection logic post-registration (e.g., to `/dashboard`)

#### **Phase 3: Production Routes**

- **Create actual `/register` and `/login` pages**
- **Replace demo handlers with real Supabase integration**
- **Add navigation links from homepage**

#### **Phase 4: Integration & Testing**

- **Connect forms to Supabase auth service**
- **Test complete registration and login flow**
- **Add error handling and user feedback**

### **Detailed Subtask Breakdown**

#### **Subtask 3.1: Implement Supabase Sign-Up**

```typescript
// Goal: Core registration functionality with Supabase
- Create auth service with signUp method
- Handle email/password registration
- Return typed responses with error handling
- Integrate with existing RegistrationForm component
```

**Implementation Details:**

```typescript
// apps/frontend/src/domains/user/api/auth.ts
export const authApi = {
  signUp: async (data: RegistrationData) => {
    const { data: authData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
    });

    if (error) throw new AuthError(error.message);
    return authData;
  },
};
```

#### **Subtask 3.2: Handle Successful Response and Session**

```typescript
// Goal: Proper session management and user state
- Process Supabase auth response
- Set up user session in application state
- Handle email confirmation scenarios
- Update UI to reflect authenticated state
```

**Implementation Details:**

```typescript
// Session handling logic
const handleAuthSuccess = (authData: AuthResponse) => {
  // Update global auth state
  setUser(authData.user);
  setSession(authData.session);

  // Handle email confirmation if required
  if (!authData.user?.email_confirmed_at) {
    showToast('Please check your email to confirm your account');
  }
};
```

#### **Subtask 3.3: Implement Redirection Logic**

```typescript
// Goal: Smooth post-registration user experience
- Redirect authenticated users to dashboard
- Handle different user states (confirmed/unconfirmed)
- Preserve intended destination (redirect after login)
- Update navigation state
```

**Implementation Details:**

```typescript
// Redirection logic
const useAuthRedirect = () => {
  const router = useRouter();

  const redirectAfterAuth = (user: User) => {
    if (user.email_confirmed_at) {
      router.push('/dashboard');
    } else {
      router.push('/verify-email');
    }
  };
};
```

### **Step-by-Step Implementation Plan**

#### **Step 1: Supabase Client Setup**

```typescript
// apps/frontend/src/infrastructure/supabase/client.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

#### **Step 2: Auth Service Implementation**

```typescript
// apps/frontend/src/domains/user/api/auth.ts
import { supabase } from '@/infrastructure/supabase/client';
import { RegistrationData, LoginData } from '@bassnotion/contracts';

export class AuthService {
  async signUp(data: RegistrationData) {
    const { data: authData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
    });

    if (error) {
      throw new Error(error.message);
    }

    return authData;
  }

  async signIn(data: LoginData) {
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) {
      throw new Error(error.message);
    }

    return authData;
  }

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  }

  getCurrentSession() {
    return supabase.auth.getSession();
  }

  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback);
  }
}

export const authService = new AuthService();
```

#### **Step 3: Production Route Creation**

```typescript
// apps/frontend/src/app/register/page.tsx
import { RegistrationForm } from '@/domains/user/components/auth';
import { authService } from '@/domains/user/api/auth';

export default function RegisterPage() {
  const handleRegistration = async (data: RegistrationData) => {
    try {
      await authService.signUp(data);
      // Handle success (redirect, show message, etc.)
    } catch (error) {
      // Handle error (show toast, etc.)
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md">
        <RegistrationForm onSubmit={handleRegistration} />
      </div>
    </div>
  );
}
```

#### **Step 4: Auth State Management**

```typescript
// apps/frontend/src/domains/user/hooks/use-auth.ts
import { create } from 'zustand';
import { User, Session } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setLoading: (isLoading) => set({ isLoading }),
}));
```

### **Environment Variables Required**

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### **Success Criteria**

- ✅ Users can register with email/password through `/register` route
- ✅ Users can login with credentials through `/login` route
- ✅ Successful registration redirects to dashboard or email confirmation
- ✅ Auth state is properly managed across the application
- ✅ Error handling provides clear user feedback
- ✅ Integration with existing form components from Task 1

### **Dependencies on Other Tasks**

- **Depends on**: ✅ Task 1 (RegistrationForm component must be completed)
- **Enables**: Task 5 (Email confirmation), Task 6 (Error handling), Task 7 (RLS policies)

### **Security Considerations**

- All API calls use Supabase's built-in security (RLS, JWT tokens)
- Passwords are handled securely by Supabase (bcrypt hashing)
- Session management follows Supabase best practices
- Input validation uses shared Zod schemas from contracts

### **Testing Strategy**

1. **Unit Tests**: Auth service methods (signUp, signIn, signOut)
2. **Integration Tests**: Complete registration and login flows
3. **E2E Tests**: User journeys from homepage to authenticated dashboard
4. **Error Scenarios**: Network failures, invalid credentials, duplicate accounts

## **Ready to Start Implementation?**

This task builds directly on the completed Task 1 and creates the missing production infrastructure for user authentication. Once completed, users will have a fully functional registration and login system powered by Supabase.

**Next Steps:**

1. Set up Supabase project and obtain credentials
2. Implement auth service layer
3. Create production routes
4. Test complete user flow
5. Add error handling and user feedback
