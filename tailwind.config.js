// /* eslint-disable @typescript-eslint/no-var-requires */
// const defaultTheme = require('tailwindcss/defaultTheme')
// const colors = require('tailwindcss/colors');
// const plugin = require('tailwindcss/plugin');

// // import { Config } from 'tailwindcss';

// const config = {
//   content: [
//     './node_modules/flowbite/**/*.js',
//     // './src/**/*.{js,ts,jsx,tsx}',
//     './src/pages/**/*.{ts,tsx}',
//     './src/components/**/*.{ts,tsx}',
//   ],
//   theme: {
//     container: {
//       center: true,
//       padding: "2rem",
//       screens: {
//         "2xl": "1400px",
//       },
//     },
//     extend: {
//       colors: {
//         gray: colors.gray,
//         transparent: "transparent",
//         current: "currentColor",
//         black: "#000",
//         white: "#fff",
//         slate: colors.slate,
//         neutral: colors.neutral,
//         stone: colors.stone,
//         red: colors.red,
//         orange: colors.orange,
//         amber: colors.amber,
//         yellow: colors.yellow,
//         lime: colors.lime,
//         green: colors.green,
//         emerald: colors.emerald,
//         teal: colors.teal,
//         cyan: colors.cyan,
//         sky: colors.sky,
//         blue: colors.blue,
//         indigo: colors.indigo,
//         violet: colors.violet,
//         purple: colors.purple,
//         fuchsia: colors.fuchsia,
//         pink: colors.pink,
//         rose: colors.rose,

//         border: "hsl(var(--border))",
//         input: "hsl(var(--input))",
//         ring: "hsl(var(--ring))",
//         background: "hsl(var(--background))",
//         foreground: "hsl(var(--foreground))",
//         primary: {
//           DEFAULT: "hsl(var(--primary))",
//           foreground: "hsl(var(--primary-foreground))",
//         },
//         secondary: {
//           DEFAULT: "hsl(var(--secondary))",
//           foreground: "hsl(var(--secondary-foreground))",
//         },
//         destructive: {
//           DEFAULT: "hsl(var(--destructive))",
//           foreground: "hsl(var(--destructive-foreground))",
//         },
//         muted: {
//           DEFAULT: "hsl(var(--muted))",
//           foreground: "hsl(var(--muted-foreground))",
//         },
//         accent: {
//           DEFAULT: "hsl(var(--accent))",
//           foreground: "hsl(var(--accent-foreground))",
//         },
//         popover: {
//           DEFAULT: "hsl(var(--popover))",
//           foreground: "hsl(var(--popover-foreground))",
//         },
//         card: {
//           DEFAULT: "hsl(var(--card))",
//           foreground: "hsl(var(--card-foreground))",
//         },
//       },
//       borderRadius: {
//         lg: `var(--radius)`,
//         md: `calc(var(--radius) - 2px)`,
//         sm: "calc(var(--radius) - 4px)",
//       },
//       fontFamily: {
//         sans: ['Inter', ...defaultTheme.fontFamily.sans],
//       },
//       keyframes: {
//         "accordion-down": {
//           from: { height: "0" },
//           to: { height: "var(--radix-accordion-content-height)" },
//         },
//         "accordion-up": {
//           from: { height: "var(--radix-accordion-content-height)" },
//           to: { height: "0" },
//         },
//       },
//       animation: {
//         "accordion-down": "accordion-down 0.2s ease-out",
//         "accordion-up": "accordion-up 0.2s ease-out",
//       },
//     },
//   },
//   darkMode: 'class',//class
//   plugins: [
//     require('@tailwindcss/forms'),
//     require('@tailwindcss/aspect-ratio'),
//     require('@tailwindcss/typography'),
//     require("tailwindcss-cmdk"),
//     plugin(function ({ addUtilities }: { addUtilities: any }) {
//       const newUtilities = {
//         '.fill-available': {
//           width: '-webkit-fill-available',
//         },
//       };

//       addUtilities(newUtilities, ['responsive', 'hover']);
//     }),
//     require("tailwindcss-animate")
//   ],
// };


// export default config