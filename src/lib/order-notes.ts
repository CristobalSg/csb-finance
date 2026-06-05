type FamilyBurgerNoteSource = {
  label: string;
  name: string;
  removedIngredients?: string[];
};

export const getFamilyBurgerNotes = (familyBurgers?: FamilyBurgerNoteSource[]) => {
  const normalCounts = new Map<string, number>();
  const changedNotes: string[] = [];

  for (const burger of familyBurgers ?? []) {
    const removedIngredients = burger.removedIngredients?.filter(Boolean) ?? [];

    if (removedIngredients.length > 0) {
      changedNotes.push(`${burger.label}: sin ${removedIngredients.join(", ")}`);
      continue;
    }

    normalCounts.set(burger.name, (normalCounts.get(burger.name) ?? 0) + 1);
  }

  const normalNotes = Array.from(normalCounts.entries()).map(([name, quantity]) => `${name} x${quantity}: normal`);

  return [...normalNotes, ...changedNotes];
};
