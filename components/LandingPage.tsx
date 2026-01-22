
import React from 'react';
import { LineArtBackground } from './LineArtBackground';
import { Logo } from './Logo';
import { useSettings } from '../contexts/SettingsContext';

interface LandingPageProps {
  onStart: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStart }) => {
  const { t, language, setLanguage, theme, setTheme } = useSettings();

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // SVG Icons for features
  const IconAnalysis = () => (
    <svg className="w-8 h-8 mb-4 stroke-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
  const IconContext = () => (
    <svg className="w-8 h-8 mb-4 stroke-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
    </svg>
  );
  const IconVersions = () => (
    <svg className="w-8 h-8 mb-4 stroke-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );

  return (
    <div className="min-h-screen flex flex-col items-center bg-white dark:bg-[#0a0a0a] transition-colors duration-300 overflow-x-hidden">
      <LineArtBackground />
      
      {/* HEADER */}
      <header className="fixed top-0 w-full p-8 flex justify-between items-center z-50 bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-sm border-b border-black/5 dark:border-white/5">
        <div className="flex items-center gap-3">
          <Logo className="w-8 h-8 text-black dark:text-white" />
          <span className="text-xl font-bold tracking-tighter text-black dark:text-white">{t('app.title')}</span>
        </div>
        
        <div className="flex items-center gap-6">
           <div className="flex items-center gap-3 text-xs font-bold">
              <button 
                onClick={() => setLanguage(language === 'en' ? 'zh' : 'en')}
                className="hover:underline uppercase text-black dark:text-white"
              >
                {language === 'en' ? 'EN' : '中文'}
              </button>
              <span className="text-black/20 dark:text-white/20">|</span>
              <button 
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                className="hover:underline uppercase text-black dark:text-white"
              >
                {theme === 'light' ? 'DARK' : 'LIGHT'}
              </button>
           </div>

           <nav className="hidden md:flex gap-8 text-sm font-medium text-black dark:text-white/80">
            <button onClick={() => scrollToSection('features')} className="hover:underline hover:text-black dark:hover:text-white">{t('landing.nav.features')}</button>
            <button onClick={() => scrollToSection('pricing')} className="hover:underline hover:text-black dark:hover:text-white">{t('landing.nav.pricing')}</button>
            <button onClick={() => scrollToSection('about')} className="hover:underline hover:text-black dark:hover:text-white">{t('landing.nav.about')}</button>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section className="min-h-screen flex flex-col items-center justify-center p-6 relative w-full max-w-6xl">
        <main className="text-center space-y-8 z-10 pt-20">
          <div className="inline-block px-4 py-1 border border-black/10 dark:border-white/10 rounded-full text-xs font-semibold tracking-widest text-black/60 dark:text-white/60 uppercase">
            {t('landing.tagline')}
          </div>
          <h1 className="text-6xl md:text-8xl font-bold tracking-tight leading-[0.95] text-black dark:text-white">
            {t('landing.headline')}<br/>
            <span className="text-black/30 dark:text-white/30">{t('landing.subhead')}</span>
          </h1>
          <p className="text-lg md:text-xl text-black/60 dark:text-white/60 max-w-2xl mx-auto leading-relaxed">
            {t('landing.desc')}
          </p>
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 pt-4">
            <button 
              onClick={onStart}
              className="px-8 py-4 bg-black dark:bg-white text-white dark:text-black text-lg font-bold border-2 border-black dark:border-white hover:bg-white dark:hover:bg-black hover:text-black dark:hover:text-white transition-all duration-300 line-art-shadow"
            >
              {t('landing.cta.launch')}
            </button>
            <button 
              onClick={() => scrollToSection('features')}
              className="px-8 py-4 bg-transparent text-black dark:text-white text-lg font-bold border-2 border-black dark:border-white hover:bg-black/5 dark:hover:bg-white/5 transition-all"
            >
              {t('landing.cta.demo')}
            </button>
          </div>
        </main>
      </section>

      {/* FEATURES */}
      <section id="features" className="w-full max-w-6xl mx-auto py-32 px-6 border-t border-black/5 dark:border-white/5">
         <div className="text-center mb-20">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-black dark:text-white uppercase">{t('landing.features.title')}</h2>
            <div className="h-1 w-20 bg-black dark:bg-white mx-auto mt-6"></div>
         </div>
         <div className="grid md:grid-cols-3 gap-8">
            <div className="p-8 border border-black dark:border-white hover:bg-black/5 dark:hover:bg-white/5 transition-all group">
               <div className="text-black dark:text-white group-hover:scale-110 transition-transform origin-left duration-300"><IconAnalysis /></div>
               <h3 className="text-xl font-bold mb-3 text-black dark:text-white">{t('landing.features.realtime.title')}</h3>
               <p className="text-black/60 dark:text-white/60 leading-relaxed">{t('landing.features.realtime.desc')}</p>
            </div>
            <div className="p-8 border border-black dark:border-white hover:bg-black/5 dark:hover:bg-white/5 transition-all group">
               <div className="text-black dark:text-white group-hover:scale-110 transition-transform origin-left duration-300"><IconContext /></div>
               <h3 className="text-xl font-bold mb-3 text-black dark:text-white">{t('landing.features.context.title')}</h3>
               <p className="text-black/60 dark:text-white/60 leading-relaxed">{t('landing.features.context.desc')}</p>
            </div>
            <div className="p-8 border border-black dark:border-white hover:bg-black/5 dark:hover:bg-white/5 transition-all group">
               <div className="text-black dark:text-white group-hover:scale-110 transition-transform origin-left duration-300"><IconVersions /></div>
               <h3 className="text-xl font-bold mb-3 text-black dark:text-white">{t('landing.features.versions.title')}</h3>
               <p className="text-black/60 dark:text-white/60 leading-relaxed">{t('landing.features.versions.desc')}</p>
            </div>
         </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="w-full max-w-6xl mx-auto py-32 px-6 border-t border-black/5 dark:border-white/5">
        <div className="text-center mb-20">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-black dark:text-white uppercase">{t('landing.pricing.title')}</h2>
            <div className="h-1 w-20 bg-black dark:bg-white mx-auto mt-6"></div>
         </div>
         <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free Plan */}
            <div className="p-10 border border-black dark:border-white flex flex-col bg-white dark:bg-[#111]">
               <h3 className="text-2xl font-bold text-black dark:text-white mb-2">{t('landing.pricing.free.title')}</h3>
               <div className="text-5xl font-bold my-6 text-black dark:text-white">{t('landing.pricing.free.price')} <span className="text-lg font-normal text-black/40 dark:text-white/40">{t('landing.pricing.free.period')}</span></div>
               <p className="text-black/60 dark:text-white/60 mb-8">{t('landing.pricing.free.desc')}</p>
               <ul className="space-y-4 mb-10 flex-1">
                  <li className="flex items-center gap-3 text-sm text-black dark:text-white"><div className="w-1.5 h-1.5 bg-black dark:bg-white rounded-full"></div>{t('landing.pricing.free.feat1')}</li>
                  <li className="flex items-center gap-3 text-sm text-black dark:text-white"><div className="w-1.5 h-1.5 bg-black dark:bg-white rounded-full"></div>{t('landing.pricing.free.feat2')}</li>
                  <li className="flex items-center gap-3 text-sm text-black dark:text-white"><div className="w-1.5 h-1.5 bg-black dark:bg-white rounded-full"></div>{t('landing.pricing.free.feat3')}</li>
               </ul>
               <button onClick={onStart} className="w-full py-4 border border-black dark:border-white text-black dark:text-white font-bold hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors uppercase tracking-widest text-sm">
                 {t('landing.pricing.btn')}
               </button>
            </div>

            {/* Pro Plan */}
            <div className="p-10 border-2 border-black dark:border-white flex flex-col relative line-art-shadow bg-white dark:bg-[#111]">
               <div className="absolute top-0 right-0 bg-black dark:bg-white text-white dark:text-black text-[10px] font-bold px-3 py-1 uppercase tracking-widest">Recommended</div>
               <h3 className="text-2xl font-bold text-black dark:text-white mb-2">{t('landing.pricing.pro.title')}</h3>
               <div className="text-5xl font-bold my-6 text-black dark:text-white">{t('landing.pricing.pro.price')} <span className="text-lg font-normal text-black/40 dark:text-white/40">{t('landing.pricing.pro.period')}</span></div>
               <p className="text-black/60 dark:text-white/60 mb-8">{t('landing.pricing.pro.desc')}</p>
               <ul className="space-y-4 mb-10 flex-1">
                  <li className="flex items-center gap-3 text-sm text-black dark:text-white"><div className="w-1.5 h-1.5 bg-black dark:bg-white rounded-full"></div>{t('landing.pricing.pro.feat1')}</li>
                  <li className="flex items-center gap-3 text-sm text-black dark:text-white"><div className="w-1.5 h-1.5 bg-black dark:bg-white rounded-full"></div>{t('landing.pricing.pro.feat2')}</li>
                  <li className="flex items-center gap-3 text-sm text-black dark:text-white"><div className="w-1.5 h-1.5 bg-black dark:bg-white rounded-full"></div>{t('landing.pricing.pro.feat3')}</li>
               </ul>
               <button className="w-full py-4 bg-black dark:bg-white text-white dark:text-black font-bold hover:opacity-90 transition-opacity uppercase tracking-widest text-sm">
                 {t('landing.pricing.btn')}
               </button>
            </div>
         </div>
      </section>

      {/* ABOUT */}
      <section id="about" className="w-full max-w-4xl mx-auto py-32 px-6 border-t border-black/5 dark:border-white/5 text-center">
         <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-black dark:text-white uppercase mb-12">{t('landing.about.title')}</h2>
         <p className="text-xl md:text-2xl leading-relaxed font-light text-black/80 dark:text-white/80">
            "{t('landing.about.desc')}"
         </p>
         <div className="mt-16 flex justify-center">
            <Logo className="w-16 h-16 text-black dark:text-white opacity-20" />
         </div>
      </section>

      <footer className="w-full p-8 flex justify-center text-[10px] text-black/40 dark:text-white/40 uppercase tracking-[0.2em] border-t border-black/5 dark:border-white/5 bg-white dark:bg-[#0a0a0a]">
        {t('landing.footer')}
      </footer>
    </div>
  );
};
