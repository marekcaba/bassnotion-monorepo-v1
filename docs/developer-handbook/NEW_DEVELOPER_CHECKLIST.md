# New Developer Onboarding Checklist 🚀

Welcome to BassNotion! Complete these steps to get up and running.

## Day 1: Environment Setup ⚙️

### Morning (2-3 hours)
- [ ] Clone the repository
  ```bash
  git clone [repository-url]
  cd bassnotion-monorepo-v1
  ```

- [ ] Install pnpm (if not installed)
  ```bash
  npm install -g pnpm
  ```

- [ ] Install dependencies
  ```bash
  pnpm install
  ```

- [ ] Copy environment files
  ```bash
  cp .env.example .env.local  # Frontend
  cp .env.example .env        # Backend
  ```

- [ ] Configure environment variables
  - [ ] Get Supabase URL and keys from team lead
  - [ ] Set `NEXT_PUBLIC_DEBUG_AUDIO=true` for development
  - [ ] Verify all required variables are set

### Afternoon (2-3 hours)
- [ ] Start the development servers
  ```bash
  pm2 start ecosystem.config.cjs
  ```

- [ ] Verify everything is running
  ```bash
  pm2 status
  # Should show:
  # bassnotion-frontend  online
  # bassnotion-backend   online
  ```

- [ ] Open the application
  - [ ] Frontend: http://localhost:3001
  - [ ] Backend health: http://localhost:3000/health

- [ ] Check all debug tools are visible
  - [ ] Health indicator (bottom-left) - Should be green 🟢
  - [ ] Audio Debug Panel (bottom-right) - Should be visible

## Day 2: Understanding the Codebase 📚

### Morning - Read Documentation
- [ ] Read [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) completely (1 hour)
- [ ] Print [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) for your desk
- [ ] Skim [TROUBLESHOOTING_FLOWCHART.md](./TROUBLESHOOTING_FLOWCHART.md)
- [ ] Review [DEBUGGING_EXAMPLES.md](./DEBUGGING_EXAMPLES.md)

### Afternoon - Explore the Code
- [ ] Understand the folder structure
  ```
  apps/
  ├── frontend/     # Next.js (port 3001)
  ├── backend/      # NestJS (port 3000)
  └── frontend-e2e/ # Playwright tests
  
  libs/
  └── contracts/    # Shared types
  ```

- [ ] Find and explore key files:
  - [ ] `apps/frontend/src/app/layout.tsx` - Main layout
  - [ ] `apps/backend/src/app.module.ts` - Backend entry
  - [ ] `libs/contracts/src/index.ts` - Shared types

## Day 3: Hands-On Practice 🛠️

### Morning - Debug Tools Practice
- [ ] Create a test component with logging
  ```typescript
  // Create: apps/frontend/src/app/test-debug/page.tsx
  import { useCorrelation } from '@/shared/hooks/useCorrelation';
  import { useAudioDebug } from '@/shared/debug/AudioDebugger';
  
  export default function TestDebug() {
    const { correlationId, logger } = useCorrelation('TestDebug');
    const debug = useAudioDebug('TestDebug');
    
    const handleClick = () => {
      logger.info('Button clicked', { timestamp: Date.now() });
      debug.log('test-event', { message: 'Hello debugging!' });
    };
    
    return (
      <div>
        <h1>Debug Test Page</h1>
        <p>Correlation ID: {correlationId}</p>
        <button onClick={handleClick}>Test Logging</button>
      </div>
    );
  }
  ```

- [ ] Click the button and find your logs:
  - [ ] Check browser console
  - [ ] Check Audio Debug Panel
  - [ ] Search backend logs with correlation ID

### Afternoon - Make a Small Change
- [ ] Pick a simple task:
  - Add a console log to an existing component
  - Change button text
  - Add a new test page

- [ ] Follow the debugging flow:
  1. Make the change
  2. Check pm2 logs for errors
  3. Test in browser
  4. Use correlation ID if something breaks

## Day 4: Audio System Understanding 🎵

### Morning - Audio Architecture
- [ ] Read about the audio system in DEVELOPER_GUIDE.md
- [ ] Understand the flow:
  ```
  User Click → Widget → Transport → Audio Engine → Sound
  ```

- [ ] Find these key services:
  - [ ] `UnifiedTransport` - The master clock
  - [ ] `AudioEngine` - Handles Web Audio API
  - [ ] Widget components in `domains/widgets`

### Afternoon - Audio Debugging
- [ ] Enable audio debug mode (should already be on)
- [ ] Play with existing audio features
- [ ] Watch the Audio Debug Panel
- [ ] Try to trigger an audio error and debug it

## Day 5: First Real Task 🎯

### Before Starting Any Task
- [ ] Create a todo list using the TodoWrite tool
- [ ] Add correlation logging to relevant components
- [ ] Enable all debug tools
- [ ] Create a test page if needed

### During Development
- [ ] Commit frequently with clear messages
- [ ] Test with debug mode enabled
- [ ] Check health indicator stays green
- [ ] Watch for console errors

### Before Submitting
- [ ] Run linting: `pnpm lint`
- [ ] Check for infinite loops (see DEVELOPER_GUIDE)
- [ ] Test main user flows
- [ ] Remove any test pages created
- [ ] Document any new patterns you introduced

## Week 2: Deeper Dive 🏊

### Advanced Topics to Explore
- [ ] Understand the Domain-Driven Design structure
- [ ] Learn about the exercise system
- [ ] Explore the widget synchronization
- [ ] Understand Supabase integration

### Code Quality
- [ ] Read through the AUDIT_08_25.md findings
- [ ] Understand technical debt areas
- [ ] Learn the refactoring plans

## Resources & Help 📞

### Slack Channels
- `#dev-help` - General development questions
- `#audio-debugging` - Audio-specific issues
- `#bug-reports` - Report and track bugs

### Key People
- Team Lead - Environment variables, architecture decisions
- Audio Expert - Audio system, Web Audio API
- Frontend Lead - React patterns, performance

### Useful Commands
```bash
# View logs
pm2 logs bassnotion-frontend
pm2 logs bassnotion-backend

# Restart services
pm2 restart all

# Emergency reset
pm2 delete all && pm2 start ecosystem.config.cjs
```

## Tips for Success 💡

1. **Always use correlation IDs** - They're your best friend for debugging
2. **Log everything when stuck** - More logs = easier debugging
3. **Check health indicator first** - It tells you if the system is okay
4. **Read error messages carefully** - They usually tell you exactly what's wrong
5. **Ask questions early** - Don't struggle alone for hours

## Your First Month Goals 🎯

- [ ] Week 1: Environment working, basic debugging mastered
- [ ] Week 2: Understand architecture, make small fixes
- [ ] Week 3: Take on a medium-sized feature
- [ ] Week 4: Contribute to documentation, help newer developers

---

## Checklist Complete? 🎉

Congratulations! You're now ready to:
- Debug issues using correlation IDs
- Use all the debugging tools
- Understand the codebase structure
- Make contributions to BassNotion

Remember: Every expert was once a beginner. Don't hesitate to ask questions!

---

*Welcome to the team!* 🚀

Onboarding version: 1.0  
Last updated: August 30, 2025