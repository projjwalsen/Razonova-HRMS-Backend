import { Request, Response } from "express";
import { CURRENCIES, INDUSTRIES } from "./industry.constants";
import { Country, State } from "country-state-city";
import countryToCurrency from "country-to-currency";
import getSymbolFromCurrency from "currency-symbol-map";

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

export const getAllCurrencies = () => {
  const uniqueCodes = new Set<string>();

  Object.values(countryToCurrency).forEach((code) => {
    if(code) uniqueCodes.add(code);
  })

  const currencies = Array.from(uniqueCodes).map((code) => ({
    code,
    symbol: getSymbolFromCurrency(code) || "",
    name: code
  }));

  return currencies.sort((a, b) => a.code.localeCompare(b.code));
}

/**
 * @swagger
 * /meta/currencies:
 *   get:
 *     tags:
 *       - meta
 *     summary: Get all currencies
 *     description: Returns a list of all currencies with code and symbol.
 *     responses:
 *       '200':
 *         description: List of currencies fetched successfully
 *       '500':
 *         description: Failed to fetch currencies
 */
export const getCurrencies = (req: Request, res: Response) => {
  try {
    const currencies = getAllCurrencies();
  
    return res.status(200).json({
      status: true,
      message: "Currencies fetched successfully",
      data: currencies
    })
  } catch (error: any) {
    return res.status(500).json({
      status: false,
      message: "Failed to fetch currencies",
      error: (error as Error).message
    })
  }
}