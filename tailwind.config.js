module.exports = {
  content: ["./views/**/*.ejs", "./src/**/*.js"],
  theme: {
    extend: {
      colors: {
        primary: '#16C784',
        secondary: '#0B3B2E',
        accent: '#0E9F6E',
        'bg-main': '#0B0D0E',
        'bg-surface': '#0F1113',
        'bg-card': '#141618',
        'text-main': '#E6E7EA',
        'text-meta': '#A1A6AD'
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Sora', 'sans-serif']
      },
      boxShadow: {
        soft: '0 10px 30px rgba(0,0,0,0.35)',
        glow: '0 0 0 1px rgba(22,199,132,0.35), 0 12px 40px rgba(22,199,132,0.12)'
      },
      borderRadius: {
        xl: '16px',
        '2xl': '24px'
      }
    }
  },
  plugins: []
};
