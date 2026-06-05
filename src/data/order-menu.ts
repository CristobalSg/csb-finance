export type OrderMenuItem = {
  name: string;
  price: number;
  category: OrderMenuCategoryId;
  image?: string;
  drinkOptions?: string[];
  sauceOptions?: string[];
  removableIngredients?: string[];
};

export type FamilyComboBurger = {
  name: string;
  label: string;
  removableIngredients: string[];
};

export type OrderMenuCategoryId =
  | "offers"
  | "individual-combos"
  | "family-combos"
  | "papero-combo"
  | "burgers"
  | "sides"
  | "sauces";

export type OrderMenuCategory = {
  id: OrderMenuCategoryId;
  label: string;
};

export const comboDrinkOptions = ["Sprite", "Coca-Cola", "Coca-Cola Zero", "Fanta"];

export const sideSauceOptions = ["Sin salsa", "Mayonesa", "Ketchup", "Mostaza", "BBQ", "Chick Fill A"];

const productImages = {
  offerSmoke: new URL("../assets/img/ofertar/smoke-criminal-oferta.webp", import.meta.url).href,
  comboClasico: new URL("../assets/img/combos-individual/Clasica.webp", import.meta.url).href,
  comboBacon: new URL("../assets/img/combos-individual/bacon.webp", import.meta.url).href,
  comboItaliana: new URL("../assets/img/combos-individual/italiana.webp", import.meta.url).href,
  comboRompedietaI: new URL("../assets/img/combos-individual/rompedieta-uno.webp", import.meta.url).href,
  comboRompedietaII: new URL("../assets/img/combos-individual/rompedieta-dos.webp", import.meta.url).href,
  comboSmoke: new URL("../assets/img/combos-individual/combo-smoke-criminal.webp", import.meta.url).href,
  comboSmokeXl: new URL("../assets/img/combos-individual/combo-smoke-criminal-xl.webp", import.meta.url).href,
  comboFamiliar: new URL("../assets/img/combos/combo-familiar.webp", import.meta.url).href,
  fullBacon: new URL("../assets/img/combos/combo-bacon-lovers.webp", import.meta.url).href,
  fullClasicas: new URL("../assets/img/combos/combo-clasicas-full.webp", import.meta.url).href,
  paperoBacon: new URL("../assets/img/Combos-paperos/combo-papero-bacon.webp", import.meta.url).href,
  paperoClasica: new URL("../assets/img/Combos-paperos/combo-papero-clasica.webp", import.meta.url).href,
  paperoItaliana: new URL("../assets/img/Combos-paperos/combo-papero-italiana.webp", import.meta.url).href,
  burgerBacon: new URL("../assets/img/hamb-solas/bacon.webp", import.meta.url).href,
  burgerSmoke: new URL("../assets/img/hamb-solas/smoke-criminal.webp", import.meta.url).href,
  burgerSmokeXl: new URL("../assets/img/hamb-solas/smoke-criminal-xl.webp", import.meta.url).href,
  burgerRompedietaI: new URL("../assets/img/hamb-solas/rompedieta-uno.webp", import.meta.url).href,
  burgerRompedietaII: new URL("../assets/img/hamb-solas/rompedieta-dos.webp", import.meta.url).href,
  burgerClasica: new URL("../assets/img/hamb-solas/clasica.webp", import.meta.url).href,
  burgerItaliana: new URL("../assets/img/hamb-solas/italiana.webp", import.meta.url).href,
  fries: new URL("../assets/img/acompaniamiento/papas.webp", import.meta.url).href,
  drink: new URL("../assets/img/acompaniamiento/bebidas.webp", import.meta.url).href,
  nuggets5: new URL("../assets/img/acompaniamiento/nuggets-x5.webp", import.meta.url).href,
  nuggets10: new URL("../assets/img/acompaniamiento/nuggets-x10.webp", import.meta.url).href,
  mayo: new URL("../assets/img/salsas/mayo.webp", import.meta.url).href,
  ketchup: new URL("../assets/img/salsas/ketchup.webp", import.meta.url).href,
  mustard: new URL("../assets/img/salsas/mostaza.webp", import.meta.url).href,
  bbq: new URL("../assets/img/salsas/bbq.webp", import.meta.url).href,
  chickFillA: new URL("../assets/img/salsas/chick-fill-a.webp", import.meta.url).href,
};

export const familyComboDescriptions: Record<string, string> = {
  "Trio Familiar": "1 bacon + 2 clasicas",
  "Trio Premium": "2 bacon + 1 clasica",
  "Trio Premium Smoke": "3 smoke normales",
  "2 Cs-Romp I Chica + 2 Cs-Smoke Criminal": "2 Cs-Romp I Chica + 2 Cs-Smoke Criminal",
  "Combo Familiar": "3 clasicas + 2 bacon",
  "Full Bacon": "5 bacon",
  "Full Clasicas": "5 clasicas",
  "Smoke Hause XL x2": "2 smoke XL",
};

const clasicaRemovableIngredients = ["Tomate", "Lechuga", "Aderezo", "Queso cheddar"];
const baconRemovableIngredients = ["Tocino", "Salsa BBQ", "Cebolla caramelizada", "Queso cheddar"];
const rompIChicaRemovableIngredients = ["Tocino", "Lechuga", "Tomate", "Cebolla morada", "Salsa", "Queso cheddar"];
const smokeRemovableIngredients = ["Cebolla crispy", "Tocino", "Carne", "Queso cheddar", "Salsa BBQ", "Mayonesa"];
const smokeXlRemovableIngredients = [
  "Cebolla crispy",
  "Doble tocino",
  "Doble carne",
  "Triple cheddar",
  "Salsa BBQ",
  "Mayonesa",
];

const createFamilyBurgers = (name: string, count: number, removableIngredients: string[]): FamilyComboBurger[] =>
  Array.from({ length: count }, (_, index) => ({
    name,
    label: `${name} ${index + 1}`,
    removableIngredients,
  }));

export const familyComboBurgers: Record<string, FamilyComboBurger[]> = {
  "Trio Familiar": [
    ...createFamilyBurgers("Bacon", 1, baconRemovableIngredients),
    ...createFamilyBurgers("Clasica", 2, clasicaRemovableIngredients),
  ],
  "Trio Premium": [
    ...createFamilyBurgers("Bacon", 2, baconRemovableIngredients),
    ...createFamilyBurgers("Clasica", 1, clasicaRemovableIngredients),
  ],
  "Trio Premium Smoke": createFamilyBurgers("Smoke", 3, smokeRemovableIngredients),
  "2 Cs-Romp I Chica + 2 Cs-Smoke Criminal": [
    ...createFamilyBurgers("Cs-Romp I Chica", 2, rompIChicaRemovableIngredients),
    ...createFamilyBurgers("Cs-Smoke Criminal", 2, smokeRemovableIngredients),
  ],
  "Combo Familiar": [
    ...createFamilyBurgers("Clasica", 3, clasicaRemovableIngredients),
    ...createFamilyBurgers("Bacon", 2, baconRemovableIngredients),
  ],
  "Full Bacon": createFamilyBurgers("Bacon", 5, baconRemovableIngredients),
  "Full Clasicas": createFamilyBurgers("Clasica", 5, clasicaRemovableIngredients),
  "Smoke Hause XL x2": createFamilyBurgers("Smoke XL", 2, smokeXlRemovableIngredients),
};

export const orderMenuCategories: OrderMenuCategory[] = [
  { id: "offers", label: "Ofertas" },
  { id: "individual-combos", label: "Combos individuales" },
  { id: "family-combos", label: "Combos familiares" },
  { id: "papero-combo", label: "Combo papero" },
  { id: "burgers", label: "Hamburguesas" },
  { id: "sides", label: "Acompañamientos" },
  { id: "sauces", label: "Salsas" },
];

export const orderMenuItems: OrderMenuItem[] = [
  { name: "Smoke Hause XL x2", price: 8000, category: "offers", image: productImages.offerSmoke },
  { name: "Trio Familiar", price: 5990, category: "offers" },
  { name: "Trio Premium", price: 6390, category: "offers" },
  { name: "Trio Premium Smoke", price: 6690, category: "offers" },
  { name: "2 Cs-Romp I Chica + 2 Cs-Smoke Criminal", price: 9490, category: "offers" },
  {
    name: "Combo Clasico",
    price: 4490,
    category: "individual-combos",
    image: productImages.comboClasico,
    drinkOptions: comboDrinkOptions,
    sauceOptions: sideSauceOptions,
    removableIngredients: ["Salsa", "Tomate", "Lechuga", "Queso"],
  },
  {
    name: "Combo Bacon",
    price: 4890,
    category: "individual-combos",
    image: productImages.comboBacon,
    drinkOptions: comboDrinkOptions,
    sauceOptions: sideSauceOptions,
    removableIngredients: ["Salsa", "Tocino", "Queso", "Cebolla caramelizada"],
  },
  {
    name: "Combo Italiana",
    price: 4690,
    category: "individual-combos",
    image: productImages.comboItaliana,
    drinkOptions: comboDrinkOptions,
    sauceOptions: sideSauceOptions,
    removableIngredients: ["Mayonesa", "Palta", "Tomate", "Queso"],
  },
  {
    name: "Combo Rompedieta II",
    price: 5590,
    category: "individual-combos",
    image: productImages.comboRompedietaII,
    drinkOptions: comboDrinkOptions,
    sauceOptions: sideSauceOptions,
    removableIngredients: ["Salsa BBQ", "Huevo frito", "Tocino", "Queso cheddar", "Cebolla caramelizada"],
  },
  {
    name: "Combo Rompedieta I",
    price: 5590,
    category: "individual-combos",
    image: productImages.comboRompedietaI,
    drinkOptions: comboDrinkOptions,
    sauceOptions: sideSauceOptions,
    removableIngredients: ["Mayonesa", "Tocino", "Lechuga", "Tomate", "Cebolla morada", "Queso cheddar"],
  },
  {
    name: "Combo Smoke Criminal XL",
    price: 6990,
    category: "individual-combos",
    image: productImages.comboSmokeXl,
    drinkOptions: comboDrinkOptions,
    sauceOptions: sideSauceOptions,
    removableIngredients: ["Cebolla crispy", "Doble tocino", "Doble carne", "Triple cheddar", "Salsa BBQ", "Mayonesa"],
  },
  {
    name: "Combo Smoke Criminal",
    price: 4690,
    category: "individual-combos",
    image: productImages.comboSmoke,
    drinkOptions: comboDrinkOptions,
    sauceOptions: sideSauceOptions,
    removableIngredients: ["Cebolla crispy", "Tocino", "Carne", "Queso cheddar", "Salsa BBQ", "Mayonesa"],
  },
  { name: "Combo Familiar", price: 10490, category: "family-combos", image: productImages.comboFamiliar },
  { name: "Full Bacon", price: 11490, category: "family-combos", image: productImages.fullBacon },
  { name: "Full Clasicas", price: 9490, category: "family-combos", image: productImages.fullClasicas },
  {
    name: "Combo Papero Cs-Bacon",
    price: 3890,
    category: "papero-combo",
    image: productImages.paperoBacon,
    sauceOptions: sideSauceOptions,
    removableIngredients: ["Salsa", "Tocino", "Queso", "Cebolla caramelizada"],
  },
  {
    name: "Combo Papero Clasica",
    price: 3490,
    category: "papero-combo",
    image: productImages.paperoClasica,
    sauceOptions: sideSauceOptions,
    removableIngredients: ["Tomate", "Lechuga", "Aderezo", "Queso cheddar"],
  },
  {
    name: "Combo Papero Italiana",
    price: 3690,
    category: "papero-combo",
    image: productImages.paperoItaliana,
    sauceOptions: sideSauceOptions,
    removableIngredients: ["Palta", "Tomate", "Mayonesa", "Queso cheddar"],
  },
  {
    name: "Cs-Bacon",
    price: 2490,
    category: "burgers",
    image: productImages.burgerBacon,
    removableIngredients: ["Tocino", "Salsa BBQ", "Cebolla caramelizada", "Queso cheddar"],
  },
  {
    name: "Cs-Smoke Criminal XL",
    price: 4690,
    category: "burgers",
    image: productImages.burgerSmokeXl,
    removableIngredients: ["Cebolla crispy", "Doble tocino", "Doble carne", "Triple cheddar", "Salsa BBQ", "Mayonesa"],
  },
  {
    name: "Cs-Smoke Criminal",
    price: 2490,
    category: "burgers",
    image: productImages.burgerSmoke,
    removableIngredients: ["Cebolla crispy", "Tocino", "Carne", "Queso cheddar", "Salsa BBQ", "Mayonesa"],
  },
  {
    name: "Cs-Romp II",
    price: 3190,
    category: "burgers",
    image: productImages.burgerRompedietaII,
    removableIngredients: ["Huevo frito", "Tocino", "Cebolla caramelizada", "Salsa BBQ", "Queso cheddar"],
  },
  {
    name: "Cs-Clasica",
    price: 2090,
    category: "burgers",
    image: productImages.burgerClasica,
    removableIngredients: ["Tomate", "Lechuga", "Aderezo", "Queso cheddar"],
  },
  {
    name: "Cs-Italiana",
    price: 2290,
    category: "burgers",
    image: productImages.burgerItaliana,
    removableIngredients: ["Palta", "Tomate", "Mayonesa", "Queso cheddar"],
  },
  {
    name: "Rompedieta I",
    price: 3190,
    category: "burgers",
    image: productImages.burgerRompedietaI,
    removableIngredients: ["Tocino", "Lechuga", "Tomate", "Cebolla morada", "Salsa", "Queso cheddar"],
  },
  {
    name: "Cs-Rompedieta I Chica",
    price: 2690,
    category: "burgers",
    image: productImages.burgerRompedietaI,
    removableIngredients: rompIChicaRemovableIngredients,
  },
  { name: "Papitas fritas", price: 1300, category: "sides", image: productImages.fries },
  { name: "Bebida", price: 1000, category: "sides", image: productImages.drink, drinkOptions: comboDrinkOptions },
  { name: "Nuggets x5", price: 1790, category: "sides", image: productImages.nuggets5, sauceOptions: sideSauceOptions },
  { name: "Nuggets x10", price: 2590, category: "sides", image: productImages.nuggets10, sauceOptions: sideSauceOptions },
  { name: "Mayonesa", price: 300, category: "sauces", image: productImages.mayo },
  { name: "Ketchup", price: 300, category: "sauces", image: productImages.ketchup },
  { name: "Mostaza", price: 300, category: "sauces", image: productImages.mustard },
  { name: "BBQ", price: 500, category: "sauces", image: productImages.bbq },
  { name: "Chick Fill A", price: 500, category: "sauces", image: productImages.chickFillA },
];
