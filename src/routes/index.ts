import { Router } from 'express'
import AuthRoutes from '../modules/auth/auth.routes';
import MetaRoutes from '../modules/meta/meta.routes';
import OrgRoutes from '../modules/organization/org.routes';
import PlatformRoutes from '../modules/Admin_Platform/platform.routes';
import OnboardingRoutes from "../modules/users/onboard.routes"

const router = Router()

// Mount Auth routes
router.use('/auth', AuthRoutes)
router.use('/org', OrgRoutes)
router.use('/meta', MetaRoutes)
router.use('/platform', PlatformRoutes)
router.use('/onboarding', OnboardingRoutes)
export default router