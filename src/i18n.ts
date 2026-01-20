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
        lng: 'ja', // 默认语言
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false, // react 已经防止 xss
        },
    });

export default i18n;
