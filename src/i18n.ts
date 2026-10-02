import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      "Welcome": "Welcome",
      "Therapist": "Therapist",
      "Parent": "Parent",
      // add more mock translations
    }
  },
  ur: {
    translation: {
      "Welcome": "خوش آمدید",
      "Therapist": "معالج",
      "Parent": "والدین",
    }
  },
  ar: {
    translation: {
      "Welcome": "مرحباً",
      "Therapist": "معالج",
      "Parent": "الوالدين",
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "en", // default language
    fallbackLng: "en",
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
