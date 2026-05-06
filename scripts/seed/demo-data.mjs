export function websiteTasks(users) {
  return [
    ['darkMode', {
      title: 'Add dark mode support',
      description: 'Users have been requesting dark mode for 6 months. Should follow system preferences by default with a manual override toggle.',
      column: 'ideas', startDate: '2026-04-01', endDate: '2026-06-30',
      objective: 'User Experience', tags: ['ux', 'frontend'],
    }],
    ['abTesting', {
      title: 'Implement A/B testing framework',
      description: 'Set up infrastructure for landing page A/B tests. Goal: improve sign-up conversion by 15%.',
      column: 'ideas', startDate: '2026-05-01', endDate: '2026-07-31',
      objective: 'Growth', tags: ['analytics', 'backend'],
    }],
    ['homepage', {
      title: 'Redesign homepage hero section',
      description: 'New design mockups are ready in Figma. Implement responsive layout with animated headline and updated CTAs.',
      column: 'todo', startDate: '2026-04-01', endDate: '2026-04-18',
      objective: 'Brand Refresh', tags: ['frontend', 'design'],
      backgroundColor: '#fef9c3',
    }],
    ['contentful', {
      title: 'Migrate blog to Contentful CMS',
      description: 'Moving from WordPress to Contentful. Export 200+ posts, configure webhooks, set up preview mode.',
      column: 'todo', startDate: '2026-04-10', endDate: '2026-04-25',
      objective: 'Infrastructure', tags: ['backend', 'devops'],
    }],
    ['iosNav', {
      title: 'Fix mobile navigation crash on iOS Safari',
      description: 'The hamburger menu overflows the viewport when the keyboard appears on iOS 16. Reproducible on iPhone 14.',
      column: 'todo', startDate: '2026-04-05', endDate: '2026-04-14',
      objective: 'Bug Fixes', tags: ['frontend', 'mobile', 'bug'],
      backgroundColor: '#fee2e2',
    }],
    ['tokens', {
      title: 'Implement new design system tokens',
      description: 'Migrate all hardcoded colour values to CSS custom properties from the new Figma token library. ~400 occurrences.',
      column: 'doing', startDate: '2026-04-01', endDate: '2026-04-20',
      objective: 'Brand Refresh', tags: ['frontend', 'design'],
      backgroundColor: '#dbeafe', doerId: users.bob.id,
    }],
    ['seo', {
      title: 'SEO audit and Core Web Vitals fixes',
      description: 'Lighthouse audit all public pages. Fix missing meta tags, structured data, and improve CWV score above 90.',
      column: 'doing', startDate: '2026-03-25', endDate: '2026-04-15',
      objective: 'Growth', tags: ['seo', 'frontend'],
      doerId: users.carol.id,
    }],
    ['ci', {
      title: 'Set up CI/CD pipeline with GitHub Actions',
      description: 'Lint → test → build → deploy to staging on PR. Auto-deploy to prod on merge. Slack notifications on failure.',
      column: 'done', startDate: '2026-03-01', endDate: '2026-03-20',
      objective: 'Infrastructure', tags: ['devops'],
    }],
    ['gdpr', {
      title: 'GDPR cookie consent banner update',
      description: 'New banner with granular category controls (analytics, marketing, preferences). Integrates with OneTrust.',
      column: 'done', startDate: '2026-03-10', endDate: '2026-03-28',
      objective: 'Compliance', tags: ['legal', 'frontend'],
    }],
    ['lazyLoad', {
      title: 'Lazy-load images for faster LCP',
      description: 'Native lazy loading on all below-fold images. LCP improved from 4.2s to 1.8s. Passed Core Web Vitals.',
      column: 'done', startDate: '2026-03-15', endDate: '2026-04-01',
      objective: 'Growth', tags: ['frontend', 'performance'],
    }],
  ].map(([key, task]) => ({ key, task }))
}

export function mobileTasks(users) {
  return [
    ['push', {
      title: 'Push notification system',
      description: 'Integrate Firebase Cloud Messaging. Support topic subscriptions, deep-link payloads, and notification preferences.',
      column: 'ideas', startDate: '2026-05-01', endDate: '2026-06-15',
      objective: 'Engagement', tags: ['mobile', 'backend'],
    }],
    ['biometric', {
      title: 'Biometric authentication (Face ID / Touch ID)',
      description: 'Store JWT refresh token in Keychain/Keystore. Use LocalAuthentication API. Fall back to PIN on failure.',
      column: 'ideas', startDate: '2026-05-15', endDate: '2026-07-01',
      objective: 'Security', tags: ['mobile', 'security'],
    }],
    ['onboarding', {
      title: 'Onboarding flow redesign',
      description: '5-step onboarding funnel with progress indicator. Drop-off analysis shows 60% leave on step 3 — simplify it.',
      column: 'todo', startDate: '2026-04-10', endDate: '2026-04-30',
      objective: 'User Experience', tags: ['mobile', 'design'],
      backgroundColor: '#fef9c3',
    }],
    ['offline', {
      title: 'Offline mode with sync queue',
      description: 'Cache board data with SQLite. Queue mutations when offline, replay on reconnect with conflict resolution.',
      column: 'doing', startDate: '2026-04-01', endDate: '2026-04-22',
      objective: 'Reliability', tags: ['mobile', 'backend'],
      backgroundColor: '#dcfce7', doerId: users.carol.id,
    }],
    ['reviews', {
      title: 'App Store review response automation',
      description: 'Fetch reviews via App Store Connect API, classify sentiment, auto-draft responses for 1–2 star reviews.',
      column: 'done', startDate: '2026-03-01', endDate: '2026-03-25',
      objective: 'Growth', tags: ['backend'],
    }],
  ].map(([key, task]) => ({ key, task }))
}

export const websiteLinks = [['homepage', 'tokens'], ['seo', 'lazyLoad']]
export const websiteArchiveKeys = ['ci', 'gdpr', 'lazyLoad']
