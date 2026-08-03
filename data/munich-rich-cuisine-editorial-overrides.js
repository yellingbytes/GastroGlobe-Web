const UPDATE_DATE = "2026-08-03";

const SOURCE_COUNTRY_ID = {
  Japan: "japan",
  India: "india",
  Thailand: "thailand",
  "Türkiye": "turkiye",
  Korea: "south-korea",
  Vietnam: "vietnam",
  Italy: "italy",
  France: "france",
  Spain: "spain",
  Mexico: "mexico",
};

const assignments = [
  // Japan — only specialists whose first-party menu or public identity supports a
  // regional tradition. Generic ramen and pan-Asian sushi remain National.
  {
    id: "osm-node-403756068",
    country: "Japan",
    region: "Hokkaido",
    evidenceLevel: "high",
    evidence: "Takumi's official site identifies its specialty as original Sapporo ramen and its noodles as coming from Sapporo; Sapporo is Hokkaido's defining ramen center.",
    sourceUrls: ["https://www.takumimunich.com/about", "https://www.takumimunich.com/menu-schwabing"],
  },
  {
    id: "osm-node-3290551024",
    country: "Japan",
    region: "Hokkaido",
    evidenceLevel: "high",
    evidence: "Takumi's official site identifies its specialty as original Sapporo ramen and its noodles as coming from Sapporo; Sapporo is Hokkaido's defining ramen center.",
    sourceUrls: ["https://www.takumimunich.com/about", "https://www.takumimunich.com/menu-schwabing"],
  },
  {
    id: "osm-node-10983046205",
    country: "Japan",
    region: "Hokkaido",
    evidenceLevel: "medium",
    evidence: "The publicly available Munich menu labels both its shoyu and Miso 44 ramen as Sapporo-style; the venue is explicitly tagged as a ramen specialist.",
    sourceUrls: ["https://www.speisekarte.de/m%C3%BCnchen/restaurant/menya_ikko/speisekarte"],
  },
  {
    id: "osm-node-649286265",
    country: "Japan",
    region: "Tokyo / Edo",
    evidenceLevel: "medium",
    evidence: "The specialist identity explicitly presents the restaurant as Kushi-Tei of Tokyo; no contradictory regional identity was found.",
    sourceUrls: ["https://www.opentable.de/r/kushi-tei-of-tokyo"],
  },
  {
    id: "osm-node-211874152",
    country: "Japan",
    region: "Tokyo / Edo",
    evidenceLevel: "medium",
    evidence: "The official site describes Kaito as an authentic Japanese restaurant whose principal specialty is sushi. It is mapped to the Tokyo/Edo tradition under the specialist-dish rule, not merely because sushi appears on the menu.",
    sourceUrls: ["https://www.kaito-restaurant.com/de"],
  },
  {
    id: "osm-node-4978044321",
    country: "Japan",
    region: "Tokyo / Edo",
    evidenceLevel: "medium",
    evidence: "The official site says sushi and sashimi prepared in Japanese quality and style have been Sansaro's focus since 2006. It is mapped to the Tokyo/Edo tradition under the specialist-dish rule.",
    sourceUrls: ["https://www.sushiya.de/"],
  },
  {
    id: "osm-node-1091830785",
    country: "Japan",
    region: "Tokyo / Edo",
    evidenceLevel: "medium",
    evidence: "The restaurant's first-party site gives sushi a dedicated core menu and its identity invokes Tokyo's Tsukiji market. It is mapped to the Tokyo/Edo tradition under the specialist-dish rule.",
    sourceUrls: ["https://www.restaurant-tsukiji.de/sushi/"],
  },

  // India — names alone are insufficient; these have corroborating menus or a
  // first-party regional/specialist identity.
  {
    id: "osm-node-1813634386",
    country: "India",
    region: "Kerala / Malabar",
    evidenceLevel: "medium",
    evidence: "The restaurant is explicitly Kerala-branded and its public menu repeatedly features Kerala dishes, coconut-and-curry-leaf preparations, dosai, and South Indian thalis, although it also offers North Indian dishes.",
    sourceUrls: ["https://www.restaurantkerala.de/"],
  },
  {
    id: "osm-node-345843640",
    country: "India",
    region: "Delhi / Western Uttar Pradesh",
    evidenceLevel: "medium",
    evidence: "The first-party identity names Delhi and foregrounds tandoori cooking and butter chicken—signature Delhi restaurant traditions—rather than using Delhi only as an incidental menu item.",
    sourceUrls: ["https://www.delhimehek.de/en", "https://delhitourism.gov.in/eating_out/purani_delhi_food.html"],
  },
  {
    id: "osm-node-330912622",
    country: "India",
    region: "Delhi / Western Uttar Pradesh",
    evidenceLevel: "medium",
    evidence: "The restaurant takes its identity from Chandni Chowk and foregrounds butter chicken, tandoori specialties, curries, and biryani. Delhi Tourism documents Chandni Chowk as a major Old Delhi food center for these traditions.",
    sourceUrls: ["https://www.restaurant-chandani-chowk.de/en", "https://delhitourism.gov.in/eating_out/purani_delhi_food.html"],
  },

  // Thailand
  {
    id: "osm-node-734773281",
    country: "Thailand",
    region: "Southern",
    evidenceLevel: "high",
    evidence: "Khao San 58's official site explicitly says the restaurant takes guests into the cuisine of Southern Thailand.",
    sourceUrls: ["https://khaosan58.de/"],
  },
  {
    id: "osm-node-365498584",
    country: "Thailand",
    region: "Central / Bangkok",
    evidenceLevel: "medium",
    evidence: "The restaurant is a dedicated Pad Thai specialist rather than a generic Thai venue. It is mapped to Central/Bangkok under the specialist-dish rule; Thai cultural sources strongly associate the dish with Bangkok's street-food canon.",
    sourceUrls: ["https://www.padthaimuenchen.com/startseite", "https://creativecity.cea.or.th/en/cities/bangkok/about"],
  },

  // Türkiye
  {
    id: "osm-node-4462434091",
    country: "Türkiye",
    region: "Istanbul / Ottoman urban",
    evidenceLevel: "high",
    evidence: "The restaurant's official history traces its signature Sultanahmet köfte directly to its original Istanbul shop and a protected four-generation recipe begun there in 1920.",
    sourceUrls: ["https://sultanahmetkoftecisi.de/unternehmen/", "https://sultanahmetkoftecisi.de/standorte/"],
  },
  ...[
    "osm-node-1813639896",
    "osm-node-11959997489",
    "osm-node-8113005448",
  ].map((id) => ({
    id,
    country: "Türkiye",
    region: "Central Anatolia",
    evidenceLevel: "high",
    evidence: "Lezizel's official identity is built around handmade Turkish mantı. Kayseri's provincial government identifies mantı as a defining Kayseri specialty, supporting Central Anatolia under the specialist-dish rule.",
    sourceUrls: ["https://lezizel.de/", "https://www.kayseri.gov.tr/etli-manti"],
  })),
  {
    id: "osm-node-12424514502",
    country: "Türkiye",
    region: "Central Anatolia",
    evidenceLevel: "medium",
    evidence: "The venue's public identity and structured cuisine metadata indicate a dedicated Turkish mantı specialist. Kayseri's provincial government identifies mantı as a defining Kayseri specialty.",
    sourceUrls: ["https://www.kayseri.gov.tr/etli-manti"],
  },

  // Korea
  {
    id: "osm-node-345849097",
    country: "Korea",
    region: "Seoul / Gyeonggi",
    evidenceLevel: "medium",
    evidence: "The first-party restaurant identity explicitly centers Seoul and describes an authentic Korean program; no competing regional identity is present.",
    sourceUrls: ["https://www.seoulrestaurantmunich.com/"],
  },

  // Vietnam
  {
    id: "osm-node-1533322114",
    country: "Vietnam",
    region: "Hanoi / Northern",
    evidenceLevel: "high",
    evidence: "Ho Tay's official site explicitly describes its culinary background as Northern Vietnamese and its cooking as typical of Hanoi's West Lake street-food tradition.",
    sourceUrls: ["https://www.hotay.de/"],
  },
  ...[
    ["osm-node-6260692009", "Ha Noi Pho"],
    ["osm-node-522195993", "Hanoi"],
    ["osm-node-1573738305", "Hanoi Bistro"],
  ].map(([id, identity]) => ({
    id,
    country: "Vietnam",
    region: "Hanoi / Northern",
    evidenceLevel: "medium",
    evidence: `${identity} explicitly makes Hanoi its specialist identity; public menu/structured data confirms a dedicated Vietnamese restaurant rather than a pan-Asian venue.`,
    sourceUrls: id === "osm-node-1573738305" ? ["https://www.hanoibistro-muenchen.de/"] : [],
  })),
  {
    id: "osm-node-4381195542",
    country: "Vietnam",
    region: "Saigon / Southern",
    evidenceLevel: "medium",
    evidence: "The restaurant's specialist identity is Cochinchina, the historical name for southern Vietnam centered on Saigon; its official site confirms the Munich restaurant identity.",
    sourceUrls: ["https://cochinchina.de/kontakt/"],
  },
  {
    id: "osm-node-1716295866",
    country: "Vietnam",
    region: "Saigon / Southern",
    evidenceLevel: "medium",
    evidence: "The first-party site identifies Bánh Mì Minh as a dedicated traditional bánh mì specialist. It is mapped to Saigon/Southern under the specialist-dish rule, reflecting the sandwich's strongest urban lineage rather than a single incidental dish.",
    sourceUrls: ["https://banhmi-minh.de/uber-uns/"],
  },

  // Italy — only explicitly Neapolitan pizzerias and clearly regional Italian
  // specialists are moved out of National. Generic pizzerias remain National.
  {
    id: "osm-node-403755415",
    country: "Italy",
    region: "Naples / Campania",
    evidenceLevel: "high",
    evidence: "60 Secondi is independently documented at the matching Munich address as strictly following Neapolitan pizza style; the venue is a dedicated pizzeria.",
    sourceUrls: ["https://www.gamberorossointernational.com/restaurants/restaurant/60-secondi/", "https://www.60secondipizzanapoletana-muenchen.de/contact"],
  },
  ...[
    "osm-node-303806374",
    "osm-node-685478628",
    "osm-node-2556259111",
  ].map((id) => ({
    id,
    country: "Italy",
    region: "Naples / Campania",
    evidenceLevel: "high",
    evidence: "Mozzamo's official site identifies original Neapolitan pizza as a core specialty, describes its AVPN-compliant process, and sources key ingredients from Campania.",
    sourceUrls: ["https://mozzamo.de/", "https://mozzamo.de/about/"],
  })),
  ...[
    "osm-node-387455905",
    "osm-node-7890902645",
  ].map((id) => ({
    id,
    country: "Italy",
    region: "Naples / Campania",
    evidenceLevel: "high",
    evidence: "Ciao Napoli's official site describes both matching Munich locations as original Neapolitan pizzerias using Vera Pizza methods and Campanian ingredients.",
    sourceUrls: ["https://ciaonapoli.de/"],
  })),
  {
    id: "osm-node-6025012036",
    country: "Italy",
    region: "Naples / Campania",
    evidenceLevel: "high",
    evidence: "Napoli Slice's official site explicitly describes original Neapolitan pizza and dough made in the Neapolitan manner at its matching Munich location.",
    sourceUrls: ["https://www.napolislice.de/"],
  },
  {
    id: "osm-node-6637431668",
    country: "Italy",
    region: "Naples / Campania",
    evidenceLevel: "high",
    evidence: "The venue is explicitly named and publicly listed as a dedicated Pizza Napoletana restaurant rather than a generic Italian restaurant.",
    sourceUrls: ["https://www.pizzanapoletanamuenchen.de/"],
  },
  {
    id: "osm-node-9566158380",
    country: "Italy",
    region: "Naples / Campania",
    evidenceLevel: "high",
    evidence: "Il Vesuvio's official site explicitly foregrounds Pizza Napoletana as its specialty at the Munich restaurant.",
    sourceUrls: ["https://ilvesuvio.de/"],
  },
  {
    id: "osm-node-1091830599",
    country: "Italy",
    region: "Naples / Campania",
    evidenceLevel: "medium",
    evidence: "Forza Napoli is a dedicated pizza concept whose official identity, dough description, and Naples-focused name consistently support the Neapolitan tradition.",
    sourceUrls: ["https://www.forza-napoli.de/"],
  },
  {
    id: "osm-node-2419288436",
    country: "Italy",
    region: "Naples / Campania",
    evidenceLevel: "medium",
    evidence: "The dedicated Italian venue uses the Neapolitan-language identity Napulè; no contradictory regional identity was found, but a first-party regional statement was unavailable.",
    sourceUrls: [],
  },
  {
    id: "osm-node-330429333",
    country: "Italy",
    region: "Puglia / Salento",
    evidenceLevel: "high",
    evidence: "Il Trullo's official site explicitly describes the restaurant as Puglian and says it celebrates Puglia's culinary tradition.",
    sourceUrls: ["https://ristoranteiltrullo.de/"],
  },
  {
    id: "osm-node-6637534637",
    country: "Italy",
    region: "Sicily",
    evidenceLevel: "medium",
    evidence: "The first-party identity explicitly presents the venue as Little Sicily Ristorante & Pizzeria; no contradictory regional identity was found, though its online menu does not make a detailed regional claim.",
    sourceUrls: ["https://little-sicily.de/contact"],
  },
  {
    id: "osm-node-266316744",
    country: "Italy",
    region: "Sardinia",
    evidenceLevel: "high",
    evidence: "Porto Cervo's official site explicitly presents the cuisine of Sardinia and names regional specialties including bottarga, porceddu, seadas, malloreddus, and culurgiones.",
    sourceUrls: ["https://www.trattoria-porto-cervo.de/"],
  },
  {
    id: "osm-node-677214309",
    country: "Italy",
    region: "Sardinia",
    evidenceLevel: "medium",
    evidence: "The specialist name Quattro Mori invokes Sardinia's four-Moors emblem, and the matching Munich business is registered under that identity; no competing regional identity was found.",
    sourceUrls: ["https://openregister.de/company/DE-HRB-D2601-274332"],
  },

  // France, Spain, Mexico
  {
    id: "osm-node-266698128",
    country: "France",
    region: "Paris / Île-de-France",
    evidenceLevel: "high",
    evidence: "Rue des Halles' official site explicitly builds its identity around Paris's former Les Halles market and the Parisian brasserie tradition.",
    sourceUrls: ["https://ruedeshalles.de/"],
  },
  {
    id: "osm-node-1091830622",
    country: "Spain",
    region: "Madrid / Castilian",
    evidenceLevel: "medium",
    evidence: "The dedicated Spanish restaurant's specialist identity explicitly centers Madrid; no contradictory regional identity was found, but no detailed first-party regional menu was available.",
    sourceUrls: [],
  },
  {
    id: "osm-node-13152731401",
    country: "Mexico",
    region: "Mexico City / Central",
    evidenceLevel: "high",
    evidence: "The first-party site describes this dedicated taquería as sitting culturally between a Mexico City street corner and Munich, making the urban taquería identity explicit.",
    sourceUrls: ["https://www.taqueriaconsalsa.com/"],
  },
];

export function applyMunichRichCuisineTaxonomyUpdate(taxonomy, sourceRestaurants) {
  const assignmentById = new Map();
  for (const assignment of assignments) {
    if (assignmentById.has(assignment.id)) {
      throw new Error(`Duplicate rich-cuisine assignment for ${assignment.id}.`);
    }
    assignmentById.set(assignment.id, assignment);
  }

  taxonomy.methodology.specialistDishRule =
    "A restaurant may represent a regional cuisine when its public identity and menu are centered on a region-defining dish with well-established provenance. A single dish on a broad menu is never enough.";
  taxonomy.methodology.researchConservatism =
    "A place-name or suggestive restaurant name is used only when paired with dedicated national-cuisine metadata and no contradictory regional evidence. Generic, fusion, and broad pan-national restaurants remain National.";

  const countries = taxonomy.continents.flatMap((continent) => continent.countries);
  const sourceById = new Map(sourceRestaurants.map((restaurant) => [restaurant.id, restaurant]));

  for (const [countryName, sourceCountryId] of Object.entries(SOURCE_COUNTRY_ID)) {
    const country = countries.find((candidate) => candidate.country === countryName);
    if (!country) continue;

    const countryAssignments = assignments.filter((assignment) => assignment.country === countryName);
    const countryAssignmentIds = new Set(countryAssignments.map((assignment) => assignment.id));

    for (const region of country.regions) {
      region.restaurants = region.restaurants.filter((restaurant) => !countryAssignmentIds.has(restaurant.id));
    }

    for (const assignment of countryAssignments) {
      const source = sourceById.get(assignment.id);
      if (!source) throw new Error(`Rich-cuisine source restaurant ${assignment.id} is missing.`);
      if (source.countryId !== sourceCountryId) {
        throw new Error(`${assignment.id} belongs to ${source.countryId}, expected ${sourceCountryId}.`);
      }

      const region = country.regions.find((candidate) => candidate.name === assignment.region);
      if (!region) throw new Error(`${countryName} taxonomy region “${assignment.region}” is missing.`);

      region.restaurants.push({
        id: source.id,
        name: source.name,
        evidenceLevel: assignment.evidenceLevel,
        evidence: assignment.evidence,
        sourceUrls: [...new Set([...assignment.sourceUrls, source.source].filter(Boolean))],
      });
    }

    for (const region of country.regions) {
      region.restaurants.sort((left, right) => left.name.localeCompare(right.name));
      region.restaurantCount = region.restaurants.length;
    }

    const sourceCountryRestaurants = sourceRestaurants.filter((restaurant) => restaurant.countryId === sourceCountryId);
    const classifiedIds = new Set(country.regions.flatMap((region) => region.restaurants.map((restaurant) => restaurant.id)));
    country.sourceRestaurantCount = sourceCountryRestaurants.length;
    country.classifiedRestaurantCount = classifiedIds.size;
    country.unclassifiedRestaurantCount = sourceCountryRestaurants.length - classifiedIds.size;
    country.auditNote = `Deep regional-cuisine research update applied ${UPDATE_DATE}. Uncertain, generic, fusion, and pan-national venues remain National.`;
  }

  taxonomy.datasetSnapshot = UPDATE_DATE;
  taxonomy.generatedAt = UPDATE_DATE;
  taxonomy.researchUpdate = {
    date: UPDATE_DATE,
    scope: "Rich-cuisine countries represented in Munich",
    newlyResearchedAssignments: assignments.length,
  };
}

export const munichRichCuisineAssignments = assignments;
