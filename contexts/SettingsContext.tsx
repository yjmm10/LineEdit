
import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'en' | 'zh';
export type Theme = 'light' | 'dark';

// --- Translations ---
const translations = {
  en: {
    'app.title': 'LINEEDIT AI',
    'landing.tagline': 'Revolutionize Your Writing',
    'landing.headline': 'Precise Edits.',
    'landing.subhead': 'AI Powered.',
    'landing.desc': 'The minimalist editor that transforms your drafts into masterpieces. Real-time suggestions, version snapshots, and intelligent document analysis.',
    'landing.cta.launch': 'Launch Editor',
    'landing.cta.demo': 'View Demo',
    'landing.nav.features': 'Features',
    'landing.nav.pricing': 'Pricing',
    'landing.nav.about': 'About',
    'landing.footer': 'Designed for thinkers · Built with precision · © 2024 LineEdit',
    
    // Features Section
    'landing.features.title': 'Core Capabilities',
    'landing.features.realtime.title': 'Real-time Analysis',
    'landing.features.realtime.desc': 'Instant feedback on grammar, style, and tone as you type, powered by advanced LLMs.',
    'landing.features.context.title': 'Context Aware',
    'landing.features.context.desc': 'Understanding the nuance of your entire document, not just isolated sentences.',
    'landing.features.versions.title': 'Version Snapshots',
    'landing.features.versions.desc': 'Never lose a good idea. Save local snapshots and compare diffs visually.',

    // Pricing Section
    'landing.pricing.title': 'Simple Pricing',
    'landing.pricing.free.title': 'Starter',
    'landing.pricing.free.price': '$0',
    'landing.pricing.free.period': '/ mo',
    'landing.pricing.free.desc': 'Essential tools for casual writing.',
    'landing.pricing.free.feat1': 'Basic Grammar Check',
    'landing.pricing.free.feat2': '5 Documents',
    'landing.pricing.free.feat3': 'Standard Speed',
    'landing.pricing.pro.title': 'Professional',
    'landing.pricing.pro.price': '$12',
    'landing.pricing.pro.period': '/ mo',
    'landing.pricing.pro.desc': 'Advanced models for serious editors.',
    'landing.pricing.pro.feat1': 'Deep Style Analysis',
    'landing.pricing.pro.feat2': 'Unlimited Documents',
    'landing.pricing.pro.feat3': 'Priority Processing',
    'landing.pricing.btn': 'Choose Plan',

    // About Section
    'landing.about.title': 'Our Philosophy',
    'landing.about.desc': 'We believe that tools should be invisible. LineEdit is designed to strip away the clutter of modern word processors, leaving you with nothing but your thoughts and an intelligent assistant that knows when to speak and when to listen.',

    'sidebar.newDoc': '+ NEW DOCUMENT',
    'sidebar.files': 'Files',
    'sidebar.snapshots': 'Snapshots',
    'sidebar.user': 'John Doe',
    'sidebar.plan': 'FREE PLAN',

    'editor.lines': 'LINES',
    'editor.words': 'WORDS',
    'editor.mode.edit': 'EDIT',
    'editor.mode.review': 'REVIEW',
    'editor.btn.snapshot': 'SNAPSHOT',
    'editor.mode.editorLabel': 'Editor Mode',
    'editor.mode.originalLabel': 'Original Text',
    'editor.view.changes': 'Changes Only',
    'editor.view.preview': 'Full Preview',
    'editor.btn.copy': 'COPY',
    'editor.empty.title': 'No Active Suggestions',
    'editor.empty.desc': 'Run the AI to see improvements here.',
    'editor.card.analysis': 'Analysis',
    'editor.card.diff': 'Text Diff',
    'editor.btn.accept': 'Accept',
    'editor.btn.reject': 'Reject',
    'editor.btn.retry': 'Retry',
    'editor.input.placeholder': "Type '/' for commands or ask AI...",
    'editor.input.selection': 'Instructions for selection...',
    'editor.target.selection': 'Targeting Selection',
    'editor.btn.run': 'Run AI',
    'editor.btn.thinking': 'Thinking...',
    'editor.menu.commands': 'Commands',

    'strategy.preserve': 'Preserve',
    'strategy.refine': 'Refine',
    'strategy.elevate': 'Elevate',
    'strategy.preserve.desc': 'Minimal Changes',
    'strategy.refine.desc': 'Balanced Editing',
    'strategy.elevate.desc': 'Rewrite & Polish',

    'cmd.polish.label': 'Polish / Improve',
    'cmd.polish.desc': 'Enhance writing quality',
    'cmd.grammar.label': 'Fix Grammar',
    'cmd.grammar.desc': 'Strict corrections only',
    'cmd.en.label': 'Translate to English',
    'cmd.en.desc': 'Language conversion',
    'cmd.zh.label': 'Translate to Chinese',
    'cmd.zh.desc': 'Language conversion',
    'cmd.concise.label': 'Make Concise',
    'cmd.concise.desc': 'Shorten content',
    'cmd.md.label': 'To Markdown',
    'cmd.md.desc': 'Format conversion',
    'cmd.expand.label': 'Expand / Elaborate',
    'cmd.expand.desc': 'Add depth',
  },
  zh: {
    'app.title': 'LINEEDIT AI',
    'landing.tagline': '彻底改变你的写作体验',
    'landing.headline': '精准修订。',
    'landing.subhead': 'AI 驱动。',
    'landing.desc': '极简主义编辑器，将草稿转化为杰作。实时建议、版本快照和智能文档分析。',
    'landing.cta.launch': '启动编辑器',
    'landing.cta.demo': '观看演示',
    'landing.nav.features': '功能',
    'landing.nav.pricing': '定价',
    'landing.nav.about': '关于',
    'landing.footer': '为思考者设计 · 精工细作 · © 2024 LineEdit',
    
    // Features Section
    'landing.features.title': '核心能力',
    'landing.features.realtime.title': '实时分析',
    'landing.features.realtime.desc': '输入时即可获得关于语法、风格和语气的即时反馈，由先进的大模型驱动。',
    'landing.features.context.title': '上下文感知',
    'landing.features.context.desc': '理解整篇文档的细微差别，而不仅仅是孤立的句子。',
    'landing.features.versions.title': '版本快照',
    'landing.features.versions.desc': '永远不会丢失好点子。保存本地快照并直观地比较差异。',

    // Pricing Section
    'landing.pricing.title': '简单定价',
    'landing.pricing.free.title': '入门版',
    'landing.pricing.free.price': '¥0',
    'landing.pricing.free.period': '/ 月',
    'landing.pricing.free.desc': '日常写作的基本工具。',
    'landing.pricing.free.feat1': '基础语法检查',
    'landing.pricing.free.feat2': '5 个文档限制',
    'landing.pricing.free.feat3': '标准响应速度',
    'landing.pricing.pro.title': '专业版',
    'landing.pricing.pro.price': '¥88',
    'landing.pricing.pro.period': '/ 月',
    'landing.pricing.pro.desc': '专业编辑的高级模型。',
    'landing.pricing.pro.feat1': '深度风格分析',
    'landing.pricing.pro.feat2': '无限文档数量',
    'landing.pricing.pro.feat3': '优先处理通道',
    'landing.pricing.btn': '选择方案',

    // About Section
    'landing.about.title': '我们的哲学',
    'landing.about.desc': '我们相信工具应该是隐形的。LineEdit 旨在剥离现代文字处理器的杂乱，只留下你的思想和一个知道何时说话、何时倾听的智能助手。',

    'sidebar.newDoc': '+ 新建文档',
    'sidebar.files': '文件列表',
    'sidebar.snapshots': '历史快照',
    'sidebar.user': '张三',
    'sidebar.plan': '免费计划',

    'editor.lines': '行',
    'editor.words': '字',
    'editor.mode.edit': '编辑',
    'editor.mode.review': '审阅',
    'editor.btn.snapshot': '快照',
    'editor.mode.editorLabel': '编辑模式',
    'editor.mode.originalLabel': '原文',
    'editor.view.changes': '仅显示更改',
    'editor.view.preview': '全文预览',
    'editor.btn.copy': '复制',
    'editor.empty.title': '暂无修改建议',
    'editor.empty.desc': '运行 AI 以在此处查看改进。',
    'editor.card.analysis': '分析',
    'editor.card.diff': '文本对比',
    'editor.btn.accept': '接受',
    'editor.btn.reject': '拒绝',
    'editor.btn.retry': '重试',
    'editor.input.placeholder': "输入 '/' 查看命令或直接提问...",
    'editor.input.selection': '针对选中文本的指令...',
    'editor.target.selection': '目标选区',
    'editor.btn.run': '运行 AI',
    'editor.btn.thinking': '思考中...',
    'editor.menu.commands': '快捷指令',

    'strategy.preserve': '保守',
    'strategy.refine': '精炼',
    'strategy.elevate': '提升',
    'strategy.preserve.desc': '最小化更改',
    'strategy.refine.desc': '平衡编辑',
    'strategy.elevate.desc': '重写与润色',

    'cmd.polish.label': '润色 / 改进',
    'cmd.polish.desc': '提升写作质量',
    'cmd.grammar.label': '修复语法',
    'cmd.grammar.desc': '仅修正错误',
    'cmd.en.label': '翻译成英文',
    'cmd.en.desc': '语言转换',
    'cmd.zh.label': '翻译成中文',
    'cmd.zh.desc': '语言转换',
    'cmd.concise.label': '更简洁',
    'cmd.concise.desc': '缩短内容',
    'cmd.md.label': '转为 Markdown',
    'cmd.md.desc': '格式转换',
    'cmd.expand.label': '扩展 / 详细阐述',
    'cmd.expand.desc': '增加深度',
  }
};

interface SettingsContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  t: (key: keyof typeof translations.en) => string;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    return (localStorage.getItem('lineedit_lang') as Language) || 'en';
  });
  
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('lineedit_theme') as Theme) || 'light';
  });

  useEffect(() => {
    localStorage.setItem('lineedit_lang', language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem('lineedit_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const t = (key: keyof typeof translations.en): string => {
    return translations[language][key] || key;
  };

  return (
    <SettingsContext.Provider value={{ language, setLanguage, theme, setTheme, t }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within a SettingsProvider');
  return context;
};
