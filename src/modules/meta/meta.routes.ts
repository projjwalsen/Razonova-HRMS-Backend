import { Router } from "express";
import { getIndustries, getCountries, getStates, getCurrencies,  } from "./meta.controller";

const router = Router();
router.get("/industries", getIndustries);
router.get("/countries", getCountries);
router.get("/states/:countryCode", getStates);
router.get("/currencies", getCurrencies);

export default router;