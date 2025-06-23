import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  it: {
    translation: {
      "Dashboard": "Dashboard",
      "Products": "Prodotti",
      "Suppliers": "Fornitori",
      "Alerts": "Alert",
      "Settings": "Impostazioni",
      "Dark Mode": "Tema Scuro",
      "Language": "Lingua",
      "settings.title": "Impostazioni",
      "settings.generalSettings": "Impostazioni Generali",
      "settings.darkMode": "Tema Scuro",
      "settings.language": "Lingua",
      "settings.productMatchingSettings.title": "Impostazioni Product Matching"
    }
  },
  en: {
    translation: {
      "Dashboard": "Dashboard",
      "Products": "Products",
      "Suppliers": "Suppliers",
      "Alerts": "Alerts",
      "Settings": "Settings",
      "Dark Mode": "Dark Mode",
      "Language": "Language",
      "settings.title": "Settings",
      "settings.generalSettings": "General Settings",
      "settings.darkMode": "Dark Mode",
      "settings.language": "Language",
      "settings.productMatchingSettings.title": "Product Matching Settings"
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'it',
    fallbackLng: 'it',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
