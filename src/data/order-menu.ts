export type OrderMenuItem = {
  name: string;
  price: number;
  category: OrderMenuCategoryId;
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

export const comboDrinkOptions = ["Sprite", "Coca-Cola", "Fanta"];

export const sideSauceOptions = ["Sin salsa", "Mayonesa", "Ketchup", "Mostaza", "BBQ", "Chick Fill A"];

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
  { name: "Smoke Hause XL x2", price: 8000, category: "offers" },
  { name: "Trio Familiar", price: 5990, category: "offers" },
  { name: "Trio Premium", price: 6390, category: "offers" },
  { name: "Trio Premium Smoke", price: 6690, category: "offers" },
  { name: "2 Cs-Romp I Chica + 2 Cs-Smoke Criminal", price: 9490, category: "offers" },
  {
    name: "Combo Clasico",
    price: 4490,
    category: "individual-combos",
    drinkOptions: comboDrinkOptions,
    sauceOptions: sideSauceOptions,
    removableIngredients: ["Salsa", "Tomate", "Lechuga", "Queso"],
  },
  {
    name: "Combo Bacon",
    price: 4890,
    category: "individual-combos",
    drinkOptions: comboDrinkOptions,
    sauceOptions: sideSauceOptions,
    removableIngredients: ["Salsa", "Tocino", "Queso", "Cebolla caramelizada"],
  },
  {
    name: "Combo Italiana",
    price: 4690,
    category: "individual-combos",
    drinkOptions: comboDrinkOptions,
    sauceOptions: sideSauceOptions,
    removableIngredients: ["Mayonesa", "Palta", "Tomate", "Queso"],
  },
  {
    name: "Combo Rompedieta II",
    price: 5590,
    category: "individual-combos",
    drinkOptions: comboDrinkOptions,
    sauceOptions: sideSauceOptions,
    removableIngredients: ["Salsa BBQ", "Huevo frito", "Tocino", "Queso cheddar", "Cebolla caramelizada"],
  },
  {
    name: "Combo Rompedieta I",
    price: 5590,
    category: "individual-combos",
    drinkOptions: comboDrinkOptions,
    sauceOptions: sideSauceOptions,
    removableIngredients: ["Mayonesa", "Tocino", "Lechuga", "Tomate", "Cebolla morada", "Queso cheddar"],
  },
  {
    name: "Combo Smoke Criminal XL",
    price: 6990,
    category: "individual-combos",
    drinkOptions: comboDrinkOptions,
    sauceOptions: sideSauceOptions,
    removableIngredients: ["Cebolla crispy", "Doble tocino", "Doble carne", "Triple cheddar", "Salsa BBQ", "Mayonesa"],
  },
  {
    name: "Combo Smoke Criminal",
    price: 4690,
    category: "individual-combos",
    drinkOptions: comboDrinkOptions,
    sauceOptions: sideSauceOptions,
    removableIngredients: ["Cebolla crispy", "Tocino", "Carne", "Queso cheddar", "Salsa BBQ", "Mayonesa"],
  },
  { name: "Combo Familiar", price: 10490, category: "family-combos" },
  { name: "Full Bacon", price: 11490, category: "family-combos" },
  { name: "Full Clasicas", price: 9490, category: "family-combos" },
  {
    name: "Combo Papero Cs-Bacon",
    price: 3890,
    category: "papero-combo",
    sauceOptions: sideSauceOptions,
    removableIngredients: ["Salsa", "Tocino", "Queso", "Cebolla caramelizada"],
  },
  {
    name: "Combo Papero Clasica",
    price: 3490,
    category: "papero-combo",
    sauceOptions: sideSauceOptions,
    removableIngredients: ["Tomate", "Lechuga", "Aderezo", "Queso cheddar"],
  },
  {
    name: "Combo Papero Italiana",
    price: 3690,
    category: "papero-combo",
    sauceOptions: sideSauceOptions,
    removableIngredients: ["Palta", "Tomate", "Mayonesa", "Queso cheddar"],
  },
  {
    name: "Cs-Bacon",
    price: 2490,
    category: "burgers",
    removableIngredients: ["Tocino", "Salsa BBQ", "Cebolla caramelizada", "Queso cheddar"],
  },
  {
    name: "Cs-Smoke Criminal XL",
    price: 4690,
    category: "burgers",
    removableIngredients: ["Cebolla crispy", "Doble tocino", "Doble carne", "Triple cheddar", "Salsa BBQ", "Mayonesa"],
  },
  {
    name: "Cs-Smoke Criminal",
    price: 2490,
    category: "burgers",
    removableIngredients: ["Cebolla crispy", "Tocino", "Carne", "Queso cheddar", "Salsa BBQ", "Mayonesa"],
  },
  {
    name: "Cs-Romp II",
    price: 3190,
    category: "burgers",
    removableIngredients: ["Huevo frito", "Tocino", "Cebolla caramelizada", "Salsa BBQ", "Queso cheddar"],
  },
  {
    name: "Cs-Clasica",
    price: 2090,
    category: "burgers",
    removableIngredients: ["Tomate", "Lechuga", "Aderezo", "Queso cheddar"],
  },
  {
    name: "Cs-Italiana",
    price: 2290,
    category: "burgers",
    removableIngredients: ["Palta", "Tomate", "Mayonesa", "Queso cheddar"],
  },
  {
    name: "Rompedieta I",
    price: 3190,
    category: "burgers",
    removableIngredients: ["Tocino", "Lechuga", "Tomate", "Cebolla morada", "Salsa", "Queso cheddar"],
  },
  {
    name: "Cs-Rompedieta I Chica",
    price: 2690,
    category: "burgers",
    removableIngredients: rompIChicaRemovableIngredients,
  },
  { name: "Papitas fritas", price: 1300, category: "sides" },
  { name: "Bebida", price: 1000, category: "sides", drinkOptions: comboDrinkOptions },
  { name: "Nuggets x5", price: 1790, category: "sides", sauceOptions: sideSauceOptions },
  { name: "Nuggets x10", price: 2590, category: "sides", sauceOptions: sideSauceOptions },
  { name: "Mayonesa", price: 300, category: "sauces" },
  { name: "Ketchup", price: 300, category: "sauces" },
  { name: "Mostaza", price: 300, category: "sauces" },
  { name: "BBQ", price: 500, category: "sauces" },
  { name: "Chick Fill A", price: 500, category: "sauces" },
];
