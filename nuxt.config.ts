export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  ssr: true,
  app: {
    head: {
      htmlAttrs: { lang: 'es' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' }
      ],
      link: [
        { rel: 'stylesheet', href: 'https://stackpath.bootstrapcdn.com/bootstrap/4.5.0/css/bootstrap.min.css' },
        { rel: 'stylesheet', href: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap' },
        { rel: 'stylesheet', href: '/css/styles.css' },
        { rel: 'manifest', href: '/site.webmanifest' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }
      ],
      script: [
        { src: 'https://code.jquery.com/jquery-3.5.1.min.js', tagPosition: 'bodyClose' },
        { src: 'https://stackpath.bootstrapcdn.com/bootstrap/4.5.0/js/bootstrap.bundle.min.js', tagPosition: 'bodyClose' },
        { src: 'https://cdn.jsdelivr.net/npm/sweetalert2@10', tagPosition: 'bodyClose' }
      ]
    }
  },
  nitro: {
    port: 2345
  },
  runtimeConfig: {
    dbHost: process.env.DB_HOST || 'localhost',
    dbUser: process.env.DB_USER || 'root',
    dbPass: process.env.DB_PASSWORD || 'Nicole10*',
    dbName: process.env.DB_NAME || 'casitaiedis',
    openaiApiKey: process.env.OPENAI_API_KEY,
    googleClientEmail: process.env.GOOGLE_CLIENT_EMAIL,
    googlePrivateKey: process.env.GOOGLE_PRIVATE_KEY
  }
});