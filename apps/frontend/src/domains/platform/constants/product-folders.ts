export interface ProductFolder {
  id: string;
  title: string;
  description: string;
  isPurchasable: boolean;
  isFree: boolean;
}

export const PRODUCT_FOLDERS: ProductFolder[] = [
  {
    id: 'starter-kit',
    title: 'Starter Kit',
    description: 'Free tutorials to get you started',
    isPurchasable: false,
    isFree: true,
  },
  {
    id: 'revisiting-basics',
    title: 'Revisiting Basics',
    description: 'Strengthen your foundation',
    isPurchasable: true,
    isFree: false,
  },
];

// Map category slugs to folder IDs
export const CATEGORY_TO_FOLDER: Record<string, string> = {
  'starter-kit': 'starter-kit',
  'revisiting-basics': 'revisiting-basics',
};
