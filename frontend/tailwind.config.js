/** @type {import('tailwindcss').Config} */
module.exports = {
  // A seção 'content' é a mais importante
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // Isso diz para olhar todos os arquivos .js dentro da pasta src e suas subpastas
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}