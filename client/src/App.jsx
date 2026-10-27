import { Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import RequireAuth from './components/RequireAuth';
import Home from './pages/Home';
import Search from './pages/Search';
import PropertyDetail from './pages/PropertyDetail';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import PropertyForm from './pages/PropertyForm';
import Enquiries from './pages/Enquiries';
import EnquiryThread from './pages/EnquiryThread';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import { PROVIDER_ROLES } from './utils/format';

export default function App() {
  return (
    <>
      <Navbar />
      <main className="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/properties" element={<Search />} />
          <Route path="/properties/:id" element={<PropertyDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/post-property" element={<RequireAuth roles={PROVIDER_ROLES}><PropertyForm /></RequireAuth>} />
          <Route path="/properties/:id/edit" element={<RequireAuth roles={PROVIDER_ROLES}><PropertyForm /></RequireAuth>} />
          <Route path="/enquiries" element={<RequireAuth><Enquiries /></RequireAuth>} />
          <Route path="/enquiries/:id" element={<RequireAuth><EnquiryThread /></RequireAuth>} />
          <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
          <Route path="/admin" element={<RequireAuth roles={['admin']}><Admin /></RequireAuth>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <footer className="footer">
        <div className="container footer-inner">
          <span>Real Estate Management System</span>
          <span>Software Project Management, Innovative Assignment 2026–27</span>
        </div>
      </footer>
    </>
  );
}

function NotFound() {
  return (
    <div className="container narrow empty">
      <h1>Page not found</h1>
      <p>The page you opened does not exist.</p>
      <a className="btn btn-primary" href="/">Go to home page</a>
    </div>
  );
}

