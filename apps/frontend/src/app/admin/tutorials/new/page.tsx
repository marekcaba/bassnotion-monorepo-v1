'use client';

import { redirect } from 'next/navigation';

export default function NewTutorialPage() {
  // Redirect to tutorials list page
  // New tutorials are created from the list page with immediate draft creation
  redirect('/admin/tutorials');
}