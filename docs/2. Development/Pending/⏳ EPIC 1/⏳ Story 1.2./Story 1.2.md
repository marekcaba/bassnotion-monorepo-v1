# Story 1.2: User Registration (Social Login)

## Status: Draft - Revised

## Story

- As a **new user**
- I want to **securely register and create an account using my existing social media credentials (specifically Google and GitHub, as per Epic 1)**
- so that I can **quickly and conveniently gain immediate access to the BassNotion platform without the need to create and manage a new email and password combination**.

## Acceptance Criteria (ACs)

1.  **FR-IN-06 Alignment:** The system shall present clear and distinct buttons for "Sign Up with Google" and "Sign Up with GitHub" on the registration interface.
2.  Upon clicking a social login button, the user shall be securely redirected to the respective social identity provider's (Google or GitHub) authentication consent screen.
3.  Upon successful authentication and authorization by the user at the social provider, the system shall seamlessly create a new user account in **Supabase Auth** or link to an existing account if the social email matches a previously registered email.
4.  The system shall securely receive and process user information (e.g., email, profile picture URL, unique ID) from the social provider via OAuth 2.0.
5.  Upon successful social registration and account creation/linking, the user shall be automatically logged into the BassNotion platform and redirected to the primary application dashboard (e.g., `/dashboard`).
6.  The system shall gracefully handle scenarios where the user denies access on the social provider's consent screen, redirecting them back to the registration page with an informative message.
7.  The system shall provide clear, user-friendly error messages for any issues during the social login flow (e.g., network errors, API failures, Supabase misconfigurations) without exposing technical details.
8.  The social registration process shall comply with `NFR-SC-01` (Security: Utilize Supabase's built-in authentication and RLS for user data).

## Tasks / Subtasks

- [ ] Task 1: Implement UI elements for social login options (Frontend: `bassnotion-frontend/src/domains/auth/components/SocialAuthButtons.tsx`).
  - [ ] Subtask 1.1: Add visually distinct "Sign Up with Google" button (leveraging `shadcn/ui` button component).
  - [ ] Subtask 1.2: Add visually distinct "Sign Up with GitHub" button (leveraging `shadcn/ui` button component).
- [ ] Task 2: Develop frontend integration with Supabase Auth for OAuth flows (`bassnotion-frontend/src/domains/auth/api/auth.ts`).
  - [ ] Subtask 2.1: Implement `supabase.auth.signInWithOAuth({ provider: 'google' })`.
  - [ ] Subtask 2.2: Implement `supabase.auth.signInWithOAuth({ provider: 'github' })`.
  - [ ] Subtask 2.3: Handle the redirection and session establishment post-authentication callback.
- [ ] Task 3: Configure Supabase project for Google and GitHub OAuth providers.
  - [ ] Subtask 3.1: Obtain and configure Google API credentials (Client ID, Client Secret) in Supabase.
  - [ ] Subtask 3.2: Obtain and configure GitHub API credentials (Client ID, Client Secret) in Supabase.
  - [ ] Subtask 3.3: Ensure correct `Redirect URLs` are set in both Supabase and the social provider consoles.
- [ ] Task 4: Implement backend logic (if necessary, potentially within `apps/backend/src/domains/auth/`) to handle Supabase webhooks for new social users (post-MVP consideration, but good to note).
  - [ ] Subtask 4.1: (Future/Post-MVP) Process user metadata from social providers for profile enrichment.
- [ ] Task 5: Implement robust error handling and user feedback.
  - [ ] Subtask 5.1: Catch and display user-friendly errors for failed social logins.
  - [ ] Subtask 5.2: Use `shadcn/ui` toasts/notifications for feedback.
- [ ] Task 6: Review and update Supabase Row-Level Security (RLS) policies to ensure social login user data is protected.

## Dev Technical Guidance

- **Frontend**: Place social login components within `bassnotion-frontend/src/domains/auth/`. Use `Next.js` client components where appropriate.
- **Backend**: Direct Supabase client-side OAuth is generally sufficient for initial social login. If custom backend logic is required for post-login processing (e.g., fetching additional user data, linking existing accounts by email), it should reside in `apps/backend/src/domains/auth/`.
- **Authentication**: Rely entirely on **Supabase Auth** for the OAuth flow and user session management.
- **Type Safety**: Ensure consistent use of types from `@bassnotion/contracts` for any user-related data exchanged or stored.
- **Security**: Adhere to `NFR-SC-02` (Secure API Endpoints) and `NFR-SC-03` (Input Validation) from `4.2. Non-Functional Requirements.md`. All redirects and data exchanges with social providers must be secure (HTTPS).
- **Scalability**: Supabase handles the core scaling of authentication; ensure application logic is efficient.

## Story Progress Notes

### Agent Model Used: `Gemini`

### Completion Notes List

- Expanded ACs to explicitly mention redirect flows, error handling, and security.
- Added granular tasks including Supabase configuration details and potential backend considerations.
- Integrated `FR-IN-06` as a direct acceptance criterion.
- Referenced relevant sections of `3. Codebase Structure.md` for file placement.
- Noted alignment with `NFR-SC-01`, `NFR-SC-02`, and `NFR-SC-03`.

### Change Log

- Initial Draft - May 28, 2025
- Revised for comprehensiveness - May 28, 2025

---

How does this more comprehensive version of Story 1.2 look to you? Are there any specific social providers beyond Google and GitHub you'd like to add to the MVP, or any other details you'd like to refine?

Once you're happy with this, we can move on to drafting the next story, which would logically be **User Login (Email/Password & Social)**, as mentioned in the Epic.
