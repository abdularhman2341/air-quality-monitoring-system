import logo from '../assets/logo.svg'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import './Header.css'

function Header() {
  const { user, logout } = useAuth()

  return (
    <header className='header'>
      <div className='brand'>
        <img src={logo} alt="Gas Monitor logo" width="40" />
        <h1>Gas Monitor</h1>
        <p>MEASURE . MONITOR . BREATHE SAFER</p>
      </div>
      {user && (
        <>
          <nav className='nav'>
            <Link to="/">Dashboard</Link>
            <Link to="/add-sensor">Add Sensor</Link>
            <Link to="/history">History & Alerts</Link>
          </nav>
          <div className='user'>
            <span>{user.name}</span>
            <button onClick={logout}>Log Out</button>
          </div>
        </>
      )}
    </header>
  )
}

export default Header