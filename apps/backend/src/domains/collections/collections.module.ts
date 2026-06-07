import { Module } from '@nestjs/common';

import { CollectionsController } from './collections.controller.js';
import { AdminCollectionsController } from './admin-collections.controller.js';
import { CollectionsService } from './collections.service.js';
import { CollectionsRepository } from './repositories/collections.repository.js';
import { CollectionTutorialsRepository } from './repositories/collection-tutorials.repository.js';
import { SupabaseModule } from '../../infrastructure/supabase/supabase.module.js';
import { AuthModule } from '../user/auth/auth.module.js';
// BillingModule exports EntitlementService + the purchase/product/product_contents
// repositories the service uses to resolve folder access and build virtual
// pack-folders from owned products.
import { BillingModule } from '../billing/billing.module.js';
// TutorialsModule exports TutorialsService, reused to hide individual gated
// tutorials from a folder's list (one access authority, no re-implementation).
import { TutorialsModule } from '../tutorials/tutorials.module.js';

@Module({
  imports: [SupabaseModule, AuthModule, BillingModule, TutorialsModule], // AuthModule for AdminGuard
  controllers: [CollectionsController, AdminCollectionsController],
  providers: [
    CollectionsService,
    CollectionsRepository,
    CollectionTutorialsRepository,
  ],
  exports: [
    CollectionsService,
    CollectionsRepository,
    CollectionTutorialsRepository,
  ],
})
export class CollectionsModule {}
