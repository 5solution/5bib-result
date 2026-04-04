'use client';

import { useTranslation } from 'react-i18next';

const LANGS = [
  { code: 'vi', flag: '🇻🇳' },
  { code: 'en', flag: '🇺🇸' },
];

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.language?.startsWith('en') ? 'en' : 'vi';

  const toggle = () => {
    i18n.changeLanguage(current === 'vi' ? 'en' : 'vi');
  };

  const next = LANGS.find((l) => l.code !== current) || LANGS[1];

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1 px-2 py-1 text-blue-100 hover:text-white hover:bg-white/10 rounded transition-colors text-sm"
      title={`Switch to ${next.code === 'en' ? 'English' : 'Tiếng Việt'}`}
    >
      <span className="text-base">{next.flag}</span>
      <span className="hidden sm:inline text-xs font-medium uppercase">{next.code}</span>
    </button>
  );
}
