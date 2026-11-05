/** @type {import('tailwindcss').Config} */
export default {
  // Hover styles only on real mice, so a tapped answer doesn't leave the next one looking selected on phones.
  future: { hoverOnlyWhenSupported: true },
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        pep: {
          navy: '#1c2b45',
          panel: '#33507a',
          gold: '#e3a72b',
          'gold-dark': '#c98f17',
          ink: '#17202e',
          muted: '#5a6577',
          line: '#dbe1ea',
          ok: '#1f7a4d',
          err: '#b4322a',
        },
      },
      fontFamily: {
        body: ['"Public Sans"', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        display: ['"Bricolage Grotesque"', '"Arial Narrow"', 'Arial', 'sans-serif'],
        logo: ['Ubuntu', '"Segoe UI"', 'Roboto', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
