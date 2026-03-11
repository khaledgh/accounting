import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from '@/App'
import '@/index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 1, refetchOnWindowFocus: false },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <BrowserRouter>
          <App />
          <Toaster position="bottom-right" toastOptions={{
            duration: 3000,
            style: { borderRadius: '12px', background: '#1e293b', color: '#f8fafc', fontSize: '14px' },
          }} />
        </BrowserRouter>
      </HelmetProvider>
    </QueryClientProvider>
  </StrictMode>,
)
