import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0a0a0f',
        panel: '#13131a',
        border: '#26262e',
        accent: '#00d4ff',
        accent2: '#ff00aa',
        muted: '#6b6b75',
      },
      backgroundImage: {
        'arc-glow': 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(0, 212, 255, 0.18), transparent 70%)',
        'arc-gradient': 'linear-gradient(135deg, #00d4ff 0%, #00ffaa 50%, #ff00aa 100%)',
      },
    },
  },
  plugins: [],
};
export default config;
