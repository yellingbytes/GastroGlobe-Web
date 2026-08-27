# GastroGlobe Regional Cuisine Audit — Phase 1 (China)

**Date:** 2026-07-25
**Scope:** All 63 Munich restaurants tagged `countryId: "china"` in `data/munich-restaurants.js`, prior to this audit uniformly classified `china-national` except for 5 restaurants (`Sichuan Ecke`, `yā | The Mandarin Room`, `Karwan`, `Taklamakan Restaurant`, `Tengri Tagh`).
**Method:** Five parallel research passes covering every restaurant in the China set, each restaurant checked against official websites/menus, social media, delivery-platform listings, and independent local food press (München sehen, Mit Vergnügen München, haochibites, mucbook, Geheimtipp München, etc.). OSM cuisine tags alone were never treated as sufficient evidence. Two closure-flagged restaurants were separately re-verified by direct web search. See "Sources" in the updated `data/munich-regional-cuisine-taxonomy.json` and in `reports/munich-unresolved-restaurants.json` for the full citation trail.

Phases 2–4 (India, Japan, Vietnam, Thailand, Korea, Italy, France, Spain, Türkiye, Mexico) were **not** part of this pass and remain unchanged from the prior dataset. This report and the accompanying data-file updates cover China only.

---

## Headline numbers

| Metric | Before | After |
|---|---|---|
| China restaurants in dataset | 63 | **56** (7 removed, see below) |
| Classified into a specific regional cuisine | 5 | **25** |
| Unclassified (generic/insufficient evidence) | 58 | **31** |
| Distinct China regions with ≥1 restaurant | 3 (Sichuan, Cantonese, Xinjiang/Uyghur) | **6** (+ Hunan, Northern China/Beijing, Yunnan, Shanxi/Shaanxi noodles — a newly added region) |
| Evidence coverage (classified ÷ valid source count) | 7.9% | **44.6%** |

**Total restaurants reviewed:** 63
**Newly classified:** 21 (19 net-new regional assignments + 1 re-verification that changed evidence quality (`yā | The Mandarin Room`, medium→high) + Sichuan Ecke re-confirmed unchanged)
**Rejected classifications:** 0 previously-assigned restaurants were found to be wrongly classified (the 5 pre-existing assignments all held up)
**Removed from dataset (not genuinely dedicated Chinese restaurants):** 7
**Restaurants with unresolved closure signals (kept, flagged):** 2
**Restaurants with duplicate-branch questions investigated and resolved as genuine separate branches:** 3 brand groups (LeDu ×3, Slurp! Nudelbar ×2, Song's Kitchen ×2, Mama Bao/Mamma Bao ×2 — all confirmed real, distinct, currently-operating locations, not stale/duplicate OSM data)

---

## New regional taxonomy structure for China

| Region | Restaurants | Notes |
|---|---:|---|
| Sichuan / Chongqing | 10 | Largest classified cluster; hotpot houses, malatang specialists, and named Sichuan-identity restaurants |
| Cantonese / Guangdong | 5 | Includes one Chaoshan (Teochew) beef-hotpot specialist grouped under the Guangdong provincial bucket |
| Shanxi / Shaanxi noodles | 4 | **New region added** — Biang Biang noodle and Lanzhou-lamian specialists; did not exist as a populated region before this audit |
| Northern China / Beijing | 1 | First restaurant classified into this bucket |
| Hunan | 1 | First restaurant classified into this bucket |
| Yunnan | 1 | First restaurant classified into this bucket |
| Xinjiang / Uyghur | 3 | Unchanged — re-verified, all still open, evidence still holds |
| Jiangsu / Zhejiang / Shanghai | 0 | **Zero-count preserved.** Genuinely investigated ("Shanghai Restaurant," "Seen," "Wais Küche," "Fuyuan") — none qualified; see notes below |
| Northeast / Dongbei | 0 | No restaurant found with credible evidence |
| Fujian / Taiwan culinary family | 0 | No restaurant found with credible evidence |
| Tibetan | 0 | No restaurant found with credible evidence |
| Unclassified | 31 | Generic, multi-regional, or insufficiently evidenced — see `reports/munich-unresolved-restaurants.json` |

A restaurant literally named **"Shanghai Restaurant"** was investigated specifically for the Jiangsu/Zhejiang/Shanghai bucket and rejected — its menu and reviews describe a generic multi-regional Chinese offering with no Shanghainese dishes (no xiaolongbao, no red-braising), exactly the name-vs-cuisine trap the research brief warned against. **"Seen"** turned out to be a well-documented Sichuan specialist (chef from Chengdu) despite a name giving no hint of that, and **"Wais Küche"** turned out to be a Cantonese/Macanese dim sum specialist run by a family from Macau — both genuine, well-evidenced restaurants, just not Jiangsu/Zhejiang/Shanghai.

---

## Restaurants removed from the dataset (not genuinely dedicated Chinese restaurants)

Per the data-quality rule to remove restaurants not genuinely dedicated to the country's cuisine, the following 7 were removed from `data/munich-restaurants.js` entirely (both from the `restaurants` array and from China's `sourceRestaurantCount`):

| Restaurant | ID | Reason | Evidence |
|---|---|---|---|
| Die Küche im Kraftwerk | osm-node-3382171989 | Not a Chinese restaurant | Café/restaurant inside a converted power-plant building serving contemporary European cuisine, breakfasts, and cakes; no Chinese identity found anywhere. |
| Frau Li | osm-node-1005229944 | Self-described pan-Asian | Own site: "beste panasiatische Küche von Hong Kong über Singapur bis Bangkok." |
| Gyoza Bar | osm-node-2335067217 | Credibly Japanese-branded | Multiple independent food blogs describe it explicitly as serving Japanese gyoza/wantan, not Chinese jiaozi. |
| Hot Wok | osm-node-4058066268 | Generic pan-Asian fast-food chain | Multi-location franchise (Mama Pizza & Hot Wok Franchise GmbH), generic "Asian delicacies" marketing, no regional identity. |
| Tai China Imbiss | osm-node-59939872 | Explicit triple-cuisine imbiss | Own site (thai-china.de) markets Thai, Chinese, and Indian cuisine side by side as a quick-service snack bar. |
| The Hutong Club | osm-node-443340606 | Pan-Asian/Chinese fusion concept | Self-described "casual elegant Asian cuisine" with Asian-fusion cocktails; press coverage titled "Asian Fusion Reloaded." |
| Xin Yun | osm-node-296937481 | Pan-Asian (Chinese + Japanese) | Own site markets "traditionellem Dim Sum bis zu frischem Sushi" — a full first-party Japanese sushi program alongside Chinese dishes. |

`datasetMeta.includedRestaurants` was reduced from 1198 to 1191 and `datasetMeta.exclusions["fusion-or-ambiguous"]` increased from 13 to 20 to reflect these removals.

---

## Permanently closed / closure-uncertain restaurants

No restaurant was found to be *unambiguously* permanently closed, but two carry unresolved closure signals. Rather than guess, both were **kept in the dataset as unclassified** and flagged in `reports/munich-unresolved-restaurants.json` for field verification:

- **Qin Cheng** (osm-node-701421198, Herzog-Wilhelm-Straße 7) — menu evidence would otherwise support Shanxi/Shaanxi noodles (Biangbiang noodles, name plausibly referencing Xi'an/Xianyang), but HappyCow reports it "permanently closed" (June 2025) while other sources suggest it may have relocated/rebranded to "Mian Noodles / Qin Cheng Sendling." Left unclassified pending verification.
- **Meet Nudelbar** (osm-node-11365929071, Schillerstraße 14) — the same address now appears to host a differently-named business, "Sichuan Küche Nudelbar." Could not confirm whether this is the same business rebranded or a genuinely new tenant, so the entry was neither renamed nor deleted, only flagged.

`Hantang Malatang` was also flagged mid-research (a stale Uber Eats "closed" status, a dead Wolt link) but was subsequently confirmed still active via a working Wolt delivery listing — no action needed.

---

## Duplicate-branch investigations (all resolved as genuine, distinct restaurants)

The following name clusters were specifically checked for duplicate/stale OSM data. In every case, independent evidence (different phone numbers, different domains, different hours, or explicit "at two locations" press coverage) confirmed these are genuinely separate, currently-operating branches — none were merged or removed:

- **Mama Bao** (Adalbertstraße 8) and **Mamma Bao** (Augustenstraße 31) — two branches of the same Biang Biang noodle chain; Geheimtipp München explicitly describes the brand operating "an zwei Standorten."
- **LeDu - Happy Dumplings** (Theresienstraße 18), **LeDu Happy Dumplings & Noodle** (Altheimer Eck 7), and **LEDU DUMPLINGS & JIANBING** (Stachus Passagen/Karlsplatz 1) — three genuinely distinct branches of the same small chain.
- **Slurp! Nudelbar** (Augustenstraße 94) and **Slurp! Nudelbar** (Leopoldstraße 41) — two distinct, currently-operating branches of the same "面肆郎" noodle-bar brand.
- **Song's Kitchen** (Rosenheimer Straße 67) and **Song's Kitchen** (Schleißheimer Straße 5) — same owner (Danhua Song), confirmed separate branches by different phone numbers and websites.

---

## Uncertain / notable restaurants worth a second look

- **San Jie Mei** (osm-node-326725407) — the owner's own website explicitly documents a genuine *dual* regional identity (Cantonese dim sum background + husband specializing in "Yue- und Sichuan-Region" cuisine). This is unusually strong first-party evidence, but because the one-restaurant-one-region rule doesn't fit a documented dual concept cleanly, it was left unclassified rather than arbitrarily assigned to one region. Flagged distinctly in `reports/munich-unresolved-restaurants.json`.
- **Fuyuan** — OSM lists its address as "Gräfelfing," but the street (Augustenstraße 21) and every other listing place it in central Munich (Maxvorstadt). Likely an OSM data error; left uncorrected as out of scope for a cuisine-classification audit, but flagged here for a future data-quality pass.

---

## Evidence coverage

- Restaurants reviewed: 63
- Valid source restaurant count after exclusions: 56
- Classified: 25 → **44.6% evidence coverage**
- Unclassified: 31 (55.4%) — genuinely researched and found to lack single-region evidence, not merely unexamined

This is a large increase in *verified* coverage from the prior snapshot (7.9%, 5/63), achieved without lowering the evidence bar — the majority of "china-national" restaurants investigated turned out to be genuinely multi-regional (explicitly, by their own websites or documented chef teams) or generically evidenced, and were correctly left unclassified rather than force-fit into a region.

---

## Full table of changed restaurants

| Restaurant | Previous region | New region | Confidence | Evidence | Sources |
|---|---|---|---|---|---|
| Sichuan Ecke | Sichuan (high) | Sichuan / Chongqing (high) | High | Re-confirmed via official site + 2 independent reviews | [eatbu.com](https://sichuan-ecke.eatbu.com/?lang=en), [Mit Vergnügen](https://muenchen.mitvergnuegen.com/tipps/chinesisches-sharing-in-der-sichuan-kueche/) |
| Chois Hotpot & Lounge | china-national | Sichuan / Chongqing | High | Official site: hotpot per old Sichuan-province recipes; "Bring Chongqing home!" | [chois-hotpot.de](https://www.chois-hotpot.de/) |
| Chuan-Fans | china-national | Sichuan / Chongqing | Medium | Name contains "Chuan" (川); directory + press confirm Sichuan cuisine | [feinfood.com](http://de.feinfood.com/restaurant/Deutschland/Muenchen/CHUAN-FANS(%E5%B7%9D%E7%B2%89).xhtml) |
| GuShu Hotpot | china-national | Sichuan / Chongqing | High | Official site: "Hotpot Spezialität aus Sichuan in China" | [gushu-hotpot.de](https://gushu-hotpot.de/) |
| Hantang Malatang | china-national | Sichuan / Chongqing | Medium | Dish name itself (malatang) is Sichuan/Chongqing in origin; confirmed still open | [Wikipedia: Malatang](https://en.wikipedia.org/wiki/Malatang) |
| Malatang | china-national | Sichuan / Chongqing | Medium | Same dish-name reasoning; active listings | [muenchen-sehen.de](https://www.muenchen-sehen.de/essen-trinken/malatang-restaurants-muenchen/) |
| Dingshang | china-national | Sichuan / Chongqing | Medium | Directories categorize "Szechuan"; blog names specific Sichuan dishes | [muenchen-sehen.de](https://www.muenchen-sehen.de/essen-trinken/dingshang-chinesisches-restaurant-muenchen/) |
| Seen | china-national | Sichuan / Chongqing | High | Official site: head chef from Chengdu, authentic Sichuan cuisine | [seen-restaurant.de](https://seen-restaurant.de/) |
| Sister Wei | china-national | Sichuan / Chongqing | Medium | Signature "Trockentopf" dishes explicitly rooted in Sichuan cuisine | [muenchen-sehen.de](https://www.muenchen-sehen.de/essen-trinken/chinesisch-essen-sister-wei/) |
| Yanyou | china-national | Sichuan / Chongqing | Medium | Own site: "Sichuan Fusion Restaurant"; repeated Sichuan-named dishes | [yanyou.de](http://www.yanyou.de/) |
| Xiang | china-national | Hunan | Medium | Name = classical abbreviation for Hunan; 2 independent Hunan-focused features | [muenchen-sehen.de](https://www.muenchen-sehen.de/essen-trinken/xiang-muenchen-hunan-kueche/) |
| yā \| The Mandarin Room | Cantonese/Guangdong (medium, OSM tag only) | Cantonese / Guangdong (high) | High | Independent editorial + official site corroborate beyond the OSM tag | [muenchen-sehen.de](https://www.muenchen-sehen.de/essen-trinken/ya-the-mandarin-room/) |
| Bonsai Garden | china-national | Cantonese / Guangdong | High | Official site: "unsere chinesische Kanton-Küche" | [bon-sai-garden.de](https://bon-sai-garden.de/) |
| Juli | china-national | Cantonese / Guangdong (Chaoshan) | High | Official site title/meta: Chaoshan beef hotpot | [juli-restaurants.de](https://juli-restaurants.de/) |
| Kam Lung | china-national | Cantonese / Guangdong | Medium | Structured Tripadvisor tags + Cantonese reviewer testimony | [Tripadvisor](https://www.tripadvisor.com/Restaurant_Review-g187309-d1111187-Reviews-Kam_Lung-Munich_Upper_Bavaria_Bavaria.html) |
| Wais Küche | china-national | Cantonese / Guangdong | High | Official site: Macau family, dim sum chef founder | [waiskueche.de](https://www.waiskueche.de/) |
| Bia & Ban | china-national | Northern China / Beijing | Medium | Own site "Beijing energy" + independent review "Solide Beijing-Küche" | [biaban.de](https://www.biaban.de/) |
| JOY China-Restaurant | china-national | Yunnan | Medium | Signature dish "Guoqiao Mixian," a distinctive Yunnan specialty | [joy-restaurant.de](https://www.joy-restaurant.de/) |
| Mama Bao | china-national | Shanxi / Shaanxi noodles | High | Own site + press: Biang Biang noodles from Shaanxi | [mammabao.de](https://mammabao.de/) |
| Mamma Bao | china-national | Shanxi / Shaanxi noodles | High | Same brand, flagship location, same Shaanxi specialty | [in-muenchen.de](https://www.in-muenchen.de/gastro/restaurants/das-chinesische-restaurant-mamma-bao-in-der-augustenstrasse-muenchen-92021504.html) |
| Max Beef Noodles | china-national | Shanxi / Shaanxi noodles | High | Multiple sources: reinterpretation of Lanzhou Lamian beef noodle soup | [Falstaff](https://www.falstaff.com/en/streetfood/maxs-beef-noodles) |
| Shang Miang | china-national | Shanxi / Shaanxi noodles | High | Own menu: "Xi'an Biang Biang Noodles," entire concept built around it | [Mit Vergnügen](https://muenchen.mitvergnuegen.com/tipps/handpulled-noodles-bei-shang-miang-schluerfen/) |
| Karwan | Xinjiang/Uyghur (high) | Xinjiang / Uyghur (high) | High | Re-verified, unchanged | [karwan-muenchen.de](https://www.karwan-muenchen.de/) |
| Taklamakan Restaurant | Xinjiang/Uyghur (high) | Xinjiang / Uyghur (high) | High | Re-verified, unchanged | [taklamakan-restaurant.de](https://taklamakan-restaurant.de/taklamakan-restaurant-muenchen/) |
| Tengri Tagh | Xinjiang/Uyghur (high) | Xinjiang / Uyghur (high) | High | Re-verified, unchanged | [tengritagh-uyghur.de](https://www.tengritagh-uyghur.de/en/reservierungen) |

*(Restaurants not listed above remain `china-national`/unclassified — see `reports/munich-unresolved-restaurants.json` for the full record of every restaurant investigated and why it did not qualify — or were removed, see the exclusion table above.)*

---

## Validation

- `node scripts/validate-regional-taxonomy.mjs` → **passes**: "Valid taxonomy: 11 countries, 86 regions, 32 classified restaurants." (32 = 25 China + 7 previously-classified restaurants in other untouched countries: Italy 4, France 1, India 1, Vietnam 1.)
- Sum of China regional counts (25) = `classifiedRestaurantCount` (25). ✓
- `classifiedRestaurantCount` (25) + `unclassifiedRestaurantCount` (31) = `sourceRestaurantCount` (56). ✓
- No restaurant assigned to more than one region. ✓
- Every restaurant ID referenced in the taxonomy exists in `data/munich-restaurants.js`. ✓
- Zero-count regions (Jiangsu/Zhejiang/Shanghai, Northeast/Dongbei, Fujian/Taiwan, Tibetan) remain visible in the taxonomy. ✓
- `data/munich-restaurants.js` loads without error and `regionTaxonomy` contains a matching entry for every `regionId` now in use (6 new region entries added: `sichuan`, `hunan`, `northern-china`, `yunnan`, `xinjiang-uyghur`, `shanxi-shaanxi-noodles`). ✓

## Next steps (not done in this pass)

Per the phased execution plan, Phase 1 (China) is complete. Phases 2–4 — India, Japan, Vietnam, Thailand, Korea (Phase 2), Italy, France, Spain, Türkiye (Phase 3), and Mexico plus remaining countries (Phase 4) — were intentionally not started in this session and their taxonomy entries are untouched. Given the volume involved (Japan 91, India 94, Vietnam 105, Italy 407 restaurants, etc.), each should get the same restaurant-by-restaurant treatment as China rather than a lighter pass.
