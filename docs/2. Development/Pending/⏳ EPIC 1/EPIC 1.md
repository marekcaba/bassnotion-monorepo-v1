# Epic 1: User Management & Profile

## Status: Draft - Revised

## Purpose

To enable users to create accounts, log in, manage their profiles, and handle basic account settings within the BassNotion platform. This epic lays the foundation for personalized user experiences and secure access to the platform's features.

## Key Features (MVP Scope)

- **User Registration:**
  - Users can create new accounts using email and password.
  - Users can register using **Social Login (e.g., Google, GitHub - common Supabase providers)**.
  - Basic validation of email format and password strength.
- **User Login:**
  - Users can log in with their registered credentials (email/password or social).
  - Password recovery/reset process.
- **User Profile:**
  - Users can view and edit their profile information:
    - Username (required).
    - Email (required, read-only post-registration).
    - Profile picture (optional).
- **Account Settings:**
  - Users can change their password.
  - Users can delete their account.

## Functional Requirements Alignment

- From `4.1. Functional Requirements.md`, this epic directly addresses requirements related to:
  - **FR-UM-01: The system shall allow users to register with minimal information.**
  - **FR-UM-02: The system shall authenticate users securely.**
  - **FR-UM-03: The system shall provide a user profile page showing previously analyzed tutorials and their settings.**
  - **FR-IN-02: The system shall integrate with Supabase for data storage.**
  - (Implicitly aligns with FR-IN-06 for Post-MVP, now brought into MVP scope based on your input): **The system shall support OAuth for social login options.**

## Codebase Considerations (from `3. Codebase Structure.md`)

- This epic will involve:
  - Extensive use of **Supabase Auth** for user authentication, session management, and social logins.
  - Backend development for handling profile data and interactions with Supabase (likely within `domains/users` and `domains/auth`).
  - Frontend development for user interface components (registration, login, profile, settings) leveraging Supabase client libraries (e.g., `@supabase/supabase-js`).
  - Database schema design for user profiles, integrated with Supabase's built-in `auth.users` table where appropriate.

## Security Recommendations (Supabase Context)

- **Leverage Supabase Auth:** Utilize Supabase's built-in authentication service for password hashing (bcrypt) and secure token management (JWTs).
- **Row-Level Security (RLS):** Implement RLS policies on all database tables containing user-sensitive data to ensure users can only access their own data or data they are authorized to see.
- **Secure API Endpoints:** All API endpoints handling user data should be secured and validated.
- **Input Validation:** Implement robust server-side and client-side validation for all user inputs to prevent common vulnerabilities.
- **Rate Limiting:** Apply rate limiting to authentication-related endpoints to protect against brute-force attacks.
- **HTTPS/SSL:** All communication handled by Supabase is secured via HTTPS by default.
- **Principle of Least Privilege:** Design database roles and application permissions to grant only the minimum necessary access to users and processes.

## Next Steps

1.  Confirm this revised Epic definition for **Epic 1: User Management & Profile**.
2.  Once confirmed, we can break down its key features into individual user stories, starting with user registration.

How does this updated **Epic 1: User Management & Profile** definition look now? Is it comprehensive enough for the MVP scope, considering your technical choices and security requirements?
