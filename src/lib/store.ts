import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CompanySettings {
  name: string;
  email: string;
  phone: string;
  address: string;
  baseUrl: string;
  adminPhone: string;
  logo?: string;
}

interface AppState {
  locale: 'id' | 'en';
  company: CompanySettings;
  setLocale: (locale: 'id' | 'en') => void;
  setCompany: (company: Partial<CompanySettings>) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      locale: 'id',
      company: {
        name: 'AIBILL RADIUS',
        email: 'admin@aibill.com',
        phone: '+62 812-3456-7890',
        address: 'Jakarta, Indonesia',
        baseUrl: '',
        adminPhone: '+62 812-3456-7890',
      },
      setLocale: (locale) => set({ locale }),
      setCompany: (company) =>
        set((state) => ({
          company: { ...state.company, ...company },
        })),
    }),
    {
      name: 'aibill-settings',
    }
  )
);
