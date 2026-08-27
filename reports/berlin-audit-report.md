# GastroGlobe Berlin — dataset build and regional audits

**Date:** 2026-08-25
**Snapshot:** OpenStreetMap via Overpass API, Berlin city relation 62422
**Scope:** Building Berlin as a second verified edition, then auditing its regional cuisines to the same evidence standard used for Munich. **China is complete (158/158). Vietnam is a first pass only (49 of 289) and is explicitly marked in-progress in the data.**

---

## 1. The Berlin dataset

Berlin had no dataset before this pass. It was built with the same pipeline as Munich, generalised so both cities share one cuisine taxonomy.

| | Berlin | Munich (for comparison) |
|---|---:|---:|
| Raw OSM `amenity=restaurant` features | 4,759 | 1,916 |
| Named + country-specific cuisine tag | **2,887** | 1,191 |
| After the China audit's removals | **2,873** | 1,196 |
| Countries represented | **62** | 43 |

Exclusions applied by the normaliser, matching Munich's definition:

| Reason | Count |
|---|---:|
| generic or food-type cuisine tag only (`asian`, `burger`, `regional`…) | 1,661 |
| multi-country tag | 160 |
| missing name or coordinate | 28 |
| fusion or ambiguous | 20 |
| duplicate within 60 m | 3 |

Berlin's ten largest country sets: Italy 901, Vietnam 289, Germany 267, Japan 261, India 210, China 158, Greece 117, Türkiye 90, South Korea 81, Mexico 67.

### Cuisine-taxonomy work this required

Berlin's OSM data used **149 cuisine tokens the old normaliser did not know**. Rather than silently dropping those restaurants, the taxonomy was extended and moved into `scripts/cuisine-taxonomy.mjs` as a single source of truth:

- **31 countries added** — Poland, Sudan, Egypt, Nigeria, Uzbekistan, Singapore, Mongolia, Cuba, Switzerland, Laos, Yemen, Colombia, Tunisia, Palestine, Iraq, the Philippines, DR Congo, Norway, Albania, Slovakia, Cambodia, Cyprus, Sweden, Chile, Belgium, Gambia, Bolivia and others.
- **Region tags added** — `sichuan`, `tibetan`, `taiwanese`, `alsatian`, `sardinian`, `swabian`, `badisch`, `south_indian`, `bengal`, `anatolian`, `hawaiian`.
- **Aliases folded in** so misspellings and German-language tags map to a canonical tag instead of being dropped: `tibetian`→`tibetan`, `columbian`→`colombian`, `suisse`→`swiss`, `sichuanese`/`szechuan`→`sichuan`, `nepali`→`nepalese`, `ceylon`/`sri_lanka`→`sri_lankan`, `iranian`→`persian`, `albanisch`→`albanian`, `bolivianisch`→`bolivian`, `yemenese`→`yemeni`, `coffe_shop`→`coffee_shop`, `steakhaus`→`steak_house`.

Munich's dataset is deliberately **left frozen** at its 2026-07-18 snapshot: its hand-researched editorial overrides reference specific OSM ids, and regenerating it would discard that work. Both cities now normalise through the same shared tables going forward.

---

## 1b. Source-scope correction (2026-08-26)

The first build queried only `amenity=restaurant`. That was wrong, and it was wrong in a way that
specifically suppressed regional signal.

A large share of Berlin's most regionally *specific* Chinese and Vietnamese cooking trades in
counter-service format and is tagged `amenity=fast_food` in OpenStreetMap. Filtering on shop format
at query time deleted that class of restaurant before any evidence could be weighed. Among the 29
China records the widened query recovered:

| Record | Why it matters |
| --- | --- |
| Biang Biang | Biangbiang noodles are the signature Xi'an / Shaanxi dish |
| Wen Cheng (x2) | Berlin's best-known Lanzhou beef-noodle operation |
| Chen's Noodle House | Hand-pulled northwestern noodles |
| Lu Kitchen | 魯菜 / "Lu" is the standard name for Shandong cuisine |
| Tsingtao Pavillon | Qingdao, Shandong |
| Mao Master, Mao Zeit | Mao-branding is near-universal Hunan positioning |

These are candidates, not classifications — none has been researched yet. But the previous build could
not even see them, and Hunan and Shandong are precisely the regions whose absence looked implausible
for a city of Berlin's size. Roughly two-thirds of the 29 are generic Asia-Imbiss operations that the
methodology excludes anyway; the point is that they are now excluded **by the audit on the evidence**
rather than **by the query on the shop format**.

`amenity=cafe` remains excluded, per the original brief.

### Effect

| | before | after |
| --- | --- | --- |
| source features | 4,759 | 7,597 |
| records | 2,887 | 3,672 |
| countries | 62 | 64 (+Bolivia, +Chile) |
| China records | 158 | 187 |
| Vietnam records | 289 | 325 |

No existing record was lost — OSM ids are stable, so the hand-audited work carried over intact.

### Consequence for the China audit's status

China had been published as **complete**, with `zeroCountsMeaningful: true`. That claim was made
against 158 records; there are now 187. China is therefore reclassified **in-progress** with 29 pending.

Its empty regions stay published, because a zero there is still a real finding across every record
searched so far — withholding them would destroy information. But the build script previously tied
"may empty regions be published" to "is the audit finished"; those are two different questions and are
now separate flags. China answers yes/no, Vietnam answers no/no.

### A correction to an earlier claim

An earlier note described Berlin's raw set as "four times Munich's". It is not: 4,759 against 1,916 is
2.5x, and on the widened scope 7,597 against 2,743 is 2.8x.

## 2. China regional audit — complete

All **158** China-tagged Berlin records were researched individually against first-party websites, menus, official social profiles, and independent Berlin food press (Berlin Food Stories, tip Berlin, Tagesspiegel, Berliner Zeitung, Mit Vergnügen, ceecee.cc, pinwo.de, Creme Guides, huanying.berlin). An OpenStreetMap cuisine tag on its own was treated as **a candidate to verify, never as evidence**.

### Headline numbers

| Metric | Value |
|---|---:|
| Records audited | 158 |
| Removed — not a dedicated Chinese restaurant | 11 |
| Removed — permanently closed | 3 |
| **Remaining in the China set** | **144** |
| **Classified into a regional cuisine** | **62** |
| Unclassified | 82 |
| **Evidence coverage** | **43.1%** |

For comparison, Munich's China set reached 44.6% coverage on 56 restaurants. Berlin's is a similar rate over roughly three times the volume.

### Regional distribution

| Region | Restaurants |
|---|---:|
| Sichuan / Chongqing | **25** |
| Shanxi / Shaanxi noodles | **16** |
| Cantonese / Guangdong | **9** |
| Northern China / Beijing | 3 |
| Jiangsu / Zhejiang / Shanghai | 2 |
| Northeast / Dongbei | 2 |
| Fujian / Taiwan culinary family | 2 |
| Yunnan | 1 |
| Xinjiang / Uyghur | 1 |
| Tibetan | 1 |
| Hunan | 0 — zero-count preserved |

Two findings are worth stating plainly. **Sichuan is Berlin's dominant verified Chinese regional cuisine**, at 25 restaurants — from Chengdu hotpot chains (Shoo Loong Kan 小龙坎, Houtang 吼堂) through maocai franchises (Sanku 三顾冒菜, two branches) to vegan Sichuan bistros (Sùsù, Tianfuzius). And **northwestern hand-pulled noodles are a genuine second cluster** at 16: four Wen Cheng branches on Shaanxi biang biang noodles, two independent Lanzhou Beef Noodles houses, two Mr. Noodle Chen branches, plus Xi-Mian, Zhang Lala, Holly, Tao Yuan, The Noodle Town, Jade Palast, Bang Bang and a Shanxi knife-cut noodle house.

**Hunan is kept at zero.** It was actively looked for — three restaurants were checked against a Hunan hypothesis and all three failed it (see §5).

---

## 3. Vietnam regional audit — first pass, in progress

Berlin has the largest Vietnamese community in Germany and 289 Vietnam-tagged records — more than Munich's entire China set. The audit was started with six parallel research batches; **one batch of 49 completed before the session's research budget ran out**, so this section covers 49 of 289 records and the remaining 240 are untouched.

### Why the data says so explicitly

A partially audited country cannot be presented like a finished one. Two things would otherwise be silently false:

- **Empty regions would lie.** In a completed audit a zero count means "searched for and not found" — that is the whole point of preserving Hunan at zero for China. For Vietnam, four of the seven regions have not been searched at all, so publishing them at zero would assert something untrue. The build script now **withholds empty regions** for any country flagged `zeroCountsMeaningful: false`.
- **"Unclassified" would conflate two different states.** The taxonomy therefore carries `auditStatus: "in-progress"`, `examinedRecordCount`, `auditedRestaurantCount` and `pendingAuditCount` so that "checked, no regional evidence" is never read as "not yet reached".

| Metric | Value |
|---|---:|
| Vietnam-tagged records | 289 |
| Records examined so far | 49 |
| Removed — not a dedicated Vietnamese restaurant | 5 |
| **Remaining in the Vietnam set** | **284** |
| Audited and retained | 44 |
| **Not yet audited** | **240** |
| Classified | 5 |

### Classified so far (5, all medium confidence — no high-confidence case in this batch)

| Restaurant | Region | Evidence |
|---|---|---|
| Anh Ba (Nassauische Str.) | Quảng Nam–Đà Nẵng / South-Central | Own site titled "Authentische Küche Mittelvietnams"; menu badges cao lầu and mì Quảng as central specialities |
| Anh Ba (Neukölln) | Quảng Nam–Đà Nẵng / South-Central | Same operator; listing describes "the aromatic depth of Central Vietnam" — a genuine second branch |
| Ça Va Sàigòn Bánh Mì | Saigon / Southeast | Qiez reports the founders opened it to bring "the taste of South Vietnam" to Berlin |
| Bánhten | Saigon / Southeast | The Berliner describes "authentic Saigon-inspired bánh mì"; single-focus bakery |
| Chén Ché | Hanoi / Red River Delta | German food press independently describes "nordvietnamesische Küche" from monastery recipes |

### Removed (5)

Asia Mami and Binh Minh (pan-Asian menus), Atuka and Bambus am See (sushi-led hybrids), and Bowl Kitchen (an office-building weekday bowl counter).

### Near-misses deliberately left alone

These are the cases that show the methodology working rather than failing:

- **Banh Xeo Saigon** — Berlin Food Stories reports the owner "hails from Da Nang", which is real medium-grade evidence. But the menu tours every region at once (bánh xèo Sài Gòn, mì Quảng, bún bò Huế, bún cá Nha Trang, hủ tiếu, bún bò Nam Bộ), so the owner-origin signal is cancelled.
- **Bên Thânh** — visitBerlin says it evokes "the famous Saigon market". Bến Thành *is* Saigon's central market, but that write-up is glossing the name, not reporting the kitchen; the menu is generic phở and curry plus sushi.
- **Bu Kon** — its signature set is bún bò Huế, bún chả Hanoi and phở bò together: a national menu, and a textbook illustration of why one bún bò Huế line cannot assign Huế.
- **A Mà 34** — the only descriptive line found hedges between "Hanoi or Ho Chi Minh City", which is the opposite of regional evidence.

### Data quality from this batch

Nine address or postcode fixes were resolved from OSM node coordinates (A Mà 34, AN DEM, Anh Ba Neukölln, Anjoy, Bánh Mì Nóng, Ça Va Sàigòn, Caytre, plus postcode corrections for Bánhten and Calvin Com Pho). All three apparent duplicate pairs — Anh Ba, Chay Long, Chay Village — turned out to be **genuine separate branches** and were kept. Caytre must not be merged with the separate "Cay Tre Quan" on Potsdamer Straße. No permanently closed restaurants were found.

One correction worth recording: the research batch's own closing summary reported "4 classified, 6 excluded", but its per-restaurant verdicts are 5 and 5. The verdicts were taken as authoritative and the summary's arithmetic discarded.

---

## 4. Removed records — China

Vietnam's five removals are listed in §3.

### Not dedicated Chinese restaurants (11)

| Restaurant | Why |
|---|---|
| Asia Koy Restaurant | Pan-Asian hotel buffet: Chinese, Japanese sushi and Vietnamese |
| Chekiang | Lunch Schnellrestaurant with a substantial Vietnamese section |
| han west | Mixed Asian bao counter — Thai chicken, halloumi-lemongrass, Korean BBQ, fries |
| Home of Dumplings | Categorised Chinese *and* Japanese; dumplings paired with seitan ramen |
| Harmonie | 202-dish menu including sushi; registered as "Fernöstliche Spezialitäten" |
| Master Wok's Asia Imbiss | Own menu carries a full Chinese section *and* a parallel full Thai section |
| Saigon Grill & Hotpot | Vietnamese-run AYCE buffet — the OSM `cuisine=chinese` tag is simply wrong |
| Restaurant BaoBao | Sushi and Vietnamese items; markets itself as "BaoBao – Asia Küche" |
| Rosengarten | Trades as "Rosengarten China-Japan Restaurant" with teppanyaki |
| Panda Meister | Bubble-tea-led chain outlet, roughly ten seats |
| Teehaus zum Osmanthussaft | A park tea house behind paid admission, not a dining venue |

### Permanently closed (3)

- **Chungking Noodles** — closed after six and a half years; was a genuine Chongqing xiaomian specialist.
- **Grand Tang** — traded as Grand Tang Xi Yu; closed. A separate Charlottenburg restaurant of the same name is also closed.
- **Ho Lin Wah** — closed 22 December 2023 and succeeded at the same Kurfürstendamm 218 premises by **En Lee Cai**, which is recorded separately. These two nodes describe one address at two points in time: a **temporal duplicate**, not two venues.

---

## 5. Name traps the audit defused — China

The methodology's rule against classifying on a name alone earned its keep repeatedly:

| Restaurant | The tempting inference | What the evidence showed |
|---|---|---|
| **Chekiang** | "Chekiang" is the postal romanisation of Zhejiang | Zero corroboration of any Zhejiang identity; menu is Chinese plus Vietnamese. Excluded. |
| **Shanghai** (Weichselstr.) | Named Shanghai | Own ordering site titled "Chinesisch, Vietnamesisch, Asiatisch"; no Shanghai signatures. |
| **Yumcha Heroes** | 飲茶 is a Cantonese term | Own site defines yumcha generically and never claims Cantonese; modern dumpling card. |
| **Lao Xiang** | 湘 would mean Hunan | The name is 老乡 ("fellow villager"). A Hunan inference would have been wrong. |
| **Lu Kitchen** | 鲁 is the classical abbreviation for Shandong | No Shandong evidence at all; "Lu" is more likely a surname. |
| **Man Kee** | Cantonese-style romanisation (文記) | The kitchen self-identifies as **Sichuan** — the name pointed the wrong way. |
| **Green Flavor** | An aggregator claimed "authentic taste of Zhejiang" | The restaurant's own site explicitly declines a regional identity. Aggregator text discarded. |
| **han west** | Legacy trade name "han west – szechuan noodles" | Current menu has one Szechuan bao among Thai, Korean and halloumi fillings. |
| **Royal Gourmet** | "Mongolian BBQ" on the menu | That is the Taiwanese-invented buffet-grill format, not a cuisine. |
| **Tibet Haus** | OSM tagged it `tibetan` | Self-describes as "Tibetan, Nepalese and Thai". Tag **rejected**. |

Conversely, four OSM regional tags were checked and **confirmed**: CÀI Kitchen (`szechuan`), Chuan Garden (`sichuanese`), Happy Momo (`tibetan`), and both Taiwanese tags (Mibap, 牛稼莊 Beef House).

---

## 6. Restaurants left unclassified for interesting reasons — China

Of the 82 unclassified, 42 are ordinary German-Chinese neighbourhood restaurants with no regional claim anywhere. The other 40 break down as:

- **24 name two or more co-equal regions themselves.** These are "too many regions", not "too little evidence":
  - **Hot Spot** — Berliner Zeitung, Creme Guides, Falstaff and Schlemmer-Atlas all report the owners cook from **Sichuan, Jiangsu *and* Shanghai**.
  - **Peking Ente** — own tagline is "Spezialitäten aus Peking und der Provinz Szechuan".
  - **tangs kantine** — own site names Sichuan, Shanghai *and* Cantonese dim sum.
  - **Hua Li Du** — own listing offers "specialties from Canton, Shanghai and Sichuan".
  - **Lei's Küche** — own menu labels dishes both "nach Hunan-Art" and "nach Sichuan-Art".
  - **Long March Canteen**, **Feast**, **UUU** — deliberately pan-regional concepts by design.
- **8 are suggestive but under-evidenced** and would likely resolve with one menu photograph: FúFú Bistro, Deli-House, Goji, Shifang House, Lucky Star, Pong's, Sun Wah, En Lee Cai.
- **4 have sources that actively disagree**: Kongfu Chili (Berlin Food Stories says Sichuan; its signature is a Shaanxi belt noodle), Jing Yang, Lao Xiang, YiLa Nudel.
- **4 had a candidate region checked and rejected**: Green Flavor, Shanghai, Yumcha Heroes, Tibet Haus.

If the schema ever supports a secondary region, the 24 multi-region records are the ones that justify it.

---

## 7. Data-quality findings for upstream OpenStreetMap — China

The audit produced concrete fixes worth pushing back to OSM.

**14 missing or wrong addresses resolved** via the OSM API and Nominatim:

| Restaurant | Resolved address |
|---|---|
| China Garden | Hermsdorfer Damm 134, 13467 |
| China Haus | Köpenicker Str. 33, 12524 |
| China Town Restaurant | Mariendorfer Damm 442, 12107 |
| Boa Goa Club | Markthalle Neun, Eisenbahnstr. 42/43, 10997 |
| Kaiser Drachen | Stubenrauchstraße 78, 12487 |
| Man-Far | Brunsbütteler Damm 260, 13581 |
| Ky Ngo Asia-Imbiss | Mittelbuschweg 17, 12055 |
| The Noodle Town Mitte | Große Hamburger Str. 24, 10115 |
| UUU | Sprengelstraße 15, 13353 |
| Wan Loi | Neuköllner Str. 302, 12357 |
| Wen's Küche | Mariendorfer Damm 175, 12107 |
| Mr. Noodle Chen (Friedrichshain) | Niederbarnimstraße 4, 10247 |
| Peking Perle | Falkenseer Damm 17, 13585 |
| Fu Duo | Triftstraße 33, 13127 |
| Golden Garden | Heinersdorfer Straße 19a, 12209 |
| Hee Lam Mun | Grunewaldstraße 23, 12165 |
| Hotpot & Nudeln | Revaler Str. 17, 10245 |

**Corrections:**
- **Do De Li** is at Kantstraße **120**, not 121.
- **Regent** — the node is mis-placed onto Rohrsängersteig; the registered address is Imchenallee 44, 14089.
- **Boa Goa Club** — the OSM name is a misspelling of **Bao Gao Club**.
- **Le Moon** — now trades as **Willing China Restaurant**; the OSM name is stale.
- **Neu Wuzhou** — OSM says Marzahner Promenade 14, all directories say 13.

**Confirmed as genuine separate branches, not duplicates:** all four Wen Cheng sites, both Aroma, both Rotbohnen, both Sanku Maots'ai, both Ming Dynastie, both Lanzhou Beef Noodles, both Mr. Noodle Chen, both Bao Gao Club locations, Jade Palast 2.

---

## 8. Open items needing human follow-up

These were **not** resolved and are recorded honestly rather than guessed:

| Item | Status |
|---|---|
| **CÀI Kitchen** | Reported closed ~November 2025 by HappyCow, but Berlin Food Stories still shows live hours. Kept and classified; needs confirmation. |
| **Tai-Lee** | speisekarte.de marks it permanently closed while other directories publish live hours. Phone check needed before retiring. |
| **Wei Dao Jia** | Temporarily closed with a stated 6 March 2026 reopening. |
| **Tianfuzius**, **Zhou's Fine**, **Deli-House**, **China Restaurant Panda II** | No 2026 trading confirmation found. |
| **Shan Shan** | Classified Jiangsu/Zhejiang/Shanghai on the operator's own Nanjing framing and documented chef origin, but Berlin Food Stories calls it Northern Chinese. The conflict is flagged in the unresolved file. |
| **Rotbohnen** (both) | Classified Northern China on the operator's own "nordchinesisch" wording, but several third-party sources say Dongbei specifically. A menu photo showing 锅包肉 or 地三鲜 would settle it. |
| **Jade Palast**, **Bang Bang** | Assigned to Shanxi/Shaanxi on menu dominance; no source names Shaanxi, Xi'an, Lanzhou or Gansu for these two specifically. |
| **China Food**, **China Snack**, **Zhong Hua**, **Zhou's Fine** | Borderline exclusion candidates — Thai/Vietnamese menu sections or AYCE Asian buffet formats. Kept in the set pending a manual menu check. |
| **Ky Ngo Asia-Imbiss** | No web presence beyond directory stubs; proprietor name is Vietnamese. Needs an on-the-ground check. |

---

## 9. Validation

`node scripts/validate-regional-taxonomy.mjs` now checks both cities:

```
✓ munich: 1196 restaurants, 11 countries in taxonomy, 84 regions, 83 classified.
✓ berlin: 2868 restaurants, 2 countries in taxonomy, 14 regions, 67 classified.
```

Checks performed per city: every region's `restaurantCount` matches its list; classified + unclassified equals `sourceRestaurantCount`; `sourceRestaurantCount` matches the dataset; every referenced restaurant id exists; no restaurant appears in two regions; taxonomy names match the source dataset.

For Vietnam two further identities were checked by hand, because a partial audit is easy to misreport:

- `auditedRestaurantCount` (44) + `pendingAuditCount` (240) = `sourceRestaurantCount` (284)
- `examinedRecordCount` (49) = audited (44) + removed (5)

That second check caught a real error: `pendingAuditCount` was initially computed by subtracting the 49 *examined records* from a source count that already excluded 5 of them, understating the outstanding work by five restaurants.

---

## 10. What is not done

- **Vietnam is 240 restaurants short of complete.** Five of the six research batches were lost to the session's research budget; only batch 1 (49 records) finished. The remaining batches are already scoped and can be re-run directly. Until then Vietnam stays flagged `auditStatus: "in-progress"` and its empty regions stay withheld.
- **Berlin's other 60 countries are not regionally audited at all.** Italy (901), Japan (261), India (210), Greece (117) and Türkiye (90) are the obvious next phases.
- **Berlin's non-China regional assignments come from OSM tags only** — 505 restaurants outside China carry a tag-derived region (Campania pizza 290, sushi 148, ramen 23, tapas 19, Bavaria 12, Swabia 4, Hawaii 3, and one each for Alsace, Sardinia, Baden, Bengali, South India and Central Anatolia). Those tags have **not** been verified to this report's standard and should not be presented as researched. Within China they were verified: five held up and one (Tibet Haus) was rejected and reset to the national bucket.
- **The 505 figure predates the Vietnam removals** and is a count of tag-derived regions outside China; none of Vietnam's regional assignments come from tags.
- **London, Paris and New York** were not started.

### Added by the source-scope correction

- **China is no longer complete.** 29 counter-service records are pending, several of them strong
  Shaanxi / Lanzhou / Shandong / Hunan candidates. Until they are audited every China zero count,
  Hunan included, is provisional.
- **Vietnam pending rose from 240 to 276.** The widened query added 36, including "Ha Noi Pho" — an
  explicit Hanoi signal the earlier scope could not see.
- **Munich has the identical blind spot and has not been corrected.** Its snapshot is still
  `amenity=restaurant` only, and its own fast_food layer holds 827 features (10 China-tagged,
  14 Vietnam-tagged). Munich's China audit is published as complete with meaningful zero counts, so
  widening its source would reopen it the same way it reopened Berlin's. That is a deliberate
  decision left to the maintainer, not an oversight: the two cities are currently **not**
  built on the same source definition, and any Munich-vs-Berlin comparison is affected until they are.
