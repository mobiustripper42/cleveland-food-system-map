export type Category = 'garden' | 'farm' | 'market';

export interface Location {
  id: string;
  name: string;
  category: Category;
  lat: number | null;
  lng: number | null;
  address: string | null;
  ward: number | null;
  manager_name: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  image_url: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
}
