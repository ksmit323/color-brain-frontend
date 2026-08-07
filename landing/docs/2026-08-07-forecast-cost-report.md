# Forecast Cost Assumptions — Vietnam Calibration Report

**Date:** 2026-08-07
**Scope:** `landing/src/lib/forecast/model.ts` and `landing/src/pages/forecast.astro` (`/forecast`)
**Purpose:** Establish defensible default cost assumptions for the Savings Forecast under Vietnam operating conditions.

---

## Executive Summary

A review of the forecast cost model identified that the previous default estimates overstated the value of a one-percentage-point improvement in Right First Time (RFT) by approximately one order of magnitude for the target operating environment.

The primary drivers of the overstatement were (i) application of a time rate of $1.50 per minute ($90 per hour) compared to an all-in Vietnam rate of approximately $4.20 per hour, and (ii) pricing every avoided correction as a full destructive strip and re-dye, whereas approximately 80% of corrections are routine shading additions requiring a fraction of dye, water, and energy.

Revised defaults, calibrated to 2024–2025 Vietnam industrial pricing, reduce the estimated value of a one-point RFT improvement for a medium-scale mill (550 batches per month) from approximately $120,000 per year to approximately $9,000 per year at the expected scenario. Corresponding expected annual savings for an 86% to 92% lift decline from $722,700 to $53,856.

Batch volumes of 250, 550, and 1,200 batches per month (approximately 10, 25, and 55 batches per day) were validated separately against industry machine-capacity data and were retained.

---

## 1. Methodology

Revised assumptions were developed through:

1. Desk research on Vietnam industrial factor prices (labour, industrial water, industrial electricity) for 2024–2025.
2. Desk research on delivered prices for commodity reactive dyes ex-India and related chemical costs.
3. Review of published dyeing cost benchmarks that decompose total cost per kilogram of fabric.
4. Review of literature on rework types (shading addition versus large addition versus destructive stripping) and their relative cost factors.
5. Application of a consistent cost-per-rework build-up: labour and overhead + dye + water + energy + time.

All monetary values are stated in United States dollars (USD) unless otherwise noted.

---

## 2. Previous and Revised Assumptions

### 2.1 Comparison

| Profile | Monthly volume | RFT lift | Previous total per rework | Previous expected annual | Revised total per rework | Revised expected annual | Value per RFT point |
|---|---|---|---|---|---|---|---|
| Small | 250 (~10/day) | 82% → 90% (+8 pts) | $1,285.00 | $308,400 | $100.60 | $24,144 | $3,018 |
| Medium | 550 (~25/day) | 86% → 92% (+6 pts) | $1,825.00 | $722,700 | $136.00 | $53,856 | $8,976 |
| Large | 1,200 (~55/day) | 88% → 93% (+5 pts) | $2,270.00 | $1,634,400 | $172.80 | $124,416 | $24,883 |

Per-rework total = labour and overhead + dye + water + energy + time (minutes × rate per minute). Annual savings = avoided reworks × total per rework × scenario realization (conservative 0.75, expected 1.00, optimistic 1.25).

Conservative and optimistic scenarios scale the expected figure by ±25%.

### 2.2 Revised Cost Build-Up

| Profile | Labour and overhead | Dye | Water | Energy | Time (rate × minutes) | Total |
|---|---|---|---|---|---|---|
| Small (180 min) | $45 | $22 | $7 | $14 | $12.60 ($0.07×180) | $100.60 |
| Medium (200 min) | $65 | $30 | $9 | $18 | $14.00 ($0.07×200) | $136.00 |
| Large (240 min) | $85 | $38 | $11 | $22 | $16.80 ($0.07×240) | $172.80 |

Previous time rate was $1.50 per minute ($90 per hour). Revised rate is $0.07 per minute ($4.20 per hour).

---

## 3. Component Analysis

### 3.1 Labour and Overhead

Vietnam industrial labour costs observed for 2024–2025:

- Region I statutory minimum wage of VND 4,960,000 per month (approximately $195) effective December 2024, increased from VND 4,680,000.
- Average monthly income for textile and garment workers reported at VND 7.8 million (approximately $300), with skilled operators in the range of VND 10–15 million ($390–590) in recent employer surveys covering approximately 735 firms.
- Employer social insurance contributions of 21.5–23.5% on top of gross wages.

Translated to hourly rates on a 26-day, 8-hour month (208 hours):

- Direct rate at $300 per month: $1.44 per hour.
- Fully loaded rate including social contributions: $1.75–$1.78 per hour.
- Including overtime premiums: $1.80–$2.30 per hour. The higher end of this range corresponds to senior positions in Region I (Ho Chi Minh City, Binh Duong, Hanoi) with overtime.

A correction typically involves approximately 0.5 hours of laboratory work and 0.3 hours of quality assessment, with the batch processing largely unattended. Estimated direct labour per rework is therefore $6–$18, with machine opportunity and overhead increasing with batch size. The revised defaults of $45, $65, and $85 for small, medium, and large profiles provide for 4–6 hours of all-in time at Vietnam rates plus machine opportunity, scaled by capacity. Previous defaults of $800–$1,500 per rework implied 330–625 hours of Vietnamese labour per correction.

### 3.2 Dye and Chemical Costs

Commodity reactive dyes ex-India were observed at INR 150–340 per kilogram ($1.80–$4.10) in 2024–2026, with representative offers at INR 150 (Sunbeam), INR 190 (Mat Dye Chem), and INR 340 for specialty navy (HE2R). Delivered cost in Vietnam is approximately $1 per kilogram higher, yielding $3–$5 per kilogram.

A 200 kilogram batch at 3% depth requires approximately 6 kilograms of dye (approximately $24 at $4 per kilogram). Published industry benchmarks place total dyeing cost at approximately $3.40 per kilogram of fabric, comprising dye ($1.20), chemicals including salt, soda, and auxiliaries ($0.80), and the balance for water, energy, labour, and overhead. For 100 kilograms of fabric this implies approximately $340 per batch for a full dyeing cycle.

A shading addition, which accounts for the majority of corrections, adds 0.01–0.10% on-weight-of-fabric and requires a small additional chemical charge: typically $1–$6 in dye and $8–$15 in chemicals, or $10–$25 in total. A large addition remains in the range of $30–$55. The previous default of $180 per rework approaches the cost of a near-complete re-dye.

Revised defaults of $22, $30, and $38 per rework correspond to the mid-point of a routine shading addition, with 2–3× multiples applicable to the infrequent destructive-strip case.

### 3.3 Water Costs

Industrial water in Ho Chi Minh City was adjusted to VND 5,600 per cubic metre ($0.22) for the 2019–2022 period and is published at VND 8,000 per cubic metre ($0.32) for industrial parks under the clean-water pricing framework. Water utility analysis and sector reporting consistently place industrial rates in the range of $0.23–$0.45 per cubic metre including effluent surcharges.

Water intensity for batch dyeing is reported at 117–400 litres per kilogram, with a 15-mill Bangladesh study reporting 126 litres per kilogram consumed and 97 litres per kilogram as effluent. For a 100-kilogram batch this implies 12.6–40 cubic metres per full batch, or $3.80–$14.00 per full batch at industrial rates. A shading addition consumes a fraction of a full bath, typically 3–8 cubic metres ($1.00–$3.50).

Revised defaults of $7, $9, and $11 per rework are provisioned on approximately 20 cubic metres equivalent and are therefore conservative for an addition. Previous defaults of $40–$70 per rework implied 125–220 cubic metres per correction, equivalent to 3–14 full batches of water.

### 3.4 Energy Costs

The average retail electricity price in Vietnam was increased to VND 2,103.11 per kilowatt-hour ($0.085) in October 2024, with a regulated ceiling of VND 2,444.09 per kilowatt-hour ($0.095) established in March 2025. The previous average was approximately $0.080 per kilowatt-hour.

Heating 12–40 cubic metres of water from 25°C to 80°C and powering circulation requires approximately 45–110 kilowatt-hours per 100-kilogram full batch, or $3.80–$9.35 in electricity, with steam and gas equivalent adding a comparable increment. Estimated energy for a full batch is $8–$18; a shading addition requires $3–$8.

Revised defaults of $14, $18, and $22 per rework are provided for small, medium, and large profiles. Previous defaults of $55–$120 per rework implied approximately 650–1,400 kilowatt-hours per correction.

### 3.5 Time and Cycle Opportunity Cost

The previous time rate of $1.50 per minute ($90 per hour) exceeded the fully loaded Vietnam operator rate by a factor of 36–62. The revised rate of $0.07 per minute ($4.20 per hour) represents approximately twice the loaded labour rate plus a provision for machine opportunity at 2024 industrial energy and water prices.

At 200 minutes, the time component is therefore $14.00 (revised) compared with $300.00 (previous). The separate labour and overhead line already captures direct labour; the time line is retained as an opportunity-cost representation of machine occupancy.

---

## 4. RFT and Rework Typology

Published reproducibility data and rework classifications distinguish:

- **Small addition (shading):** approximately 80% of corrections — addition of a small dye amount to correct a light shade; cost factor of approximately +110% of base processing cost.
- **Large addition:** approximately 15% of corrections — larger dosage, cost factor of approximately +135%.
- **Destructive strip and re-dye:** infrequent — removal of dye with reducing or oxidative agents followed by a complete re-dye; cost dominated by chemicals, additional heat, and effluent treatment.

The forecast model previously priced every avoided miss at the strip cost. The revised defaults price every avoided miss at the shading cost, with the strip case 2–3× higher should a scenario analysis be required.

The current scenario realization band (conservative 0.75, expected 1.00, optimistic 1.25) can be interpreted as the share of misses that would have incurred a full-cost rework, with the conservative case already reflecting that not every miss results in a billable correction. The standalone savings calculator previously represented this explicitly through a correction success rate and an addressable-share factor; that explicit parameterization may be reintroduced if required for pilot scoping.

---

## 5. Impact on Reported Savings

For the medium profile presently used as the default view (550 batches per month, 86% to 92% RFT):

- Avoided reworks (expected): `550 × 12 × 6% = 396`
- Per-rework total: $136.00
- Expected annual savings: `396 × $136.00 = $53,856`
- Per-point value: `66 × $136.00 = $8,976` (conservative $6,732; optimistic $11,220)

This represents 14× less than the previous expected figure of $722,700 and is consistent with an annual dyed volume of 660,000 kilograms (550 × 100kg × 12). At a finished fabric selling price of approximately $7 per kilogram, annual sales are approximately $4.6 million; savings of $53,856 represent approximately 1.2% of sales.

The revised figures were verified in the production build. The hashed artifact `dist/_astro/forecast…B8hOZshc.js` contains `costPerRework:45,65,85` and `TIME_RATE_PER_MINUTE` of 0.07, and the page builds without type errors (`astro check` / `astro build`: 2 pages). Headless verification at the preview server confirmed that the revised “Expected annual” value renders correctly for each preset.

---

## 6. Limitations and Next Steps

1. Defaults remain provisional and should be validated against at least one pilot dyehouse’s measured consumption (litres per kilogram, kilowatt-hours per batch, and actual small-addition chemical and dye bills).
2. Batch weight is implicitly 100 kilograms in the per-kilogram to per-batch translation; mills running significantly larger or smaller lots should adjust dye, water, and energy proportionally.
3. Where management evaluates margin rather than operating cost, the addressable-share and seconds/down-grade assumptions should be made explicit in the calculator UI.

---

## 7. References

1. Talentnet Corporation — *Garment Worker Wages in Vietnam: 2025 Report & 2026 Trends* (survey of 735 firms; new-hire $154–$192, skilled $385–$577, average $400 with overtime) — https://www.talentnetgroup.com/vn/featured-insights/current-garment-worker-wages-vietnam
2. Textile Insights — *Vietnam’s Textile Workers Earn Higher Wages Than Global Average* (Vinatex average $300 vs global $200) — https://textileinsights.in/vietnams-textile-workers-earn-higher-wages-than-global-average/
3. WTO Center / VCCI — *Garment industry improves productivity to reduce pressure from high labour costs* (Vinatex chairman statement) — https://wtocenter.vn/tin-tuc/25435-garment-industry-improves-productivity-to-reduce-pressure-from-high-labour-costs
4. Saigoneer — *74% of Vietnam’s Garment Workers Earn Below Global Living Wage* — https://saigoneer.com/vietnam-news/16471-74-of-vietnam-s-garment-workers-earn-below-global-living-wage-study
5. International Labour Organization — *Viet Nam stands out in minimum wage compliance in Asia’s garment industries* — https://www.ilo.org/resource/news/viet-nam-stands-out-minimum-wage-compliance-asias-garment-industries
6. IndiaMART — Reactive dyes from INR 150/kg (Sunbeam) — https://dir.indiamart.com/impcat/reactive-dyes.html
7. IndiaMART — Navy Blue HE2R reactive dye at INR 340/kg — https://www.indiamart.com/proddetail/navy-blue-he2r-reactive-dye-27618722091.html
8. IndiaMART — Red ME6BL ME Bi reactive dye at INR 180/kg — https://www.indiamart.com/proddetail/red-me6bl-me-bi-reactive-dye-2853930272633.html
9. Mohsina Rahman Tisha / Nazmul Ahsan Jabed — *Total Dyeing Cost ≈ $3.40/kg* (dye $1.20, chemicals $0.80) — https://www.linkedin.com/posts/mohsina-rahman-tisha-555410404_textileengineering-dyeing-costing-activity-7455488962707681280-zNcV
10. Royal Society of Chemistry, Green Chemistry — *Color stripping of dyed textile waste* (chemicals, heat, agitation, effluent costs) — https://pubs.rsc.org/en/content/articlelanding/2026/gc/d5gc06662j
11. Springer Nature, Fashion and Textiles — *Effects of reductive stripping of reactive dyes on the quality of cotton fabric* — https://link.springer.com/article/10.1186/s40691-015-0032-y
12. Viet Nam News / Cong Thuong — *Average retail electricity price VND 2,103.11/kWh ($0.085)*, October 2024 — https://ven.congthuong.vn/increase-in-electricity-prices-concerns-manufacturers-53977.html
13. Vietstock — *Water prices set to rise in HCMC to VND 5,600/m³* — https://en.vietstock.vn/2019/10/water-prices-set-to-rise-in-hcmc-970-373203.htm
14. FAOLEX — *Vietnam Law & Legal: clean water prices in industrial parks, VND 8,000/m³* — https://faolex.fao.org:443/docs/pdf/vie92155.pdf
15. The Saigon Times — *Retail power tariff cap VND 2,444.09/kWh ($0.095)*, March 2025 — https://english.thesaigontimes.vn/retail-power-tariff-cap-set-at-vnd2444-per-kwh/
16. Reuters — *Vietnam hikes retail electricity prices by 8.36% to $0.0804/kWh* — https://www.reuters.com/article/vietnam-energy-prices/update-1-vietnam-hikes-retail-electricity-prices-by-836-pct-ministry-idUSL3N2172E1/
17. Slideshare — *Improving reproducibility in dyeing: small addition vs large addition cost and productivity* — https://www.slideshare.net/slideshow/24681302-improveing-the-reproducibility-in-dyeing-pptx/273851439
