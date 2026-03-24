import { Router } from "express";
import { getIndustries, getCountries, getStates } from "./meta.controller";

const router = Router();
router.get("/industries", getIndustries);
router.get("/countries", getCountries);
router.get("/states/:countryCode", getStates);

export default router;