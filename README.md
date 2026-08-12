# Ethnoir GST Invoice

Local first-version invoice calculator for the Ethnoir Shopify store.

## Run locally

Copy `.env.example` to `.env`, add the Shopify Admin API token, then use `npm start` and open `http://localhost:3000`.

## Current scope

- Pre-filled with OPUS APPARELS and GSTIN `24AAGFO1864Q1ZR` from the supplied invoice.
- Business details, state code, invoice prefix, address and logo can be changed in Settings.
- Computes inclusive GST per apparel line after discount: up to Rs. 2,625 inclusive (Rs. 2,500 taxable) at 5%; Rs. 2,950 and above at 18%.
- Stops invoice creation for the Rs. 2,625.01 to Rs. 2,949.99 inclusive-price gap, which needs a confirmed pre-tax transaction value instead of a guessed GST rate.
- Splits tax as CGST/SGST for Gujarat customers and IGST for other states.
- Imports paid orders after secure Shopify Admin API configuration, maps SKU-to-HSN codes, and supports Print / Save as PDF.

## Shopify connection still required

This local-first build supports an existing Shopify-admin custom app access token with the `read_orders` scope. Put the token in `.env`; never commit or paste it in chat.

For a newly created, production Shopify app, use Shopify CLI / Dev Dashboard and implement Shopify OAuth before making it available inside Shopify Admin. Shopify no longer allows creating new custom apps in the Shopify Admin.

