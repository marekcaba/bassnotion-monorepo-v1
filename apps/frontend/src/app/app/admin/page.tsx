import { redirect } from 'next/navigation';

/**
 * /admin index. The admin panel has no landing page of its own — it's a set of section pages
 * (tutorials, monitoring, scales, …) reached from the admin sub-nav. Historically bare /admin 404'd;
 * now that Admin is a sidebar nav item (which navigates to /admin), send it to the first real section
 * so the click always lands somewhere. AdminGuard (in the admin layout) still gates the redirect
 * target. Uses the CLEAN /admin/tutorials path (middleware rewrites it into /app/admin/tutorials).
 */
export default function AdminIndexPage() {
  redirect('/admin/tutorials');
}
