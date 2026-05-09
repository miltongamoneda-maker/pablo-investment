export const metadata = { title: 'Pablo Investment', description: 'Portfolio Tracker & AI Research' }
export default function RootLayout({ children }) {
  return (<html lang="es"><head><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,700;1,700&display=swap" rel="stylesheet"/></head><body style={{margin:0,padding:0,background:"#0a0a0f"}}>{children}</body></html>)
}
