import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import ja from './locales/ja.json';
import en from './locales/en.json';
import zh from './locales/zh.json';

const resources = {
    ja: { translation: ja },
    en: { translation: en },
    zh: { translation: zh },
};

i18n
    .use(initReactI18next)
    .init({
        resources,
        lng: 'ja', // default language
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false, // react already safes from xss
        },
    });

export default i18n;
