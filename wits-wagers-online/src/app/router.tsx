// Router setup for the app
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Lobby from './pages/Lobby';
import Round from './pages/Round';

const AppRouter = () => (
  <Router>
    <Routes>
      <Route path='/' element={<Home />} />
      <Route path='/lobby' element={<Lobby />} />
      <Route path='/round' element={<Round />} />
    </Routes>
  </Router>
);

export default AppRouter;
