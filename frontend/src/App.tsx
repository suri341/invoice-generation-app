import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import Customers from './pages/Customers'
import Parts from './pages/Parts'
import Invoices from './pages/Invoices'
import CreateInvoice from './pages/CreateInvoice'

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/parts" element={<Parts />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/invoices/create" element={<CreateInvoice />} />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App
