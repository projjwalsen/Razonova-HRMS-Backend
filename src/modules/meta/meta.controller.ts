import { Request, Response } from "express";
import { CURRENCIES, INDUSTRIES } from "./industry.constants";
import { Country, State } from "country-state-city";

/**
 * @swagger
 * /meta/industries:
 *   get:
 *     tags:
 *       - meta
 *     summary: Get industry list
 *     description: Returns a list of supported industries.
 *     responses:
 *       200:
 *         description: List of industries
 */
export const getIndustries = (req: Request, res: Response) => {
  res.json(INDUSTRIES);
};

/**
 * @swagger
 * /meta/countries:
 *   get:
 *     tags:
 *       - meta
 *     summary: Get country list
 *     description: Returns a list of all countries with their ISO codes.
 *     responses:
 *       200:
 *         description: List of countries
 */
export const getCountries = (req: Request, res: Response) => {
  res.json(Country.getAllCountries());
};

/**
 * @swagger
 * /meta/states/:countryCode:
 *   get:
 *     tags:
 *       - meta
 *     summary: Get states by country
 *     description: Returns a list of states for the given country ISO code.
 *     parameters:
 *       - in: path
 *         name: countryCode
 *         schema:
 *           type: string
 *         required: true
 *         description: ISO code of the country (from /meta/countries)
 *     responses:
 *       200:
 *         description: List of states
 *       400:
 *         description: countryCode required
 */
export const getStates = (req: Request, res: Response) => {
  const { countryCode } = req.params as { countryCode: string };
  if (!countryCode) return res.status(400).json({ message: "countryCode required" });
  res.json(State.getStatesOfCountry(countryCode));
};

export const getCurrencies = (req: Request, res: Response) => {
  return res.json(CURRENCIES);
}