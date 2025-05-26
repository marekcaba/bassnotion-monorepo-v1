Based on our `BassNotion Platform Codebase Structure.md` and standard DDD/modern project practices, here's the best placement for different types of tests:

### 1\. Unit Tests

- **Placement:** Co-located with the code they test.

  - For **Frontend** (React/TypeScript): Place the test file directly alongside the component, hook, utility, or store module it tests.
    - Example:
      ```
      bassnotion-frontend/
      ├── src/
      │   ├── components/
      │   │   ├── musical-exercise-representation/
      │   │   │   ├── MusicalExerciseRepresentation.tsx
      │   │   │   ├── MusicalExerciseRepresentation.module.css
      │   │   │   └── MusicalExerciseRepresentation.test.tsx  <-- Unit tests here
      │   ├── domains/
      │   │   ├── user/
      │   │   │   ├── hooks/
      │   │   │   │   ├── useAuth.ts
      │   │   │   │   └── useAuth.test.ts  <-- Unit tests here
      │   │   │   ├── store/
      │   │   │   │   ├── userStore.ts
      │   │   │   │   └── userStore.test.ts  <-- Unit tests here
      ```
  - For **Backend** (NestJS/TypeScript): Place the test file directly alongside the service, controller, repository, or entity it tests. NestJS CLI usually scaffolds this for you (`.spec.ts` suffix).
    - Example:
      ```
      bassnotion-backend/
      ├── src/
      │   ├── domains/
      │   │   ├── user/
      │   │   │   ├── auth/
      │   │   │   │   ├── auth.service.ts
      │   │   │   │   └── auth.service.spec.ts  <-- Unit tests here
      │   │   │   │   ├── auth.controller.ts
      │   │   │   │   └── auth.controller.spec.ts <-- Controller's unit tests (often involves mocking service)
      │   │   │   ├── repositories/
      │   │   │   │   ├── user.repository.ts
      │   │   │   │   └── user.repository.spec.ts <-- Unit tests here
      ```

- **Naming Convention:** Use `.test.ts` or `.spec.ts` (NestJS default) as the suffix.

- **Rationale:**

  - **Discoverability:** When you look at a file, its tests are immediately obvious and easy to find.
  - **Maintainability:** When you change a component, its tests are right there, making it easier to update them.
  - **Modularity:** Reinforces the idea of testing small, isolated units.

### 2\. Integration Tests

Integration tests verify the interaction between different layers or modules.

- **Placement:**

  - **Within Domains:** For backend, if an integration test primarily focuses on the interaction _within_ a specific domain (e.g., a controller interacting with a service, or a service interacting with a repository), it can be placed within a `test/` subdirectory inside that domain or even co-located with a `.integration-spec.ts` suffix if it's tightly coupled to a specific component.
    - Example (as demonstrated with `auth.controller.integration-spec.ts`):
      ```
      bassnotion-backend/
      ├── src/
      │   ├── domains/
      │   │   ├── user/
      │   │   │   ├── auth/
      │   │   │   │   ├── auth.controller.ts
      │   │   │   │   └── test/  <-- Dedicated folder for broader domain/integration tests
      │   │   │   │       └── auth.controller.integration-spec.ts
      ```
  - **Higher-Level / Cross-Domain:** For tests that involve interactions across multiple domains or significant parts of the application (e.g., frontend component interacting with a real API client, or a backend service orchestrating calls to multiple repositories), a dedicated `tests/integration/` folder at the root of `bassnotion-frontend` or `bassnotion-backend` might be appropriate.
    - Example:
      ```
      bassnotion-backend/
      ├── tests/
      │   ├── integration/
      │   │   ├── user-flow.integration.test.ts  # E.g., registers user, then logs in, then fetches profile
      ```
      ```
      bassnotion-frontend/
      ├── src/
      │   ├── app/
      │   │   └── tests/ # For app-wide integration of core components/routes
      │   │       └── global-navigation.integration.test.tsx
      ```

- **Naming Convention:** Use `.integration.test.ts` or `.integration-spec.ts`.

- **Rationale:**

  - **Clear Scope:** Separates tests that involve external dependencies or multiple components from pure unit tests.
  - **Structured Testing:** Allows for focused testing of specific integration points.

### 3\. End-to-End (E2E) Tests

These are the highest-level tests that simulate real user flows across the entire system (frontend, backend, database, external services).

- **Placement:** In a dedicated top-level `e2e/` or `cypress/` (if using Cypress) or `playwright/` (if using Playwright) directory at the root of the relevant application (e.g., `bassnotion-frontend`). They are generally separate from the `src/` directory.

  - Example for Frontend-driven E2E tests:
    ```
    bassnotion-frontend/
    ├── e2e/
    │   ├── specs/
    │   │   ├── authentication.e2e.test.ts   # Tests user registration, login, logout
    │   │   ├── youtube-analysis.e2e.test.ts # Tests submitting URL, seeing results
    │   ├── support/
    │   ├── plugins/
    │   ├── tsconfig.json
    ```
  - Example for Backend E2E tests (if simulating external client interactions):
    ```
    bassnotion-backend/
    ├── e2e/
    │   ├── auth.e2e-spec.ts # Similar to what was in the previous example, but now clearly e2e
    │   ├── videos.e2e-spec.ts
    ```

- **Naming Convention:** `.e2e.test.ts`, `.e2e-spec.ts`, or defined by the E2E framework (e.g., Cypress often uses `_spec.js` or `_test.js` by default).

- **Rationale:**

  - **Independent from Source:** E2E tests often use a different test runner and environment setup than unit/integration tests, so keeping them separate prevents conflicts.
  - **Clear Purpose:** Highlights that these tests cover full user journeys.
  - **Performance:** They are run less frequently (e.g., before deployment) compared to unit tests, so isolating them makes build processes more efficient.
