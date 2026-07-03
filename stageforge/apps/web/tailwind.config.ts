import type { Config } from 'tailwindcss';

/**
 * StageForge 设计系统 ——「Cinema Noir 暗房调色台」
 *
 * 策略：语义重映射。组件里既有的 slate/blue/emerald/red/amber 工具类
 * 不改一行，直接把色阶换成本设计语言的暖色版本：
 *   slate → 暖灰（纸感文字/边框）    blue → 香槟金（主色，颁奖季的金）
 *   emerald → 鼠尾草绿（成功）      red → 赤陶红（危险）
 *   amber → 琥珀（警示）           white → 暖纸白
 * 好处：全站一次性换血、绝无漏网的旧蓝色。
 */

const gold = {
  50: '#fbf5e9',
  100: '#f7ecd4',
  200: '#f0dcae',
  300: '#e7c887',
  400: '#dcb160',
  500: '#cf9a42',
  600: '#b07c2e',
  700: '#8a5f24',
  800: '#5e401a',
  900: '#3f2b13',
  950: '#2a1c0c',
};

const warmGray = {
  50: '#faf8f4',
  100: '#f1ede5',
  200: '#e4ddd0',
  300: '#c8bfae',
  400: '#a39987',
  500: '#7d7466',
  600: '#575046',
  700: '#3b352d',
  800: '#282721',
  900: '#1b1a16',
  950: '#12110e',
};

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        white: '#f6f1e7', // 暖纸白 —— 全站"白"统一带纸感
        slate: warmGray,
        blue: gold,
        emerald: {
          300: '#b9cfa6',
          400: '#94b47c',
          500: '#75985f',
          600: '#5a7a48',
          900: '#26331d',
        },
        red: {
          300: '#e8b0a0',
          400: '#d98a72',
          500: '#c4664b',
          600: '#a44d36',
          900: '#3f1d14',
        },
        amber: {
          300: '#e8cf9a',
          400: '#d9b56e',
          900: '#3d2f14',
        },
        purple: {
          300: '#c5b3d6',
          900: '#332740',
        },
        ink: {
          950: '#0d0c0a',
          900: '#141310',
          850: '#181713',
          800: '#1f1d18',
          700: '#2b2820',
        },
      },
      fontFamily: {
        // 衬线做标题（片头字幕/编辑部气质），正文保持无衬线
        display: [
          '"Songti SC"',
          '"STSong"',
          '"Noto Serif SC"',
          '"Source Han Serif SC"',
          'Georgia',
          '"Times New Roman"',
          'serif',
        ],
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Consolas',
          'monospace',
        ],
      },
      boxShadow: {
        card: '0 1px 0 rgba(246,241,231,0.03) inset, 0 12px 32px rgba(0,0,0,0.45)',
        glow: '0 0 0 1px rgba(220,177,96,0.35), 0 8px 28px rgba(220,177,96,0.12)',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
        recBlink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.25' },
        },
      },
      animation: {
        'fade-up': 'fadeUp 0.5s ease-out both',
        shimmer: 'shimmer 1.6s linear infinite',
        rec: 'recBlink 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
