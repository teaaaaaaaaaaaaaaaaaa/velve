export default function App() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      background: 'linear-gradient(135deg, #F6F8ED 0%, #9DD3E4 50%, #CBDA63 100%)',
    }}>
      <h1 style={{
        fontFamily: 'Ballet, cursive',
        fontSize: '5rem',
        color: '#431A43',
        marginBottom: '1rem',
        lineHeight: 1,
      }}>
        Velve
      </h1>
      <p style={{
        fontFamily: 'Inter, sans-serif',
        fontWeight: 300,
        fontSize: '1.1rem',
        color: '#2B2A2B',
        opacity: 0.7,
        marginBottom: '3rem',
      }}>
        Razmeni garderobu. Otkrij stil.
      </p>
      <div style={{
        background: 'rgba(67, 26, 67, 0.9)',
        color: '#F6F8ED',
        padding: '0.75rem 2rem',
        borderRadius: '999px',
        fontFamily: 'Inter, sans-serif',
        fontSize: '0.9rem',
        letterSpacing: '0.05em',
      }}>
        Uskoro — Beograd
      </div>
    </div>
  )
}
