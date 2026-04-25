export type OrderMenuItem = {
  name: string;
  price: number;
  category: OrderMenuCategoryId;
  drinkOptions?: string[];
  sauceOptions?: string[];
  removableIngredients?: string[];
};

export type OrderMenuCategoryId =
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

export const sideSauceOptions = ["Mayonesa", "Ketchup", "Mostaza", "BBQ", "Chick Fill A"];

export const familyComboDescriptions: Record<string, string> = {
  "Combo Familiar": "3 clasicas + 2 bacon",
  "Full Bacon": "5 bacon",
  "Full Clasicas": "5 clasicas",
};

export const orderMenuCategories: OrderMenuCategory[] = [
  { id: "individual-combos", label: "Combos individuales" },
  { id: "family-combos", label: "Combos familiares" },
  { id: "papero-combo", label: "Combo papero" },
  { id: "burgers", label: "Hamburguesas" },
  { id: "sides", label: "Acompañamientos" },
  { id: "sauces", label: "Salsas" },
];

export const orderMenuItems: OrderMenuItem[] = [
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
  { name: "Combo Familiar", price: 10490, category: "family-combos", sauceOptions: sideSauceOptions },
  { name: "Full Bacon", price: 11490, category: "family-combos", sauceOptions: sideSauceOptions },
  { name: "Full Clasicas", price: 9490, category: "family-combos", sauceOptions: sideSauceOptions },
  {
    name: "Combo Papero Cs-Bacon",
    price: 3890,
    category: "papero-combo",
    sauceOptions: sideSauceOptions,
    removableIngredients: ["Salsa", "Tocino", "Queso", "Cebolla caramelizada"],
  },
  {
    name: "Cs-Bacon",
    price: 2490,
    category: "burgers",
    removableIngredients: ["Tocino", "Salsa BBQ", "Cebolla caramelizada", "Queso cheddar"],
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
